import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerSchema } from "@/lib/validations/auth";
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
        const validation = registerSchema.safeParse(body);
        if (!validation.success) {
            return createErrorResponse(
                "Données invalides",
                400,
                validation.error.flatten().fieldErrors
            );
        }

        const { first_name, last_name, email, password, pseudo, gender } = validation.data;

        const rate = checkRateLimit(
            buildRateLimitKey(req, "auth:register", email.trim().toLowerCase()),
            { limit: 5, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        // 2. Connexion à Supabase Auth
        const supabase = await createClient();

        const { data: existingPseudo, error: pseudoCheckError } = await supabase
            .from("profiles")
            .select("id")
            .ilike("pseudo", pseudo.trim())
            .maybeSingle();

        if (pseudoCheckError && pseudoCheckError.code !== "PGRST116") {
            return createErrorResponse("Impossible de vérifier le pseudo pour le moment.", 400);
        }
        if (existingPseudo) {
            return createErrorResponse("Ce pseudo est déjà utilisé.", 409);
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    first_name,
                    last_name,
                    pseudo,
                    gender,
                },
            },
        });

        if (error) {
            // Identifier le type d'erreur Supabase (ex: email déjà pris)
            if (error.message.includes("already registered")) {
                return createErrorResponse("Cette adresse email est déjà utilisée.", 409);
            }
            if (
                error.message.toLowerCase().includes("duplicate key")
                || error.message.toLowerCase().includes("profiles_pseudo_unique_ci")
                || error.message.toLowerCase().includes("pseudo")
            ) {
                return createErrorResponse("Ce pseudo est déjà utilisé.", 409);
            }
            return createErrorResponse("Impossible de créer le compte pour le moment.", 400);
        }

        if (!data.user) {
            return createErrorResponse("Erreur lors de la création de l'utilisateur", 500);
        }

        // 3. Réponse Standardisée
        return createSuccessResponse(
            {
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    first_name: data.user.user_metadata.first_name,
                    last_name: data.user.user_metadata.last_name,
                    pseudo: data.user.user_metadata.pseudo,
                },
                message: "Inscription réussie",
            },
            201
        );

    } catch (e) {
        return createErrorResponse(
            "Erreur interne du serveur lors de l'inscription.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
