import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { z } from "zod";

const claimInvitationSchema = z.object({
    activity_id: z.string().uuid(),
});

const RESERVATION_WINDOW_MS = 10 * 60 * 1000;

type InvitationRow = {
    id: string;
    activity_id: string;
    inviter_id: string;
    invitee_id: string;
    status: "pending" | "accepted" | "declined" | "expired";
    reservation_expires_at?: string | null;
};

function buildServiceRoleClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    return createSupabaseClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const serviceRoleClient = buildServiceRoleClient();
        const db = serviceRoleClient ?? supabase;

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return createErrorResponse("Non autorisé", 401);
        }

        const body = await req.json().catch(() => null);
        const parsed = claimInvitationSchema.safeParse(body);
        if (!parsed.success) {
            return createErrorResponse("activity_id invalide", 400, parsed.error.flatten().fieldErrors);
        }

        const activityId = parsed.data.activity_id;

        const { data: activity, error: activityError } = await db
            .from("activities")
            .select("id,creator_id,status,start_time,max_attendees")
            .eq("id", activityId)
            .maybeSingle();

        if (activityError) {
            return createErrorResponse("Impossible de charger l'activité", 400, activityError.message);
        }
        if (!activity) {
            return createErrorResponse("Activité introuvable", 404, { code: "activity_not_found" });
        }

        const startMs = new Date(String(activity.start_time || "")).getTime();
        if (!Number.isFinite(startMs) || startMs <= Date.now() || ["annulé", "passé"].includes(String(activity.status || ""))) {
            return createErrorResponse("Cette activité est expirée", 400, { code: "activity_expired" });
        }

        const { data: existingParticipation } = await db
            .from("participations")
            .select("id")
            .eq("activity_id", activityId)
            .eq("user_id", user.id)
            .maybeSingle();
        if (existingParticipation?.id) {
            return createSuccessResponse({
                status: "already_joined",
                activity_id: activityId,
                message: "Tu participes déjà à cette activité.",
            });
        }

        let invitationResult = await db
            .from("activity_invitations")
            .select("id,activity_id,inviter_id,invitee_id,status,reservation_expires_at")
            .eq("activity_id", activityId)
            .eq("invitee_id", user.id)
            .maybeSingle();
        const invitationNeedsLegacyFallback = !!invitationResult.error && (
            invitationResult.error.code === "42703"
            || invitationResult.error.code === "PGRST204"
            || String(invitationResult.error.message || "").toLowerCase().includes("reservation_expires_at")
        );
        if (invitationNeedsLegacyFallback) {
            const legacyResult = await db
                .from("activity_invitations")
                .select("id,activity_id,inviter_id,invitee_id,status")
                .eq("activity_id", activityId)
                .eq("invitee_id", user.id)
                .maybeSingle();
            invitationResult = {
                data: legacyResult.data ? { ...legacyResult.data, reservation_expires_at: null } : null,
                error: legacyResult.error,
                count: null,
                status: legacyResult.status,
                statusText: legacyResult.statusText,
            } as typeof invitationResult;
        }
        if (invitationResult.error) {
            return createErrorResponse("Impossible de charger l'invitation", 400, invitationResult.error.message);
        }

        const existingInvitation = invitationResult.data as InvitationRow | null;
        const nowIso = new Date().toISOString();
        const reservationExpiry = new Date(Date.now() + RESERVATION_WINDOW_MS).toISOString();
        const reservationExpiresAt = existingInvitation?.reservation_expires_at
            ? String(existingInvitation.reservation_expires_at)
            : null;
        const existingIsExpiredByTime = !!reservationExpiresAt && reservationExpiresAt <= nowIso;
        const effectiveExistingStatus =
            existingInvitation?.status === "pending" && existingIsExpiredByTime
                ? "expired"
                : existingInvitation?.status;

        if (effectiveExistingStatus === "accepted") {
            return createSuccessResponse({
                status: "already_accepted",
                activity_id: activityId,
                message: "Invitation déjà acceptée.",
            });
        }

        if (effectiveExistingStatus === "pending") {
            return createSuccessResponse({
                status: "pending",
                activity_id: activityId,
                invitation_id: existingInvitation?.id || null,
                message: "Invitation en attente.",
            });
        }

        if (!["ouvert", "confirmé", "en_attente"].includes(String(activity.status || ""))) {
            if (String(activity.status) === "complet") {
                return createErrorResponse("Cette activité est complète", 400, { code: "activity_full" });
            }
            return createErrorResponse("Cette activité est expirée", 400, { code: "activity_expired" });
        }

        const maxAttendees = Number(activity.max_attendees || 0);
        if (maxAttendees > 0) {
            const { data: confirmedParticipations, error: confirmedError } = await db
                .from("participations")
                .select("user_id")
                .eq("activity_id", activityId)
                .eq("status", "confirmé");
            if (confirmedError) {
                return createErrorResponse("Impossible de vérifier la capacité", 400, confirmedError.message);
            }

            const { data: activeReservations, error: reservationError } = await db
                .from("activity_invitations")
                .select("invitee_id")
                .eq("activity_id", activityId)
                .eq("status", "pending")
                .gt("reservation_expires_at", nowIso);
            if (
                reservationError
                && reservationError.code !== "42703"
                && reservationError.code !== "42P01"
                && reservationError.code !== "PGRST204"
            ) {
                return createErrorResponse("Impossible de vérifier les invitations", 400, reservationError.message);
            }

            const confirmedUserIds = new Set(
                ((confirmedParticipations || []) as Array<{ user_id: string | null }>)
                    .map((row) => String(row.user_id || ""))
                    .filter(Boolean)
            );
            const reservedUserIds = new Set(
                ((activeReservations || []) as Array<{ invitee_id: string | null }>)
                    .map((row) => String(row.invitee_id || ""))
                    .filter((id) => !!id && !confirmedUserIds.has(id))
            );
            const reservedCountWithoutCurrentUser = reservedUserIds.has(user.id)
                ? reservedUserIds.size - 1
                : reservedUserIds.size;
            const currentAttendeesCount = 1 + confirmedUserIds.size;

            if (currentAttendeesCount + reservedCountWithoutCurrentUser >= maxAttendees) {
                return createErrorResponse("Cette activité est complète", 400, { code: "activity_full" });
            }
        }

        const invitationPayload = {
            activity_id: activityId,
            inviter_id: String(activity.creator_id),
            invitee_id: user.id,
            status: "pending",
            reservation_expires_at: reservationExpiry,
            updated_at: nowIso,
        };

        let mutationError: { code?: string; message?: string } | null = null;
        if (existingInvitation?.id) {
            const updateResult = await db
                .from("activity_invitations")
                .update({
                    status: "pending",
                    reservation_expires_at: reservationExpiry,
                    updated_at: nowIso,
                })
                .eq("id", existingInvitation.id)
                .eq("invitee_id", user.id);
            mutationError = updateResult.error;
        } else {
            const insertResult = await db
                .from("activity_invitations")
                .insert(invitationPayload);
            mutationError = insertResult.error;
        }

        const mutationNeedsLegacyFallback = !!mutationError && (
            mutationError.code === "42703"
            || mutationError.code === "PGRST204"
            || String(mutationError.message || "").toLowerCase().includes("reservation_expires_at")
            || String(mutationError.message || "").toLowerCase().includes("updated_at")
        );
        if (mutationNeedsLegacyFallback) {
            if (existingInvitation?.id) {
                const fallbackUpdateResult = await db
                    .from("activity_invitations")
                    .update({ status: "pending" })
                    .eq("id", existingInvitation.id)
                    .eq("invitee_id", user.id);
                mutationError = fallbackUpdateResult.error;
            } else {
                const fallbackInsertResult = await db
                    .from("activity_invitations")
                    .insert({
                        activity_id: activityId,
                        inviter_id: String(activity.creator_id),
                        invitee_id: user.id,
                        status: "pending",
                    });
                mutationError = fallbackInsertResult.error;
            }
        }

        if (mutationError) {
            return createErrorResponse("Impossible de créer l'invitation", 400, mutationError.message);
        }

        await db
            .from("activity_invitation_notifications")
            .upsert({
                activity_id: activityId,
                user_id: user.id,
                type: "activity_invitation",
                title: "Invitation reçue",
                body: "Tu as été invité à une activité",
                metadata: {
                    type: "activity_invitation",
                    activity_id: activityId,
                    inviter_user_id: String(activity.creator_id),
                },
                read_at: null,
            }, { onConflict: "activity_id,user_id" });

        return createSuccessResponse({
            status: "pending",
            activity_id: activityId,
            message: "Invitation en attente.",
        });
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
