import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActivitySchema } from "@/lib/validations/activities";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { sanitizeActivityLocationForViewer } from "@/lib/security/activity-location";
import { pickRandomImageForSportExcluding } from "@/lib/sport-images";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
    canAuthorizedMemberAccessChat,
    getActivityComputedStatus,
    getUrgentChatOpenMs,
    isRunningOrCyclingSport,
    isSoloCapableSport,
    isSoloCompletedWithoutPeers,
    resolveStartedPendingActivityStatus,
} from "@/lib/activity-rules";
import { tryFinalizeActivityPulse } from "@/lib/pulse";
import { enforceUserCapability, getModerationServiceClient, isModeratorUser } from "@/lib/moderation";
import { getBlockedUserIdsForUser } from "@/lib/blocks";
import { canUsePlayziPlusFeature, getUserEntitlements } from "@/lib/billing/entitlements";
import {
    ACTIVITY_CREATION_LIMIT_ERROR_CODE,
    deleteActivityAfterCreationEventFailure,
    getActivityCreationEligibility,
    recordActivityCreationEvent,
} from "@/lib/activity-creation-limit";
import fs from "fs";
import {
    buildActivityNotificationTitle,
    buildActivityNotificationDedupeKey,
    createUserNotifications,
    getSportsNotificationsEnabledMap,
    USER_NOTIFICATION_TYPES,
} from "@/lib/user-notifications";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
const INVITE_DEBUG_ENABLED = process.env.NODE_ENV !== "production";
const DISCOVER_PUBLICATION_GRACE_MS = 3 * 60 * 1000;
const ACTIVITY_REMINDER_WINDOW_MS = 30 * 60 * 1000;

function inviteDebug(...args: unknown[]) {
    if (!INVITE_DEBUG_ENABLED) return;
    console.log(...args);
}

function isFemaleGender(value: unknown) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "female" || normalized === "femme";
}

