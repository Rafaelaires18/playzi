import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { ReportingError, submitActivityReports } from "@/lib/reporting";

const reportSchema = z.object({
    type: z.enum(["absence", "problem"]),
    reason: z.string().min(1),
    description: z.string().optional(),
    reported_users: z.array(z.string().uuid()).min(1, "S\u00e9lectionnez au moins un participant")
});

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const supabase = await createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();

        if (!user) {
            return createErrorResponse("Vous devez \u00eatre connect\u00e9 pour effectuer un signalement.", 401);
        }

        const payload = await req.json();
        const validated = reportSchema.safeParse(payload);

        if (!validated.success) {
            return createErrorResponse("Donn\u00e9es invalides", 400, validated.error.flatten().fieldErrors);
        }

        const { type, reason, description, reported_users } = validated.data;

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
        const isParticipant = activity.participations?.some((p: any) => p.user_id === user.id);

        if (!isCreator && !isParticipant) {
            return createErrorResponse("Vous n'avez pas acc\u00e8s \u00e0 cette activit\u00e9.", 403);
        }

        const startMs = new Date(activity.start_time).getTime();
        const nowMs = Date.now();
        const reportWindowEnd = startMs + (2 * 60 * 60 * 1000);
        if (Number.isNaN(startMs) || nowMs < startMs || nowMs > reportWindowEnd) {
            return createErrorResponse("La fenêtre de signalement est fermée (disponible jusqu'à 2h après l'activité).", 400);
        }

        const outcome = await submitActivityReports({
            supabase,
            activityId: params.id,
            reporterId: user.id,
            type,
            reason,
            description,
            reportedUserIds: reported_users,
        });

        return createSuccessResponse({
            success: true,
            count: outcome.count,
            threshold: outcome.threshold,
            sanctions_applied: outcome.sanctionsApplied,
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
