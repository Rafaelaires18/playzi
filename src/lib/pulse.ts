import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

const FEEDBACK_OPEN_DELAY_MS = 2 * 60 * 60 * 1000;
const FEEDBACK_WINDOW_MS = 4 * 60 * 60 * 1000;

export const PULSE_REASONS = {
    PARTICIPATION_COMPLETED: { code: "participation_completed", label: "Participation activité complétée", points: 10 },
    CREATOR_COMPLETED: { code: "creator_completed", label: "Activité organisée et complétée", points: 12 },
    FEEDBACK_SUBMITTED: { code: "feedback_submitted", label: "Feedback envoyé", points: 1 },
    PRESENCE_CONFIRMED: { code: "presence_confirmed", label: "Présence confirmée sans incident", points: 3 },
    ORGANIZER_BONUS: { code: "organizer_bonus", label: "Bonus organisateur activité bien évaluée", points: 5 },
    NO_SHOW: { code: "no_show_confirmed", label: "No-show confirmé", points: -10 },
    LATE_30M: { code: "late_30m", label: "Retard important (>30min)", points: -5 },
    CHAT_SPAM: { code: "chat_spam", label: "Spam signalé", points: -5 },
    INAPPROPRIATE_BEHAVIOR: { code: "inappropriate_behavior", label: "Comportement inapproprié", points: -10 },
    HARASSMENT_INSULTS: { code: "harassment_insults", label: "Harcèlement / insultes", points: -12 },
} as const;

export type PulseReason = {
    code: string;
    label: string;
    points: number;
};

export function buildPulseEventKey(parts: string[]) {
    return parts.join(":");
}

export function mapFeedbackRatingToPulseScore(rating: number) {
    if (rating >= 4) return 2; // Super
    if (rating >= 2) return 1; // Ca va
    return -1; // Probleme
}

export function getFeedbackWindow(startIso: string) {
    const start = new Date(startIso).getTime();
    return {
        openAtMs: start + FEEDBACK_OPEN_DELAY_MS,
        closeAtMs: start + FEEDBACK_OPEN_DELAY_MS + FEEDBACK_WINDOW_MS,
    };
}

export function computeReportThreshold(participantCount: number) {
    return Math.max(3, Math.ceil(participantCount * 0.5));
}

export async function recordPulseTransaction(
    supabase: SupabaseClient,
    input: {
        userId: string;
        activityId?: string | null;
        sourceType: string;
        points: number;
        reasonCode: string;
        reasonLabel: string;
        uniqueEventKey: string;
        metadata?: Record<string, unknown>;
    }
) {
    const signedPoints = input.points;
    const direction = signedPoints >= 0 ? "credit" : "debit";
    const absPoints = Math.abs(signedPoints);

    const { error } = await supabase.rpc("record_pulse_transaction", {
        p_user_id: input.userId,
        p_activity_id: input.activityId ?? null,
        p_source_type: input.sourceType,
        p_direction: direction,
        p_points: absPoints,
        p_signed_points: signedPoints,
        p_reason_code: input.reasonCode,
        p_reason_label: input.reasonLabel,
        p_metadata: input.metadata ?? {},
        p_unique_event_key: input.uniqueEventKey,
    });

    if (error) {
        throw new Error(error.message);
    }
}

export async function loadActivityMemberIds(
    supabase: SupabaseClient,
    activityId: string,
    creatorId?: string | null
) {
    const { data: participations } = await supabase
        .from("participations")
        .select("user_id,status")
        .eq("activity_id", activityId)
        .eq("status", "confirmé");

    const ids = new Set<string>();
    if (creatorId) ids.add(creatorId);
    for (const p of participations || []) {
        if (p.user_id) ids.add(p.user_id);
    }
    return Array.from(ids);
}

