import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { buildRateLimitKey, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";

export async function POST(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const body = await req.json();

        // 1. Validation Zod du payload
        const validation = loginSchema.safeParse(body);
        if (!validation.success) {
            return createErrorResponse(
                "Données invalides",
                400,
                validation.error.flatten().fieldErrors
            );
        }

        const { email, password } = validation.data;

        const rate = checkRateLimit(
            buildRateLimitKey(req, "auth:login", email.trim().toLowerCase()),
            { limit: 8, windowMs: 10 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        // 2. Connexion à Supabase Auth
        const supabase = await createClient();

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return createErrorResponse(
                "Email ou mot de passe incorrect.",
                401
            );
        }

        if (!data.user) {
            return createErrorResponse("Erreur inattendue lors de la connexion", 500);
        }

        // 3. Réponse Standardisée
        return createSuccessResponse(
            {
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    pseudo: data.user.user_metadata?.pseudo,
                },
                message: "Connexion réussie",
            },
            200
        );

    } catch (e) {
        return createErrorResponse(
            "Erreur interne du serveur lors de la connexion.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
