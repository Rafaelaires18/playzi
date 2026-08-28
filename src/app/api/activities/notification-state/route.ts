import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import {
    canAuthorizedMemberAccessChat,
    getActivityComputedStatus,
    getUrgentChatOpenMs,
    isRunningOrCyclingSport,
    isSoloCompletedWithoutPeers,
} from "@/lib/activity-rules";

type ActivityRow = {
    id: string;
    creator_id: string | null;
    sport: string | null;
    status: string | null;
    start_time: string | null;
    updated_at: string | null;
    max_attendees: number | null;
    pulse_finalized_at: string | null;
};

type ParticipationRow = {
    activity_id: string;
    user_id: string;
    status: string | null;
};

type FeedbackRow = {
    activity_id: string;
    reviewer_id: string;
};

type ChatReadRow = {
    activity_id: string;
    last_read_at: string | null;
};

type ChatMessageRow = {
    activity_id: string;
    created_at: string | null;
};

type PulseSummaryRow = {
    activity_id: string;
    total_points: number | null;
    breakdown: unknown;
};

type CancellationProposalRow = {
    id: string;
    activity_id: string;
    expires_at: string | null;
};

type CancellationVoteRow = {
    proposal_id: string;
};

type CancellationNotificationRow = {
    proposal_id: string;
    activity_id: string;
    read_at: string | null;
};

type InvitationRow = {
    activity_id: string;
    status: string | null;
    reservation_expires_at?: string | null;
};

