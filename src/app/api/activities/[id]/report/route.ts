import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

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
            .select("creator_id, participations(user_id)")
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

        const inserts = reported_users
            .filter(targetId => targetId !== user.id) // Cannot report oneself
            .map(targetId => ({
                activity_id: params.id,
                reporter_id: user.id,
                reported_id: targetId,
                type,
                reason,
                description: description || null,
                status: 'pending'
            }));

        if (inserts.length === 0) {
            return createErrorResponse("Aucun utilisateur valide \u00e0 signaler.", 400);
        }

        const { error: insertError } = await supabase.from('reports').insert(inserts);

        if (insertError) {
            console.error("[REPORT] Insert failed:", insertError);
            return createErrorResponse("Erreur lors de l'enregistrement du signalement.", 500, insertError.message);
        }

        return createSuccessResponse({ success: true, count: inserts.length }, 200);

    } catch (err: any) {
        console.error("[REPORT] Unexpected error:", err);
        return createErrorResponse("Erreur interne", 500, err.message);
    }
}
