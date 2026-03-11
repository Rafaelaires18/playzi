import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import {
    buildPulseEventKey,
    getFeedbackWindow,
    mapFeedbackRatingToPulseScore,
    PULSE_REASONS,
    recordPulseTransaction,
    tryFinalizeActivityPulse,
} from "@/lib/pulse";
import { ReportingError, submitActivityReports } from "@/lib/reporting";

const feedbackSchema = z.object({
    rating: z.number().int().min(1).max(5),
    issues: z.array(z.enum([
        "Participant absent (no-show)",
        "Retard important (+30 min)",
        "Mauvais comportement",
        "Autre",
    ])).optional().default([]),
    reported_user: z.string().uuid().optional(),
    reported_users: z.array(z.string().uuid()).optional().default([]), // legacy compatibility
    comment: z.string().optional()
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
            console.error("[FEEDBACK] Auth error:", authErr?.message);
            return createErrorResponse("Vous devez être connecté pour donner un avis.", 401);
        }

        console.log(`[FEEDBACK] User ${user.id} submitting feedback for activity ${params.id}`);

        // Check if the user is the creator
        const { data: activityRow, error: actErr } = await supabase
            .from("activities")
            .select("creator_id, status, start_time")
            .eq("id", params.id)
            .single();

        if (actErr) {
            console.error("[FEEDBACK] Error fetching activity:", actErr.message);
            return createErrorResponse("Activité introuvable.", 404);
        }

        const isCreator = activityRow?.creator_id === user.id;
        console.log(`[FEEDBACK] Activity status: ${activityRow?.status}, isCreator: ${isCreator}`);

        if (activityRow?.status === "annulé") {
            return createErrorResponse("Feedback indisponible: cette activité a été annulée.", 400);
        }

        const { openAtMs, closeAtMs } = getFeedbackWindow(activityRow.start_time);
        const nowMs = Date.now();
        if (nowMs < openAtMs) {
            return createErrorResponse("Le feedback sera disponible 2h après le début de l'activité.", 400);
        }
        if (nowMs > closeAtMs) {
            return createErrorResponse("La fenêtre de feedback est fermée.", 400);
        }

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

        const { data: existingGlobalFeedback } = await supabase
            .from("activity_feedback")
            .select("id")
            .eq("activity_id", params.id)
            .eq("reviewer_id", user.id)
            .is("reviewed_user_id", null)
            .maybeSingle();

        if (existingGlobalFeedback?.id) {
            return createErrorResponse("Vous avez déjà donné votre avis pour cette activité.", 400);
        }

        const payload = await req.json();
        console.log("[FEEDBACK] Payload received:", JSON.stringify(payload));

        const validated = feedbackSchema.safeParse(payload);

        if (!validated.success) {
            console.error("[FEEDBACK] Validation failed:", validated.error.flatten().fieldErrors);
            return createErrorResponse("Données invalides", 400, validated.error.flatten().fieldErrors);
        }

        const { rating, issues, reported_user, reported_users, comment } = validated.data;
        const pulseScore = mapFeedbackRatingToPulseScore(rating);
        const inserts: any[] = [];
        const selectedIssue = issues[0] || null;

        // Global Feedback row (no specific user targeted)
        inserts.push({
            activity_id: params.id,
            reviewer_id: user.id,
            reviewed_user_id: null,
            rating: rating,
            pulse_score: pulseScore,
            tags: issues?.length ? issues : null,
            comment: comment || null,
            no_show: false,
            scored_at: new Date().toISOString(),
        });

        const reportTargetId = reported_user || reported_users[0] || null;
        if (selectedIssue && !reportTargetId) {
            return createErrorResponse("Vous devez sélectionner la personne concernée.", 400);
        }
        if (selectedIssue && reportTargetId === user.id) {
            return createErrorResponse("Vous ne pouvez pas vous signaler vous-même.", 400);
        }
        if (selectedIssue === "Autre" && !comment?.trim()) {
            return createErrorResponse("Une explication est obligatoire pour le motif \"Autre\".", 400);
        }

        // Keep one targeted feedback row for traceability (aligned with single-target UX)
        if (selectedIssue && reportTargetId) {
            inserts.push({
                activity_id: params.id,
                reviewer_id: user.id,
                reviewed_user_id: reportTargetId,
                rating: rating,
                pulse_score: pulseScore,
                tags: [selectedIssue],
                comment: null,
                no_show: selectedIssue === "Participant absent (no-show)",
                scored_at: new Date().toISOString(),
            });
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

        await recordPulseTransaction(supabase, {
            userId: user.id,
            activityId: params.id,
            sourceType: "feedback",
            points: PULSE_REASONS.FEEDBACK_SUBMITTED.points,
            reasonCode: PULSE_REASONS.FEEDBACK_SUBMITTED.code,
            reasonLabel: PULSE_REASONS.FEEDBACK_SUBMITTED.label,
            uniqueEventKey: buildPulseEventKey(["feedback", params.id, user.id, "submitted"]),
            metadata: {
                rating,
                pulse_score: pulseScore,
            },
        });

        let reportOutcome: { count: number; threshold: number; sanctionsApplied: number } | null = null;
        if (selectedIssue && reportTargetId) {
            const reportType: "absence" | "problem" =
                selectedIssue === "Participant absent (no-show)" ? "absence" : "problem";

            try {
                reportOutcome = await submitActivityReports({
                    supabase,
                    activityId: params.id,
                    reporterId: user.id,
                    type: reportType,
                    reason: selectedIssue,
                    description: comment,
                    reportedUserIds: [reportTargetId],
                });
            } catch (reportErr) {
                if (!(reportErr instanceof ReportingError && reportErr.status === 409)) {
                    throw reportErr;
                }
                // If already reported via chat, keep feedback but avoid duplicate report rejection.
            }
        }

        const finalize = await tryFinalizeActivityPulse(supabase, params.id);
        let pulseSummary: { total_points: number; breakdown: unknown[]; created_at: string | null } | null = null;

        const { data: summaryRow } = await supabase
            .from("pulse_summaries")
            .select("total_points,breakdown,created_at")
            .eq("activity_id", params.id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (summaryRow) {
            pulseSummary = {
                total_points: Number(summaryRow.total_points || 0),
                breakdown: Array.isArray(summaryRow.breakdown) ? summaryRow.breakdown : [],
                created_at: summaryRow.created_at || null,
            };
        }

        console.log("[FEEDBACK] Success! Feedback submitted.");
        return createSuccessResponse({
            success: true,
            pulse_awarded: 1,
            finalized: finalize.finalized,
            finalize_reason: finalize.reason,
            report_count: reportOutcome?.count || 0,
            sanctions_applied: reportOutcome?.sanctionsApplied || 0,
            pulse_summary: pulseSummary,
        }, 200);
    } catch (err: any) {
        console.error("[FEEDBACK] Unexpected error:", err);
        return createErrorResponse("Erreur interne", 500, err.message);
    }
}