export async function tryFinalizeActivityPulse(supabase: SupabaseClient, activityId: string) {
    const { data: activity, error: actErr } = await supabase
        .from("activities")
        .select("id, creator_id, start_time, status, pulse_finalized_at")
        .eq("id", activityId)
        .single();

    if (actErr || !activity) {
        throw new Error(actErr?.message || "Activity not found");
    }
    if (activity.pulse_finalized_at) {
        return { finalized: false, reason: "already_finalized" as const };
    }
    if (activity.status === "annulé") {
        await supabase
            .from("activities")
            .update({ pulse_finalized_at: new Date().toISOString() })
            .eq("id", activityId)
            .is("pulse_finalized_at", null);
        return { finalized: false, reason: "cancelled_no_pulse" as const };
    }

    const { openAtMs, closeAtMs } = getFeedbackWindow(activity.start_time);
    const nowMs = Date.now();
    if (nowMs < openAtMs) {
        return { finalized: false, reason: "feedback_not_open" as const };
    }

    const memberIds = await loadActivityMemberIds(supabase, activityId, activity.creator_id);
    const expectedFeedbackCount = memberIds.length;

    const { data: globalFeedbackRows } = await supabase
        .from("activity_feedback")
        .select("reviewer_id,rating,pulse_score")
        .eq("activity_id", activityId)
        .is("reviewed_user_id", null);

    const reviewerIds = new Set((globalFeedbackRows || []).map((row: any) => row.reviewer_id).filter(Boolean));
    const allDoneEarly = expectedFeedbackCount > 0 && reviewerIds.size >= expectedFeedbackCount;
    const windowClosed = nowMs >= closeAtMs;

    if (!allDoneEarly && !windowClosed) {
        return { finalized: false, reason: "waiting_feedback" as const };
    }

    const creatorId = activity.creator_id as string;
    const participantIds = memberIds.filter((id) => id !== creatorId);

    for (const participantId of participantIds) {
        await recordPulseTransaction(supabase, {
            userId: participantId,
            activityId,
            sourceType: "activity",
            points: PULSE_REASONS.PARTICIPATION_COMPLETED.points,
            reasonCode: PULSE_REASONS.PARTICIPATION_COMPLETED.code,
            reasonLabel: PULSE_REASONS.PARTICIPATION_COMPLETED.label,
            uniqueEventKey: buildPulseEventKey(["activity", activityId, participantId, "participation_completed"]),
        });

        await recordPulseTransaction(supabase, {
            userId: participantId,
            activityId,
            sourceType: "attendance",
            points: PULSE_REASONS.PRESENCE_CONFIRMED.points,
            reasonCode: PULSE_REASONS.PRESENCE_CONFIRMED.code,
            reasonLabel: PULSE_REASONS.PRESENCE_CONFIRMED.label,
            uniqueEventKey: buildPulseEventKey(["activity", activityId, participantId, "presence_confirmed"]),
        });
    }

    await recordPulseTransaction(supabase, {
        userId: creatorId,
        activityId,
        sourceType: "activity",
        points: PULSE_REASONS.CREATOR_COMPLETED.points,
        reasonCode: PULSE_REASONS.CREATOR_COMPLETED.code,
        reasonLabel: PULSE_REASONS.CREATOR_COMPLETED.label,
        uniqueEventKey: buildPulseEventKey(["activity", activityId, creatorId, "creator_completed"]),
    });

    const feedbackCount = (globalFeedbackRows || []).length;
    if (feedbackCount >= 2) {
        const totalScore = (globalFeedbackRows || []).reduce((sum: number, row: any) => {
            if (typeof row.pulse_score === "number") return sum + row.pulse_score;
            return sum + mapFeedbackRatingToPulseScore(Number(row.rating || 1));
        }, 0);
        const average = totalScore / feedbackCount;

        if (average > 0) {
            await recordPulseTransaction(supabase, {
                userId: creatorId,
                activityId,
                sourceType: "feedback_quality",
                points: PULSE_REASONS.ORGANIZER_BONUS.points,
                reasonCode: PULSE_REASONS.ORGANIZER_BONUS.code,
                reasonLabel: PULSE_REASONS.ORGANIZER_BONUS.label,
                uniqueEventKey: buildPulseEventKey(["activity", activityId, creatorId, "organizer_bonus"]),
                metadata: {
                    feedback_count: feedbackCount,
                    feedback_total_score: totalScore,
                    feedback_average: average,
                },
            });
        }
    }

    const { data: txRows } = await supabase
        .from("pulse_transactions")
        .select("user_id,signed_points,reason_code,reason_label")
        .eq("activity_id", activityId)
        .in("user_id", memberIds);

    const summaries = memberIds.map((userId) => {
        const rows = (txRows || []).filter((r: any) => r.user_id === userId);
        const total = rows.reduce((sum: number, row: any) => sum + Number(row.signed_points || 0), 0);
        const breakdown = rows.map((row: any) => ({
            reason_code: row.reason_code,
            reason_label: row.reason_label,
            signed_points: row.signed_points,
        }));
        return { activity_id: activityId, user_id: userId, total_points: total, breakdown };
    });

    if (summaries.length > 0) {
        await supabase.from("pulse_summaries").upsert(summaries, { onConflict: "activity_id,user_id" });
    }

    await supabase
        .from("activities")
        .update({ pulse_finalized_at: new Date().toISOString() })
        .eq("id", activityId)
        .is("pulse_finalized_at", null);

    return { finalized: true, reason: allDoneEarly ? "all_feedback_done" as const : "window_closed" as const };
}

export function createServiceRoleClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createSupabaseClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
