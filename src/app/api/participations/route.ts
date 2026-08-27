import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { joinActivitySchema } from "@/lib/validations/participations";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { enforceUserCapability, getModerationServiceClient } from "@/lib/moderation";
import { getBlockedUserIdsForUser } from "@/lib/blocks";
import {
    buildActivityNotificationTitle,
    buildActivityNotificationDedupeKey,
    createUserNotifications,
    getSportsNotificationsEnabledMap,
    USER_NOTIFICATION_TYPES,
} from "@/lib/user-notifications";

const INVITE_DEBUG_ENABLED = process.env.NODE_ENV !== "production";

function inviteDebug(...args: unknown[]) {
    if (!INVITE_DEBUG_ENABLED) return;
    console.log(...args);
}

function isFemaleGender(value: unknown) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "female" || normalized === "femme";
}

export async function POST(req: NextRequest) {
    try {
        const debugRequestId = INVITE_DEBUG_ENABLED
            ? `participations_post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
            : "";
        const supabase = await createClient();
        const moderationDb = getModerationServiceClient() ?? supabase;
        const serviceRoleClient = (() => {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (!url || !key) return null;
            return createSupabaseClient(url, key, {
                auth: { persistSession: false, autoRefreshToken: false },
            });
        })();
        const db = serviceRoleClient ?? supabase;

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return createErrorResponse("Non autorisé. Connectez-vous pour rejoindre.", 401);
        }

        const moderationGate = await enforceUserCapability(moderationDb as never, user.id, "join_activity");
        if (!moderationGate.allowed) {
            return createErrorResponse(moderationGate.message, 403, {
                code: moderationGate.code,
                until: moderationGate.until || null,
                message: moderationGate.message,
            });
        }

        const body = await req.json();

        // Validation stricte du payload
        const validation = joinActivitySchema.safeParse(body);
        if (!validation.success) {
            return createErrorResponse("Données invalides", 400, validation.error.flatten().fieldErrors);
        }

        const { activity_id } = validation.data;
        inviteDebug(`[INVITE_DEBUG][${debugRequestId}] participation join request`, {
            user_id: user.id,
            activity_id,
        });

        // 1. Vérifier si l'activité existe et n'est pas complète
        const { data: activity, error: activityError } = await db
            .from('activities')
            .select('id, creator_id, max_attendees, status, start_time, gender_filter, sport, location, address')
            .eq('id', activity_id)
            .single();

        if (activityError || !activity) {
            return createErrorResponse("Activité introuvable", 404);
        }
        const nowIso = new Date().toISOString();
        let hasActiveInvitationReservation = false;
        let invitationReservationResult = await db
            .from("activity_invitations")
            .select("status,reservation_expires_at")
            .eq("activity_id", activity_id)
            .eq("invitee_id", user.id)
            .maybeSingle();
        const reservationNeedsLegacyFallback = !!invitationReservationResult.error && (
            invitationReservationResult.error.code === "42703"
            || invitationReservationResult.error.code === "PGRST204"
            || String(invitationReservationResult.error.message || "").toLowerCase().includes("reservation_expires_at")
        );
        if (reservationNeedsLegacyFallback) {
            const legacyReservationResult = await db
                .from("activity_invitations")
                .select("status")
                .eq("activity_id", activity_id)
                .eq("invitee_id", user.id)
                .maybeSingle();
            invitationReservationResult = {
                data: legacyReservationResult.data
                    ? { ...legacyReservationResult.data, reservation_expires_at: null }
                    : null,
                error: legacyReservationResult.error,
                count: null,
                status: legacyReservationResult.status,
                statusText: legacyReservationResult.statusText,
            } as typeof invitationReservationResult;
        }
        if (!invitationReservationResult.error) {
            const invitationStatus = String(invitationReservationResult.data?.status || "");
            const reservationExpiresAt = invitationReservationResult.data?.reservation_expires_at
                ? String(invitationReservationResult.data.reservation_expires_at)
                : null;
            hasActiveInvitationReservation =
                invitationStatus === "pending"
                && (!reservationExpiresAt || reservationExpiresAt > nowIso);
        }

        const isOpenForGeneralJoin = ['ouvert', 'confirmé', 'en_attente'].includes(activity.status);
        const canJoinDespiteComplete = activity.status === "complet" && hasActiveInvitationReservation;
        if (!isOpenForGeneralJoin && !canJoinDespiteComplete) {
            return createErrorResponse("Cette activité n'est plus ouverte aux inscriptions", 400);
        }
        const startMs = new Date(activity.start_time).getTime();
        if (Number.isFinite(startMs) && startMs <= Date.now()) {
            return createErrorResponse("Cette activité est déjà passée", 400);
        }

        if (activity.creator_id === user.id) {
            return createErrorResponse("Vous êtes déjà organisateur de cette activité.", 400);
        }

        const { data: currentUserProfile, error: currentUserProfileError } = await db
            .from("profiles")
            .select("gender")
            .eq("id", user.id)
            .maybeSingle();
        if (currentUserProfileError) {
            return createErrorResponse("Impossible de vérifier le profil utilisateur", 400, currentUserProfileError.message);
        }
        if ((activity.gender_filter === "filles" || activity.gender_filter === "femmes") && !isFemaleGender(currentUserProfile?.gender)) {
            return createErrorResponse("Cette activité est réservée aux profils féminins.", 403, {
                code: "female_only_activity",
            });
        }

        const blockedIds = await getBlockedUserIdsForUser(db as never, user.id);
        if (blockedIds.has(activity.creator_id)) {
            return createErrorResponse("Cette activité n'est plus disponible", 404);
        }

        const { data: existingParticipation } = await db
            .from("participations")
            .select("id")
            .eq("activity_id", activity_id)
            .eq("user_id", user.id)
            .maybeSingle();
        if (existingParticipation?.id) {
            return createErrorResponse("Vous participez déjà à cette activité", 400);
        }

        const maxAttendees = Number(activity.max_attendees || 0);
        if (maxAttendees > 0) {
            const { data: confirmedParticipations } = await db
                .from("participations")
                .select("id,user_id")
                .eq("activity_id", activity_id)
                .eq("status", "confirmé");

            const includesBlockedParticipant = (confirmedParticipations || [])
                .some((participant) => blockedIds.has(String(participant.user_id || "")));
            if (includesBlockedParticipant) {
                return createErrorResponse("Cette activité n'est plus disponible", 404);
            }

            const { data: activeReservations, error: reservationError } = await db
                .from("activity_invitations")
                .select("invitee_id")
                .eq("activity_id", activity_id)
                .eq("status", "pending")
                .gt("reservation_expires_at", nowIso);
            if (reservationError && reservationError.code !== "42703" && reservationError.code !== "42P01") {
                return createErrorResponse("Impossible de vérifier les réservations d'invitation", 400, reservationError.message);
            }

            const currentAttendeesCount = 1 + (confirmedParticipations || []).length;
            const confirmedUserIds = new Set((confirmedParticipations || []).map((row) => String(row.user_id || "")));
            const reservedUserIds = new Set(
                ((activeReservations || []) as Array<{ invitee_id: string | null }>)
                    .map((row) => String(row.invitee_id || ""))
                    .filter((id) => !!id && !confirmedUserIds.has(id))
            );
            const hasActiveReservation = reservedUserIds.has(user.id) || hasActiveInvitationReservation;
            const reservedCountWithoutCurrentUser = reservedUserIds.size - (hasActiveReservation ? 1 : 0);

            if (!hasActiveReservation && currentAttendeesCount + reservedUserIds.size >= maxAttendees) {
                return createErrorResponse("Le groupe est déjà complet", 400);
            }
            if (hasActiveReservation && currentAttendeesCount + reservedCountWithoutCurrentUser >= maxAttendees) {
                return createErrorResponse("Le groupe est déjà complet", 400);
            }
        } else {
            const { data: confirmedParticipations } = await db
                .from("participations")
                .select("user_id")
                .eq("activity_id", activity_id)
                .eq("status", "confirmé");

            const includesBlockedParticipant = (confirmedParticipations || [])
                .some((participant) => blockedIds.has(String(participant.user_id || "")));
            if (includesBlockedParticipant) {
                return createErrorResponse("Cette activité n'est plus disponible", 404);
            }
        }

        // 2. Tenter de rejoindre
        const { error } = await supabase
            .from('participations')
            .insert([{
                activity_id,
                user_id: user.id,
                status: 'confirmé'
            }]);

        if (error) {
            if (error.code === '23505') { // Code Unique Violation dans PostgreSQL (User a déjà rejoint)
                return createErrorResponse("Vous participez déjà à cette activité", 400);
            }
            if (error.code === '23514' || error.message?.toLowerCase().includes('creator cannot join own activity')) {
                const errorMessage = error.message?.toLowerCase() || "";
                if (errorMessage.includes("full") || errorMessage.includes("complet")) {
                    return createErrorResponse("Le groupe est déjà complet", 400);
                }
                return createErrorResponse("Vous êtes déjà organisateur de cette activité.", 400);
            }
            return createErrorResponse("Erreur lors de l'inscription", 500, error.message);
        }

        let invitationAcceptResult = await db
            .from("activity_invitations")
            .update({
                status: "accepted",
                reservation_expires_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq("activity_id", activity_id)
            .eq("invitee_id", user.id)
            .eq("status", "pending");
        const invitationAcceptNeedsLegacyFallback = !!invitationAcceptResult.error && (
            invitationAcceptResult.error.code === "42703"
            || invitationAcceptResult.error.code === "PGRST204"
            || String(invitationAcceptResult.error.message || "").toLowerCase().includes("reservation_expires_at")
        );
        if (invitationAcceptNeedsLegacyFallback) {
            invitationAcceptResult = await db
                .from("activity_invitations")
                .update({
                    status: "accepted",
                    updated_at: new Date().toISOString(),
                })
                .eq("activity_id", activity_id)
                .eq("invitee_id", user.id)
                .eq("status", "pending");
        }
        if (
            invitationAcceptResult.error
            && invitationAcceptResult.error.code !== "42P01"
            && invitationAcceptResult.error.code !== "42703"
        ) {
            console.warn("[PARTICIPATIONS] invitation accept update failed:", invitationAcceptResult.error.message);
        } else {
            inviteDebug(`[INVITE_DEBUG][${debugRequestId}] invitation accept update`, {
                user_id: user.id,
                activity_id,
                error: invitationAcceptResult.error ? {
                    code: invitationAcceptResult.error.code,
                    message: invitationAcceptResult.error.message,
                } : null,
            });
        }

        const { error: invitationNotificationReadError } = await db
            .from("activity_invitation_notifications")
            .update({
                read_at: new Date().toISOString(),
            })
            .eq("activity_id", activity_id)
            .eq("user_id", user.id)
            .is("read_at", null);

        if (
            invitationNotificationReadError
            && invitationNotificationReadError.code !== "42P01"
            && invitationNotificationReadError.code !== "42703"
        ) {
            console.warn("[PARTICIPATIONS] invitation notification read update failed:", invitationNotificationReadError.message);
        }

        try {
            const creatorId = String(activity.creator_id || "");
            if (creatorId && creatorId !== user.id) {
                const prefMap = await getSportsNotificationsEnabledMap(db as never, [creatorId]);
                if (prefMap.get(creatorId) !== false) {
                    const { data: participantProfile } = await db
                        .from("profiles")
                        .select("pseudo")
                        .eq("id", user.id)
                        .maybeSingle();
                    const pseudo = String((participantProfile as { pseudo?: unknown } | null)?.pseudo || "").trim();
                    await createUserNotifications(db as never, [{
                        user_id: creatorId,
                        type: USER_NOTIFICATION_TYPES.PARTICIPANT_JOINED,
                        title: buildActivityNotificationTitle(activity),
                        message: pseudo ? `${pseudo} a rejoint ton activité.` : "Quelqu’un a rejoint ton activité.",
                        activity_id,
                        dedupe_key: buildActivityNotificationDedupeKey({
                            type: USER_NOTIFICATION_TYPES.PARTICIPANT_JOINED,
                            activityId: activity_id,
                            suffix: user.id,
                        }),
                    }]);
                }
            }
        } catch (notificationError) {
            console.warn("[PARTICIPATIONS] participant joined notification failed:", notificationError);
        }

        if (maxAttendees > 0) {
            const { data: finalConfirmed } = await db
                .from("participations")
                .select("id,user_id")
                .eq("activity_id", activity_id)
                .eq("status", "confirmé");
            const finalAttendeesCount = 1 + (finalConfirmed || []).length;
            if (finalAttendeesCount >= maxAttendees && activity.status !== "complet") {
                await db
                    .from("activities")
                    .update({ status: "complet", updated_at: new Date().toISOString() })
                    .eq("id", activity_id);

                try {
                    const recipientIds = Array.from(
                        new Set([
                            String(activity.creator_id || ""),
                            ...((finalConfirmed || []).map((row: { user_id?: unknown }) => String(row.user_id || ""))),
                        ].filter((id) => !!id))
                    );
                    const prefMap = await getSportsNotificationsEnabledMap(db as never, recipientIds);
                    const rows = recipientIds
                        .filter((recipientId) => prefMap.get(recipientId) !== false)
                        .map((recipientId) => ({
                            user_id: recipientId,
                            type: USER_NOTIFICATION_TYPES.GROUP_COMPLETE,
                            title: buildActivityNotificationTitle(activity),
                            message: "Le groupe est complet.",
                            activity_id,
                            dedupe_key: buildActivityNotificationDedupeKey({
                                type: USER_NOTIFICATION_TYPES.GROUP_COMPLETE,
                                activityId: activity_id,
                            }),
                        }));
                    await createUserNotifications(db as never, rows);
                } catch (notificationError) {
                    console.warn("[PARTICIPATIONS] group complete notification failed:", notificationError);
                }
            }
        }

        return createSuccessResponse({ message: "Vous avez rejoint l'activité avec succès ! 🎉" }, 201);

    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