export async function GET(req: NextRequest) {
    try {
        const debugRequestId = INVITE_DEBUG_ENABLED
            ? `activities_get_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
            : "";
        const supabase = await createClient();
        const serviceRoleClient = (() => {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (!url || !key) return null;
            return createSupabaseClient(url, key, {
                auth: { persistSession: false, autoRefreshToken: false },
            });
        })();
        const db = serviceRoleClient ?? supabase;

        // Options de filtrage (ex: /api/activities?sport=Running)
        const { searchParams } = new URL(req.url);
        const sport = searchParams.get('sport');
        const status = searchParams.get('status');
        const filter = searchParams.get('filter');

        // Nouveaux filtres Discover
        const genderFilterParam = searchParams.get('genderFilter');
        const cityFilterParam = searchParams.get('city');
        const maxDistanceParam = searchParams.get('maxDistance');
        const userLatParam = searchParams.get('userLat');
        const userLngParam = searchParams.get('userLng');

        let query = db
            .from('activities')
            .select(`*`)
            .order('start_time', { ascending: true });

        // --- GENDER & USER FILTERING PREP ---
        const { data: { user } } = await supabase.auth.getUser();
        const blockedUserIds = user?.id
            ? await getBlockedUserIdsForUser(db as never, user.id)
            : new Set<string>();
        let userGender = 'male'; // Default safe assumption if missing
        let canUseAdvancedFilters = false;

        if (user) {
            const { data: profile } = await db
                .from('profiles')
                .select('gender')
                .eq('id', user.id)
                .single();
            if (profile?.gender) {
                userGender = profile.gender;
            }
            const entitlements = await getUserEntitlements(user.id, db as never);
            canUseAdvancedFilters = canUsePlayziPlusFeature(entitlements, "advanced_filters");
        }
        const effectiveCityFilterParam = canUseAdvancedFilters ? cityFilterParam : null;
        const requestedMaxDistance = Number(maxDistanceParam);
        const effectiveMaxDistance = canUseAdvancedFilters ? requestedMaxDistance : 30;

        // Apply route specific filters
        if (filter === 'my_activities') {
            if (!user) {
                return createErrorResponse("Vous devez être connecté pour voir vos activités", 401);
            }

            // Fetch IDs of activities where user is a participant
            const { data: userParticipations } = await db
                .from('participations')
                .select('activity_id')
                .eq('user_id', user.id);

            const joinedActivityIds = userParticipations?.map(p => p.activity_id) || [];

            // Fetch IDs of activities created by the user
            const { data: createdActivities } = await db
                .from('activities')
                .select('id')
                .eq('creator_id', user.id);

            const createdActivityIds = createdActivities?.map(a => a.id) || [];
            const { data: pendingInvitations } = await db
                .from("activity_invitations")
                .select("activity_id")
                .eq("invitee_id", user.id)
                .in("status", ["pending", "expired"]);
            const pendingInvitationActivityIds = (pendingInvitations || []).map((row: any) => row.activity_id).filter(Boolean);
            inviteDebug(`[INVITE_DEBUG][${debugRequestId}] my_activities pending invitations`, {
                user_id: user.id,
                pending_invitation_activity_ids: pendingInvitationActivityIds,
                pending_invitation_count: pendingInvitationActivityIds.length,
            });

            const allMyActivityIds = [...new Set([...joinedActivityIds, ...createdActivityIds, ...pendingInvitationActivityIds])];
            inviteDebug(`[INVITE_DEBUG][${debugRequestId}] my_activities candidate ids`, {
                user_id: user.id,
                joined_count: joinedActivityIds.length,
                created_count: createdActivityIds.length,
                all_my_activity_count: allMyActivityIds.length,
            });

            if (allMyActivityIds.length === 0) {
                return createSuccessResponse([], 200); // Early return empty array if no activities
            }

            query = query.in('id', allMyActivityIds);

        } else {
            // Default feed behavior
            if (sport) {
                query = query.eq('sport', sport);
            }
            if (status) {
                query = query.eq('status', status);
            } else {
                query = query.in('status', ['ouvert', 'complet', 'confirmé', 'en_attente']);
            }
        }

        // 1. Localisation (Ville)
        if (effectiveCityFilterParam) {
            query = query.ilike('location', `%${effectiveCityFilterParam}%`);
        }

        const { data, error } = await query;

        if (error) {
            return createErrorResponse("Erreur lors de la récupération des activités", 500, error.message);
        }

        let filteredData = data || [];

        // Auto-resolve stale pending activities when start_time is reached:
        // - solo-capable sports => maintain activity (`confirmé`)
        // - group sports full => maintained (`complet`)
        // - group sports insufficient => auto-cancel (`annulé`)
        const stalePendingCandidates = filteredData
            .filter((a: any) => {
                const hasStarted = new Date(a.start_time).getTime() <= Date.now();
                return a.status === "en_attente" && hasStarted;
            });

        if (stalePendingCandidates.length > 0) {
            const nowIso = new Date().toISOString();
            const stalePendingActivityIds = stalePendingCandidates
                .map((a: any) => a.id)
                .filter(Boolean);

            const [{ data: currentPendingActivities, error: currentPendingError }, { data: confirmedParticipations, error: confirmedParticipationsError }] = await Promise.all([
                db
                    .from("activities")
                    .select("id,max_attendees,status,sport")
                    .in("id", stalePendingActivityIds)
                    .eq("status", "en_attente"),
                db
                    .from("participations")
                    .select("activity_id,user_id")
                    .in("activity_id", stalePendingActivityIds)
                    .eq("status", "confirmé"),
            ]);

            if (currentPendingError) {
                console.warn("[ACTIVITIES] stale pending recheck failed:", currentPendingError.message);
            }
            if (confirmedParticipationsError) {
                console.warn("[ACTIVITIES] stale pending participations recheck failed:", confirmedParticipationsError.message);
            }

            const confirmedCountByActivity = new Map<string, number>();
            for (const row of confirmedParticipations || []) {
                confirmedCountByActivity.set(
                    row.activity_id,
                    (confirmedCountByActivity.get(row.activity_id) || 0) + 1
                );
            }

            const idsToMarkComplete: string[] = [];
            const idsToAutoConfirm: string[] = [];
            const idsToAutoCancel: string[] = [];
            for (const activity of currentPendingActivities || []) {
                const resolvedStatus = resolveStartedPendingActivityStatus({
                    sport: activity.sport,
                    max_attendees: activity.max_attendees,
                    confirmed_participants: confirmedCountByActivity.get(activity.id) || 0,
                });
                if (resolvedStatus === "confirmé") {
                    idsToAutoConfirm.push(activity.id);
                    continue;
                }
                if (resolvedStatus === "complet") {
                    idsToMarkComplete.push(activity.id);
                } else {
                    idsToAutoCancel.push(activity.id);
                }
            }

            if (idsToAutoConfirm.length > 0) {
                const { error: autoConfirmError } = await db
                    .from("activities")
                    .update({ status: "confirmé", updated_at: nowIso })
                    .in("id", idsToAutoConfirm)
                    .eq("status", "en_attente");

                if (autoConfirmError) {
                    console.warn("[ACTIVITIES] auto-confirm stale pending solo failed:", autoConfirmError.message);
                } else {
                    console.info("[ACTIVITIES] stale pending auto-confirmed solo activities", { count: idsToAutoConfirm.length });
                    filteredData = filteredData.map((a: any) =>
                        idsToAutoConfirm.includes(a.id) ? { ...a, status: "confirmé", updated_at: nowIso } : a
                    );
                }
            }

            if (idsToMarkComplete.length > 0) {
                const { error: autoCompleteError } = await db
                    .from("activities")
                    .update({ status: "complet", updated_at: nowIso })
                    .in("id", idsToMarkComplete)
                    .eq("status", "en_attente");

                if (autoCompleteError) {
                    console.warn("[ACTIVITIES] auto-complete stale pending failed:", autoCompleteError.message);
                } else {
                    filteredData = filteredData.map((a: any) =>
                        idsToMarkComplete.includes(a.id) ? { ...a, status: "complet", updated_at: nowIso } : a
                    );
                }
            }

            if (idsToAutoCancel.length > 0) {
                const { error: autoCancelError } = await db
                .from("activities")
                .update({ status: "annulé", updated_at: nowIso })
                .in("id", idsToAutoCancel)
                .eq("status", "en_attente");

                if (autoCancelError) {
                    console.warn("[ACTIVITIES] auto-cancel failed:", autoCancelError.message);
                } else {
                    console.info("[ACTIVITIES] stale pending auto-cancelled group activities", { count: idsToAutoCancel.length });
                    filteredData = filteredData.map((a: any) =>
                        idsToAutoCancel.includes(a.id) ? { ...a, status: "annulé", updated_at: nowIso } : a
                    );
                }
            }
        }

        // 2. Discover feed cleanup: remove "dead/closed" activities from discover
        if (filter !== 'my_activities') {
            let joinedActivityIds = new Set<string>();
            const confirmedParticipantCountByActivity = new Map<string, number>();
            const creatorByActivityId = new Map<string, string>();
            const activeReservationByActivityId = new Set<string>();

            for (const activity of filteredData as any[]) {
                if (activity?.id && activity?.creator_id) {
                    creatorByActivityId.set(activity.id, activity.creator_id);
                }
            }

            if (user?.id) {
                const { data: userParticipations } = await db
                    .from("participations")
                    .select("activity_id")
                    .eq("user_id", user.id);
                joinedActivityIds = new Set((userParticipations || []).map((p: any) => p.activity_id).filter(Boolean));
            }

            const discoverActivityIds = (filteredData as any[]).map((a) => a.id).filter(Boolean);
            if (discoverActivityIds.length > 0) {
                const nowIso = new Date().toISOString();
                const [
                    { data: confirmedParticipations },
                    activeReservationsResult,
                ] = await Promise.all([
                    db
                        .from("participations")
                        .select("activity_id,user_id")
                        .in("activity_id", discoverActivityIds)
                        .eq("status", "confirmé"),
                    db
                        .from("activity_invitations")
                        .select("activity_id")
                        .in("activity_id", discoverActivityIds)
                        .eq("status", "pending")
                        .gt("reservation_expires_at", nowIso),
                ]);

                let activeReservations = activeReservationsResult.data || [];
                const activeReservationsError = activeReservationsResult.error;
                const reservationColumnMissing = !!activeReservationsError && (
                    activeReservationsError.code === "42703"
                    || activeReservationsError.code === "PGRST204"
                    || String(activeReservationsError.message || "").toLowerCase().includes("reservation_expires_at")
                );
                if (reservationColumnMissing) {
                    activeReservations = [];
                } else if (activeReservationsError) {
                    console.warn("[ACTIVITIES] discover active reservations query failed:", activeReservationsError.message);
                }

                for (const row of confirmedParticipations || []) {
                    const creatorId = creatorByActivityId.get(row.activity_id);
                    if (creatorId && row.user_id === creatorId) continue;
                    confirmedParticipantCountByActivity.set(
                        row.activity_id,
                        (confirmedParticipantCountByActivity.get(row.activity_id) || 0) + 1
                    );
                }

                for (const row of activeReservations || []) {
                    if (row?.activity_id) activeReservationByActivityId.add(String(row.activity_id));
                }
            }

            const nowMs = Date.now();
            filteredData = filteredData.filter((a: any) => {
                if (blockedUserIds.has(String(a.creator_id || ""))) return false;
                if (user?.id && a.creator_id === user.id) return false; // Never show own created activities in Discover
                if (user?.id && joinedActivityIds.has(a.id)) return false; // Never show joined activities in Discover
                if (activeReservationByActivityId.has(String(a.id))) return false; // Temporarily hidden while invited seats are reserved
                const createdAtMs = new Date(a.created_at).getTime();
                const isWithinPublicationGraceWindow =
                    Number.isFinite(createdAtMs) && (nowMs - createdAtMs) < DISCOVER_PUBLICATION_GRACE_MS;
                if (isWithinPublicationGraceWindow) return false; // Hide newly published activity for first 5 minutes
                const isAutoConfirmedSport = isSoloCapableSport(a.sport);
                const startMs = new Date(a.start_time).getTime();
                const hasAttendeeLimit = Number(a.max_attendees || 0) > 0;
                const confirmedParticipants = confirmedParticipantCountByActivity.get(a.id) || 0;
                const attendees = 1 + confirmedParticipants;
                const isFull = hasAttendeeLimit && attendees >= Number(a.max_attendees);
                const urgentOpenMs = getUrgentChatOpenMs({
                    start_time: a.start_time,
                    max_attendees: a.max_attendees,
                });

                // Urgent = quota activity, not full, and urgent window reached.
                const isUrgent = hasAttendeeLimit
                    && !isFull
                    && Number.isFinite(startMs)
                    && startMs > nowMs
                    && urgentOpenMs !== null
                    && nowMs >= urgentOpenMs;

                // 1. Hide activities whose start time has already passed
                if (Number.isFinite(startMs) && startMs <= nowMs) return false;

                // 2. Hide cancelled / past / full activities
                if (a.status === "annulé" || a.status === "passé" || a.status === "complet") return false;
                if (isFull) return false;

                // 3. Hide manually confirmed activities UNLESS they are in urgent mode
                // (Urgent activities stay visible so last-minute joiners can still sign up)
                if (a.status === "confirmé" && !isAutoConfirmedSport && !isUrgent) return false;

                // Inject isUrgent so the SwipeCard can render the badge
                a.isUrgent = isUrgent;

                return true;
            });
        }

        // 3. Group type (Discover only) in JS to keep NULL values compatible
        if (filter !== 'my_activities') {
            const isFemale = userGender === 'female' || userGender === 'femme';

            if (!isFemale) {
                // Only female profiles can see activities restricted to women.
                filteredData = filteredData.filter((a: any) => a.gender_filter !== 'filles' && a.gender_filter !== 'femmes');
            } else if (isFemale && genderFilterParam && genderFilterParam !== 'tout') {
                // Women using the UI filter to see only 'mixte' or only 'filles'
                if (genderFilterParam === 'mixte') {
                    filteredData = filteredData.filter((a: any) => !a.gender_filter || a.gender_filter === 'mixte');
                } else if (genderFilterParam === 'filles') {
                    filteredData = filteredData.filter((a: any) => a.gender_filter === 'filles' || a.gender_filter === 'femmes');
                }
            }
        }

        // 4. Distance (Discover only): apply only when NO city filter is selected.
        // Business rule: city filter has priority over distance filter.
        const shouldApplyDistanceFilter = filter !== 'my_activities' && !effectiveCityFilterParam && (
            canUseAdvancedFilters ? !!maxDistanceParam : !!user
        );
        if (shouldApplyDistanceFilter) {
            const maxDist = effectiveMaxDistance;
            const userLat = Number(userLatParam);
            const userLng = Number(userLngParam);

            const hasUserOrigin = Number.isFinite(userLat) && Number.isFinite(userLng);
            if (Number.isFinite(maxDist) && maxDist > 0 && maxDist <= 30 && hasUserOrigin) {
                const cityCoords: Record<string, { lat: number; lng: number }> = {
                    Lausanne: { lat: 46.5197, lng: 6.6323 },
                    Genève: { lat: 46.2044, lng: 6.1432 },
                    Neuchâtel: { lat: 46.99, lng: 6.9293 },
                };

                const toRad = (value: number) => value * Math.PI / 180;
                const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
                    const R = 6371;
                    const dLat = toRad(lat2 - lat1);
                    const dLng = toRad(lng2 - lng1);
                    const a =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                        Math.sin(dLng / 2) * Math.sin(dLng / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    return R * c;
                };

                filteredData = filteredData.filter((a: any) => {
                    let targetLat = Number(a.lat);
                    let targetLng = Number(a.lng);

                    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) {
                        const locationText = String(a.location || "");
                        const matchedCity = Object.keys(cityCoords).find((cityName) =>
                            locationText.toLowerCase().includes(cityName.toLowerCase())
                        );
                        if (!matchedCity) return false;
                        targetLat = cityCoords[matchedCity].lat;
                        targetLng = cityCoords[matchedCity].lng;
                    }

                    const distanceKm = haversineKm(userLat, userLng, targetLat, targetLng);
                    return distanceKm <= maxDist;
                });
            }
        }

        // Pulse finalization safety net:
        // if feedback window closed (or all feedback already done), finalize even without new POST /feedback.
        if (filter === "my_activities") {
            const nowMs = Date.now();
            const pendingPulseFinalizeIds = (filteredData as any[])
                .filter((a) => {
                    if (!a?.id || a?.pulse_finalized_at) return false;
                    const startMs = new Date(a.start_time).getTime();
                    return Number.isFinite(startMs) && startMs <= nowMs;
                })
                .map((a) => a.id)
                .filter(Boolean);

            if (pendingPulseFinalizeIds.length > 0) {
                await Promise.all(
                    pendingPulseFinalizeIds.map(async (activityId) => {
                        try {
                            await tryFinalizeActivityPulse(db as any, activityId, {
                                scopeUserId: user?.id || null,
                            });
                        } catch (e) {
                            console.warn("[ACTIVITIES] pulse finalization check failed:", activityId, e instanceof Error ? e.message : e);
                        }
                    })
                );
            }
        }

        // Load participations + feedback in separate queries for robustness
        const activityIds = filteredData.map((a: any) => a.id).filter(Boolean);
        const creatorIds = [...new Set(filteredData.map((a: any) => a.creator_id).filter(Boolean))];
        const participationsByActivity = new Map<string, any[]>();
        const feedbackByActivity = new Map<string, any[]>();
        const creatorById = new Map<string, { id: string; pseudo: string; grade?: string }>();
        const chatLastReadByActivity = new Map<string, number>();
        const unreadChatMessagesByActivity = new Map<string, number>();
        const unreadCancellationVotesByActivity = new Map<string, number>();
        const cancellationAcknowledgedByActivity = new Map<string, boolean>();
        const pendingInvitationByActivity = new Map<string, {
            invitation_id: string;
            inviter_user_id: string;
            inviter_pseudo: string;
            status: "pending" | "accepted" | "expired";
            reserved_until: string | null;
            notification_type: "activity_invitation";
            push_payload: {
                type: "activity_invitation";
                activity_id: string;
                invitation_id: string;
                inviter_user_id: string;
                url?: string;
            };
        }>();
        const activeCancellationVoteByActivity = new Map<string, {
            proposal_id: string;
            expires_at: string;
            reason_code: string;
            reason_text: string | null;
            user_has_voted: boolean;
        }>();
        const pulseSummaryCreatedAtByActivity = new Map<string, string>();
        const pulseClaimableByActivity = new Map<string, boolean>();

        if (creatorIds.length > 0) {
            const { data: creators, error: creatorsError } = await db
                .from("profiles")
                .select("id, pseudo, grade")
                .in("id", creatorIds);

            if (!creatorsError && creators) {
                for (const creator of creators as any[]) {
                    creatorById.set(creator.id, creator);
                }
            } else if (creatorsError) {
                console.warn("[ACTIVITIES] creators query failed:", creatorsError.message);
            }
        }

        if (activityIds.length > 0) {
            const { data: participationsData, error: partError } = await db
                .from('participations')
                .select('activity_id, status, user_id, profiles(pseudo)')
                .in('activity_id', activityIds);

            if (!partError && participationsData) {
                for (const p of participationsData as any[]) {
                    const list = participationsByActivity.get(p.activity_id) || [];
                    list.push(p);
                    participationsByActivity.set(p.activity_id, list);
                }
            } else if (partError) {
                console.warn("[ACTIVITIES] participations query failed:", partError.message);
            }

            if (blockedUserIds.size > 0) {
                filteredData = filteredData.filter((activity: any) => {
                    if (blockedUserIds.has(String(activity.creator_id || ""))) return false;
                    const participations = participationsByActivity.get(activity.id) || [];
                    const hasBlockedParticipant = participations.some((p: any) =>
                        blockedUserIds.has(String(p.user_id || ""))
                    );
                    return !hasBlockedParticipant;
                });
            }

            const { data: feedbackData, error: feedbackError } = await db
                .from('activity_feedback')
                .select('activity_id, id, reviewer_id')
                .in('activity_id', activityIds);

            if (!feedbackError && feedbackData) {
                for (const f of feedbackData as any[]) {
                    const list = feedbackByActivity.get(f.activity_id) || [];
                    list.push(f);
                    feedbackByActivity.set(f.activity_id, list);
                }
            } else if (feedbackError) {
                console.warn("[ACTIVITIES] feedback query failed:", feedbackError.message);
            }

            if (filter === "my_activities" && user?.id) {
                const [
                    { data: readRows, error: readsError },
                    { data: chatRows, error: chatError },
                    { data: pulseSummaries },
                    { data: activeCancellationProposals, error: activeCancellationProposalsError },
                    { data: cancellationAcknowledgements, error: cancellationAcknowledgementsError },
                    invitationRowsResult,
                ] = await Promise.all([
                    db
                        .from("activity_chat_reads")
                        .select("activity_id,last_read_at")
                        .eq("user_id", user.id)
                        .in("activity_id", activityIds),
                    db
                        .from("activity_chat_messages")
                        .select("activity_id,created_at,sender_id")
                        .in("activity_id", activityIds)
                        .neq("sender_id", user.id),
                    db
                        .from("pulse_summaries")
                        .select("activity_id,created_at,total_points,breakdown")
                        .eq("user_id", user.id)
                        .in("activity_id", activityIds),
                    db
                        .from("activity_cancellation_proposals")
                        .select("id,activity_id,status,expires_at,reason_code,reason_text")
                        .eq("status", "active")
                        .in("activity_id", activityIds),
                    db
                        .from("activity_cancellation_acknowledgements")
                        .select("activity_id")
                        .eq("user_id", user.id)
                        .in("activity_id", activityIds),
                    db
                        .from("activity_invitations")
                        .select("id,activity_id,inviter_id,status,reservation_expires_at")
                        .eq("invitee_id", user.id)
                        .in("activity_id", activityIds)
                        .in("status", ["pending", "accepted", "expired"]),
                ]);
                let invitationRows = invitationRowsResult.data || [];
                let invitationRowsError = invitationRowsResult.error;

                const invitationRowsNeedsLegacyFallback = !!invitationRowsError && (
                    invitationRowsError.code === "42703"
                    || invitationRowsError.code === "PGRST204"
                    || String(invitationRowsError.message || "").toLowerCase().includes("reservation_expires_at")
                );
                if (invitationRowsNeedsLegacyFallback) {
                    const legacyInvitationRowsResult = await db
                        .from("activity_invitations")
                        .select("id,activity_id,inviter_id,status")
                        .eq("invitee_id", user.id)
                        .in("activity_id", activityIds)
                        .in("status", ["pending", "accepted", "expired"]);
                    invitationRows = (legacyInvitationRowsResult.data || []).map((row: any) => ({
                        ...row,
                        reservation_expires_at: null,
                    }));
                    invitationRowsError = legacyInvitationRowsResult.error;
                }

                const inviterIds = [...new Set((invitationRows || [])
                    .map((row: any) => String(row?.inviter_id || ""))
                    .filter(Boolean))];
                const { data: inviterRows, error: invitersError } = inviterIds.length > 0
                    ? await db
                        .from("profiles")
                        .select("id,pseudo")
                        .in("id", inviterIds)
                    : { data: [], error: null as { message?: string } | null };
                if (invitersError) {
                    console.warn("[ACTIVITIES] inviters query failed:", invitersError.message);
                }
                const inviterPseudoById = new Map<string, string>(
                    (inviterRows || []).map((row: any) => [String(row.id), String(row.pseudo || "utilisateur")])
                );
                const applyPulseSummaries = (rows: Array<{ activity_id: string; created_at?: string | null; total_points?: number | null; breakdown?: unknown[] }>) => {
                    for (const summary of rows || []) {
                        if (summary.created_at) {
                            pulseSummaryCreatedAtByActivity.set(summary.activity_id, summary.created_at);
                        }
                        const claimable = Number(summary.total_points || 0) > 0
                            && Array.isArray(summary.breakdown)
                            && summary.breakdown.some((line: any) => Number(line?.signed_points || 0) > 0 && line?.claim_state === "pending");
                        if (claimable) {
                            pulseClaimableByActivity.set(summary.activity_id, true);
                        }
                    }
                };

                if (readsError) {
                    console.warn("[ACTIVITIES] chat reads query failed:", readsError.message);
                } else {
                    for (const row of readRows || []) {
                        const readMs = row.last_read_at ? new Date(row.last_read_at).getTime() : NaN;
                        if (Number.isFinite(readMs)) {
                            chatLastReadByActivity.set(row.activity_id, readMs);
                        }
                    }
                }

                if (chatError) {
                    console.warn("[ACTIVITIES] chat messages query failed:", chatError.message);
                } else {
                    for (const row of chatRows || []) {
                        const createdMs = row.created_at ? new Date(row.created_at).getTime() : NaN;
                        if (!Number.isFinite(createdMs)) continue;
                        const lastReadMs = chatLastReadByActivity.get(row.activity_id) || 0;
                        if (createdMs > lastReadMs) {
                            unreadChatMessagesByActivity.set(
                                row.activity_id,
                                (unreadChatMessagesByActivity.get(row.activity_id) || 0) + 1
                            );
                        }
                    }
                }

                if (cancellationAcknowledgementsError) {
                    const isMissingTableError = (cancellationAcknowledgementsError.message || "").includes("does not exist");
                    if (!isMissingTableError) {
                        console.warn("[ACTIVITIES] cancellation acknowledgements query failed:", cancellationAcknowledgementsError.message);
                    }
                } else {
                    for (const row of cancellationAcknowledgements || []) {
                        cancellationAcknowledgedByActivity.set(row.activity_id, true);
                    }
                }

                if (invitationRowsError) {
                    const isMissingTableError = (invitationRowsError.message || "").includes("does not exist");
                    if (!isMissingTableError) {
                        console.warn("[ACTIVITIES] invitation rows query failed:", invitationRowsError.message);
                    }
                } else {
                    const nowIso = new Date().toISOString();
                    const timedOutPendingIds = (invitationRows || [])
                        .filter((row: any) => {
                            const rowStatus = String(row?.status || "pending");
                            const expiresAt = row?.reservation_expires_at ? String(row.reservation_expires_at) : null;
                            return rowStatus === "pending" && !!expiresAt && expiresAt <= nowIso;
                        })
                        .map((row: any) => String(row?.id || ""))
                        .filter(Boolean);
                    if (timedOutPendingIds.length > 0) {
                        const { error: expireError } = await db
                            .from("activity_invitations")
                            .update({
                                status: "expired",
                                updated_at: new Date().toISOString(),
                            })
                            .in("id", timedOutPendingIds)
                            .eq("invitee_id", user.id)
                            .eq("status", "pending");
                        if (expireError) {
                            const missingUpdatedAt = expireError.code === "42703"
                                || String(expireError.message || "").toLowerCase().includes("updated_at");
                            if (!missingUpdatedAt) {
                                console.warn("[ACTIVITIES] invitation timed-out expiration update failed:", expireError.message);
                            } else {
                                await db
                                    .from("activity_invitations")
                                    .update({ status: "expired" })
                                    .in("id", timedOutPendingIds)
                                    .eq("invitee_id", user.id)
                                    .eq("status", "pending");
                            }
                        } else {
                            invitationRows = (invitationRows || []).map((row: any) => (
                                timedOutPendingIds.includes(String(row?.id || ""))
                                    ? { ...row, status: "expired" }
                                    : row
                            ));
                        }
                    }
                    inviteDebug(`[INVITE_DEBUG][${debugRequestId}] invitation rows resolved`, {
                        user_id: user.id,
                        invitation_rows_count: (invitationRows || []).length,
                        invitation_rows: (invitationRows || []).map((row: any) => ({
                            id: row?.id,
                            activity_id: row?.activity_id,
                            inviter_id: row?.inviter_id,
                            status: row?.status,
                            reservation_expires_at: row?.reservation_expires_at ?? null,
                        })),
                    });
                    for (const row of invitationRows || []) {
                        const reservationExpiresAt = row.reservation_expires_at ? String(row.reservation_expires_at) : null;
                        const rowStatus = String(row.status || "pending");
                        const isExpiredByReservation = !!reservationExpiresAt && reservationExpiresAt <= nowIso;
                        const status: "pending" | "accepted" | "expired" = rowStatus === "accepted"
                            ? "accepted"
                            : (rowStatus === "expired" || isExpiredByReservation ? "expired" : "pending");
                        pendingInvitationByActivity.set(String(row.activity_id), {
                            invitation_id: String(row.id),
                            inviter_user_id: String(row.inviter_id),
                            inviter_pseudo: inviterPseudoById.get(String(row.inviter_id)) || "utilisateur",
                            status,
                            reserved_until: reservationExpiresAt,
                            notification_type: "activity_invitation",
                            push_payload: {
                                type: "activity_invitation",
                                activity_id: String(row.activity_id),
                                invitation_id: String(row.id),
                                inviter_user_id: String(row.inviter_id),
                                url: `/activities?focus=${encodeURIComponent(String(row.activity_id))}`,
                            },
                        });
                    }
                }

                if (activeCancellationProposalsError) {
                    console.warn("[ACTIVITIES] active cancellation proposals query failed:", activeCancellationProposalsError.message);
                } else {
                    const activeProposals = (activeCancellationProposals || []).filter((proposal: any) => {
                        const expiresAtMs = new Date(proposal.expires_at).getTime();
                        return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now();
                    });
                    const activeProposalIds = [...new Set(activeProposals.map((proposal: any) => proposal.id).filter(Boolean))];
                    const voteReminderThresholdMs = 5 * 60 * 1000;

                    const [{ data: myVotes, error: myVotesError }, { data: notificationRows, error: notificationRowsError }] = activeProposalIds.length > 0
                        ? await Promise.all([
                            db
                                .from("activity_cancellation_votes")
                                .select("proposal_id")
                                .eq("voter_id", user.id)
                                .in("proposal_id", activeProposalIds),
                            db
                                .from("activity_cancellation_vote_notifications")
                                .select("id,proposal_id,activity_id,metadata,read_at")
                                .eq("user_id", user.id)
                                .in("proposal_id", activeProposalIds),
                        ])
                        : [{ data: [], error: null }, { data: [], error: null }];

                    if (myVotesError) {
                        console.warn("[ACTIVITIES] my cancellation votes query failed:", myVotesError.message);
                    }
                    if (notificationRowsError) {
                        const isMissingTableError = (notificationRowsError.message || "").includes("does not exist");
                        if (!isMissingTableError) {
                            console.warn("[ACTIVITIES] cancellation notifications query failed:", notificationRowsError.message);
                        }
                    }

                    const votedProposalIds = new Set((myVotes || []).map((vote: any) => vote.proposal_id).filter(Boolean));
                    const notificationByProposalId = new Map<string, any>();
                    for (const row of notificationRows || []) {
                        notificationByProposalId.set(row.proposal_id, row);
                    }

                    const reminderUpserts: any[] = [];
                    const reminderUpdates: Array<{ id: string; metadata: Record<string, unknown> }> = [];
                    const nowMs = Date.now();
                    for (const proposal of activeProposals as any[]) {
                        const hasVoted = votedProposalIds.has(proposal.id);
                        activeCancellationVoteByActivity.set(proposal.activity_id, {
                            proposal_id: proposal.id,
                            expires_at: proposal.expires_at,
                            reason_code: proposal.reason_code,
                            reason_text: proposal.reason_text || null,
                            user_has_voted: hasVoted,
                        });

                        const notificationRow = notificationByProposalId.get(proposal.id);
                        if (notificationRow?.read_at == null) {
                            unreadCancellationVotesByActivity.set(
                                proposal.activity_id,
                                (unreadCancellationVotesByActivity.get(proposal.activity_id) || 0) + 1
                            );
                        }

                        const expiresAtMs = new Date(proposal.expires_at).getTime();
                        const remainingMs = expiresAtMs - nowMs;
                        const shouldSendReminder = remainingMs > 0 && remainingMs <= voteReminderThresholdMs && !hasVoted;
                        if (!shouldSendReminder) continue;

                        const currentMetadata = notificationRow?.metadata && typeof notificationRow.metadata === "object"
                            ? notificationRow.metadata as Record<string, unknown>
                            : {};
                        const alreadyReminded = !!currentMetadata.reminder_5m_sent;
                        if (alreadyReminded) continue;

                        const nextMetadata = {
                            ...currentMetadata,
                            type: "activity_cancellation_vote",
                            proposal_id: proposal.id,
                            activity_id: proposal.activity_id,
                            reminder_5m_sent: true,
                            reminder_5m_at: new Date().toISOString(),
                            push_payload: {
                                type: "activity_cancellation_vote",
                                proposal_id: proposal.id,
                                activity_id: proposal.activity_id,
                                title: "Plus que 5 min pour voter",
                                body: "Le vote d’annulation se termine bientôt",
                                url: `/activities?focus=${encodeURIComponent(String(proposal.activity_id))}`,
                            },
                        };

                        if (notificationRow?.id) {
                            reminderUpdates.push({
                                id: notificationRow.id,
                                metadata: nextMetadata,
                            });
                        } else {
                            reminderUpserts.push({
                                proposal_id: proposal.id,
                                activity_id: proposal.activity_id,
                                user_id: user.id,
                                type: "activity_cancellation_vote",
                                title: "Plus que 5 min pour voter",
                                body: "Le vote d’annulation se termine bientôt",
                                metadata: nextMetadata,
                                read_at: null,
                            });
                        }
                    }

                    if (reminderUpdates.length > 0) {
                        await Promise.all(reminderUpdates.map(async (updateRow) => {
                            const { error } = await db
                                .from("activity_cancellation_vote_notifications")
                                .update({
                                    title: "Plus que 5 min pour voter",
                                    body: "Le vote d’annulation se termine bientôt",
                                    metadata: updateRow.metadata,
                                    read_at: null,
                                })
                                .eq("id", updateRow.id);
                            if (error && !(error.message || "").includes("does not exist")) {
                                console.warn("[ACTIVITIES] cancellation reminder update failed:", error.message);
                            }
                        }));
                    }

                    if (reminderUpserts.length > 0) {
                        const { error } = await db
                            .from("activity_cancellation_vote_notifications")
                            .upsert(reminderUpserts, { onConflict: "proposal_id,user_id" });
                        if (error && !(error.message || "").includes("does not exist")) {
                            console.warn("[ACTIVITIES] cancellation reminder upsert failed:", error.message);
                        }
                    }
                }

                applyPulseSummaries(pulseSummaries || []);

                // Self-healing pass:
                // if past activities still have no pulse summary for this user, retry finalization then reload summaries.
                const summaryActivityIds = new Set((pulseSummaries || []).map((row) => row.activity_id));
                const missingSummaryActivityIds = (filteredData as any[])
                    .filter((a) => {
                        if (!a?.id) return false;
                        const startMs = new Date(a.start_time).getTime();
                        return Number.isFinite(startMs) && startMs <= Date.now() && !summaryActivityIds.has(a.id);
                    })
                    .map((a) => a.id);

                if (missingSummaryActivityIds.length > 0) {
                    await Promise.all(
                        missingSummaryActivityIds.map(async (activityId) => {
                            try {
                                await tryFinalizeActivityPulse(db as any, activityId, {
                                    scopeUserId: user.id,
                                });
                            } catch (e) {
                                console.warn("[ACTIVITIES] pulse finalization retry failed:", activityId, e instanceof Error ? e.message : e);
                            }
                        })
                    );

                    const { data: retriedPulseSummaries, error: retriedPulseSummariesError } = await db
                        .from("pulse_summaries")
                        .select("activity_id,created_at,total_points,breakdown")
                        .eq("user_id", user.id)
                        .in("activity_id", missingSummaryActivityIds);

                    if (retriedPulseSummariesError) {
                        console.warn("[ACTIVITIES] pulse summaries retry query failed:", retriedPulseSummariesError.message);
                    } else {
                        applyPulseSummaries(retriedPulseSummaries || []);
                    }
                }
            }
        }

        // Transformer les données pour inclure le nombre de 'attendees' (Créateur + participants validés)
        const formattedData = filteredData.map((a: any) => {
            const participations = (participationsByActivity.get(a.id) || []).filter((p: any) => p.user_id !== a.creator_id);
            const activityFeedback = feedbackByActivity.get(a.id) || [];
            let feedbackStatus = undefined;
            const isConfirmedParticipant = participations.some((p: any) => p.user_id === user?.id && p.status === 'confirmé');
            const isCreator = a.creator_id === user?.id;
            const attendees = 1 + participations.length;
            const isSoloCompletedAlone = isSoloCompletedWithoutPeers({ sport: a.sport, attendees });

            const activityStartTime = new Date(a.start_time).getTime();
            const now = Date.now();
            const hoursSinceStart = (now - activityStartTime) / (1000 * 60 * 60);

            const computedStatus = getActivityComputedStatus({
                status: a.status,
                start_time: a.start_time,
                max_attendees: a.max_attendees,
                attendees,
                sport: a.sport,
            }, { nowMs: now, pastBufferMs: 0 });
            const isEffectivelyPast = computedStatus === "completed" || computedStatus === "cancelled";

            if (isEffectivelyPast && (filter === 'my_activities' || isConfirmedParticipant || isCreator)) {
                if (a.status === "annulé") {
                    feedbackStatus = "expired";
                } else if (isSoloCompletedAlone) {
                    // Solo-only completion: no feedback should be requested.
                    feedbackStatus = "expired";
                } else {
                const hasProvidedFeedback = activityFeedback.some((f: any) => f.reviewer_id === user?.id);

                if (hasProvidedFeedback) {
                    feedbackStatus = 'completed';
                } else {
                    // Feedback window: opens at +2h and closes at +6h (4h window)
                    if (hoursSinceStart >= 2 && hoursSinceStart <= 6) {
                        feedbackStatus = 'pending';
                    } else if (hoursSinceStart > 6) {
                        feedbackStatus = 'expired';
                    } else {
                        feedbackStatus = 'too_early'; // < 2h after start = activity still 'En cours'
                    }
                }
                }
            }

            const lastReadMs = chatLastReadByActivity.get(a.id) || 0;
            const unreadMessagesCount = unreadChatMessagesByActivity.get(a.id) || 0;
            const startMs = new Date(a.start_time).getTime();
            const nowMs = Date.now();
            const isUpcoming = Number.isFinite(startMs) && startMs > nowMs && ["ouvert", "complet", "confirmé", "en_attente"].includes(a.status);
            const isFull = !!a.max_attendees && Number(a.max_attendees) > 0 && attendees >= Number(a.max_attendees);
            const isAuthorizedForChat = isCreator || isConfirmedParticipant;

            let chatOpenAtMs: number | null = null;
            if (isRunningOrCyclingSport(a.sport) && Number.isFinite(startMs)) {
                chatOpenAtMs = startMs - (24 * 60 * 60 * 1000);
            } else if (a.status === "confirmé" || a.status === "complet" || isFull) {
                const updatedAtMs = a.updated_at ? new Date(a.updated_at).getTime() : NaN;
                chatOpenAtMs = Number.isFinite(updatedAtMs) ? updatedAtMs : null;
            } else {
                const urgentOpenMs = getUrgentChatOpenMs({ start_time: a.start_time, max_attendees: a.max_attendees });
                chatOpenAtMs = urgentOpenMs;
            }

            const chatIsOpenNow = isAuthorizedForChat && canAuthorizedMemberAccessChat({
                sport: a.sport,
                status: a.status,
                start_time: a.start_time,
                max_attendees: a.max_attendees,
                attendees,
            }, nowMs);

            const hasUnreadChatOpenEvent =
                isUpcoming
                && chatIsOpenNow
                && chatOpenAtMs !== null
                && Number.isFinite(chatOpenAtMs)
                && lastReadMs < chatOpenAtMs;

            const unreadEventCount = hasUnreadChatOpenEvent ? 1 : 0;
            const unreadRedCount = unreadMessagesCount + unreadEventCount;
            const unreadAmberCount = unreadCancellationVotesByActivity.get(a.id) || 0;
            const unreadBlueCount = feedbackStatus === "pending" ? 1 : 0;
            const unreadGoldCount = pulseClaimableByActivity.get(a.id) ? 1 : 0;
            const rawPendingInvitation = pendingInvitationByActivity.get(a.id) || null;
            const pendingInvitation = rawPendingInvitation
                ? rawPendingInvitation
                : null;
            const unreadInvitationCount = pendingInvitation?.status === "pending" ? 1 : 0;

            return {
                ...a,
                creator: creatorById.get(a.creator_id) || null,
                feedbackStatus,
                _debug: { isConfirmedParticipant, isCreator, hoursSinceStart, isEffectivelyPast, dbStatus: a.status },
                participations,
                attendees: 1 + participations.length,
                unreadMessagesCount,
                unreadEventCount,
                unreadRedCount,
                unreadAmberCount,
                activeCancellationVote: activeCancellationVoteByActivity.get(a.id) || null,
                cancellationAcknowledged: cancellationAcknowledgedByActivity.get(a.id) || false,
                unreadBlueCount,
                unreadGoldCount,
                unreadInvitationCount,
                pendingInvitation,
                pulseClaimable: unreadGoldCount > 0,
                pulseSummaryCreatedAt: pulseSummaryCreatedAtByActivity.get(a.id) || null,
                activity_feedback: undefined
            };
        });

        if (user) {
            const authorizedActivityIds = formattedData
                .filter((a: any) =>
                    a.creator_id === user.id
                    || (a.participations || []).some((p: any) => p.user_id === user.id && p.status === "confirmé")
                )
                .map((a: any) => a.id)
                .filter(Boolean);

            if (authorizedActivityIds.length > 0) {
                const { data: privateLocations } = await db
                    .from("activity_private_locations")
                    .select("activity_id, exact_address, exact_lat, exact_lng")
                    .in("activity_id", authorizedActivityIds);

                const privateByActivityId = new Map<string, { exact_address: string | null; exact_lat: number | null; exact_lng: number | null }>();
                for (const row of privateLocations || []) {
                    privateByActivityId.set(row.activity_id, {
                        exact_address: row.exact_address,
                        exact_lat: row.exact_lat,
                        exact_lng: row.exact_lng,
                    });
                }

                for (const activity of formattedData as any[]) {
                    const privateLocation = privateByActivityId.get(activity.id);
                    if (privateLocation) {
                        activity.exact_address = privateLocation.exact_address;
                        activity.exact_lat = privateLocation.exact_lat;
                        activity.exact_lng = privateLocation.exact_lng;
                    }
                }
            }
        }

        const sanitizedData = formattedData.map((a: any) => {
            const { _debug, ...rest } = a;
            return sanitizeActivityLocationForViewer(rest, user?.id);
        });
        if (filter === "my_activities" && user?.id) {
            const pendingInvitationActivities = (sanitizedData as any[]).filter(
                (activity) => activity?.pendingInvitation?.status === "pending"
            );
            inviteDebug(`[INVITE_DEBUG][${debugRequestId}] my_activities response summary`, {
                user_id: user.id,
                total_activities: sanitizedData.length,
                pending_invitation_activity_count: pendingInvitationActivities.length,
                pending_invitation_activities: pendingInvitationActivities.map((activity) => ({
                    activity_id: activity.id,
                    status: activity.status,
                    start_time: activity.start_time,
                    pendingInvitation: activity.pendingInvitation,
                })),
            });
        }

        if (filter === "my_activities" && user?.id) {
            try {
                const prefMap = await getSportsNotificationsEnabledMap(db as never, [user.id]);
                const sportsNotificationsEnabled = prefMap.get(user.id) !== false;
                const nowMs = Date.now();
                const notificationRows: Array<{
                    user_id: string;
                    type: (typeof USER_NOTIFICATION_TYPES)[keyof typeof USER_NOTIFICATION_TYPES];
                    title: string;
                    message: string;
                    activity_id: string;
                    dedupe_key: string;
                }> = [];

                    for (const activity of formattedData as any[]) {
                        const activityId = String(activity.id || "");
                        if (!activityId) continue;
                        const startMs = new Date(activity.start_time).getTime();
                        if (!Number.isFinite(startMs)) continue;

                        const isCreator = String(activity.creator_id || "") === user.id;
                        const isConfirmedParticipant = (activity.participations || []).some(
                            (p: any) => String(p.user_id || "") === user.id && String(p.status || "") === "confirmé"
                        );
                        if (!isCreator && !isConfirmedParticipant) continue;

                        const attendees = Number(activity.attendees || 1);
                        const maxAttendees = Number(activity.max_attendees || 0);
                        const hasCapacity = maxAttendees > 0;
                        const msToStart = startMs - nowMs;
                        const notificationTitle = buildActivityNotificationTitle(activity);

                        const canAccessChatNow = canAuthorizedMemberAccessChat({
                            sport: activity.sport,
                            status: activity.status,
                            start_time: activity.start_time,
                            max_attendees: activity.max_attendees,
                            attendees,
                        }, nowMs);
                        if (sportsNotificationsEnabled && canAccessChatNow && msToStart > 0) {
                            notificationRows.push({
                                user_id: user.id,
                                type: USER_NOTIFICATION_TYPES.CHAT_OPEN,
                                title: notificationTitle,
                                message: "Le chat est maintenant ouvert.",
                                activity_id: activityId,
                                dedupe_key: buildActivityNotificationDedupeKey({
                                    type: USER_NOTIFICATION_TYPES.CHAT_OPEN,
                                    activityId,
                                }),
                            });
                        }

                        const urgentOpenMs = getUrgentChatOpenMs({
                            start_time: activity.start_time,
                            max_attendees: activity.max_attendees,
                        });
                        const isUrgentMode =
                            !isSoloCapableSport(activity.sport)
                            && hasCapacity
                            && attendees < maxAttendees
                            && msToStart > 0
                            && urgentOpenMs !== null
                            && nowMs >= urgentOpenMs;
                        if (isUrgentMode) {
                            const recipientIds = Array.from(new Set([
                                String(activity.creator_id || ""),
                                ...((activity.participations || []) as Array<{ status?: unknown; user_id?: unknown }>)
                                    .filter((participation) => String(participation.status || "") === "confirmé")
                                    .map((participation) => String(participation.user_id || "")),
                            ].filter(Boolean)));
                            const urgentPrefMap = await getSportsNotificationsEnabledMap(db as never, recipientIds);
                            for (const recipientId of recipientIds) {
                                if (urgentPrefMap.get(recipientId) === false) continue;
                                notificationRows.push({
                                    user_id: recipientId,
                                    type: USER_NOTIFICATION_TYPES.URGENT_MODE,
                                    title: notificationTitle,
                                    message: "Mode urgence : le groupe n’est pas complet. Discutez pour décider si l’activité est maintenue.",
                                    activity_id: activityId,
                                    dedupe_key: buildActivityNotificationDedupeKey({
                                        type: USER_NOTIFICATION_TYPES.URGENT_MODE,
                                        activityId,
                                    }),
                                });
                            }
                        }

                        if (sportsNotificationsEnabled && msToStart > 0 && msToStart <= ACTIVITY_REMINDER_WINDOW_MS) {
                            notificationRows.push({
                                user_id: user.id,
                                type: USER_NOTIFICATION_TYPES.ACTIVITY_REMINDER_30M,
                                title: notificationTitle,
                                message: "Ton activité commence dans 30 minutes.",
                                activity_id: activityId,
                                dedupe_key: buildActivityNotificationDedupeKey({
                                    type: USER_NOTIFICATION_TYPES.ACTIVITY_REMINDER_30M,
                                    activityId,
                                    suffix: String(startMs),
                                }),
                            });
                        }
                    }

                await createUserNotifications(db as never, notificationRows);
            } catch (notificationError) {
                console.warn("[ACTIVITIES] user notifications sync failed:", notificationError);
            }
        }

        return createSuccessResponse(sanitizedData, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

export async function POST(req: NextRequest) {
    try {
        const debugRequestId = INVITE_DEBUG_ENABLED
            ? `activities_post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
            : "";
        const supabase = await createClient();
        const moderationDb = getModerationServiceClient() ?? supabase;

        // 1. Vérifier l'authentification SSR
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return createErrorResponse("Non autorisé. Vous devez être connecté pour créer une activité.", 401);
        }

        const isStaffUser = await isModeratorUser(supabase as never, user as never);
        if (isStaffUser) {
            return createErrorResponse(
                "Les comptes admin/modération ne peuvent pas créer d’activités.",
                403,
                { code: "admin_staff_creation_blocked" }
            );
        }

        const moderationGate = await enforceUserCapability(moderationDb as never, user.id, "create_activity");
        if (!moderationGate.allowed) {
            return createErrorResponse(moderationGate.message, 403, {
                code: moderationGate.code,
                until: moderationGate.until || null,
                message: moderationGate.message,
            });
        }

        const body = await req.json();

        // 2. Validation Zod stricte
        const validation = createActivitySchema.safeParse(body);
        if (!validation.success) {
            return createErrorResponse("Données invalides", 400, validation.error.flatten().fieldErrors);
        }

        const activityData = validation.data;
        const {
            invited_user_ids: invitedUserIdsRaw = [],
            invite_share_token: inviteShareToken = null,
            ...activityDataWithoutInvites
        } = activityData;

        const creationEligibility = await getActivityCreationEligibility(supabase as never, user.id);
        if (!creationEligibility.can_create_activity) {
            return Response.json({
                error: ACTIVITY_CREATION_LIMIT_ERROR_CODE,
                message: "Tu as déjà créé ton activité de la semaine.",
                upgrade_url: "/pricing",
                weekly_limit: creationEligibility.weekly_limit,
                created_this_week: creationEligibility.created_this_week,
                replacement_available: creationEligibility.replacement_available,
                creation_access: creationEligibility.creation_access,
                next_reset_at: creationEligibility.next_reset_at,
            }, { status: 403 });
        }

        const invitedUserIds = Array.from(
            new Set(
                (invitedUserIdsRaw || [])
                    .map((value) => String(value || "").trim())
                    .filter((value) => value.length > 0 && value !== user.id)
            )
        ).slice(0, 20);
        if (invitedUserIds.length > 0) {
            const [connectionsAsA, connectionsAsB] = await Promise.all([
                supabase
                    .from("user_connections")
                    .select("user_b")
                    .eq("user_a", user.id)
                    .in("user_b", invitedUserIds),
                supabase
                    .from("user_connections")
                    .select("user_a")
                    .eq("user_b", user.id)
                    .in("user_a", invitedUserIds),
            ]);

            const connectedIds = new Set<string>([
                ...((connectionsAsA.data || []).map((row: any) => String(row.user_b || ""))),
                ...((connectionsAsB.data || []).map((row: any) => String(row.user_a || ""))),
            ].filter(Boolean));
            const unknownInvitesCount = invitedUserIds.filter((id) => !connectedIds.has(id)).length;
            const MAX_UNKNOWN_INVITES = 4;
            if (unknownInvitesCount > MAX_UNKNOWN_INVITES) {
                return createErrorResponse(
                    "Vous pouvez inviter jusqu’à 4 personnes hors connexions",
                    400,
                    { code: "unknown_invites_limit", max_unknown: MAX_UNKNOWN_INVITES }
                );
            }
        }
        let previousSportImage: string | null = null;
        const { data: latestSameSportActivity } = await supabase
            .from("activities")
            .select("image_url")
            .eq("creator_id", user.id)
            .eq("sport", activityData.sport)
            .not("image_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        previousSportImage = (latestSameSportActivity?.image_url as string | null) || null;
        const randomSportImage = pickRandomImageForSportExcluding(activityData.sport, previousSportImage);
        // Approximate coordinates to ~30km buckets for privacy-safe public location.
        const approximateCoordinate = (value?: number) => {
            if (typeof value !== "number" || Number.isNaN(value)) return null;
            const step = 0.3;
            return Number((Math.round(value / step) * step).toFixed(3));
        };
        const exactAddress = (activityData.address || "").trim() || null;
        const exactLat = typeof activityData.lat === "number" ? activityData.lat : null;
        const exactLng = typeof activityData.lng === "number" ? activityData.lng : null;

        // Auto-assign status based on sport
        const isAutoConfirmed = isSoloCapableSport(activityDataWithoutInvites.sport);
        const initialStatus = isAutoConfirmed ? 'confirmé' : 'en_attente';

        // Fetch user profile to enforce business rules
        const { data: profile } = await supabase
            .from('profiles')
            .select('gender')
            .eq('id', user.id)
            .single();

        let finalGenderFilter = activityData.gender_filter;
        if (!isFemaleGender(profile?.gender)) {
            finalGenderFilter = 'mixte';
        }

        if (finalGenderFilter === "filles" && invitedUserIds.length > 0) {
            const { data: inviteeProfiles, error: inviteeProfilesError } = await supabase
                .from("profiles")
                .select("id,gender")
                .in("id", invitedUserIds);

            if (inviteeProfilesError) {
                return createErrorResponse("Impossible de vérifier les profils invités", 400, inviteeProfilesError.message);
            }

            const genderByInviteeId = new Map<string, string>(
                (inviteeProfiles || []).map((row: { id: string; gender?: string | null }) => [String(row.id), String(row.gender || "")])
            );
            const hasIncompatibleInvitee = invitedUserIds.some((inviteeId) => !isFemaleGender(genderByInviteeId.get(inviteeId)));
            if (hasIncompatibleInvitee) {
                return createErrorResponse("Cette activité est réservée aux profils féminins.", 403, {
                    code: "female_only_activity",
                });
            }
        }

        // 3. Insertion dans la DataBase
        const insertPayload = {
            ...activityDataWithoutInvites,
            address: null,
            lat: approximateCoordinate(activityData.lat),
            lng: approximateCoordinate(activityData.lng),
            public_location: activityData.location,
            public_lat: approximateCoordinate(activityData.lat),
            public_lng: approximateCoordinate(activityData.lng),
            status: initialStatus,
            gender_filter: finalGenderFilter,
            creator_id: user.id,
            image_url: randomSportImage
        };

        let data: any = null;
        let error: any = null;

        ({ data, error } = await supabase
            .from('activities')
            .insert([insertPayload])
            .select()
            .single());

        const missingImageColumn =
            !!error && (
                error.code === "42703"
                || error.code === "PGRST204"
                || String(error.message || "").toLowerCase().includes("image_url")
            );

        if (missingImageColumn) {
            const { image_url, ...legacyPayload } = insertPayload;
            ({ data, error } = await supabase
                .from('activities')
                .insert([legacyPayload])
                .select()
                .single());
        }

        if (error) {
            return createErrorResponse("Erreur lors de la création de l'activité", 500, error.message);
        }

        if (data?.id) {
            try {
                await recordActivityCreationEvent({
                    userId: user.id,
                    activityId: String(data.id),
                    activityCreatedAt: String(data.created_at || new Date().toISOString()),
                });
            } catch (creationEventError) {
                try {
                    await deleteActivityAfterCreationEventFailure({
                        userId: user.id,
                        activityId: String(data.id),
                    });
                } catch (rollbackError) {
                    console.error("[ACTIVITY_CREATION_LIMIT] failed to record event and rollback activity", {
                        user_id: user.id,
                        activity_id: String(data.id),
                        creation_event_error: creationEventError instanceof Error ? creationEventError.message : "activity_creation_event_failed",
                        rollback_error: rollbackError instanceof Error ? rollbackError.message : "activity_creation_rollback_failed",
                    });
                    return createErrorResponse(
                        "Erreur lors de l'enregistrement du quota de création et du rollback de l'activité.",
                        500,
                        {
                            creation_event_error: creationEventError instanceof Error ? creationEventError.message : "activity_creation_event_failed",
                            rollback_error: rollbackError instanceof Error ? rollbackError.message : "activity_creation_rollback_failed",
                        }
                    );
                }

                return createErrorResponse(
                    "Erreur lors de l'enregistrement du quota de création.",
                    500,
                    creationEventError instanceof Error ? creationEventError.message : "activity_creation_event_failed"
                );
            }

            if (invitedUserIds.length > 0) {
                const reservationExpiry = new Date(Date.now() + DISCOVER_PUBLICATION_GRACE_MS).toISOString();
                const inviteRows = invitedUserIds.map((inviteeId) => ({
                    activity_id: data.id,
                    inviter_id: user.id,
                    invitee_id: inviteeId,
                    status: "pending",
                    reservation_expires_at: reservationExpiry,
                }));
                inviteDebug(`[INVITE_DEBUG][${debugRequestId}] invitation insert payload`, {
                    activity_id: data.id,
                    inviter_id: user.id,
                    invited_user_ids: invitedUserIds,
                    invite_rows_count: inviteRows.length,
                    invite_rows: inviteRows,
                });
                let { error: inviteInsertError } = await supabase
                    .from("activity_invitations")
                    .insert(inviteRows);
                const inviteInsertNeedsLegacyFallback = !!inviteInsertError && (
                    inviteInsertError.code === "42703"
                    || inviteInsertError.code === "PGRST204"
                    || String(inviteInsertError.message || "").toLowerCase().includes("reservation_expires_at")
                );
                if (inviteInsertNeedsLegacyFallback) {
                    const legacyInviteRows = invitedUserIds.map((inviteeId) => ({
                        activity_id: data.id,
                        inviter_id: user.id,
                        invitee_id: inviteeId,
                        status: "pending",
                    }));
                    const legacyInsertResult = await supabase
                        .from("activity_invitations")
                        .insert(legacyInviteRows);
                    inviteInsertError = legacyInsertResult.error;
                }

                if (inviteInsertError) {
                    const missingTable =
                        inviteInsertError.code === "42P01"
                        || String(inviteInsertError.message || "").toLowerCase().includes("activity_invitations");
                    if (!missingTable) {
                        console.warn("[ACTIVITIES] invite insert failed:", inviteInsertError.message);
                    } else {
                        console.warn("[ACTIVITIES] activity_invitations table missing; run phase 25 migration.");
                    }
                    inviteDebug(`[INVITE_DEBUG][${debugRequestId}] invitation insert result`, {
                        ok: false,
                        error_code: inviteInsertError.code,
                        error_message: inviteInsertError.message,
                    });
                } else {
                    inviteDebug(`[INVITE_DEBUG][${debugRequestId}] invitation insert result`, {
                        ok: true,
                        inserted_rows: inviteRows.length,
                    });
                }

                const { data: inviterProfile } = await supabase
                    .from("profiles")
                    .select("pseudo")
                    .eq("id", user.id)
                    .maybeSingle();
                const inviterPseudo = String(inviterProfile?.pseudo || "utilisateur");
                const inviteNotificationRows = invitedUserIds.map((inviteeId) => ({
                    activity_id: data.id,
                    user_id: inviteeId,
                    type: "activity_invitation",
                    title: `@${inviterPseudo} vous invite à rejoindre une activité`,
                    body: "Ouvrez Mes activités pour répondre à l'invitation",
                    metadata: {
                        type: "activity_invitation",
                        activity_id: data.id,
                        inviter_user_id: user.id,
                        inviter_pseudo: inviterPseudo,
                        push_payload: {
                            type: "activity_invitation",
                            activity_id: data.id,
                            inviter_user_id: user.id,
                            title: `@${inviterPseudo} vous invite à rejoindre une activité`,
                            body: "Ouvrez Mes activités pour répondre à l'invitation",
                            url: `/activities?focus=${encodeURIComponent(String(data.id))}`,
                        },
                    },
                }));
                const { error: inviteNotificationsError } = await supabase
                    .from("activity_invitation_notifications")
                    .upsert(inviteNotificationRows, { onConflict: "activity_id,user_id" });
                if (inviteNotificationsError) {
                    const missingTable =
                        inviteNotificationsError.code === "42P01"
                        || String(inviteNotificationsError.message || "").toLowerCase().includes("activity_invitation_notifications");
                    if (!missingTable) {
                        console.warn("[ACTIVITIES] invitation notifications upsert failed:", inviteNotificationsError.message);
                    } else {
                        console.warn("[ACTIVITIES] activity_invitation_notifications table missing; run phase 33 migration.");
                    }
                }
            }

            if (inviteShareToken) {
                const { error: inviteLinkError } = await supabase
                    .from("activity_invite_links")
                    .upsert({
                        activity_id: data.id,
                        token: inviteShareToken,
                        created_by: user.id,
                    }, { onConflict: "activity_id" });

                if (inviteLinkError) {
                    const missingTable =
                        inviteLinkError.code === "42P01"
                        || String(inviteLinkError.message || "").toLowerCase().includes("activity_invite_links");
                    if (!missingTable) {
                        console.warn("[ACTIVITIES] invite link upsert failed:", inviteLinkError.message);
                    } else {
                        console.warn("[ACTIVITIES] activity_invite_links table missing; run phase 32 migration.");
                    }
                }
            }

            const { error: privateLocationError } = await supabase
                .from("activity_private_locations")
                .upsert({
                    activity_id: data.id,
                    exact_address: exactAddress,
                    exact_lat: exactLat,
                    exact_lng: exactLng,
                    updated_at: new Date().toISOString(),
                }, { onConflict: "activity_id" });

            if (privateLocationError) {
                return createErrorResponse("Erreur lors de l'enregistrement de la localisation exacte", 500, privateLocationError.message);
            }

            try {
                const locationText = String(data.location || "").trim();
                if (locationText) {
                    const cutoffIso = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString();
                    const { data: sameCityActivities } = await supabase
                        .from("activities")
                        .select("id,creator_id")
                        .ilike("location", `%${locationText}%`)
                        .neq("creator_id", user.id)
                        .gte("start_time", cutoffIso)
                        .limit(300);

                    const candidateUserIds = new Set<string>();
                    const candidateActivityIds = (sameCityActivities || []).map((row: any) => String(row.id || "")).filter(Boolean);
                    for (const row of sameCityActivities || []) {
                        const creatorId = String((row as any).creator_id || "");
                        if (creatorId && creatorId !== user.id) candidateUserIds.add(creatorId);
                    }

                    if (candidateActivityIds.length > 0) {
                        const { data: candidateParticipations } = await supabase
                            .from("participations")
                            .select("activity_id,user_id,status")
                            .in("activity_id", candidateActivityIds)
                            .eq("status", "confirmé");
                        for (const row of candidateParticipations || []) {
                            const participantId = String((row as any).user_id || "");
                            if (participantId && participantId !== user.id) candidateUserIds.add(participantId);
                        }
                    }

                    const recipientIds = Array.from(candidateUserIds)
                        .filter((recipientId) => recipientId !== user.id && !invitedUserIds.includes(recipientId))
                        .slice(0, 120);
                    const prefMap = await getSportsNotificationsEnabledMap(supabase as never, recipientIds);
                    const notificationTitle = buildActivityNotificationTitle({
                        id: String(data.id || ""),
                        sport: String(data.sport || ""),
                        start_time: String(data.start_time || ""),
                    });
                    const rows = recipientIds
                        .filter((recipientId) => prefMap.get(recipientId) !== false)
                        .map((recipientId) => ({
                            user_id: recipientId,
                            type: USER_NOTIFICATION_TYPES.NEW_ACTIVITY_NEARBY,
                            title: notificationTitle,
                            message: "Nouvelle activité proche de toi disponible.",
                            activity_id: data.id as string,
                            dedupe_key: buildActivityNotificationDedupeKey({
                                type: USER_NOTIFICATION_TYPES.NEW_ACTIVITY_NEARBY,
                                activityId: String(data.id),
                            }),
                        }));
                    await createUserNotifications(supabase as never, rows);
                }
            } catch (notificationError) {
                console.warn("[ACTIVITIES] nearby notification creation failed:", notificationError);
            }
        }

        return createSuccessResponse({
            activity: data,
            message: "Activité créée avec succès"
        }, 201);

    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
