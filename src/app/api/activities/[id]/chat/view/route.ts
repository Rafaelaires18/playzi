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

        if (!user) return createErrorResponse("Non autorisé", 401);

        const allowed = await canAccessActivityChat(activityId, user.id, supabase);
        if (!allowed) return createErrorResponse("Accès refusé à ce chat", 403);

        const { data: messages, error: messagesError } = await supabase
            .from("activity_chat_messages")
            .select("id")
            .eq("activity_id", activityId)
            .neq("sender_id", user.id);

        if (messagesError) {
            return createErrorResponse("Erreur lors du marquage de lecture", 500, messagesError.message);
        }

        if (!messages || messages.length === 0) {
            return createSuccessResponse({ success: true, marked: 0 }, 200);
        }

        const nowIso = new Date().toISOString();
        const rows = messages.map((m: any) => ({
            message_id: m.id,
            viewer_id: user.id,
            viewed_at: nowIso
        }));

        const { error: upsertError } = await supabase
            .from("activity_chat_message_views")
            .upsert(rows, { onConflict: "message_id,viewer_id" });

        if (upsertError) {
            return createErrorResponse("Erreur lors du marquage de lecture", 500, upsertError.message);
        }

        return createSuccessResponse({ success: true, marked: rows.length }, 200);
    } catch (e: unknown) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
