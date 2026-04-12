import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { createModerationNotificationMessage, getCurrentSeasonId, getModerationServiceClient, getModeratorAccessDebug, isModeratorUser, notifyModerationStageByEmail } from "@/lib/moderation";

const schema = z.object({
    report_id: z.string().uuid(),
    action: z.enum(["warn1", "warn2", "restrict_chat", "suspend", "ignore"]),
    duration_days: z.number().int().min(1).max(30).optional(),
    ignore_scope: z.enum(["single", "group"]).optional().default("single"),
});

export async function POST(req: NextRequest) {
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

        const payload = await req.json().catch(() => null);
        const parsed = schema.safeParse(payload);
        if (!parsed.success) {
            return createErrorResponse("Données invalides", 400, parsed.error.flatten().fieldErrors);
        }

        const { report_id, action, ignore_scope } = parsed.data;
        const durationDays = parsed.data.duration_days || 7;

        const { data: report, error: reportError } = await db
            .from("moderation_chat_reports")
            .select("id,activity_id,reported_user_id,report_reason_code,season_id,status")
            .eq("id", report_id)
            .maybeSingle();

        if (reportError) return createErrorResponse("Impossible de charger le report", 400, reportError.message);
        if (!report) return createErrorResponse("Report introuvable", 404);

        const seasonId = getCurrentSeasonId();
        const sourceReportSeasonId = String(report.season_id || "");
        const targetUserId = String(report.reported_user_id);
        const nowIso = new Date().toISOString();
        const untilIso = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

        const { data: warnLogs, error: warnLogsError } = await db
            .from("moderation_actions_log")
            .select("id,action_type")
            .eq("user_id", targetUserId)
            .eq("season_id", seasonId)
            .in("action_type", ["manual_warn_1", "manual_warn_2"]);
        if (warnLogsError) {
            return createErrorResponse("Impossible de charger l’historique de warnings", 400, warnLogsError.message);
        }
        const warnCountBefore = (warnLogs || []).length;

        const { data: currentStatus } = await db
            .from("moderation_user_status")
            .select("incident_count,moderation_level,chat_restricted_until,suspended_until")
            .eq("user_id", targetUserId)
            .eq("season_id", seasonId)
            .maybeSingle();

        const upsertStatus = async (patch: Record<string, unknown>) => {
            const payloadToUpsert = {
                user_id: targetUserId,
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

        const insertActionLog = async (payload: Record<string, unknown>) => {
            const { error } = await db.from("moderation_actions_log").insert(payload);
            if (error) throw new Error(`moderation_actions_log_insert_failed: ${error.message}`);
        };

        let emailResult: { attempted: boolean; sent: boolean; error: string | null } | null = null;

        if (action === "ignore") {
            if (String(report.status || "").toLowerCase() !== "pending") {
                return createErrorResponse("Seuls les signalements en attente peuvent être ignorés.", 409);
            }

            const { data: beforeStatus } = await db
                .from("moderation_user_status")
                .select("incident_count,moderation_level,chat_restricted_until,suspended_until")
                .eq("user_id", targetUserId)
                .eq("season_id", seasonId)
                .maybeSingle();

            let dismissedCount = 0;
            if (ignore_scope === "group") {
                const { data: dismissedRows, error: dismissError } = await db
                    .from("moderation_chat_reports")
                    .update({ status: "dismissed" })
                    .eq("activity_id", report.activity_id)
                    .eq("reported_user_id", report.reported_user_id)
                    .eq("report_reason_code", report.report_reason_code)
                    .eq("status", "pending")
                    .select("id");
                if (dismissError) return createErrorResponse("Impossible d’ignorer le report", 400, dismissError.message);
                dismissedCount = (dismissedRows || []).length;
            } else {
                const { data: dismissedRows, error: dismissError } = await db
                    .from("moderation_chat_reports")
                    .update({ status: "dismissed" })
                    .eq("id", report_id)
                    .select("id");
                if (dismissError) return createErrorResponse("Impossible d’ignorer le report", 400, dismissError.message);
                dismissedCount = (dismissedRows || []).length;
            }

            const { data: afterStatus } = await db
                .from("moderation_user_status")
                .select("incident_count,moderation_level,chat_restricted_until,suspended_until")
                .eq("user_id", targetUserId)
                .eq("season_id", seasonId)
                .maybeSingle();

            console.info("[CHAT_REPORT_DEBUG][admin_action][ignore]", {
                report_id,
                target_user_id: targetUserId,
                ignore_scope,
                dismissed_count: dismissedCount,
                status_before: beforeStatus || null,
                status_after: afterStatus || null,
                sanctions_changed: JSON.stringify(beforeStatus || null) !== JSON.stringify(afterStatus || null),
            });

            await insertActionLog({
                user_id: targetUserId,
                action_type: "manual_ignore_report",
                reason: report.report_reason_code || "manual_ignore",
                related_activity_id: report.activity_id,
                season_id: seasonId,
                metadata: {
                    report_id,
                    moderator_id: user.id,
                    ignore_scope,
                    dismissed_count: dismissedCount,
                    source_report_season_id: sourceReportSeasonId || null,
                },
            });

            return createSuccessResponse({
                report_id,
                action,
                ignore_scope,
                applied: true,
                dismissed_count: dismissedCount,
                warn_count_before: warnCountBefore,
                warn_count_after: warnCountBefore,
            }, 200);
        }

        if (action === "warn1" || action === "warn2") {
            const actionType = action === "warn1" ? "manual_warn_1" : "manual_warn_2";
            await upsertStatus({
                moderation_level: ["chat_restricted", "suspended"].includes(String(currentStatus?.moderation_level || ""))
                    ? currentStatus?.moderation_level
                    : "warning",
                warning_sent_at: nowIso,
            });

            await insertActionLog({
                user_id: targetUserId,
                action_type: actionType,
                reason: report.report_reason_code || "manual_warning",
                related_activity_id: report.activity_id,
                season_id: seasonId,
                metadata: {
                    report_id,
                    moderator_id: user.id,
                    warn_level: action === "warn1" ? 1 : 2,
                    source_report_season_id: sourceReportSeasonId || null,
                },
            });

            await createModerationNotificationMessage(db as never, targetUserId, {
                title: action === "warn1" ? "Avertissement (1/2)" : "Avertissement (2/2)",
                body: action === "warn1"
                    ? "Un avertissement a été enregistré sur votre compte."
                    : "Un deuxième avertissement a été enregistré sur votre compte.",
                level: "warning",
                metadata: { report_id, moderator_id: user.id, warn_level: action === "warn1" ? 1 : 2 },
                eventKey: `${action}:${report_id}`,
            });

            if (action === "warn2") {
                emailResult = await notifyModerationStageByEmail(db as never, targetUserId, "warning");
            }
        }

        if (action === "restrict_chat") {
            await upsertStatus({
                moderation_level: "chat_restricted",
                chat_restricted_until: untilIso,
            });

            await insertActionLog({
                user_id: targetUserId,
                action_type: "manual_chat_restriction",
                reason: report.report_reason_code || "manual_chat_restriction",
                related_activity_id: report.activity_id,
                season_id: seasonId,
                metadata: {
                    report_id,
                    moderator_id: user.id,
                    duration_days: durationDays,
                    source_report_season_id: sourceReportSeasonId || null,
                },
            });

            await createModerationNotificationMessage(db as never, targetUserId, {
                title: "Restriction chat",
                body: `Votre accès au chat est restreint pendant ${durationDays} jours.`,
                level: "restriction",
                metadata: { report_id, moderator_id: user.id, duration_days: durationDays, until: untilIso },
                eventKey: `restrict_chat:${report_id}:${durationDays}`,
            });

            emailResult = await notifyModerationStageByEmail(db as never, targetUserId, "chat_restriction", { durationDays });
        }

        if (action === "suspend") {
            await upsertStatus({
                moderation_level: "suspended",
                chat_restricted_until: untilIso,
                suspended_until: untilIso,
            });

            await insertActionLog({
                user_id: targetUserId,
                action_type: "manual_suspension",
                reason: report.report_reason_code || "manual_suspension",
                related_activity_id: report.activity_id,
                season_id: seasonId,
                metadata: {
                    report_id,
                    moderator_id: user.id,
                    duration_days: durationDays,
                    source_report_season_id: sourceReportSeasonId || null,
                },
            });

            await createModerationNotificationMessage(db as never, targetUserId, {
                title: "Suspension temporaire",
                body: `Certaines fonctionnalités de votre compte sont suspendues pendant ${durationDays} jours.`,
                level: "suspension",
                metadata: { report_id, moderator_id: user.id, duration_days: durationDays, until: untilIso },
                eventKey: `suspend:${report_id}:${durationDays}`,
            });

            emailResult = await notifyModerationStageByEmail(db as never, targetUserId, "temporary_suspension", { durationDays });
        }

        const { data: warnLogsAfter } = await db
            .from("moderation_actions_log")
            .select("id")
            .eq("user_id", targetUserId)
            .eq("season_id", seasonId)
            .in("action_type", ["manual_warn_1", "manual_warn_2"]);

        const { data: refreshedStatus } = await db
            .from("moderation_user_status")
            .select("incident_count,moderation_level,chat_restricted_until,suspended_until")
            .eq("user_id", targetUserId)
            .eq("season_id", seasonId)
            .maybeSingle();

        return createSuccessResponse({
            report_id,
            action,
            applied: true,
            duration_days: action === "restrict_chat" || action === "suspend" ? durationDays : null,
            warn_count_before: warnCountBefore,
            warn_count_after: (warnLogsAfter || []).length,
            moderation_status: refreshedStatus || null,
            season_id: seasonId,
            email: emailResult,
        }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}
