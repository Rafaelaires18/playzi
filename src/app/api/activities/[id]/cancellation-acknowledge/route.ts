import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function POST(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: activityId } = await context.params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return createErrorResponse("Non autorisé", 401);

        const { data: activity, error: activityError } = await supabase
            .from("activities")
            .select("id, creator_id, status")
            .eq("id", activityId)
            .maybeSingle();

        if (activityError || !activity) {
            return createErrorResponse("Activité introuvable", 404);
        }

        const { data: participation } = await supabase
            .from("participations")
            .select("id")
            .eq("activity_id", activityId)
            .eq("user_id", user.id)
            .eq("status", "confirmé")
            .maybeSingle();

        const isCreator = activity.creator_id === user.id;
        const isParticipant = !!participation;
        if (!isCreator && !isParticipant) {
            return createErrorResponse("Accès refusé", 403);
        }

        if (activity.status !== "annulé") {
            return createErrorResponse("Cette activité n'est pas annulée.", 400);
        }

        const { error: upsertError } = await supabase
            .from("activity_cancellation_acknowledgements")
            .upsert({
                activity_id: activityId,
                user_id: user.id,
                acknowledged_at: new Date().toISOString(),
            }, { onConflict: "activity_id,user_id" });

        if (upsertError) {
            return createErrorResponse("Impossible d'enregistrer la confirmation.", 500, upsertError.message);
        }

        return createSuccessResponse({ success: true }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
