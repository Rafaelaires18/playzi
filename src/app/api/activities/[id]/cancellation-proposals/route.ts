import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { createServiceRoleClient } from "@/lib/pulse";
import { createCancellationVoteNotifications } from "@/lib/activity-cancellation-notifications";
import {
    CANCELLATION_CREATION_MIN_LEAD_MINUTES,
    buildCancellationProposalView,
    CANCELLATION_VOTE_WINDOW_MINUTES,
    CANCELLATION_REASON_OPTIONS,
    getActivityCancellationContext,
    loadLatestCancellationProposal,
    resolveCancellationProposalIfNeeded,
} from "@/lib/activity-cancellation";

const createProposalSchema = z.object({
    reason_code: z.enum(CANCELLATION_REASON_OPTIONS.map((option) => option.code) as [string, ...string[]]),
    reason_text: z.string().trim().max(120).optional().nullable(),
});

export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: activityId } = await context.params;
        const supabase = await createClient();
        const db = createServiceRoleClient() ?? supabase;
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return createErrorResponse("Non autorisé", 401);

        const activityContext = await getActivityCancellationContext(db as never, activityId, user.id);
        if (!activityContext.isMember) return createErrorResponse("Accès refusé à ce chat", 403);

        let proposal = await loadLatestCancellationProposal(db as never, activityId);
        if (proposal?.status === "active") {
            const resolvedStatus = await resolveCancellationProposalIfNeeded(
                db as never,
                proposal,
                activityContext.eligibleVoterIds,
                activityContext.activity.status
            );
            if (resolvedStatus) {
                proposal = await loadLatestCancellationProposal(db as never, activityId);
            }
        }

        const proposalView = proposal
            ? await buildCancellationProposalView(db as never, proposal as never, user.id, activityContext.eligibleVoterIds)
            : null;

        const hasActiveProposal = proposalView?.status === "active";
        const startTimeMs = new Date(activityContext.activity.start_time).getTime();
        const canStartVoteUntilMs = Date.now() + (CANCELLATION_CREATION_MIN_LEAD_MINUTES * 60 * 1000);
        const canCreateProposal =
            activityContext.isCreator
            && activityContext.activity.status !== "annulé"
            && startTimeMs >= canStartVoteUntilMs
            && activityContext.eligibleVoterIds.length >= 2
            && !hasActiveProposal;

        return createSuccessResponse({
            proposal: proposalView,
            can_create: canCreateProposal,
        }, 200);
    } catch (e) {
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        if (message === "activity_not_found") {
            return createErrorResponse("Activité introuvable", 404);
        }
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
        const db = createServiceRoleClient() ?? supabase;
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return createErrorResponse("Non autorisé", 401);

        const body = await req.json();
        const parsed = createProposalSchema.safeParse(body);
        if (!parsed.success) {
            return createErrorResponse("Données invalides", 400, parsed.error.flatten().fieldErrors);
        }

        const reasonCode = parsed.data.reason_code;
        const reasonText = (parsed.data.reason_text || "").trim();
        if (reasonCode === "other" && !reasonText) {
            return createErrorResponse("Une courte description est requise pour le motif Autre.", 400);
        }

        const activityContext = await getActivityCancellationContext(db as never, activityId, user.id);
        if (!activityContext.isMember) return createErrorResponse("Accès refusé à ce chat", 403);
        if (!activityContext.isCreator) {
            return createErrorResponse("Seul le créateur peut proposer une annulation.", 403);
        }
        if (activityContext.activity.status === "annulé") {
            return createErrorResponse("Cette activité est déjà annulée.", 400);
        }
        const startTimeMs = new Date(activityContext.activity.start_time).getTime();
        const nowMs = Date.now();
        if (startTimeMs <= nowMs) {
            return createErrorResponse("Impossible de lancer un vote après le début de l'activité.", 400);
        }
        if ((startTimeMs - nowMs) < (CANCELLATION_CREATION_MIN_LEAD_MINUTES * 60 * 1000)) {
            return createErrorResponse("Impossible de proposer une annulation à moins de 45 minutes du début", 400);
        }
        if (activityContext.eligibleVoterIds.length < 2) {
            return createErrorResponse("Il faut au moins 2 participants pour proposer une annulation.", 400);
        }

        const activeProposal = await db
            .from("activity_cancellation_proposals")
            .select("id")
            .eq("activity_id", activityId)
            .eq("status", "active")
            .maybeSingle();

        if (activeProposal.data?.id) {
            return createErrorResponse("Une proposition d'annulation est déjà en cours.", 409, {
                code: "active_proposal_exists",
            });
        }

        const expiresAt = new Date(Date.now() + (CANCELLATION_VOTE_WINDOW_MINUTES * 60 * 1000)).toISOString();
        const { data: inserted, error: insertError } = await db
            .from("activity_cancellation_proposals")
            .insert({
                activity_id: activityId,
                initiated_by: user.id,
                reason_code: reasonCode,
                reason_text: reasonCode === "other" ? reasonText : null,
                status: "active",
                expires_at: expiresAt,
            })
            .select("id, activity_id, initiated_by, reason_code, reason_text, status, expires_at, created_at, resolved_at")
            .single();

        if (insertError || !inserted) {
            return createErrorResponse("Impossible de publier la proposition.", 500, insertError?.message);
        }

        const proposalView = await buildCancellationProposalView(
            db as never,
            inserted as never,
            user.id,
            activityContext.eligibleVoterIds
        );

        const notificationRecipients = activityContext.eligibleVoterIds.filter((participantId) => participantId !== user.id);
        await createCancellationVoteNotifications(db as never, {
            proposalId: inserted.id,
            activityId,
            userIds: notificationRecipients,
        });

        return createSuccessResponse({ proposal: proposalView }, 201);
    } catch (e) {
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        if (message === "activity_not_found") {
            return createErrorResponse("Activité introuvable", 404);
        }
        return createErrorResponse("Erreur interne", 500, message);
    }
}
