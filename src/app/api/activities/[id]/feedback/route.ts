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

type FeedbackInsertRow = {
    activity_id: string;
    reviewer_id: string;
    reviewed_user_id: string | null;
    rating: number;
    tags: string[] | null;
    comment: string | null;
    no_show: boolean;
};

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const supabase = await createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();

        if (!user) {
            console.error("[FEEDBACK] Auth error:", authErr?.message);
            return createErrorResponse("Vous devez être connecté pour donner un avis.", 401);
        }

        console.log(`[FEEDBACK] User ${user.id} submitting feedback for activity ${params.id}`);

        // Check if the user is the creator
        const { data: activityRow, error: actErr } = await supabase
            .from("activities")
            .select("creator_id, status")
            .eq("id", params.id)
            .single();

        if (actErr) {
            console.error("[FEEDBACK] Error fetching activity:", actErr.message);
            return createErrorResponse("Activité introuvable.", 404);
        }

        const isCreator = activityRow?.creator_id === user.id;
        console.log(`[FEEDBACK] Activity status: ${activityRow?.status}, isCreator: ${isCreator}`);

        // Check if the user has a confirmed participation
        const { data: part, error: partErr } = await supabase
            .from("participations")
            .select("id")
            .eq("activity_id", params.id)
            .eq("user_id", user.id)
            .eq("status", "confirmé")
            .single();

        console.log(`[FEEDBACK] Participation found: ${!!part}, error: ${partErr?.message}`);

        // Allow: confirmed participant OR creator of the activity
        if (!part && !isCreator) {
            console.warn(`[FEEDBACK] BLOCKED: User ${user.id} is neither a participant nor the creator`);
            return createErrorResponse("Vous n'avez pas le droit de donner un avis sur cette activité.", 403);
        }

        const payload = await req.json();
        console.log("[FEEDBACK] Payload received:", JSON.stringify(payload));

        const validated = feedbackSchema.safeParse(payload);

        if (!validated.success) {
            console.error("[FEEDBACK] Validation failed:", validated.error.flatten().fieldErrors);
            return createErrorResponse("Données invalides", 400, validated.error.flatten().fieldErrors);
        }

        const { rating, issues, reported_users, comment } = validated.data;
        const isNoShowIssue = issues.includes("Absent") || issues.includes("Absent (No-show)");
        const inserts: FeedbackInsertRow[] = [];

        // Global Feedback row (no specific user targeted)
        inserts.push({
            activity_id: params.id,
            reviewer_id: user.id,
            reviewed_user_id: null,
            rating: rating,
            tags: issues?.length ? issues : null,
            comment: comment || null,
            no_show: false
        });

        // Individual per-user reports
        if (reported_users && reported_users.length > 0) {
            for (const targetId of reported_users) {
                if (targetId === user.id) continue; // Skip self-reports

                inserts.push({
                    activity_id: params.id,
                    reviewer_id: user.id,
                    reviewed_user_id: targetId,
                    rating: rating,
                    tags: issues?.length ? issues : null,
                    comment: null,
                    no_show: isNoShowIssue
                });
            }
        }

        console.log(`[FEEDBACK] Inserting ${inserts.length} rows into activity_feedback:`, JSON.stringify(inserts));

        const { error: insertError } = await supabase.from('activity_feedback').insert(inserts);

        if (insertError) {
            console.error("[FEEDBACK] Insert failed:", insertError.code, insertError.message, insertError.details, insertError.hint);
            // 23505 = unique constraint violation (already submitted feedback)
            if (insertError.code === '23505') {
                return createErrorResponse("Vous avez déjà donné votre avis pour cette activité.", 400);
            }
            // 42501 = insufficient privilege (RLS policy blocked)
            if (insertError.code === '42501') {
                return createErrorResponse("La politique de sécurité bloque l'insertion. Vérifiez votre RLS Supabase.", 403, insertError.message);
            }
            return createErrorResponse("Erreur lors de l'enregistrement de l'avis", 500, insertError.message);
        }

        console.log("[FEEDBACK] Success! Feedback submitted.");
        return createSuccessResponse({ success: true }, 200);
    } catch (err: unknown) {
        console.error("[FEEDBACK] Unexpected error:", err);
        const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
        return createErrorResponse("Erreur interne", 500, errorMessage);
    }
}
