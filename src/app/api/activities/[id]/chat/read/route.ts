import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

async function canAccessActivityChat(activityId: string, userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data: activity, error: activityError } = await supabase
        .from("activities")
        .select("id, creator_id")
        .eq("id", activityId)
        .single();

    if (activityError || !activity) return false;
    if (activity.creator_id === userId) return true;

    const { data: participation } = await supabase
        .from("participations")
        .select("id")
        .eq("activity_id", activityId)
        .eq("user_id", userId)
        .eq("status", "confirmé")
        .single();

    return !!participation;
}

export async function POST(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: activityId } = await context.params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return createErrorResponse("Non autorisé", 401);
        }

        const allowed = await canAccessActivityChat(activityId, user.id, supabase);
        if (!allowed) {
            return createErrorResponse("Accès refusé à ce chat", 403);
        }

        const { error } = await supabase
            .from("activity_chat_reads")
            .upsert({
                activity_id: activityId,
                user_id: user.id,
                last_read_at: new Date().toISOString()
            }, { onConflict: "activity_id,user_id" });

        if (error) {
            return createErrorResponse("Erreur lors de la mise à jour de lecture", 500, error.message);
        }

        return createSuccessResponse({ success: true }, 200);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        return createErrorResponse("Erreur interne", 500, message);
    }
}
