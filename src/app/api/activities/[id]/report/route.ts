import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { ReportingError, submitActivityReports } from "@/lib/reporting";
import { isChatReportReasonCode, resolveChatReportReason } from "@/lib/chat-report-reasons";

const reportSchema = z.object({
    type: z.enum(["problem"]).optional().default("problem"),
    reason: z.string().optional(),
    reason_code: z.string().optional(),
    description: z.string().optional(),
    reported_users: z.array(z.string().uuid()).min(1, "S\u00e9lectionnez au moins un participant")
}).refine((data) => {
    const rawReasonCode = String(data.reason_code || "").trim();
    const rawReason = String(data.reason || "").trim();
    return !!rawReason || (rawReasonCode.length > 0 && isChatReportReasonCode(rawReasonCode));
}, {
    message: "Le motif est requis.",
    path: ["reason_code"],
});

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return createErrorResponse("Vous devez \u00eatre connect\u00e9 pour effectuer un signalement.", 401);
        }

        const payload = await req.json();
        const validated = reportSchema.safeParse(payload);

        if (!validated.success) {
            return createErrorResponse("Donn\u00e9es invalides", 400, validated.error.flatten().fieldErrors);
        }

        const { type, reason, reason_code, description, reported_users } = validated.data;
        const rawReason = (reason_code && isChatReportReasonCode(reason_code.trim()))
            ? reason_code.trim()
            : String(reason || "").trim();
        const mappedReason = resolveChatReportReason(rawReason);
        console.info("[CHAT_REPORT_DEBUG][api][received]", {
            activity_id: params.id,
            reporter_user_id: user.id,
            reason_raw: rawReason,
            reason_code_normalized: mappedReason.code,
            reason_label_normalized: mappedReason.label,
            has_description: !!description?.trim(),
            reported_users_count: reported_users.length,
        });

        // Verify that the user is actually a part of this activity (or creator)
        const { data: activityList, error: actErr } = await supabase
            .from("activities")
            .select("creator_id, start_time, participations(user_id,status)")
            .eq("id", params.id);

        if (actErr || !activityList || activityList.length === 0) {
            return createErrorResponse("Activit\u00e9 introuvable.", 404);
        }

        const activity = activityList[0];
        const isCreator = activity.creator_id === user.id;
        const participations = Array.isArray(activity.participations)
            ? (activity.participations as Array<{ user_id?: string | null; status?: string | null }>)
            : [];
        const isParticipant = participations.some((p) => p.user_id === user.id);

        if (!isCreator && !isParticipant) {
            return createErrorResponse("Vous n'avez pas acc\u00e8s \u00e0 cette activit\u00e9.", 403);
        }

        const outcome = await submitActivityReports({
            supabase,
            activityId: params.id,
            reporterId: user.id,
            type,
            reason: mappedReason.code,
            description,
            reportedUserIds: reported_users,
            channel: "chat",
        });
        console.info("[CHAT_REPORT_DEBUG][api][outcome]", {
            activity_id: params.id,
            reporter_user_id: user.id,
            reason_code: outcome.reasonCode,
            inserted_count: outcome.count,
            threshold: outcome.threshold,
        });

        const moderationDebug = Object.prototype.hasOwnProperty.call(outcome, "moderationDebug")
            ? ((outcome as unknown as { moderationDebug?: unknown }).moderationDebug ?? [])
            : [];
        const reportDebug = Object.prototype.hasOwnProperty.call(outcome, "reportDebug")
            ? ((outcome as unknown as { reportDebug?: unknown }).reportDebug ?? null)
            : null;

        return createSuccessResponse({
            success: true,
            count: outcome.count,
            threshold: outcome.threshold,
            sanctions_applied: outcome.sanctionsApplied,
            moderation_incidents_validated: outcome.moderationIncidentsValidated,
            moderation_actions: outcome.moderationActions,
            moderation_debug: moderationDebug,
            report_debug: reportDebug,
            reason_code: outcome.reasonCode,
            requires_manual_review: outcome.requiresManualReview,
        }, 200);

    } catch (err: unknown) {
        if (err instanceof ReportingError) {
            return createErrorResponse(err.message, err.status, err.details);
        }
        console.error("[REPORT] Unexpected error:", err);
        return createErrorResponse("Erreur interne", 500, err instanceof Error ? err.message : "Erreur inconnue");
    }
}
