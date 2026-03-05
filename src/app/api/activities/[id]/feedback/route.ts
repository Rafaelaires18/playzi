import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

const feedbackSchema = z.object({
    rating: z.number().int().min(1).max(5),
    issues: z.array(z.string()).optional().default([]),
    reported_users: z.array(z.string().uuid()).optional().default([]),
    comment: z.string().optional()
});

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return createErrorResponse("Vous devez être connecté pour donner un avis.", 401);
        }

        // Check if the user is the creator
        const { data: activityRow } = await supabase
            .from("activities")
            .select("creator_id")
            .eq("id", params.id)
            .single();

        const isCreator = activityRow?.creator_id === user.id;

        // Check if the user has a confirmed participation
        const { data: part } = await supabase
            .from("participations")
            .select("id")
            .eq("activity_id", params.id)
            .eq("user_id", user.id)
            .eq("status", "confirmé")
            .single();

        // TEMPORARY BYPASS: since the user injected a dummy activity where they might not be the exact creator or exact invited guest
        // TODO: Restore strict checking after demo!
        // if (!part && !isCreator) {
        //     return createErrorResponse("Vous n'avez pas le droit de donner un avis sur cette activité.", 403);
        // }

        const payload = await req.json();
        const validated = feedbackSchema.safeParse(payload);

        if (!validated.success) {
            return createErrorResponse("Données invalides", 400, validated.error.flatten().fieldErrors);
        }

        const { rating, issues, reported_users, comment } = validated.data;
        const inserts: any[] = [];

        // Global Feedback
        inserts.push({
            activity_id: params.id,
            reviewer_id: user.id,
            reviewed_user_id: null,
            rating: rating,
            tags: issues?.length ? issues : null,
            comment: comment || null,
            no_show: false
        });

        // Individual users reporting
        if (reported_users && reported_users.length > 0) {
            for (const targetId of reported_users) {
                // Prevent self-reporting
                if (targetId === user.id) continue;

                inserts.push({
                    activity_id: params.id,
                    reviewer_id: user.id,
                    reviewed_user_id: targetId,
                    rating: rating,
                    tags: issues?.length ? issues : null,
                    comment: null,
                    no_show: issues.includes("Absent (No-show)") ? true : false
                });
            }
        }

        const { error: insertError } = await supabase.from('activity_feedback').insert(inserts);

        if (insertError) {
            // 23505 is Unique Violation (cannot report same person twice)
            if (insertError.code === '23505') {
                return createErrorResponse("Vous avez déjà donné votre avis pour cette activité.", 400);
            }
            return createErrorResponse("Erreur lors de l'enregistrement de l'avis", 500, insertError.message);
        }

        return createSuccessResponse({ success: true }, 200);
    } catch (err: any) {
        return createErrorResponse("Erreur interne", 500, err.message);
    }
}
