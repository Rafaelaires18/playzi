import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getCurrentSeasonId, getModerationServiceClient, getModeratorAccessDebug, isModeratorUser } from "@/lib/moderation";

type StatusRow = {
    user_id: string;
    season_id: string;
    incident_count: number;
    moderation_level: string;
    chat_restricted_until: string | null;
    suspended_until: string | null;
    updated_at: string | null;
};

type ActionLogRow = {
    id: string;
    user_id: string;
    action_type: string;
    created_at: string;
    season_id: string;
    related_activity_id: string | null;
};

type ProfileRow = { id: string; pseudo: string | null };
type ActivityRow = { id: string; sport: string | null; start_time: string | null; location: string | null; creator_id: string | null };
type ParticipationRow = { activity_id: string; user_id: string | null; status: string };

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const allowed = await isModeratorUser(supabase, user);
        if (!allowed) {
            const debug = await getModeratorAccessDebug(supabase as never, user as never);
            return createErrorResponse("Accès admin refusé", 403, debug);
        }

        const seasonId = req.nextUrl.searchParams.get("season_id")?.trim() || getCurrentSeasonId();
        const type = req.nextUrl.searchParams.get("type")?.trim() || "all";
        const nowIso = new Date().toISOString();

        let statusQuery = db
            .from("moderation_user_status")
            .select("user_id,season_id,incident_count,moderation_level,chat_restricted_until,suspended_until,updated_at")
            .eq("season_id", seasonId);

        if (type === "restrict") {
            statusQuery = statusQuery.gt("chat_restricted_until", nowIso);
        } else if (type === "suspend") {
            statusQuery = statusQuery.gt("suspended_until", nowIso);
        } else {
            statusQuery = statusQuery.or(`chat_restricted_until.gt.${nowIso},suspended_until.gt.${nowIso}`);
        }

        const [statusesRes, warnsRes, sanctionLogsRes] = await Promise.all([
            statusQuery,
            (type === "warn1" || type === "warn2" || type === "all")
                ? db
                    .from("moderation_actions_log")
                    .select("id,user_id,action_type,created_at,season_id,related_activity_id")
                    .eq("season_id", seasonId)
                    .in("action_type", ["manual_warn_1", "manual_warn_2", "manual_feedback_warning"])
                    .order("created_at", { ascending: false })
                    .limit(500)
                : Promise.resolve({ data: [] as ActionLogRow[], error: null }),
            db
                .from("moderation_actions_log")
                .select("user_id,action_type,related_activity_id,created_at")
                .eq("season_id", seasonId)
                .in("action_type", ["manual_chat_restriction", "manual_suspension"])
                .order("created_at", { ascending: false })
                .limit(1000),
        ]);

        if (statusesRes.error) return createErrorResponse("Impossible de charger les sanctions actives", 400, statusesRes.error.message);
        if (warnsRes.error) return createErrorResponse("Impossible de charger les warnings", 400, warnsRes.error.message);
        if (sanctionLogsRes.error) return createErrorResponse("Impossible de charger le contexte des sanctions", 400, sanctionLogsRes.error.message);

        const statusRows = (statusesRes.data || []) as StatusRow[];
        const warnRows = (warnsRes.data || []) as ActionLogRow[];
        const sanctionLogs = (sanctionLogsRes.data || []) as Array<{
            user_id: string;
            action_type: string;
            related_activity_id: string | null;
            created_at: string;
        }>;

        const userIds = Array.from(new Set([
            ...statusRows.map((s) => s.user_id),
            ...warnRows.map((w) => w.user_id),
            ...sanctionLogs.map((s) => s.user_id),
        ].filter(Boolean)));
        const activityIds = Array.from(new Set([
            ...warnRows.map((w) => w.related_activity_id),
            ...sanctionLogs.map((s) => s.related_activity_id),
        ].filter(Boolean))) as string[];

        const [profilesRes, activitiesRes, participationsRes] = await Promise.all([
            userIds.length > 0 ? db.from("profiles").select("id,pseudo").in("id", userIds) : Promise.resolve({ data: [] as ProfileRow[] }),
            activityIds.length > 0 ? db.from("activities").select("id,sport,start_time,location,creator_id").in("id", activityIds) : Promise.resolve({ data: [] as ActivityRow[] }),
            activityIds.length > 0 ? db.from("participations").select("activity_id,user_id,status").in("activity_id", activityIds).eq("status", "confirmé") : Promise.resolve({ data: [] as ParticipationRow[] }),
        ]);

        const profiles = (profilesRes.data || []) as ProfileRow[];
        const activities = (activitiesRes.data || []) as ActivityRow[];
        const participations = (participationsRes.data || []) as ParticipationRow[];

        const pseudoById = new Map(profiles.map((p) => [p.id, p.pseudo || "Utilisateur"]));
        const activityById = new Map(activities.map((a) => [a.id, a]));

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

        const latestSanctionActivityByUser = new Map<string, string>();
        for (const row of sanctionLogs) {
            if (!row.related_activity_id) continue;
            if (latestSanctionActivityByUser.has(row.user_id)) continue;
            latestSanctionActivityByUser.set(row.user_id, row.related_activity_id);
        }

        const activeSanctionsRaw = statusRows
            .filter((row) => {
                const hasRestrict = !!row.chat_restricted_until && new Date(row.chat_restricted_until).toISOString() > nowIso;
                const hasSuspend = !!row.suspended_until && new Date(row.suspended_until).toISOString() > nowIso;
                return hasRestrict || hasSuspend;
            })
            .flatMap((row) => {
                const linkedActivityId = latestSanctionActivityByUser.get(row.user_id) || null;
                const linkedActivity = linkedActivityId ? activityById.get(linkedActivityId) : null;
                const linkedParticipantsCount = linkedActivityId ? (participantsByActivity.get(linkedActivityId)?.size || 0) : 0;
                const hasRestrict = !!row.chat_restricted_until && new Date(row.chat_restricted_until).toISOString() > nowIso;
                const hasSuspend = !!row.suspended_until && new Date(row.suspended_until).toISOString() > nowIso;

                const result: Array<Record<string, unknown>> = [];
                // A suspension already includes chat restrictions; surface only suspension to avoid duplicated active sanctions.
                if (hasRestrict && !hasSuspend) {
                    result.push({
                        user_id: row.user_id,
                        pseudo: pseudoById.get(row.user_id) || "Utilisateur",
                        type: "restrict_chat",
                        start_at: row.updated_at || null,
                        end_at: row.chat_restricted_until,
                        season_id: row.season_id,
                        activity: linkedActivityId ? {
                            id: linkedActivityId,
                            sport: linkedActivity?.sport || "Activité",
                            start_time: linkedActivity?.start_time || null,
                            location: linkedActivity?.location || null,
                            participants_count: linkedParticipantsCount,
                        } : null,
                    });
                }
                if (hasSuspend) {
                    result.push({
                        user_id: row.user_id,
                        pseudo: pseudoById.get(row.user_id) || "Utilisateur",
                        type: "suspend",
                        start_at: row.updated_at || null,
                        end_at: row.suspended_until,
                        season_id: row.season_id,
                        activity: linkedActivityId ? {
                            id: linkedActivityId,
                            sport: linkedActivity?.sport || "Activité",
                            start_time: linkedActivity?.start_time || null,
                            location: linkedActivity?.location || null,
                            participants_count: linkedParticipantsCount,
                        } : null,
                    });
                }
                return result;
            });

        // Safety net: dedupe identical sanctions (same user + type + active window).
        const seenSanctions = new Set<string>();
        const activeSanctions = activeSanctionsRaw.filter((row) => {
            const key = `${String(row.user_id)}::${String(row.type)}::${String(row.end_at || "")}`;
            if (seenSanctions.has(key)) return false;
            seenSanctions.add(key);
            return true;
        });

        const warnings = warnRows.map((row) => {
            const linkedActivity = row.related_activity_id ? activityById.get(row.related_activity_id) : null;
            const linkedParticipantsCount = row.related_activity_id ? (participantsByActivity.get(row.related_activity_id)?.size || 0) : 0;
            return {
                id: row.id,
                user_id: row.user_id,
                pseudo: pseudoById.get(row.user_id) || "Utilisateur",
                type: row.action_type === "manual_warn_2" ? "warn2" : row.action_type === "manual_feedback_warning" ? "warn2" : "warn1",
                created_at: row.created_at,
                season_id: row.season_id,
                activity: row.related_activity_id ? {
                    id: row.related_activity_id,
                    sport: linkedActivity?.sport || "Activité",
                    start_time: linkedActivity?.start_time || null,
                    location: linkedActivity?.location || null,
                    participants_count: linkedParticipantsCount,
                } : null,
            };
        });

        let filteredWarnings = warnings;
        if (type === "warn1") filteredWarnings = warnings.filter((w) => w.type === "warn1");
        if (type === "warn2") filteredWarnings = warnings.filter((w) => w.type === "warn2");

        return createSuccessResponse({
            season_id: seasonId,
            active_sanctions: activeSanctions,
            warnings: filteredWarnings,
        }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}
