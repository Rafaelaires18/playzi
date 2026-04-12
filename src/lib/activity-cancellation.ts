import type { SupabaseClient } from "@supabase/supabase-js";
import { markCancellationVoteNotificationsReadForProposalAll } from "@/lib/activity-cancellation-notifications";

export const CANCELLATION_REASON_OPTIONS = [
    { code: "weather", label: "Météo" },
    { code: "injury", label: "Blessure" },
    { code: "low_participants", label: "Trop peu de participants" },
    { code: "collective_unforeseen", label: "Imprévu collectif" },
    { code: "other", label: "Autre" },
] as const;

export type CancellationReasonCode = (typeof CANCELLATION_REASON_OPTIONS)[number]["code"];
export type CancellationProposalStatus = "active" | "accepted" | "rejected";
export type CancellationVoteValue = "yes" | "no";
export const CANCELLATION_VOTE_WINDOW_MINUTES = 15;
export const CANCELLATION_CREATION_MIN_LEAD_MINUTES = 45;

type ActivityRow = {
    id: string;
    creator_id: string;
    status: string;
    start_time: string;
};

type ProposalRow = {
    id: string;
    activity_id: string;
    initiated_by: string;
    reason_code: CancellationReasonCode;
    reason_text: string | null;
    status: CancellationProposalStatus;
    expires_at: string;
    created_at: string;
    resolved_at: string | null;
};

type VoteRow = {
    voter_id: string;
    vote: CancellationVoteValue;
    created_at: string;
    updated_at: string;
};

export type CancellationProposalView = {
    id: string;
    activity_id: string;
    initiated_by: string;
    reason_code: CancellationReasonCode;
    reason_label: string;
    reason_text: string | null;
    status: CancellationProposalStatus;
    expires_at: string;
    created_at: string;
    resolved_at: string | null;
    counts: {
        yes: number;
        no: number;
        total_votes: number;
        total_eligible: number;
        quorum_required: number;
    };
    my_vote: CancellationVoteValue | null;
    votes: Array<{
        voter_id: string;
        vote: CancellationVoteValue;
        pseudo: string;
        created_at: string;
        updated_at: string;
    }>;
};

export function getCancellationReasonLabel(reasonCode: string): string {
    return CANCELLATION_REASON_OPTIONS.find((option) => option.code === reasonCode)?.label || "Autre";
}

export function getCancellationVoteQuorum(totalEligible: number): number {
    return Math.max(2, Math.ceil(totalEligible / 2));
}

export async function getActivityCancellationContext(
    supabase: SupabaseClient,
    activityId: string,
    userId: string
): Promise<{
    activity: ActivityRow;
    eligibleVoterIds: string[];
    isCreator: boolean;
    isMember: boolean;
}> {
    const { data: activity, error: activityError } = await supabase
        .from("activities")
        .select("id, creator_id, status, start_time")
        .eq("id", activityId)
        .maybeSingle<ActivityRow>();

    if (activityError || !activity) {
        throw new Error("activity_not_found");
    }

    const { data: participations } = await supabase
        .from("participations")
        .select("user_id")
        .eq("activity_id", activityId)
        .eq("status", "confirmé");

    const participantIds = (participations || []).map((entry: { user_id: string }) => entry.user_id).filter(Boolean);
    const eligibleVoterIds = Array.from(new Set([activity.creator_id, ...participantIds]));
    const isCreator = activity.creator_id === userId;
    const isMember = eligibleVoterIds.includes(userId);

    return {
        activity,
        eligibleVoterIds,
        isCreator,
        isMember,
    };
}

