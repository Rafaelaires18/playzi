import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getCurrentSeasonId, getModerationServiceClient, getModeratorAccessDebug, isModeratorUser, resolveUserEmailsForAdmin } from "@/lib/moderation";
import { getChatReportReasonFilterCodes, isChatReportReasonCode, resolveChatReportReason } from "@/lib/chat-report-reasons";

type ReportRow = {
    id: string;
    activity_id: string;
    reporter_user_id: string;
    reported_user_id: string;
    report_reason_code: string;
    report_reason_label: string;
    report_text: string | null;
    status: string;
    season_id: string;
    created_at: string;
    validated_at: string | null;
    validated_group_key: string | null;
};

type ProfileRow = { id: string; pseudo: string | null };
type ActivityRow = { id: string; sport: string | null; start_time: string | null; location: string | null; creator_id: string | null };
type ParticipationRow = { activity_id: string; user_id: string | null; status: string };
type StatusRow = {
    user_id: string;
    season_id: string;
    incident_count: number;
    moderation_level: string;
    chat_restricted_until: string | null;
    suspended_until: string | null;
};
type ActionLogRow = { user_id: string; action_type: string };
type StalePendingRow = {
    id: string;
    activity_id: string;
    reported_user_id: string;
    report_reason_code: string;
    reporter_user_id: string;
};

