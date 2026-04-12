import { randomBytes, createHash } from "crypto";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/pulse";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { requestEmailChangeSchema } from "@/lib/validations/auth";
import { buildRateLimitKey, getSafeRedirectBase, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";
import { buildPlayziSystemEmailHtml, sendPlayziSystemEmail } from "@/lib/email/system";

const CONFIRM_WINDOW_MS = 15 * 60 * 1000;
const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

function createToken() {
    return randomBytes(32).toString("base64url");
}

function isAlreadyUsedEmailError(message: string) {
    const lower = message.toLowerCase();
    return lower.includes("already") || lower.includes("registered") || lower.includes("exists") || lower.includes("duplicate");
}

function buildEmailChangeActionLink(baseUrl: string, action: "confirm" | "cancel", token: string) {
    return `${baseUrl}/auth/email-change?action=${action}&token=${encodeURIComponent(token)}`;
}

export async function POST(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const body = await req.json();
        const validation = requestEmailChangeSchema.safeParse(body);

        if (!validation.success) {
            return createErrorResponse(
                "Données invalides",
                400,
                validation.error.flatten().fieldErrors
            );
        }

        const { new_email, current_password } = validation.data;
        const supabase = await createClient();

        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user || !user.email) {
            return createErrorResponse("Non authentifié", 401);
        }

        const rate = checkRateLimit(
            buildRateLimitKey(req, "auth:email:update", user.id),
            { limit: 8, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const normalizedCurrentEmail = user.email.trim().toLowerCase();
        const normalizedNewEmail = new_email.trim().toLowerCase();

        if (normalizedCurrentEmail === normalizedNewEmail) {
            return createErrorResponse("Le nouvel email doit être différent de l'email actuel.", 400);
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: normalizedCurrentEmail,
            password: current_password,
        });

        if (signInError) {
            return createErrorResponse("Le mot de passe actuel est incorrect.", 401);
        }

        const serviceRoleClient = createServiceRoleClient();
        if (!serviceRoleClient) {
            return createErrorResponse("Configuration serveur incomplète.", 500);
        }

        const { data: existingAuthUsers, error: authUsersError } = await serviceRoleClient
            .schema("auth")
            .from("users")
            .select("id")
            .ilike("email", normalizedNewEmail)
            .limit(1);

        if (authUsersError) {
            return createErrorResponse("Impossible de vérifier l'adresse email.", 400);
        }

        if (Array.isArray(existingAuthUsers) && existingAuthUsers.some((row: { id: string }) => row.id !== user.id)) {
            return createErrorResponse("Cette adresse email est déjà utilisée.", 409);
        }

        const now = Date.now();
        const confirmToken = createToken();
        const cancelToken = createToken();
        const confirmTokenHash = hashToken(confirmToken);
        const cancelTokenHash = hashToken(cancelToken);

        const confirmExpiresAt = new Date(now + CONFIRM_WINDOW_MS).toISOString();
        const cancelExpiresAt = new Date(now + CANCEL_WINDOW_MS).toISOString();

        await serviceRoleClient
            .from("email_change_requests")
            .update({ canceled_at: new Date(now).toISOString(), pending_email: null })
            .eq("user_id", user.id)
            .is("canceled_at", null);

        const { data: insertedRequest, error: insertError } = await serviceRoleClient
            .from("email_change_requests")
            .insert({
                user_id: user.id,
                current_email: normalizedCurrentEmail,
                pending_email: normalizedNewEmail,
                confirm_token_hash: confirmTokenHash,
                cancel_token_hash: cancelTokenHash,
                confirm_expires_at: confirmExpiresAt,
                cancel_expires_at: cancelExpiresAt,
            })
            .select("id")
            .single();

        if (insertError || !insertedRequest?.id) {
            if (insertError && isAlreadyUsedEmailError(insertError.message || "")) {
                return createErrorResponse("Cette adresse email est déjà utilisée.", 409);
            }
            return createErrorResponse("Impossible d'initier le changement d'email.", 400, insertError?.message);
        }

        const baseUrl = getSafeRedirectBase(req);
        const confirmLink = buildEmailChangeActionLink(baseUrl, "confirm", confirmToken);
        const cancelLink = buildEmailChangeActionLink(baseUrl, "cancel", cancelToken);

        const [newEmailDelivery, oldEmailAlert] = await Promise.all([
            sendPlayziSystemEmail({
                to: normalizedNewEmail,
                subject: "Confirmez votre nouvelle adresse email",
                text: `Une demande de changement d'email a été initiée pour votre compte Playzi.\n\nConfirmer maintenant: ${confirmLink}\n\nCe lien expire dans 15 minutes.`,
                html: buildPlayziSystemEmailHtml({
                    title: "Confirmez votre nouvelle adresse email",
                    paragraphs: [
                        "Une demande de modification d’adresse email a été faite sur votre compte Playzi.",
                    ],
                    ctaLabel: "Confirmer mon email",
                    ctaHref: confirmLink,
                    secondaryText: "Ce lien expire dans 10 à 15 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet email.",
                }),
            }),
            sendPlayziSystemEmail({
                to: normalizedCurrentEmail,
                subject: "Modification d’adresse email détectée",
                text: `Une demande de changement d'adresse email a été effectuée sur votre compte Playzi.\n\nSi ce n'est pas vous, annulez immédiatement: ${cancelLink}\n\nLe lien d'annulation reste actif 24 heures.`,
                html: buildPlayziSystemEmailHtml({
                    title: "Modification d’adresse email détectée",
                    paragraphs: [
                        "Une demande de changement d’adresse email a été effectuée sur votre compte Playzi.",
                    ],
                    ctaLabel: "Ce n’est pas moi",
                    ctaHref: cancelLink,
                    secondaryText: "Vous avez jusqu’à 24 heures pour annuler cette modification. Si vous êtes bien à l’origine de cette action, aucune action n’est nécessaire.",
                }),
            }),
        ]);

        if (!newEmailDelivery.sent || !oldEmailAlert.sent) {
            await serviceRoleClient
                .from("email_change_requests")
                .delete()
                .eq("id", insertedRequest.id);

            return createErrorResponse(
                "Impossible d'envoyer les emails de sécurité pour le moment.",
                503,
                {
                    new_email_sent: newEmailDelivery.sent,
                    old_email_sent: oldEmailAlert.sent,
                }
            );
        }

        console.info("[SECURITY_AUDIT] email_change_requested", {
            user_id: user.id,
            from: normalizedCurrentEmail,
            to: normalizedNewEmail,
            confirm_expires_at: confirmExpiresAt,
            cancel_expires_at: cancelExpiresAt,
        });

        return createSuccessResponse(
            {
                message: "Un email de confirmation a été envoyé à votre nouvelle adresse.",
                pending_email: normalizedNewEmail,
            },
            200
        );
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors du changement d'email.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
