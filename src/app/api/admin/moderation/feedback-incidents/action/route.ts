import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { createModerationNotificationMessage, getCurrentSeasonId, getModerationServiceClient, getModeratorAccessDebug, isModeratorUser, notifyModerationStageByEmail } from "@/lib/moderation";

const schema = z.object({
    activity_id: z.string().uuid(),
    user_id: z.string().uuid(),
    reason_code: z.string().min(1),
    action: z.enum(["warning", "suspend", "ignore"]),
    duration_days: z.number().int().min(1).max(30).optional(),
});

const FEEDBACK_REASON_LABELS: Record<string, string> = {
    feedback_bad_behavior: "mauvais comportement",
    feedback_late: "retard important",
    feedback_no_show: "absence / no-show",
    feedback_other: "description optionnelle",
};

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const allowed = await isModeratorUser(supabase, user);
        if (!allowed) {
            const debug = await getModeratorAccessDebug(supabase, user);
            return createErrorResponse("Accès admin refusé", 403, debug);
        }

        const payload = await req.json().catch(() => null);
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
            return createErrorResponse("Données invalides", 400, parsed.error.flatten().fieldErrors);
        }

        const { activity_id, user_id, reason_code, action } = parsed.data;
        const durationDays = parsed.data.duration_days || 7;
        const incidentKey = `${activity_id}::${user_id}::${reason_code}`;
        const reasonLabel = FEEDBACK_REASON_LABELS[String(reason_code || "").toLowerCase()] || "incident feedback";

        const { data: activity } = await db
            .from("activities")
            .select("id,start_time")
            .eq("id", activity_id)
            .maybeSingle();

        const seasonId = getCurrentSeasonId();
        const sourceActivitySeasonId = activity?.start_time
            ? getCurrentSeasonId(new Date(activity.start_time))
            : null;

        const { data: feedbackRows, error: feedbackError } = await db
            .from("activity_feedback")
            .select("id,tags")
            .eq("activity_id", activity_id)
            .eq("reviewed_user_id", user_id);

        if (feedbackError) return createErrorResponse("Impossible de vérifier l'incident feedback", 400, feedbackError.message);
        if (!feedbackRows || feedbackRows.length === 0) return createErrorResponse("Incident feedback introuvable", 404);

        const normalized = reason_code.toLowerCase();
        const hasMatchingReason = feedbackRows.some((row: { tags?: unknown[] | null }) => {
            const tags = Array.isArray(row?.tags) ? row.tags.map((t) => String(t || "").toLowerCase()) : [];
            if (normalized === "feedback_no_show") return tags.some((t: string) => t.includes("absent") || t.includes("no-show") || t.includes("faux plan"));
            if (normalized === "feedback_late") return tags.some((t: string) => t.includes("retard"));
            if (normalized === "feedback_bad_behavior") return tags.some((t: string) => t.includes("comportement"));
            if (normalized === "feedback_other") return tags.some((t: string) => t.includes("autre"));
            return true;
        });
        if (!hasMatchingReason) return createErrorResponse("Incident feedback introuvable pour ce motif", 404);

        const { data: currentStatus } = await db
            .from("moderation_user_status")
            .select("incident_count,moderation_level,chat_restricted_until,suspended_until")
            .eq("user_id", user_id)
            .eq("season_id", seasonId)
            .maybeSingle();

        const nowIso = new Date().toISOString();
        const untilIso = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

        const upsertStatus = async (patch: Record<string, unknown>) => {
            const payloadToUpsert = {
                user_id,
                season_id: seasonId,
                incident_count: Number(currentStatus?.incident_count || 0),
                moderation_level: String(currentStatus?.moderation_level || "none"),
                chat_restricted_until: currentStatus?.chat_restricted_until || null,
                suspended_until: currentStatus?.suspended_until || null,
                ...patch,
            };
            const { error } = await db.from("moderation_user_status").upsert(payloadToUpsert, { onConflict: "user_id,season_id" });
            if (error) throw new Error(`moderation_user_status_upsert_failed: ${error.message}`);
        };

        const insertActionLog = async (payloadToInsert: Record<string, unknown>) => {
            const { error } = await db.from("moderation_actions_log").insert(payloadToInsert);
            if (error) throw new Error(`moderation_actions_log_insert_failed: ${error.message}`);
        };

        let emailResult: { attempted: boolean; sent: boolean; error: string | null } | null = null;

        if (action === "warning") {
            await upsertStatus({
                moderation_level: ["chat_restricted", "suspended"].includes(String(currentStatus?.moderation_level || ""))
                    ? currentStatus?.moderation_level
                    : "warning",
                warning_sent_at: nowIso,
            });

            await insertActionLog({
                user_id,
                action_type: "manual_feedback_warning",
                reason: reason_code,
                related_activity_id: activity_id,
                season_id: seasonId,
                metadata: {
                    source: "feedback_incident",
                    moderator_id: user.id,
                    incident_key: incidentKey,
                    source_activity_season_id: sourceActivitySeasonId,
                },
            });

            await createModerationNotificationMessage(db as never, user_id, {
                title: "Avertissement",
                body: "Un avertissement a été enregistré suite à un incident remonté dans les feedbacks d’activité.",
                level: "warning",
                metadata: { source: "feedback_incident", moderator_id: user.id, activity_id, reason_code },
                eventKey: `feedback_warning:${activity_id}:${user_id}:${reason_code}`,
            });

            emailResult = await notifyModerationStageByEmail(db as never, user_id, "warning", {
                context: "feedback",
                reasonLabel,
            });
        }

        if (action === "suspend") {
            await upsertStatus({
                moderation_level: "suspended",
                chat_restricted_until: untilIso,
                suspended_until: untilIso,
            });

            await insertActionLog({
                user_id,
                action_type: "manual_suspension",
                reason: reason_code,
                related_activity_id: activity_id,
                season_id: seasonId,
                metadata: {
                    source: "feedback_incident",
                    moderator_id: user.id,
                    duration_days: durationDays,
                    incident_key: incidentKey,
                    source_activity_season_id: sourceActivitySeasonId,
                },
            });

            await createModerationNotificationMessage(db as never, user_id, {
                title: "Suspension temporaire",
                body: `Certaines fonctionnalités de votre compte sont suspendues pendant ${durationDays} jours.`,
                level: "suspension",
                metadata: { source: "feedback_incident", moderator_id: user.id, activity_id, reason_code, duration_days: durationDays, until: untilIso },
                eventKey: `feedback_suspend:${activity_id}:${user_id}:${reason_code}:${durationDays}`,
            });

            emailResult = await notifyModerationStageByEmail(db as never, user_id, "temporary_suspension", { durationDays });
        }

        if (action === "ignore") {
            await insertActionLog({
                user_id,
                action_type: "manual_feedback_ignored",
                reason: reason_code,
                related_activity_id: activity_id,
                season_id: seasonId,
                metadata: {
                    source: "feedback_incident",
                    moderator_id: user.id,
                    incident_key: incidentKey,
                    resolved: true,
                    resolution: "ignored",
                    source_activity_season_id: sourceActivitySeasonId,
                },
            });
        }

        const { data: refreshedStatus } = await db
            .from("moderation_user_status")
            .select("incident_count,moderation_level,chat_restricted_until,suspended_until")
            .eq("user_id", user_id)
            .eq("season_id", seasonId)
            .maybeSingle();

        return createSuccessResponse({
            applied: true,
            action,
            user_id,
            activity_id,
            reason_code,
            duration_days: action === "suspend" ? durationDays : null,
            moderation_status: refreshedStatus || null,
            season_id: seasonId,
            email: emailResult,
        }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}