function groupKeyFromReport(row: ReportRow) {
    return `${row.activity_id}::${row.reported_user_id}::${row.report_reason_code}`;
}

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const { data: { user }, error: authErr } = await supabase.auth.getUser();

        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const allowed = await isModeratorUser(supabase, user);
        if (!allowed) {
            const debug = await getModeratorAccessDebug(supabase as never, user as never);
            return createErrorResponse("Accès admin refusé", 403, {
                ...debug,
                help: "Mettre profiles.grade à admin/moderator/moderation/mod, ou configurer MODERATION_ADMIN_EMAILS / MODERATION_ADMIN_USER_IDS.",
            });
        }

        const { searchParams } = new URL(req.url);
        const seasonId = searchParams.get("season_id")?.trim() || null;
        const reasonCode = searchParams.get("reason_code");
        const status = searchParams.get("status");
        const reportedUserId = searchParams.get("reported_user_id");
        const search = searchParams.get("search")?.trim().toLowerCase();

        // Cleanup auto: pending isolé (1 seul vote) > 24h => suppression.
        const staleBeforeIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: stalePending } = await db
            .from("moderation_chat_reports")
            .select("id,activity_id,reported_user_id,report_reason_code,reporter_user_id,status,created_at")
            .eq("status", "pending")
            .lt("created_at", staleBeforeIso)
            .limit(2000);

        if (Array.isArray(stalePending) && stalePending.length > 0) {
            const staleRows = stalePending as StalePendingRow[];
            const staleByGroup = new Map<string, { ids: string[]; reporters: Set<string> }>();
            for (const row of staleRows) {
                const key = `${row.activity_id}::${row.reported_user_id}::${row.report_reason_code}`;
                const bucket = staleByGroup.get(key) || { ids: [], reporters: new Set<string>() };
                const id = row.id;
                const reporterId = row.reporter_user_id;
                if (id) bucket.ids.push(id);
                if (reporterId) bucket.reporters.add(reporterId);
                staleByGroup.set(key, bucket);
            }
            const idsToDelete: string[] = [];
            for (const bucket of staleByGroup.values()) {
                if (bucket.reporters.size === 1) idsToDelete.push(...bucket.ids);
            }
            if (idsToDelete.length > 0) {
                await db.from("moderation_chat_reports").delete().in("id", idsToDelete);
            }
        }

        let query = db
            .from("moderation_chat_reports")
            .select("id,activity_id,reporter_user_id,reported_user_id,report_reason_code,report_reason_label,report_text,status,season_id,created_at,validated_at,validated_group_key")
            .order("created_at", { ascending: false })
            .limit(500);

        if (seasonId) query = query.eq("season_id", seasonId);
        if (status) query = query.eq("status", status);
        if (reportedUserId) query = query.eq("reported_user_id", reportedUserId);

        const normalizedReasonFilter = reasonCode && isChatReportReasonCode(reasonCode.trim()) ? reasonCode.trim() : null;
        const dbReasonFilterCodes = normalizedReasonFilter ? getChatReportReasonFilterCodes(normalizedReasonFilter) : [];
        if (dbReasonFilterCodes.length > 0) {
            query = query.in("report_reason_code", dbReasonFilterCodes);
        }

        const { data: reports, error: reportsError } = await query;
        if (reportsError) return createErrorResponse("Impossible de charger les reports", 400, reportsError.message);

        const typedReports = (reports || []) as ReportRow[];
        const userIds = Array.from(new Set(typedReports.flatMap((r) => [r.reporter_user_id, r.reported_user_id]).filter(Boolean)));
        const activityIds = Array.from(new Set(typedReports.map((r) => r.activity_id).filter(Boolean)));
        const effectiveSeasonId = seasonId || getCurrentSeasonId();

        const [profilesRes, activitiesRes, participationsRes, statusesRes, actionLogsRes] = await Promise.all([
            userIds.length > 0
                ? db.from("profiles").select("id,pseudo").in("id", userIds)
                : Promise.resolve({ data: [] as ProfileRow[] }),
            activityIds.length > 0
                ? db.from("activities").select("id,sport,start_time,location,creator_id").in("id", activityIds)
                : Promise.resolve({ data: [] as ActivityRow[] }),
            activityIds.length > 0
                ? db.from("participations").select("activity_id,user_id,status").in("activity_id", activityIds).eq("status", "confirmé")
                : Promise.resolve({ data: [] as ParticipationRow[] }),
            userIds.length > 0
                ? (
                    seasonId
                        ? db.from("moderation_user_status").select("user_id,season_id,incident_count,moderation_level,chat_restricted_until,suspended_until").eq("season_id", seasonId).in("user_id", userIds)
                        : db.from("moderation_user_status").select("user_id,season_id,incident_count,moderation_level,chat_restricted_until,suspended_until").in("user_id", userIds)
                )
                : Promise.resolve({ data: [] as StatusRow[] }),
            userIds.length > 0
                ? db
                    .from("moderation_actions_log")
                    .select("user_id,action_type")
                    .eq("season_id", effectiveSeasonId)
                    .in("user_id", userIds)
                    .in("action_type", ["manual_warn_1", "manual_warn_2", "manual_feedback_warning"])
                : Promise.resolve({ data: [] as ActionLogRow[] }),
        ]);

        const profiles = (profilesRes.data || []) as ProfileRow[];
        const activities = (activitiesRes.data || []) as ActivityRow[];
        const participations = (participationsRes.data || []) as ParticipationRow[];
        const statuses = (statusesRes.data || []) as StatusRow[];
        const actionLogs = (actionLogsRes.data || []) as ActionLogRow[];

        const profileById = new Map(profiles.map((p) => [p.id, p]));
        const emailById = await resolveUserEmailsForAdmin(db as never, userIds);
        const activityById = new Map(activities.map((a) => [a.id, a]));
        const statusByUser = new Map(statuses.map((s) => [s.user_id, s]));

        const participantsByActivity = new Map<string, Set<string>>();
        for (const activity of activities) {
            const set = new Set<string>();
            if (activity.creator_id) set.add(activity.creator_id);
            participantsByActivity.set(activity.id, set);
        }
        for (const row of participations) {
            if (!row.user_id) continue;
            const set = participantsByActivity.get(row.activity_id) || new Set<string>();
            set.add(row.user_id);
            participantsByActivity.set(row.activity_id, set);
        }

        const warnsCountByUser = new Map<string, number>();
        for (const row of actionLogs) {
            if (!row.user_id) continue;
            warnsCountByUser.set(row.user_id, (warnsCountByUser.get(row.user_id) || 0) + 1);
        }

        const commentsByGroup = new Map<string, Array<{ reporter_id: string; reporter_pseudo: string; text: string }>>();
        for (const report of typedReports) {
            const text = String(report.report_text || "").trim();
            if (!text) continue;
            const key = groupKeyFromReport(report);
            const list = commentsByGroup.get(key) || [];
            list.push({
                reporter_id: report.reporter_user_id,
                reporter_pseudo: profileById.get(report.reporter_user_id)?.pseudo || "Utilisateur",
                text,
            });
            commentsByGroup.set(key, list);
        }

        console.info("[CHAT_REPORT_DEBUG][admin_reports][fetched]", {
            season_id: seasonId || getCurrentSeasonId(),
            requested_reason_code: reasonCode || null,
            db_reason_filter_codes: dbReasonFilterCodes,
            rows_count: typedReports.length,
            reason_codes: Array.from(new Set(typedReports.map((row) => String(row.report_reason_code || "")).filter(Boolean))),
        });

        const rows = typedReports.map((r) => {
            const reported = profileById.get(r.reported_user_id);
            const reporter = profileById.get(r.reporter_user_id);
            const activity = activityById.get(r.activity_id);
            const modStatus = statusByUser.get(r.reported_user_id);
            const comments = commentsByGroup.get(groupKeyFromReport(r)) || [];
            const individualText = String(r.report_text || "").trim() || null;
            const participantsCount = participantsByActivity.get(r.activity_id)?.size || 0;

            const normalizedReason = resolveChatReportReason(`${r.report_reason_label || ""} ${r.report_reason_code || ""}`);
            return {
                id: r.id,
                created_at: r.created_at,
                season_id: r.season_id,
                status: r.status,
                reason_code: normalizedReason.code,
                reason_label: normalizedReason.label,
                report_text: individualText,
                all_group_comments: comments,
                validated_at: r.validated_at,
                reporter: { id: r.reporter_user_id, pseudo: reporter?.pseudo || "Utilisateur", email: emailById.get(r.reporter_user_id) || null },
                reported: { id: r.reported_user_id, pseudo: reported?.pseudo || "Utilisateur", email: emailById.get(r.reported_user_id) || null },
                activity: {
                    id: r.activity_id,
                    sport: activity?.sport || "Activité",
                    start_time: activity?.start_time || null,
                    location: activity?.location || null,
                    participants_count: participantsCount,
                },
                moderation_status: modStatus || null,
                warns_count: warnsCountByUser.get(r.reported_user_id) || 0,
            };
        });

        const filteredRows = search
            ? rows.filter((row) =>
                String(row.reported.pseudo || "").toLowerCase().includes(search)
                || String(row.reporter.pseudo || "").toLowerCase().includes(search)
                || String(row.reported.email || "").toLowerCase().includes(search)
                || String(row.reporter.email || "").toLowerCase().includes(search)
            )
            : rows;

        return createSuccessResponse({ rows: filteredRows, season_id: seasonId || getCurrentSeasonId() }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}
