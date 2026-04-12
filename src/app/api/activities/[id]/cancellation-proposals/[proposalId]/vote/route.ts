import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { createServiceRoleClient } from "@/lib/pulse";
import { markCancellationVoteNotificationsReadForProposal } from "@/lib/activity-cancellation-notifications";
import {
    buildCancellationProposalView,
    getActivityCancellationContext,
    loadLatestCancellationProposal,
    resolveCancellationProposalIfNeeded,
} from "@/lib/activity-cancellation";

const voteSchema = z.object({
    vote: z.enum(["yes", "no"]),
});

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string; proposalId: string }> }
) {
    try {
        const { id: activityId, proposalId } = await context.params;
        const supabase = await createClient();
        const db = createServiceRoleClient() ?? supabase;
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return createErrorResponse("Non autorisé", 401);

        const body = await req.json();
        const parsed = voteSchema.safeParse(body);
        if (!parsed.success) {
            return createErrorResponse("Vote invalide", 400, parsed.error.flatten().fieldErrors);
        }

        const activityContext = await getActivityCancellationContext(db as never, activityId, user.id);
        if (!activityContext.isMember) {
            return createErrorResponse("Accès refusé à ce vote", 403);
        }

        let proposal = await db
            .from("activity_cancellation_proposals")
            .select("id, activity_id, initiated_by, reason_code, reason_text, status, expires_at, created_at, resolved_at")
            .eq("id", proposalId)
            .eq("activity_id", activityId)
            .maybeSingle();

        if (!proposal.data) {
            return createErrorResponse("Proposition introuvable", 404);
        }

        if (proposal.data.status !== "active") {
            const fallback = await loadLatestCancellationProposal(db as never, activityId);
            const view = fallback
                ? await buildCancellationProposalView(db as never, fallback as never, user.id, activityContext.eligibleVoterIds)
                : null;
            return createErrorResponse("Ce vote est déjà terminé.", 409, { proposal: view });
        }

        if (new Date(proposal.data.expires_at).getTime() <= Date.now()) {
            await resolveCancellationProposalIfNeeded(
                db as never,
                proposal.data as never,
                activityContext.eligibleVoterIds,
                activityContext.activity.status
            );
            const fallback = await loadLatestCancellationProposal(db as never, activityId);
            const view = fallback
                ? await buildCancellationProposalView(db as never, fallback as never, user.id, activityContext.eligibleVoterIds)
                : null;
            return createErrorResponse("Le vote est terminé.", 409, { proposal: view });
        }

        const { error: voteError } = await db
            .from("activity_cancellation_votes")
            .upsert({
                proposal_id: proposalId,
                voter_id: user.id,
                vote: parsed.data.vote,
                updated_at: new Date().toISOString(),
            }, { onConflict: "proposal_id,voter_id" });

        if (voteError) {
            return createErrorResponse("Impossible d'enregistrer le vote.", 500, voteError.message);
        }

        await markCancellationVoteNotificationsReadForProposal(db as never, {
            proposalId,
            userId: user.id,
        });

        await resolveCancellationProposalIfNeeded(
            db as never,
            proposal.data as never,
            activityContext.eligibleVoterIds,
            activityContext.activity.status
        );

        proposal = await db
            .from("activity_cancellation_proposals")
            .select("id, activity_id, initiated_by, reason_code, reason_text, status, expires_at, created_at, resolved_at")
            .eq("id", proposalId)
            .eq("activity_id", activityId)
            .maybeSingle();

        if (!proposal.data) {
            return createErrorResponse("Proposition introuvable", 404);
        }

        const view = await buildCancellationProposalView(
            db as never,
            proposal.data as never,
            user.id,
            activityContext.eligibleVoterIds
        );

        return createSuccessResponse({ proposal: view }, 200);
    } catch (e) {
        const message = e instanceof Error ? e.message : "Erreur inconnue";
        if (message === "activity_not_found") {
            return createErrorResponse("Activité introuvable", 404);
        }
        return createErrorResponse("Erreur interne", 500, message);
    }
}
