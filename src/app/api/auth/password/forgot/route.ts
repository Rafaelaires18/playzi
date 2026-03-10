import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { buildRateLimitKey, getSafeRedirectBase, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";

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

        const supabase = await createClient();
        // Supabase recovery links often append tokens in URL hash (#...), which is not
        // available to server routes. Redirect directly to reset-password so the client
        // page can bootstrap the recovery session from the hash.
        const redirectTo = `${getSafeRedirectBase(req)}/reset-password?recovery=1`;

        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

        if (error) {
            console.error("[SECURITY_AUDIT] password_reset_request_failed", {
                code: error.code,
                message: error.message,
                status: error.status,
            });
            return createErrorResponse(
                "Impossible d'envoyer l'email pour le moment. Réessaie dans quelques minutes.",
                503
            );
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
