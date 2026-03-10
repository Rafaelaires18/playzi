import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { changePasswordSchema } from "@/lib/validations/auth";
import { buildRateLimitKey, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";

export async function POST(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const body = await req.json();
        const validation = changePasswordSchema.safeParse(body);

        if (!validation.success) {
            return createErrorResponse(
                "Données invalides",
                400,
                validation.error.flatten().fieldErrors
            );
        }

        const { current_password, new_password } = validation.data;
        const supabase = await createClient();

        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user || !user.email) {
            return createErrorResponse("Non authentifié", 401);
        }

        const rate = checkRateLimit(
            buildRateLimitKey(req, "auth:password:update", user.id),
            { limit: 10, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: current_password,
        });

        if (signInError) {
            return createErrorResponse("Le mot de passe actuel est incorrect.", 401);
        }

        const { error: updateError } = await supabase.auth.updateUser({
            password: new_password,
        });

        if (updateError) {
            return createErrorResponse("Impossible de mettre à jour le mot de passe.", 400);
        }

        console.info("[SECURITY_AUDIT] password_changed", { user_id: user.id });

        return createSuccessResponse(
            { message: "Mot de passe mis à jour avec succès" },
            200
        );
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors de la modification du mot de passe.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
