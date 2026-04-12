import { NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { buildRateLimitKey, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";
import { deleteAccountSchema } from "@/lib/validations/auth";

export async function POST(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const body = await req.json();
        const validation = deleteAccountSchema.safeParse(body);

        if (!validation.success) {
            return createErrorResponse(
                "Données invalides",
                400,
                validation.error.flatten().fieldErrors
            );
        }

        const supabase = await createClient();
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user || !user.email) {
            return createErrorResponse("Non authentifié", 401);
        }

        const rate = checkRateLimit(
            buildRateLimitKey(req, "auth:account:delete", user.id),
            { limit: 5, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !anonKey || !serviceRoleKey) {
            return createErrorResponse("Configuration Supabase incomplète", 500);
        }

        const checkClient = createSupabaseClient(url, anonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        const { error: signInError } = await checkClient.auth.signInWithPassword({
            email: user.email,
            password: validation.data.password,
        });

        if (signInError) {
            return createErrorResponse("Mot de passe incorrect.", 401);
        }

        const serviceRoleClient = createSupabaseClient(url, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        const { error: deleteError } = await serviceRoleClient.auth.admin.deleteUser(user.id);
        if (deleteError) {
            return createErrorResponse("Impossible de supprimer le compte.", 400, deleteError.message);
        }

        console.info("[SECURITY_AUDIT] account_deleted", { user_id: user.id });

        return createSuccessResponse(
            { message: "Compte supprimé avec succès." },
            200
        );
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors de la suppression du compte.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
