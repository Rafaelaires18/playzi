import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/pulse";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { buildRateLimitKey, getSafeRedirectBase, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";
import { buildPlayziSystemEmailHtml, sendPlayziSystemEmail } from "@/lib/email/system";

export async function POST(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const body = await req.json().catch(() => null);
        const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

        if (!email || !email.includes("@")) {
            return createErrorResponse("Adresse email invalide", 400);
        }

        const rate = checkRateLimit(
            buildRateLimitKey(req, "auth:password:forgot"),
            { limit: 6, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const redirectTo = `${getSafeRedirectBase(req)}/reset-password?recovery=1`;

        const serviceRoleClient = createServiceRoleClient();
        if (!serviceRoleClient) {
            return createErrorResponse("Configuration serveur incomplète.", 500);
        }

        const { data: authUsers } = await serviceRoleClient
            .schema("auth")
            .from("users")
            .select("id,email")
            .ilike("email", email)
            .limit(1);

        const hasUser = Array.isArray(authUsers) && authUsers.length > 0;
        if (hasUser) {
            const { data: linkData, error: linkError } = await serviceRoleClient.auth.admin.generateLink({
                type: "recovery",
                email,
                options: { redirectTo },
            });

            if (linkError || !linkData?.properties?.action_link) {
                console.error("[SECURITY_AUDIT] password_reset_generate_link_failed", {
                    code: linkError?.code,
                    message: linkError?.message,
                    status: linkError?.status,
                });
                return createErrorResponse(
                    "Impossible d'envoyer l'email pour le moment. Réessaie dans quelques minutes.",
                    503
                );
            }

            const resetLink = linkData.properties.action_link;
            const delivery = await sendPlayziSystemEmail({
                to: email,
                subject: "Réinitialisez votre mot de passe",
                text: `Une demande de réinitialisation du mot de passe a été faite sur votre compte Playzi.\n\nRéinitialiser maintenant: ${resetLink}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez simplement cet email.`,
                html: buildPlayziSystemEmailHtml({
                    title: "Réinitialisez votre mot de passe",
                    paragraphs: [
                        "Une demande de réinitialisation du mot de passe a été faite sur votre compte Playzi.",
                    ],
                    ctaLabel: "Réinitialiser mon mot de passe",
                    ctaHref: resetLink,
                    secondaryText: "Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet email.",
                }),
            });

            if (!delivery.sent) {
                return createErrorResponse(
                    "Impossible d'envoyer l'email pour le moment. Réessaie dans quelques minutes.",
                    503
                );
            }
        }

        console.info("[SECURITY_AUDIT] password_reset_requested");

        // Keep response generic for privacy even when email is unknown.
        return createSuccessResponse(
            {
                message: "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé."
            },
            200
        );
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors de la demande de réinitialisation.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