function isPulseClaimable(summary: PulseSummaryRow) {
    return Number(summary.total_points || 0) > 0
        && Array.isArray(summary.breakdown)
        && summary.breakdown.some((line) => {
            const item = line as { signed_points?: unknown; claim_state?: unknown };
            return Number(item.signed_points || 0) > 0 && item.claim_state === "pending";
        });
}

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const [
            { data: userParticipations, error: participationsError },
            { data: createdActivities, error: createdError },
            { data: invitationActivityRows, error: invitationsError },
        ] = await Promise.all([
            supabase
                .from("participations")
                .select("activity_id")
                .eq("user_id", user.id),
            supabase
                .from("activities")
                .select("id")
                .eq("creator_id", user.id),
            supabase
                .from("activity_invitations")
                .select("activity_id")
                .eq("invitee_id", user.id)
                .in("status", ["pending", "expired"]),
        ]);

        if (participationsError || createdError || invitationsError) {
            return createErrorResponse("Impossible de charger l'état des activités", 400);
        }

        const activityIds = Array.from(new Set([
            ...(userParticipations || []).map((row) => String(row.activity_id || "")),
            ...(createdActivities || []).map((row) => String(row.id || "")),
            ...(invitationActivityRows || []).map((row) => String(row.activity_id || "")),
        ].filter(Boolean)));

        if (activityIds.length === 0) {
            return createSuccessResponse({
                upcomingRedCount: 0,
                upcomingInvitationCount: 0,
                upcomingUnreadCount: 0,
                upcomingCancellationVoteCount: 0,
                pastPostActionCount: 0,
                pastNeedsAttention: false,
                pastHasGoldClaim: false,
            }, 200);
        }

        const [
            { data: activities, error: activitiesError },
            { data: participations, error: allParticipationsError },
            { data: feedbackRows, error: feedbackError },
            { data: readRows, error: readsError },
            { data: chatRows, error: chatError },
            { data: pulseSummaries, error: pulseError },
            { data: activeCancellationProposals, error: proposalsError },
            { data: invitationRows, error: invitationRowsError },
        ] = await Promise.all([
            supabase
                .from("activities")
                .select("id,creator_id,sport,status,start_time,updated_at,max_attendees,pulse_finalized_at")
                .in("id", activityIds),
            supabase
                .from("participations")
                .select("activity_id,user_id,status")
                .in("activity_id", activityIds),
            supabase
                .from("activity_feedback")
                .select("activity_id,reviewer_id")
                .in("activity_id", activityIds),
            supabase
                .from("activity_chat_reads")
                .select("activity_id,last_read_at")
                .eq("user_id", user.id)
                .in("activity_id", activityIds),
            supabase
                .from("activity_chat_messages")
                .select("activity_id,created_at")
                .in("activity_id", activityIds)
                .neq("sender_id", user.id),
            supabase
                .from("pulse_summaries")
                .select("activity_id,total_points,breakdown")
                .eq("user_id", user.id)
                .in("activity_id", activityIds),
            supabase
                .from("activity_cancellation_proposals")
                .select("id,activity_id,expires_at")
                .eq("status", "active")
                .in("activity_id", activityIds),
            supabase
                .from("activity_invitations")
                .select("activity_id,status,reservation_expires_at")
                .eq("invitee_id", user.id)
                .in("activity_id", activityIds)
                .in("status", ["pending", "accepted", "expired"]),
        ]);

        if (
            activitiesError
            || allParticipationsError
            || feedbackError
            || readsError
            || chatError
            || pulseError
            || proposalsError
            || invitationRowsError
        ) {
            return createErrorResponse("Impossible de charger l'état des activités", 400);
        }

        const nowMs = Date.now();
        const participationsByActivity = new Map<string, ParticipationRow[]>();
        for (const participation of (participations || []) as ParticipationRow[]) {
            const list = participationsByActivity.get(participation.activity_id) || [];
            list.push(participation);
            participationsByActivity.set(participation.activity_id, list);
        }

        const feedbackByActivity = new Map<string, FeedbackRow[]>();
        for (const feedback of (feedbackRows || []) as FeedbackRow[]) {
            const list = feedbackByActivity.get(feedback.activity_id) || [];
            list.push(feedback);
            feedbackByActivity.set(feedback.activity_id, list);
        }

        const readMsByActivity = new Map<string, number>();
        for (const read of (readRows || []) as ChatReadRow[]) {
            const readMs = read.last_read_at ? new Date(read.last_read_at).getTime() : NaN;
            if (Number.isFinite(readMs)) readMsByActivity.set(read.activity_id, readMs);
        }

        const unreadMessagesByActivity = new Map<string, number>();
        for (const message of (chatRows || []) as ChatMessageRow[]) {
            const createdMs = message.created_at ? new Date(message.created_at).getTime() : NaN;
            if (!Number.isFinite(createdMs)) continue;
            const lastReadMs = readMsByActivity.get(message.activity_id) || 0;
            if (createdMs > lastReadMs) {
                unreadMessagesByActivity.set(message.activity_id, (unreadMessagesByActivity.get(message.activity_id) || 0) + 1);
            }
        }

        const pulseClaimableByActivity = new Set(
            ((pulseSummaries || []) as PulseSummaryRow[])
                .filter(isPulseClaimable)
                .map((summary) => summary.activity_id)
        );

        const activeProposals = ((activeCancellationProposals || []) as CancellationProposalRow[])
            .filter((proposal) => {
                const expiresAtMs = proposal.expires_at ? new Date(proposal.expires_at).getTime() : NaN;
                return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
            });
        const activeProposalIds = activeProposals.map((proposal) => proposal.id).filter(Boolean);
        const [{ data: myVotes }, { data: cancellationNotifications }] = activeProposalIds.length > 0
            ? await Promise.all([
                supabase
                    .from("activity_cancellation_votes")
                    .select("proposal_id")
                    .eq("voter_id", user.id)
                    .in("proposal_id", activeProposalIds),
                supabase
                    .from("activity_cancellation_vote_notifications")
                    .select("proposal_id,activity_id,read_at")
                    .eq("user_id", user.id)
                    .in("proposal_id", activeProposalIds),
            ])
            : [{ data: [] }, { data: [] }];

        const votedProposalIds = new Set(((myVotes || []) as CancellationVoteRow[]).map((vote) => vote.proposal_id));
        const unreadCancellationVotesByActivity = new Map<string, number>();
        const notificationByProposalId = new Map<string, CancellationNotificationRow>();
        for (const notification of (cancellationNotifications || []) as CancellationNotificationRow[]) {
            notificationByProposalId.set(notification.proposal_id, notification);
        }
        for (const proposal of activeProposals) {
            if (votedProposalIds.has(proposal.id)) continue;
            const notification = notificationByProposalId.get(proposal.id);
            if (notification && notification.read_at !== null) continue;
            unreadCancellationVotesByActivity.set(
                proposal.activity_id,
                (unreadCancellationVotesByActivity.get(proposal.activity_id) || 0) + 1
            );
        }

        const pendingInvitationByActivity = new Set<string>();
        for (const invitation of (invitationRows || []) as InvitationRow[]) {
            const status = String(invitation.status || "");
            const expiresAt = invitation.reservation_expires_at || null;
            const isExpiredByReservation = !!expiresAt && expiresAt <= new Date(nowMs).toISOString();
            if (status === "pending" && !isExpiredByReservation) {
                pendingInvitationByActivity.add(invitation.activity_id);
            }
        }

        let upcomingRedCount = 0;
        let upcomingInvitationCount = 0;
        let upcomingUnreadCount = 0;
        let upcomingCancellationVoteCount = 0;
        let pastPostActionCount = 0;
        let pastNeedsAttention = false;
        let pastHasGoldClaim = false;

        for (const activity of (activities || []) as ActivityRow[]) {
            const participationsForActivity = participationsByActivity.get(activity.id) || [];
            const confirmedParticipations = participationsForActivity.filter((participation) => participation.status === "confirmé");
            const isCreator = activity.creator_id === user.id;
            const isConfirmedParticipant = confirmedParticipations.some((participation) => participation.user_id === user.id);
            const attendees = 1 + confirmedParticipations.filter((participation) => participation.user_id !== activity.creator_id).length;
            const startMs = activity.start_time ? new Date(activity.start_time).getTime() : NaN;
            const computedStatus = getActivityComputedStatus({
                status: activity.status || "",
                start_time: activity.start_time || "",
                max_attendees: activity.max_attendees || 0,
                attendees,
                sport: activity.sport || "",
            }, { nowMs, pastBufferMs: 0 });
            const isPast = computedStatus === "completed" || computedStatus === "cancelled";

            const activityFeedback = feedbackByActivity.get(activity.id) || [];
            let feedbackStatus: "pending" | "completed" | "expired" | "too_early" | undefined;
            if (isPast && (isConfirmedParticipant || isCreator)) {
                const isSoloCompletedAlone = isSoloCompletedWithoutPeers({ sport: activity.sport || "", attendees });
                if (activity.status === "annulé" || isSoloCompletedAlone) {
                    feedbackStatus = "expired";
                } else if (activityFeedback.some((feedback) => feedback.reviewer_id === user.id)) {
                    feedbackStatus = "completed";
                } else {
                    const hoursSinceStart = Number.isFinite(startMs) ? (nowMs - startMs) / (1000 * 60 * 60) : 0;
                    if (hoursSinceStart >= 2 && hoursSinceStart <= 6) feedbackStatus = "pending";
                    else if (hoursSinceStart > 6) feedbackStatus = "expired";
                    else feedbackStatus = "too_early";
                }
            }

            const isUpcoming = Number.isFinite(startMs)
                && startMs > nowMs
                && ["ouvert", "complet", "confirmé", "en_attente"].includes(String(activity.status || ""));
            const chatOpenAtMs = (() => {
                if (!Number.isFinite(startMs)) return null;
                if (isRunningOrCyclingSport(activity.sport || "")) {
                    return startMs - (24 * 60 * 60 * 1000);
                }
                if (activity.status === "confirmé" || activity.status === "complet") {
                    const updatedAtMs = activity.updated_at ? new Date(activity.updated_at).getTime() : NaN;
                    return Number.isFinite(updatedAtMs) ? updatedAtMs : null;
                }
                return getUrgentChatOpenMs({
                    start_time: activity.start_time || "",
                    max_attendees: activity.max_attendees || 0,
                });
            })();
            const chatIsOpenNow = (isCreator || isConfirmedParticipant) && canAuthorizedMemberAccessChat({
                sport: activity.sport || "",
                status: activity.status || "",
                start_time: activity.start_time || "",
                max_attendees: activity.max_attendees || 0,
                attendees,
            }, nowMs);
            const hasUnreadChatOpenEvent = isUpcoming
                && chatIsOpenNow
                && chatOpenAtMs !== null
                && (readMsByActivity.get(activity.id) || 0) < chatOpenAtMs;

            const unreadRedCount = (unreadMessagesByActivity.get(activity.id) || 0) + (hasUnreadChatOpenEvent ? 1 : 0);
            const unreadAmberCount = unreadCancellationVotesByActivity.get(activity.id) || 0;
            const unreadBlueCount = feedbackStatus === "pending" ? 1 : 0;
            const unreadGoldCount = pulseClaimableByActivity.has(activity.id) ? 1 : 0;
            const unreadInvitationCount = pendingInvitationByActivity.has(activity.id) ? 1 : 0;

            if (isUpcoming) {
                upcomingRedCount += unreadRedCount;
                upcomingInvitationCount += unreadInvitationCount;
                upcomingUnreadCount += unreadRedCount + unreadInvitationCount;
                upcomingCancellationVoteCount += unreadAmberCount;
            } else if (isPast) {
                const hasPostAction = unreadBlueCount > 0 || unreadGoldCount > 0 || pulseClaimableByActivity.has(activity.id);
                pastPostActionCount += hasPostAction ? 1 : 0;
                pastNeedsAttention ||= feedbackStatus === "pending" || unreadBlueCount > 0;
                pastHasGoldClaim ||= unreadGoldCount > 0 || pulseClaimableByActivity.has(activity.id);
            }
        }

        return createSuccessResponse({
            upcomingRedCount,
            upcomingInvitationCount,
            upcomingUnreadCount,
            upcomingCancellationVoteCount,
            pastPostActionCount,
            pastNeedsAttention,
            pastHasGoldClaim,
        }, 200);
    } catch (error) {
        return createErrorResponse(
            "Erreur interne",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}
