import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getCurrentSeasonId, getModerationServiceClient, getModeratorAccessDebug, isModeratorUser, resolveUserEmailsForAdmin } from "@/lib/moderation";
import { normalizeReason } from "@/lib/reporting";

type FeedbackReason = {
    code: string;
    label: string;
};

function mapFeedbackReason(raw: string): FeedbackReason {
    const normalized = normalizeReason(raw);
    if (normalized.includes("absence") || normalized.includes("no-show") || normalized.includes("faux plan")) {
        return { code: "feedback_no_show", label: "Absence / no-show" };
    }
    if (normalized.includes("retard")) {
        return { code: "feedback_late", label: "Retard important" };
    }
    if (normalized.includes("mauvais comportement") || normalized.includes("comportement")) {
        return { code: "feedback_bad_behavior", label: "Mauvais comportement" };
    }
    if (normalized.includes("autre")) {
        return { code: "feedback_other", label: "Description (optionnel)" };
    }
    return { code: "feedback_problem", label: "Problème" };
}

function getFeedbackIncidentThreshold(participantsCount: number) {
    if (participantsCount <= 2) return null;
    if (participantsCount === 4) return 3;
    return Math.ceil(participantsCount * 0.5);
}

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const { data: { user }, error: authErr } = await supabase.auth.getUser();

        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const allowed = await isModeratorUser(supabase, user);
        if (!allowed) {
            const debug = await getModeratorAccessDebug(supabase as any, user as any);
            return createErrorResponse("Accès admin refusé", 403, debug);
        }

        const searchParams = req.nextUrl.searchParams;
        const statusFilter = (searchParams.get("status") || "all").trim().toLowerCase();
        const reasonFilter = (searchParams.get("reason_code") || "all").trim().toLowerCase();
        const search = (searchParams.get("search") || "").trim().toLowerCase();

        const { data: targetedRows, error: targetedError } = await db
            .from("activity_feedback")
            .select("activity_id,reviewer_id,reviewed_user_id,tags,scored_at")
            .not("reviewed_user_id", "is", null)
            .order("scored_at", { ascending: false })
            .limit(5000);

        if (targetedError) {
            return createErrorResponse("Impossible de charger les incidents feedback", 400, targetedError.message);
        }

        const groups = new Map<string, {
            key: string;
            activity_id: string;
            reported_user_id: string;
            reason_code: string;
            reason_label: string;
            reviewer_ids: Set<string>;
            last_scored_at: string | null;
        }>();

        for (const row of targetedRows || []) {
            const activityId = String((row as any).activity_id || "");
            const reviewerId = String((row as any).reviewer_id || "");
            const reviewedUserId = String((row as any).reviewed_user_id || "");
            const tags = Array.isArray((row as any).tags) ? (row as any).tags : [];
            const rawReason = String(tags[0] || "");
            if (!activityId || !reviewerId || !reviewedUserId || !rawReason) continue;
            const mapped = mapFeedbackReason(rawReason);
            const key = `${activityId}::${reviewedUserId}::${mapped.code}`;

            const existing = groups.get(key);
            if (existing) {
                existing.reviewer_ids.add(reviewerId);
                const scoredAt = (row as any).scored_at ? String((row as any).scored_at) : null;
                if (scoredAt && (!existing.last_scored_at || scoredAt > existing.last_scored_at)) {
                    existing.last_scored_at = scoredAt;
                }
            } else {
                groups.set(key, {
                    key,
                    activity_id: activityId,
                    reported_user_id: reviewedUserId,
                    reason_code: mapped.code,
                    reason_label: mapped.label,
                    reviewer_ids: new Set([reviewerId]),
                    last_scored_at: (row as any).scored_at ? String((row as any).scored_at) : null,
                });
            }
        }

        const grouped = Array.from(groups.values());
        if (grouped.length === 0) {
            return createSuccessResponse({ rows: [] }, 200);
        }

        const activityIds = Array.from(new Set(grouped.map((g) => g.activity_id)));
        const reportedUserIds = Array.from(new Set(grouped.map((g) => g.reported_user_id)));
        const allReviewerIds = Array.from(
            new Set(grouped.flatMap((g) => Array.from(g.reviewer_ids)))
        );

        const [activitiesRes, participationsRes, profilesRes, commentsRes, statusesRes, actionLogsRes] = await Promise.all([
            db.from("activities").select("id,creator_id,sport,start_time,location").in("id", activityIds),
            db.from("participations").select("activity_id,user_id,status").in("activity_id", activityIds).eq("status", "confirmé"),
            db.from("profiles").select("id,pseudo").in("id", Array.from(new Set([...reportedUserIds, ...allReviewerIds]))),
            db
                .from("activity_feedback")
                .select("activity_id,reviewer_id,comment")
                .in("activity_id", activityIds)
                .is("reviewed_user_id", null)
                .not("comment", "is", null),
            db
                .from("moderation_user_status")
                .select("user_id,season_id,incident_count,moderation_level,chat_restricted_until,suspended_until")
                .in("user_id", reportedUserIds),
            db
                .from("moderation_actions_log")
                .select("user_id,reason,related_activity_id,action_type,metadata")
                .in("user_id", reportedUserIds)
                .in("related_activity_id", activityIds)
                .in("action_type", ["manual_feedback_warning", "manual_suspension", "manual_feedback_ignored"]),
        ]);

        const activities = activitiesRes.data || [];
        const participations = participationsRes.data || [];
        const profiles = profilesRes.data || [];
        const commentsRows = commentsRes.data || [];
        const statuses = statusesRes.data || [];
        const actionLogs = actionLogsRes.data || [];

        const activityById = new Map((activities || []).map((a: any) => [a.id, a]));
        const pseudoById = new Map((profiles || []).map((p: any) => [p.id, p.pseudo || "Utilisateur"]));
        const emailById = await resolveUserEmailsForAdmin(db as never, reportedUserIds);
        const statusByUser = new Map((statuses || []).map((s: any) => [s.user_id, s]));

        const participantsByActivity = new Map<string, Set<string>>();
        for (const activity of activities || []) {
            const set = new Set<string>();
            if ((activity as any).creator_id) set.add(String((activity as any).creator_id));
            participantsByActivity.set(String((activity as any).id), set);
        }
        for (const row of participations || []) {
            const activityId = String((row as any).activity_id || "");
            const userId = String((row as any).user_id || "");
            if (!activityId || !userId) continue;
            const set = participantsByActivity.get(activityId) || new Set<string>();
            set.add(userId);
            participantsByActivity.set(activityId, set);
        }

        const commentByActivityReviewer = new Map<string, string>();
        for (const row of commentsRows || []) {
            const activityId = String((row as any).activity_id || "");
            const reviewerId = String((row as any).reviewer_id || "");
            const comment = String((row as any).comment || "").trim();
            if (!activityId || !reviewerId || !comment) continue;
            commentByActivityReviewer.set(`${activityId}::${reviewerId}`, comment);
        }

        const resolvedIncidentKeys = new Set<string>();
        for (const row of actionLogs || []) {
            const metadata = (row as any)?.metadata || null;
            const fromMetadata = metadata && typeof metadata === "object" ? String((metadata as Record<string, unknown>).incident_key || "") : "";
            const fallbackKey = `${String((row as any)?.related_activity_id || "")}::${String((row as any)?.user_id || "")}::${String((row as any)?.reason || "")}`;
            const key = fromMetadata || fallbackKey;
            if (key && !key.includes("::")) continue;
            if (key) resolvedIncidentKeys.add(key);
        }

        let rows = grouped.map((group) => {
            const activity = activityById.get(group.activity_id);
            const participantsCount = (participantsByActivity.get(group.activity_id)?.size) || 0;
            const threshold = getFeedbackIncidentThreshold(participantsCount);
            const votes = group.reviewer_ids.size;
            const validated = threshold !== null && votes >= threshold;
            const seasonId = activity?.start_time
                ? getCurrentSeasonId(new Date(activity.start_time))
                : getCurrentSeasonId();

            const otherTexts = group.reason_code === "feedback_other"
                ? Array.from(group.reviewer_ids)
                    .map((reviewerId) => {
                        const text = commentByActivityReviewer.get(`${group.activity_id}::${reviewerId}`) || "";
                        if (!text) return null;
                        return {
                            reporter_id: reviewerId,
                            reporter_pseudo: pseudoById.get(reviewerId) || "Utilisateur",
                            text,
                        };
                    })
                    .filter(Boolean)
                : [];

            return {
                id: group.key,
                activity_id: group.activity_id,
                reported_user_id: group.reported_user_id,
                reported_pseudo: pseudoById.get(group.reported_user_id) || "Utilisateur",
                reported_email: emailById.get(group.reported_user_id) || null,
                sport: activity?.sport || "Activité",
                location: activity?.location || null,
                activity_start_time: activity?.start_time || null,
                reason_code: group.reason_code,
                reason_label: group.reason_label,
                votes_count: votes,
                participants_count: participantsCount,
                threshold,
                status: validated ? "validated" : "informative",
                last_scored_at: group.last_scored_at,
                season_id: seasonId,
                other_texts: otherTexts,
                reviewer_ids: Array.from(group.reviewer_ids),
                moderation_status: statusByUser.get(group.reported_user_id) || null,
            };
        });

        rows = rows.filter((row) => !resolvedIncidentKeys.has(row.id));

        if (reasonFilter !== "all") rows = rows.filter((row) => row.reason_code === reasonFilter);
        if (statusFilter !== "all") rows = rows.filter((row) => row.status === statusFilter);
        if (search) {
            rows = rows.filter((row) =>
                row.reported_pseudo.toLowerCase().includes(search)
                || String(row.reported_email || "").toLowerCase().includes(search)
            );
        }

        rows.sort((a, b) => {
            const da = new Date(a.last_scored_at || a.activity_start_time || 0).getTime();
            const dbTime = new Date(b.last_scored_at || b.activity_start_time || 0).getTime();
            return dbTime - da;
        });

        return createSuccessResponse({ rows }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}