export async function loadLatestCancellationProposal(
    supabase: SupabaseClient,
    activityId: string
): Promise<ProposalRow | null> {
    const { data } = await supabase
        .from("activity_cancellation_proposals")
        .select("id, activity_id, initiated_by, reason_code, reason_text, status, expires_at, created_at, resolved_at")
        .eq("activity_id", activityId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<ProposalRow>();

    return data || null;
}

export async function buildCancellationProposalView(
    supabase: SupabaseClient,
    proposal: ProposalRow,
    currentUserId: string,
    eligibleVoterIds: string[]
): Promise<CancellationProposalView> {
    const { data: voteRows } = await supabase
        .from("activity_cancellation_votes")
        .select("voter_id, vote, created_at, updated_at")
        .eq("proposal_id", proposal.id);

    const votes = (voteRows || []) as VoteRow[];
    const voterIds = votes.map((vote) => vote.voter_id).filter(Boolean);
    const { data: profiles } = voterIds.length
        ? await supabase.from("profiles").select("id, pseudo").in("id", voterIds)
        : { data: [] as Array<{ id: string; pseudo: string }> };

    const pseudoById = new Map<string, string>((profiles || []).map((profile) => [profile.id, profile.pseudo || "Utilisateur"]));
    const yes = votes.filter((vote) => vote.vote === "yes").length;
    const no = votes.filter((vote) => vote.vote === "no").length;
    const myVote = votes.find((vote) => vote.voter_id === currentUserId)?.vote || null;
    const quorumRequired = getCancellationVoteQuorum(eligibleVoterIds.length);

    return {
        id: proposal.id,
        activity_id: proposal.activity_id,
        initiated_by: proposal.initiated_by,
        reason_code: proposal.reason_code,
        reason_label: getCancellationReasonLabel(proposal.reason_code),
        reason_text: proposal.reason_text || null,
        status: proposal.status,
        expires_at: proposal.expires_at,
        created_at: proposal.created_at,
        resolved_at: proposal.resolved_at || null,
        counts: {
            yes,
            no,
            total_votes: votes.length,
            total_eligible: eligibleVoterIds.length,
            quorum_required: quorumRequired,
        },
        my_vote: myVote,
        votes: votes.map((vote) => ({
            voter_id: vote.voter_id,
            vote: vote.vote,
            pseudo: pseudoById.get(vote.voter_id) || "Utilisateur",
            created_at: vote.created_at,
            updated_at: vote.updated_at,
        })),
    };
}

export async function resolveCancellationProposalIfNeeded(
    supabase: SupabaseClient,
    proposal: ProposalRow,
    eligibleVoterIds: string[],
    activityStatus: string
): Promise<CancellationProposalStatus | null> {
    if (proposal.status !== "active") return null;

    const { data: voteRows } = await supabase
        .from("activity_cancellation_votes")
        .select("vote")
        .eq("proposal_id", proposal.id);

    const votes = (voteRows || []) as Array<{ vote: CancellationVoteValue }>;
    const yes = votes.filter((vote) => vote.vote === "yes").length;
    const no = votes.filter((vote) => vote.vote === "no").length;
    const expired = new Date(proposal.expires_at).getTime() <= Date.now();
    const quorumRequired = getCancellationVoteQuorum(eligibleVoterIds.length);

    // Vote can only be resolved when the timer expires.
    if (!expired) {
        return null;
    }

    const hasQuorum = votes.length >= quorumRequired;
    const nextStatus: CancellationProposalStatus = hasQuorum && yes > no ? "accepted" : "rejected";
    const nowIso = new Date().toISOString();

    const { error: updateProposalError } = await supabase
        .from("activity_cancellation_proposals")
        .update({ status: nextStatus, resolved_at: nowIso })
        .eq("id", proposal.id)
        .eq("status", "active");

    if (updateProposalError) {
        throw new Error(updateProposalError.message);
    }

    if (nextStatus === "accepted" && activityStatus !== "annulé") {
        const { error: cancelActivityError } = await supabase
            .from("activities")
            .update({ status: "annulé", updated_at: nowIso })
            .eq("id", proposal.activity_id)
            .neq("status", "annulé");

        if (cancelActivityError) {
            throw new Error(cancelActivityError.message);
        }
    }

    await markCancellationVoteNotificationsReadForProposalAll(supabase as never, {
        proposalId: proposal.id,
    });

    return nextStatus;
}
