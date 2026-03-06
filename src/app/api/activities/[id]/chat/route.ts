import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

const createMessageSchema = z.object({
    content: z.string().trim().min(1).max(1000)
});

type ChatMessageRow = {
    id: string;
    activity_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender: { pseudo: string } | { pseudo: string }[] | null;
};

async function canAccessActivityChat(activityId: string, userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
    const { data: activity, error: activityError } = await supabase
        .from("activities")
        .select("id, creator_id")
        .eq("id", activityId)
        .single();

    if (activityError || !activity) return { allowed: false };

    if (activity.creator_id === userId) return { allowed: true };

    const { data: participation } = await supabase
        .from("participations")
        .select("id")
        .eq("activity_id", activityId)
        .eq("user_id", userId)
        .eq("status", "confirmé")
        .single();

    return { allowed: !!participation };
}

export async function GET(
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

        const access = await canAccessActivityChat(activityId, user.id, supabase);
        if (!access.allowed) {
            return createErrorResponse("Accès refusé à ce chat", 403);
        }

        const { data, error } = await supabase
            .from("activity_chat_messages")
            .select("id, activity_id, sender_id, content, created_at, sender:profiles!activity_chat_messages_sender_id_fkey(pseudo)")
            .eq("activity_id", activityId)
            .order("created_at", { ascending: true });

        if (error) {
            return createErrorResponse("Erreur lors du chargement des messages", 500, error.message);
        }

        const messages = ((data || []) as ChatMessageRow[]).map((row) => {
            const senderPseudo = Array.isArray(row.sender) ? row.sender[0]?.pseudo : row.sender?.pseudo;
            return {
                id: row.id,
                activity_id: row.activity_id,
                sender_id: row.sender_id,
                sender_name: senderPseudo || "Utilisateur",
                content: row.content,
                created_at: row.created_at
            };
        });

        return createSuccessResponse(messages, 200);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        return createErrorResponse("Erreur interne", 500, message);
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

        if (!user) {
            return createErrorResponse("Non autorisé", 401);
        }

        const access = await canAccessActivityChat(activityId, user.id, supabase);
        if (!access.allowed) {
            return createErrorResponse("Accès refusé à ce chat", 403);
        }

        const body = await req.json();
        const parsed = createMessageSchema.safeParse(body);
        if (!parsed.success) {
            return createErrorResponse("Message invalide", 400, parsed.error.flatten().fieldErrors);
        }

        const { content } = parsed.data;

        const { data: inserted, error: insertError } = await supabase
            .from("activity_chat_messages")
            .insert({
                activity_id: activityId,
                sender_id: user.id,
                content
            })
            .select("id, activity_id, sender_id, content, created_at")
            .single();

        if (insertError || !inserted) {
            return createErrorResponse("Erreur lors de l'envoi du message", 500, insertError?.message);
        }

        const { data: senderProfile } = await supabase
            .from("profiles")
            .select("pseudo")
            .eq("id", user.id)
            .single();

        return createSuccessResponse({
            id: inserted.id,
            activity_id: inserted.activity_id,
            sender_id: inserted.sender_id,
            sender_name: senderProfile?.pseudo || "Utilisateur",
            content: inserted.content,
            created_at: inserted.created_at
        }, 201);
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        return createErrorResponse("Erreur interne", 500, message);
    }
}
