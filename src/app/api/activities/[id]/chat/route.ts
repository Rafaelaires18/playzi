import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { canAuthorizedMemberAccessChat } from "@/lib/activity-rules";

const createMessageSchema = z.object({
    content: z.string().trim().min(1).max(1000)
});

async function canAccessActivityChat(activityId: string, userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data: activity, error: activityError } = await supabase
        .from("activities")
        .select("id, creator_id, sport, status, start_time, max_attendees")
        .eq("id", activityId)
        .single();

    if (activityError || !activity) return false;

    const { data: participation } = await supabase
        .from("participations")
        .select("id")
        .eq("activity_id", activityId)
        .eq("user_id", userId)
        .eq("status", "confirmé")
        .single();

    const isCreator = activity.creator_id === userId;
    const isConfirmedParticipant = !!participation;
    if (!isCreator && !isConfirmedParticipant) return false;

    const attendees = (await supabase
        .from("participations")
        .select("id", { count: "exact", head: true })
        .eq("activity_id", activityId)).count;

    return canAuthorizedMemberAccessChat(
        {
            sport: activity.sport,
            status: activity.status,
            start_time: activity.start_time,
            max_attendees: activity.max_attendees,
            attendees: typeof attendees === "number" ? 1 + attendees : undefined,
        },
        Date.now()
    );
}

export async function GET(
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
            .select("id, activity_id, sender_id, content, created_at")
            .eq("activity_id", activityId)
            .order("created_at", { ascending: true });

        if (messagesError) {
            return createErrorResponse("Erreur lors du chargement des messages", 500, messagesError.message);
        }

        const senderIds = [...new Set((messages || []).map((m: any) => m.sender_id))];
        const messageIds = (messages || []).map((m: any) => m.id);

        const { data: profiles } = senderIds.length > 0
            ? await supabase.from("profiles").select("id, pseudo").in("id", senderIds)
            : { data: [] as { id: string; pseudo: string }[] };

        const { data: views } = messageIds.length > 0
            ? await supabase
                .from("activity_chat_message_views")
                .select("message_id, viewer_id, viewed_at")
                .in("message_id", messageIds)
            : { data: [] as { message_id: string; viewer_id: string; viewed_at: string }[] };

        const profileById = new Map<string, string>((profiles || []).map((p: any) => [p.id, p.pseudo]));
        const viewsByMessage = new Map<string, { viewer_id: string; pseudo: string; viewed_at: string }[]>();

        for (const view of views || []) {
            const current = viewsByMessage.get(view.message_id) || [];
            current.push({
                viewer_id: view.viewer_id,
                pseudo: profileById.get(view.viewer_id) || "Utilisateur",
                viewed_at: view.viewed_at
            });
            viewsByMessage.set(view.message_id, current);
        }

        const formatted = (messages || []).map((m: any) => ({
            id: m.id,
            activity_id: m.activity_id,
            sender_id: m.sender_id,
            sender_name: profileById.get(m.sender_id) || "Utilisateur",
            content: m.content,
            created_at: m.created_at,
            seen_by: viewsByMessage.get(m.id) || []
        }));

        return createSuccessResponse(formatted, 200);
    } catch (e: unknown) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: activityId } = await context.params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return createErrorResponse("Non autorisé", 401);

        const allowed = await canAccessActivityChat(activityId, user.id, supabase);
        if (!allowed) return createErrorResponse("Accès refusé à ce chat", 403);

        const body = await req.json();
        const parsed = createMessageSchema.safeParse(body);
        if (!parsed.success) {
            return createErrorResponse("Message invalide", 400, parsed.error.flatten().fieldErrors);
        }

        const { data: inserted, error: insertError } = await supabase
            .from("activity_chat_messages")
            .insert({
                activity_id: activityId,
                sender_id: user.id,
                content: parsed.data.content
            })
            .select("id, activity_id, sender_id, content, created_at")
            .single();

        if (insertError || !inserted) {
            return createErrorResponse("Erreur lors de l'envoi du message", 500, insertError?.message);
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("pseudo")
            .eq("id", user.id)
            .single();

        return createSuccessResponse({
            id: inserted.id,
            activity_id: inserted.activity_id,
            sender_id: inserted.sender_id,
            sender_name: profile?.pseudo || "Utilisateur",
            content: inserted.content,
            created_at: inserted.created_at,
            seen_by: []
        }, 201);
    } catch (e: unknown) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
