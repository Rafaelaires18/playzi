import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getModerationServiceClient, getModeratorAccessDebug, isModeratorUser } from "@/lib/moderation";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const { data: { user }, error: authErr } = await supabase.auth.getUser();

        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const allowed = await isModeratorUser(supabase, user);
        if (!allowed) {
            const debug = await getModeratorAccessDebug(supabase as any, user as any);
            return createErrorResponse("Accès admin refusé", 403, debug);
        }

        const activityId = req.nextUrl.searchParams.get("activity_id")?.trim();
        if (!activityId) {
            return createErrorResponse("activity_id requis", 400);
        }

        const [{ data: activity, error: activityError }, { data: messages, error: messagesError }] = await Promise.all([
            db
                .from("activities")
                .select("id,sport,start_time,location")
                .eq("id", activityId)
                .maybeSingle(),
            db
                .from("activity_chat_messages")
                .select("id,activity_id,sender_id,content,created_at")
                .eq("activity_id", activityId)
                .order("created_at", { ascending: true })
                .limit(2000),
        ]);

        if (activityError) return createErrorResponse("Impossible de charger l'activité", 400, activityError.message);
        if (!activity) return createErrorResponse("Activité introuvable", 404);
        if (messagesError) return createErrorResponse("Impossible de charger le chat", 400, messagesError.message);

        const senderIds = Array.from(new Set((messages || []).map((m: any) => m.sender_id).filter(Boolean)));
        const { data: profiles } = senderIds.length > 0
            ? await db.from("profiles").select("id,pseudo").in("id", senderIds)
            : { data: [] as any[] };

        const pseudoById = new Map<string, string>((profiles || []).map((profile: any) => [profile.id, profile.pseudo || "Utilisateur"]));
        const formatted = (messages || []).map((message: any) => ({
            id: message.id,
            activity_id: message.activity_id,
            sender_id: message.sender_id,
            sender_name: pseudoById.get(message.sender_id) || "Utilisateur",
            content: message.content,
            created_at: message.created_at,
        }));

        return createSuccessResponse({
            activity: {
                id: activity.id,
                sport: activity.sport,
                start_time: activity.start_time,
                location: activity.location,
            },
            messages: formatted,
        }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}

