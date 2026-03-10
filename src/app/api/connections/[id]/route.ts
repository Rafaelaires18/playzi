import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { buildRateLimitKey, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        if (!isSameOriginRequest(_req)) {
            return forbiddenOriginResponse();
        }

        const { id } = await params;
        const supabase = await createClient();
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) return createErrorResponse("Non authentifié", 401);

        const rate = checkRateLimit(
            buildRateLimitKey(_req, "connections:delete", user.id),
            { limit: 60, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const { data: connection, error: connectionErr } = await supabase
            .from("user_connections")
            .select("id, user_a, user_b")
            .eq("id", id)
            .single();

        if (connectionErr || !connection) {
            return createErrorResponse("Connexion introuvable", 404);
        }

        if (connection.user_a !== user.id && connection.user_b !== user.id) {
            return createErrorResponse("Action non autorisée", 403);
        }

        const { error: deleteErr } = await supabase
            .from("user_connections")
            .delete()
            .eq("id", id);

        if (deleteErr) {
            return createErrorResponse("Impossible de supprimer la connexion", 400);
        }

        console.info("[SECURITY_AUDIT] connection_deleted", {
            connection_id: id,
            actor_id: user.id,
        });

        // Single shared record => reciprocal deletion for both users.
        return createSuccessResponse({ removed: true }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne lors de la suppression", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
