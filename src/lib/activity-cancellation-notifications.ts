import type { SupabaseClient } from "@supabase/supabase-js";

const CANCELLATION_NOTIFICATION_TYPE = "activity_cancellation_vote";

function isMissingTableError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || "");
    return message.includes("relation") && message.includes("does not exist");
}

export async function createCancellationVoteNotifications(
    supabase: SupabaseClient,
    payload: {
        proposalId: string;
        activityId: string;
        userIds: string[];
    }
) {
    if (!payload.userIds.length) return;
    const rows = payload.userIds.map((userId) => ({
        proposal_id: payload.proposalId,
        activity_id: payload.activityId,
        user_id: userId,
        type: CANCELLATION_NOTIFICATION_TYPE,
        title: "Vote d’annulation en cours",
        body: "Donnez votre avis",
        metadata: {
            type: CANCELLATION_NOTIFICATION_TYPE,
            proposal_id: payload.proposalId,
            activity_id: payload.activityId,
            push_payload: {
                type: CANCELLATION_NOTIFICATION_TYPE,
                proposal_id: payload.proposalId,
                activity_id: payload.activityId,
                title: "Vote d’annulation en cours",
                body: "Donnez votre avis",
            },
        },
    }));

    const { error } = await supabase
        .from("activity_cancellation_vote_notifications")
        .upsert(rows, { onConflict: "proposal_id,user_id", ignoreDuplicates: false });

    if (error && !isMissingTableError(error)) {
        throw new Error(error.message);
    }
}

export async function markCancellationVoteNotificationsReadForActivity(
    supabase: SupabaseClient,
    payload: { activityId: string; userId: string }
) {
    const { error } = await supabase
        .from("activity_cancellation_vote_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("activity_id", payload.activityId)
        .eq("user_id", payload.userId)
        .is("read_at", null);

    if (error && !isMissingTableError(error)) {
        throw new Error(error.message);
    }
}

export async function markCancellationVoteNotificationsReadForProposal(
    supabase: SupabaseClient,
    payload: { proposalId: string; userId: string }
) {
    const { error } = await supabase
        .from("activity_cancellation_vote_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("proposal_id", payload.proposalId)
        .eq("user_id", payload.userId)
        .is("read_at", null);

    if (error && !isMissingTableError(error)) {
        throw new Error(error.message);
    }
}

export async function markCancellationVoteNotificationsReadForProposalAll(
    supabase: SupabaseClient,
    payload: { proposalId: string }
) {
    const { error } = await supabase
        .from("activity_cancellation_vote_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("proposal_id", payload.proposalId)
        .is("read_at", null);

    if (error && !isMissingTableError(error)) {
        throw new Error(error.message);
    }
}
