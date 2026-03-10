import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { passwordSchema } from "@/lib/validations/auth";
import { z } from "zod";
import { buildRateLimitKey, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";

const recoverPasswordSchema = z.object({
    new_password: passwordSchema,
    confirm_password: z.string().min(1, "La confirmation du mot de passe est requise")
}).refine((data) => data.new_password === data.confirm_password, {
    message: "La confirmation du nouveau mot de passe ne correspond pas",
    path: ["confirm_password"]
});

export async function POST(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const body = await req.json();
        const validation = recoverPasswordSchema.safeParse(body);

        if (!validation.success) {
            return createErrorResponse(
                "Données invalides",
                400,
                validation.error.flatten().fieldErrors
            );
        }

        const { new_password } = validation.data;
        const supabase = await createClient();

        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return createErrorResponse("Session de récupération invalide ou expirée.", 401);
        }

        const rate = checkRateLimit(
            buildRateLimitKey(req, "auth:password:recover", user.id),
            { limit: 8, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const { error: updateError } = await supabase.auth.updateUser({
            password: new_password,
        });

        if (updateError) {
            return createErrorResponse("Impossible de mettre à jour le mot de passe.", 400);
        }

        // End recovery session to force explicit login with the new password.
        await supabase.auth.signOut();

        console.info("[SECURITY_AUDIT] password_recovered", { user_id: user.id });

        return createSuccessResponse(
            { message: "Mot de passe réinitialisé avec succès" },
            200
        );
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors de la réinitialisation du mot de passe.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
