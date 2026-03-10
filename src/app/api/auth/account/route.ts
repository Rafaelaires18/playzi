import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { updateAccountSchema } from "@/lib/validations/auth";
import { buildRateLimitKey, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";

export async function PATCH(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const body = await req.json();
        const validation = updateAccountSchema.safeParse(body);

        if (!validation.success) {
            return createErrorResponse(
                "Données invalides",
                400,
                validation.error.flatten().fieldErrors
            );
        }

        const { pseudo, email } = validation.data;
        const supabase = await createClient();

        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) return createErrorResponse("Non authentifié", 401);

        const rate = checkRateLimit(
            buildRateLimitKey(req, "auth:account:update", user.id),
            { limit: 20, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const { data: existingProfile, error: existingProfileError } = await supabase
            .from("profiles")
            .select("id, pseudo")
            .eq("id", user.id)
            .single();

        if (existingProfileError || !existingProfile) {
            return createErrorResponse("Profil utilisateur introuvable", 404);
        }

        const nextPseudo = pseudo.trim();
        const nextEmail = email.trim().toLowerCase();

        if (nextPseudo.toLowerCase() !== (existingProfile.pseudo || "").toLowerCase()) {
            const { data: pseudoTaken, error: pseudoTakenError } = await supabase
                .from("profiles")
                .select("id")
                .ilike("pseudo", nextPseudo)
                .neq("id", user.id)
                .maybeSingle();

            if (pseudoTakenError && pseudoTakenError.code !== "PGRST116") {
                return createErrorResponse("Impossible de vérifier le pseudo", 400);
            }
            if (pseudoTaken) {
                return createErrorResponse("Ce pseudo est déjà utilisé.", 409);
            }
        }

        const { error: profileUpdateError } = await supabase
            .from("profiles")
            .update({ pseudo: nextPseudo })
            .eq("id", user.id);

        if (profileUpdateError) {
            if (profileUpdateError.message.toLowerCase().includes("duplicate") || profileUpdateError.message.toLowerCase().includes("pseudo")) {
                return createErrorResponse("Ce pseudo est déjà utilisé.", 409);
            }
            return createErrorResponse("Impossible de mettre à jour le pseudo", 400);
        }

        const metadataPayload: Record<string, string> = {
            pseudo: nextPseudo,
        };

        const shouldUpdateEmail = (user.email || "").toLowerCase() !== nextEmail;

        const { error: authUpdateError } = await supabase.auth.updateUser(
            shouldUpdateEmail
                ? { email: nextEmail, data: metadataPayload }
                : { data: metadataPayload }
        );

        if (authUpdateError) {
            return createErrorResponse("Impossible de mettre à jour le compte", 400);
        }

        console.info("[SECURITY_AUDIT] account_updated", {
            user_id: user.id,
            email_changed: shouldUpdateEmail,
        });

        return createSuccessResponse(
            {
                user: {
                    id: user.id,
                    pseudo: nextPseudo,
                    email: shouldUpdateEmail ? nextEmail : user.email,
                },
                message: shouldUpdateEmail
                    ? "Compte mis à jour. Vérifie ta boîte mail pour confirmer le nouvel email."
                    : "Compte mis à jour"
            },
            200
        );
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors de la mise à jour du compte.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
