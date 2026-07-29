import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import { isSoloCompletedWithoutPeers } from "@/lib/activity-rules";

const FEEDBACK_OPEN_DELAY_MS = 2 * 60 * 60 * 1000;
const FEEDBACK_WINDOW_MS = 4 * 60 * 60 * 1000;

export const PULSE_REASONS = {
    PARTICIPATION_COMPLETED: { code: "participation_completed", label: "Participation activité complétée", points: 10 },
    CREATOR_COMPLETED: { code: "creator_completed", label: "Activité organisée et complétée", points: 12 },
    SOLO_COMPLETED_CAPPED: { code: "solo_completed_capped", label: "Activité solo complétée", points: 5 },
    FEEDBACK_SUBMITTED: { code: "feedback_submitted", label: "Feedback envoyé", points: 1 },
    PRESENCE_CONFIRMED: { code: "presence_confirmed", label: "Présence confirmée sans incident", points: 3 },
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

type SummaryBreakdownLine = {
    reason_code: string;
    reason_label: string;
    signed_points: number;
    claim_state?: "pending" | "applied";
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
    return Math.ceil(participantCount * 0.5);
}

export async function recordPulseTransaction(
    _supabase: SupabaseClient,
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
    const db = createServiceRoleClient();
    if (!db) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante pour ecrire les transactions Pulse.");
    }
    const signedPoints = input.points;
    const direction = signedPoints >= 0 ? "credit" : "debit";
    const absPoints = Math.abs(signedPoints);

    const { error } = await db.rpc("record_pulse_transaction", {
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

function pushRewardLine(
    rewardLinesByUser: Map<string, SummaryBreakdownLine[]>,
    userId: string,
    reason: PulseReason
) {
    const rows = rewardLinesByUser.get(userId) || [];
    rows.push({
        reason_code: reason.code,
        reason_label: reason.label,
        signed_points: reason.points,
    });
    rewardLinesByUser.set(userId, rows);
}

async function buildPulseSummariesWithRewards(input: {
    supabase: SupabaseClient;
    activityId: string;
    memberIds: string[];
    targetMemberIds: string[];
    rewardLinesByUser: Map<string, SummaryBreakdownLine[]>;
}) {
    const { supabase, activityId, memberIds, targetMemberIds, rewardLinesByUser } = input;
    const { data: txRows } = await supabase
        .from("pulse_transactions")
        .select("user_id,signed_points,reason_code,reason_label,source_type")
        .eq("activity_id", activityId)
        .in("user_id", memberIds);

    const summaries = [];
    for (const userId of targetMemberIds) {
        const appliedRows = (txRows || []).filter((r: any) => r.user_id === userId);
        const appliedBreakdown: SummaryBreakdownLine[] = appliedRows.map((row: any) => ({
            reason_code: row.reason_code,
            reason_label: row.reason_label,
            signed_points: Number(row.signed_points || 0),
            claim_state: "applied",
        }));
        const appliedTotal = appliedRows.reduce((sum: number, row: any) => sum + Number(row.signed_points || 0), 0);

        const rewardRows = rewardLinesByUser.get(userId) || [];
        const alreadyAppliedRewardReasonCodes = new Set(
            appliedRows
                .filter((row: any) =>
                    row?.source_type === "activity_reward"
                    || row?.source_type === "pulse_claim"
                )
                .map((row: any) => String(row.reason_code || ""))
                .filter(Boolean)
        );
        // Idempotency guard: never recreate a pending reward line if this reward was
        // already applied for the same activity/user.
        const pendingRewardRows = rewardRows.filter((row) => !alreadyAppliedRewardReasonCodes.has(row.reason_code));
        const rewardTotal = pendingRewardRows.reduce((sum, row) => sum + Number(row.signed_points || 0), 0);
        const netTotal = appliedTotal + rewardTotal;
        const shouldBeClaimable = netTotal > 0;

        if (shouldBeClaimable) {
            summaries.push({
                activity_id: activityId,
                user_id: userId,
                total_points: netTotal,
                breakdown: [
                    ...appliedBreakdown,
                    ...pendingRewardRows.map((row) => ({ ...row, claim_state: "pending" as const })),
                ],
            });
            continue;
        }

        for (const reward of pendingRewardRows) {
            await recordPulseTransaction(supabase, {
                userId,
                activityId,
                sourceType: "activity_reward",
                points: reward.signed_points,
                reasonCode: reward.reason_code,
                reasonLabel: reward.reason_label,
                uniqueEventKey: buildPulseEventKey(["activity", activityId, userId, "auto_apply_reward", reward.reason_code]),
            });
        }

        const { data: refreshedRows } = await supabase
            .from("pulse_transactions")
            .select("user_id,signed_points,reason_code,reason_label")
            .eq("activity_id", activityId)
            .eq("user_id", userId);

        const finalRows = refreshedRows || [];
        const finalTotal = finalRows.reduce((sum: number, row: any) => sum + Number(row.signed_points || 0), 0);
        const finalBreakdown: SummaryBreakdownLine[] = finalRows.map((row: any) => ({
            reason_code: row.reason_code,
            reason_label: row.reason_label,
            signed_points: Number(row.signed_points || 0),
            claim_state: "applied",
        }));

        summaries.push({
            activity_id: activityId,
            user_id: userId,
            total_points: finalTotal,
            breakdown: finalBreakdown,
        });
    }

    if (summaries.length > 0) {
        const { error: summaryUpsertErr } = await supabase
            .from("pulse_summaries")
            .upsert(summaries, { onConflict: "activity_id,user_id" });
        if (summaryUpsertErr) {
            throw new Error(summaryUpsertErr.message);
        }
    }
}

export async function tryFinalizeActivityPulse(
    supabase: SupabaseClient,
    activityId: string,
    options?: { scopeUserId?: string | null }
) {
    const { data: activity, error: actErr } = await supabase
        .from("activities")
        .select("id, creator_id, sport, start_time, status, pulse_finalized_at")
        .eq("id", activityId)
        .single();

    if (actErr || !activity) {
        throw new Error(actErr?.message || "Activity not found");
    }
    const alreadyFinalized = !!activity.pulse_finalized_at;
    const scopeUserId = typeof options?.scopeUserId === "string" && options.scopeUserId.trim().length > 0
        ? options.scopeUserId.trim()
        : null;

    const buildAppliedSummariesForMembers = async (memberIds: string[]) => {
        const { data: txRows, error: txErr } = await supabase
            .from("pulse_transactions")
            .select("user_id,signed_points,reason_code,reason_label")
            .eq("activity_id", activityId)
            .in("user_id", memberIds);

        if (txErr) {
            throw new Error(txErr.message);
        }

        return memberIds.map((userId) => {
            const rows = (txRows || []).filter((r: any) => r.user_id === userId);
            const total = rows.reduce((sum: number, row: any) => sum + Number(row.signed_points || 0), 0);
            const breakdown: SummaryBreakdownLine[] = rows.map((row: any) => ({
                reason_code: row.reason_code,
                reason_label: row.reason_label,
                signed_points: Number(row.signed_points || 0),
                claim_state: "applied",
            }));
            return {
                activity_id: activityId,
                user_id: userId,
                total_points: total,
                breakdown,
            };
        });
    };

    if (activity.status === "annulé") {
        const memberIds = await loadActivityMemberIds(supabase, activityId, activity.creator_id);
        const { data: existingRows } = await supabase
            .from("pulse_summaries")
            .select("user_id")
            .eq("activity_id", activityId);
        const existingSummaryUserIds = new Set((existingRows || []).map((row: any) => row.user_id).filter(Boolean));
        let targetMemberIds = alreadyFinalized
            ? memberIds.filter((id) => !existingSummaryUserIds.has(id))
            : memberIds;
        if (scopeUserId) {
            if (!memberIds.includes(scopeUserId)) {
                return { finalized: false, reason: "scope_user_not_member" as const };
            }
            targetMemberIds = targetMemberIds.filter((id) => id === scopeUserId);
        }

        const cancelledSummaries = await buildAppliedSummariesForMembers(targetMemberIds);
        if (cancelledSummaries.length > 0) {
            const { error: upsertCancelledSummaryErr } = await supabase
                .from("pulse_summaries")
                .upsert(cancelledSummaries, { onConflict: "activity_id,user_id" });
            if (upsertCancelledSummaryErr) {
                throw new Error(upsertCancelledSummaryErr.message);
            }
        }

        // In scoped mode (non service-role), never mark activity as globally finalized
        // because only one user's summary might have been processed.
        if (!alreadyFinalized && !scopeUserId) {
            const { error: finalizeCancelledErr } = await supabase
                .from("activities")
                .update({ pulse_finalized_at: new Date().toISOString() })
                .eq("id", activityId)
                .is("pulse_finalized_at", null);

            if (finalizeCancelledErr) {
                throw new Error(finalizeCancelledErr.message);
            }
        }

        return {
            finalized: !alreadyFinalized && !scopeUserId,
            reason: alreadyFinalized
                ? "repaired_cancelled_missing_summary" as const
                : "cancelled_no_pulse" as const,
        };
    }

    const { openAtMs, closeAtMs } = getFeedbackWindow(activity.start_time);
    const nowMs = Date.now();
    if (nowMs < openAtMs) {
        return { finalized: false, reason: "feedback_not_open" as const };
    }

    const memberIds = await loadActivityMemberIds(supabase, activityId, activity.creator_id);
    const { data: existingSummaryRows } = await supabase
        .from("pulse_summaries")
        .select("user_id")
        .eq("activity_id", activityId);
    const existingSummaryUserIds = new Set((existingSummaryRows || []).map((row: any) => row.user_id).filter(Boolean));
    let targetMemberIds = alreadyFinalized
        ? memberIds.filter((id) => !existingSummaryUserIds.has(id))
        : memberIds;
    if (scopeUserId) {
        if (!memberIds.includes(scopeUserId)) {
            return { finalized: false, reason: "scope_user_not_member" as const };
        }
        targetMemberIds = targetMemberIds.filter((id) => id === scopeUserId);
    }

    if (targetMemberIds.length === 0) {
        return { finalized: false, reason: "already_finalized" as const };
    }

    const isSoloCompletedAlone = isSoloCompletedWithoutPeers({
        sport: activity.sport,
        attendees: memberIds.length,
    });
    const rewardLinesByUser = new Map<string, SummaryBreakdownLine[]>();
    if (isSoloCompletedAlone) {
        const creatorId = String(activity.creator_id || "");
        if (creatorId) {
            pushRewardLine(rewardLinesByUser, creatorId, PULSE_REASONS.SOLO_COMPLETED_CAPPED);
        }
        console.info("[PULSE] finalized solo activity with capped reward", { activity_id: activityId, member_count: memberIds.length });
    }

    const expectedFeedbackCount = memberIds.length;

    const { data: globalFeedbackRows } = await supabase
        .from("activity_feedback")
        .select("reviewer_id,rating,pulse_score")
        .eq("activity_id", activityId)
        .is("reviewed_user_id", null);

    const reviewerIds = new Set((globalFeedbackRows || []).map((row: any) => row.reviewer_id).filter(Boolean));
    const creatorId = activity.creator_id as string;
    const participantIds = memberIds.filter((id) => id !== creatorId);

    // Immediate finalization rules:
    // - standard: every member answered (creator + participants)
    // - group-safe fallback: all participants answered (creator optional)
    const allMembersDoneEarly = expectedFeedbackCount > 0 && memberIds.every((id) => reviewerIds.has(id));
    const allParticipantsDoneEarly = participantIds.length > 0 && participantIds.every((id) => reviewerIds.has(id));
    const allDoneEarly = allMembersDoneEarly || allParticipantsDoneEarly;
    const windowClosed = nowMs >= closeAtMs;

    if (!isSoloCompletedAlone && !allDoneEarly && !windowClosed) {
        return { finalized: false, reason: "waiting_feedback" as const };
    }

    if (!isSoloCompletedAlone) {
        for (const participantId of participantIds) {
            pushRewardLine(rewardLinesByUser, participantId, PULSE_REASONS.PARTICIPATION_COMPLETED);
            pushRewardLine(rewardLinesByUser, participantId, PULSE_REASONS.PRESENCE_CONFIRMED);
        }

        pushRewardLine(rewardLinesByUser, creatorId, PULSE_REASONS.CREATOR_COMPLETED);
        pushRewardLine(rewardLinesByUser, creatorId, PULSE_REASONS.PRESENCE_CONFIRMED);

        for (const reviewerId of reviewerIds) {
            if (memberIds.includes(reviewerId)) {
                pushRewardLine(rewardLinesByUser, reviewerId, PULSE_REASONS.FEEDBACK_SUBMITTED);
            }
        }
    }

    await buildPulseSummariesWithRewards({
        supabase,
        activityId,
        memberIds,
        targetMemberIds,
        rewardLinesByUser,
    });

    // In scoped mode (non service-role), never mark activity as globally finalized
    // because only one user's summary might have been processed.
    if (!alreadyFinalized && !scopeUserId) {
        const { error: finalizeErr } = await supabase
            .from("activities")
            .update({ pulse_finalized_at: new Date().toISOString() })
            .eq("id", activityId)
            .is("pulse_finalized_at", null);

        if (finalizeErr) {
            throw new Error(finalizeErr.message);
        }
    }

    if (alreadyFinalized) {
        return { finalized: false, reason: "repaired_missing_summaries" as const };
    }
    if (scopeUserId) {
        return { finalized: false, reason: "scoped_summary_rebuilt" as const };
    }
    if (isSoloCompletedAlone) {
        return { finalized: true, reason: "solo_completed_capped" as const };
    }
    return { finalized: true, reason: allDoneEarly ? "all_feedback_done" as const : "window_closed" as const };
}

export function createServiceRoleClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY
        || process.env.SUPABASE_SERVICE_KEY
        || process.env.SUPABASE_SERVICE_ROLE
        || "";
    if (!url || !key) return null;
    return createSupabaseClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

export async function loadPulseTotalsByUserIds(
    userIds: string[],
    client?: SupabaseClient | null
) {
    const normalizedUserIds = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));
    const totalsByUserId = new Map<string, number>();

    for (const userId of normalizedUserIds) {
        totalsByUserId.set(userId, 0);
    }

    if (normalizedUserIds.length === 0) {
        return totalsByUserId;
    }

    const supabase = client ?? createServiceRoleClient();
    if (!supabase) {
        return totalsByUserId;
    }

    const { data, error } = await supabase
        .from("pulse_transactions")
        .select("user_id,signed_points")
        .in("user_id", normalizedUserIds);

    if (error) {
        throw new Error(error.message);
    }

    for (const row of data || []) {
        const userId = String(row.user_id || "");
        if (!userId) continue;
        totalsByUserId.set(userId, (totalsByUserId.get(userId) || 0) + Number(row.signed_points || 0));
    }

    return totalsByUserId;
}
