import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { buildRateLimitKey, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";

function canonicalPair(a: string, b: string) {
    return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

export async function POST(
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
            buildRateLimitKey(_req, "connections:request:accept", user.id),
            { limit: 60, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const { data: request, error: requestErr } = await supabase
            .from("connection_requests")
            .select("id, sender_id, receiver_id")
            .eq("id", id)
            .single();

        if (requestErr || !request) {
            return createErrorResponse("Demande introuvable", 404);
        }
        if (request.receiver_id !== user.id) {
            return createErrorResponse("Action non autorisée", 403);
        }

        const pair = canonicalPair(request.sender_id, request.receiver_id);

        const { error: insertErr } = await supabase
            .from("user_connections")
            .insert({ user_a: pair.user_a, user_b: pair.user_b });

        if (insertErr && !insertErr.message.toLowerCase().includes("duplicate")) {
            return createErrorResponse("Impossible d'ajouter la connexion", 400);
        }

        const { error: deleteErr } = await supabase
            .from("connection_requests")
            .delete()
            .eq("id", id);

        if (deleteErr) {
            return createErrorResponse("Impossible de finaliser la demande", 400);
        }

        console.info("[SECURITY_AUDIT] connection_request_accepted", {
            request_id: id,
            receiver_id: user.id,
            sender_id: request.sender_id,
        });

        return createSuccessResponse({ accepted: true }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne lors de l'acceptation", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

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
            buildRateLimitKey(_req, "connections:request:delete", user.id),
            { limit: 60, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const { data: request, error: requestErr } = await supabase
            .from("connection_requests")
            .select("id, sender_id, receiver_id")
            .eq("id", id)
            .single();

        if (requestErr || !request) {
            return createErrorResponse("Demande introuvable", 404);
        }
        if (request.receiver_id !== user.id && request.sender_id !== user.id) {
            return createErrorResponse("Action non autorisée", 403);
        }

        const { error: deleteErr } = await supabase
            .from("connection_requests")
            .delete()
            .eq("id", id);

        if (deleteErr) {
            return createErrorResponse("Impossible de supprimer la demande", 400);
        }

        console.info("[SECURITY_AUDIT] connection_request_deleted", {
            request_id: id,
            actor_id: user.id,
        });

        // No notification side-effect by design.
        return createSuccessResponse({ refused: true }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne lors du refus", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
