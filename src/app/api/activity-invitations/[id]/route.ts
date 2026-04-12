import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { z } from "zod";

const updateInvitationSchema = z.object({
    action: z.enum(["decline", "dismiss_expired"]),
});

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return createErrorResponse("Non autorisé", 401);
        }

        const { id } = await context.params;
        if (!id) return createErrorResponse("Invitation invalide", 400);

        const body = await req.json().catch(() => null);
        const parsed = updateInvitationSchema.safeParse(body);
        if (!parsed.success) {
            return createErrorResponse("Action invalide", 400, parsed.error.flatten().fieldErrors);
        }

        const { action } = parsed.data;
        let invitationResult = await supabase
            .from("activity_invitations")
            .select("id,activity_id,invitee_id,status,reservation_expires_at")
            .eq("id", id)
            .eq("invitee_id", user.id)
            .maybeSingle();
        const invitationNeedsLegacyFallback = !!invitationResult.error && (
            invitationResult.error.code === "42703"
            || invitationResult.error.code === "PGRST204"
            || String(invitationResult.error.message || "").toLowerCase().includes("reservation_expires_at")
        );
        if (invitationNeedsLegacyFallback) {
            const legacyResult = await supabase
                .from("activity_invitations")
                .select("id,activity_id,invitee_id,status")
                .eq("id", id)
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
        const invitation = invitationResult.data;
        const invitationError = invitationResult.error;

        if (invitationError) {
            return createErrorResponse("Impossible de charger l'invitation", 400, invitationError.message);
        }
        if (!invitation) {
            return createErrorResponse("Invitation introuvable", 404);
        }

        const nowIso = new Date().toISOString();
        const reservationExpiresAt = invitation.reservation_expires_at ? String(invitation.reservation_expires_at) : null;
        const isExpiredByTime = !!reservationExpiresAt && reservationExpiresAt <= nowIso;
        const effectiveStatus = invitation.status === "pending" && isExpiredByTime ? "expired" : invitation.status;

        if (action === "dismiss_expired" && effectiveStatus !== "expired") {
            return createErrorResponse("Invitation non expirée", 400);
        }

        if (action === "decline" && !["pending", "expired"].includes(effectiveStatus)) {
            return createErrorResponse("Invitation déjà traitée", 400);
        }

        let invitationUpdateResult = await supabase
            .from("activity_invitations")
            .update({
                status: "declined",
                reservation_expires_at: null,
                updated_at: nowIso,
            })
            .eq("id", id)
            .eq("invitee_id", user.id)
            .in("status", ["pending", "expired"]);

        const needsLegacyFallback = !!invitationUpdateResult.error && (
            invitationUpdateResult.error.code === "42703"
            || invitationUpdateResult.error.code === "PGRST204"
            || String(invitationUpdateResult.error.message || "").toLowerCase().includes("reservation_expires_at")
            || String(invitationUpdateResult.error.message || "").toLowerCase().includes("updated_at")
        );
        if (needsLegacyFallback) {
            invitationUpdateResult = await supabase
                .from("activity_invitations")
                .update({ status: "declined" })
                .eq("id", id)
                .eq("invitee_id", user.id)
                .in("status", ["pending", "expired"]);
        }
        if (invitationUpdateResult.error) {
            return createErrorResponse("Impossible de mettre à jour l'invitation", 400, invitationUpdateResult.error.message);
        }

        await supabase
            .from("activity_invitation_notifications")
            .update({ read_at: nowIso })
            .eq("activity_id", invitation.activity_id)
            .eq("user_id", user.id)
            .is("read_at", null);

        return createSuccessResponse({ status: "declined" }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
