import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { buildRateLimitKey } from "@/lib/security/request";
import { tooManyRequestsResponse } from "@/lib/security/response";

type ConnectionRow = {
    id: string;
    user_a: string;
    user_b: string;
    created_at: string;
};

type ConnectionRequestRow = {
    id: string;
    sender_id: string;
    receiver_id: string;
    created_at: string;
};

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) return createErrorResponse("Non authentifié", 401);

        const rate = checkRateLimit(
            buildRateLimitKey(req, "connections:list", user.id),
            { limit: 120, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const [{ data: requests, error: reqErr }, { data: connA, error: connAErr }, { data: connB, error: connBErr }] = await Promise.all([
            supabase
                .from("connection_requests")
                .select("id, sender_id, receiver_id, created_at")
                .eq("receiver_id", user.id)
                .order("created_at", { ascending: false }),
            supabase
                .from("user_connections")
                .select("id, user_a, user_b, created_at")
                .eq("user_a", user.id),
            supabase
                .from("user_connections")
                .select("id, user_a, user_b, created_at")
                .eq("user_b", user.id)
        ]);

        if (reqErr || connAErr || connBErr) {
            return createErrorResponse("Impossible de charger les connexions", 400);
        }

        const allConnections = ([...(connA || []), ...(connB || [])] as ConnectionRow[]);
        const otherProfileIds = Array.from(
            new Set(
                allConnections.map((c) => (c.user_a === user.id ? c.user_b : c.user_a))
            )
        );
        const requestSenderIds = Array.from(new Set((requests || []).map((r) => r.sender_id)));
        const profileIds = Array.from(new Set([...otherProfileIds, ...requestSenderIds]));

        const { data: profiles, error: profileErr } =
            profileIds.length > 0
                ? await supabase.from("profiles").select("id, pseudo, avatar_url").in("id", profileIds)
                : { data: [], error: null as { message?: string } | null };

        if (profileErr) {
            return createErrorResponse("Impossible de charger les profils connexes", 400);
        }

        const profileById = new Map<string, { pseudo: string; avatar_url: string | null }>(
            (profiles || []).map((p) => [p.id, { pseudo: p.pseudo || "Utilisateur", avatar_url: p.avatar_url || null }])
        );

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const newThisMonth = allConnections.filter((c) => new Date(c.created_at) >= monthStart).length;

        const responseConnections = allConnections.map((c) => {
            const otherId = c.user_a === user.id ? c.user_b : c.user_a;
            const profile = profileById.get(otherId);
            return {
                id: c.id,
                name: profile?.pseudo || "Utilisateur",
                pseudo: profile?.pseudo || "utilisateur",
                avatar_url: profile?.avatar_url || null,
                activities: 0,
                connectedAt: c.created_at
            };
        });

        const responseRequests = (requests as ConnectionRequestRow[] | null || []).map((r) => {
            const profile = profileById.get(r.sender_id);
            return {
                id: r.id,
                name: profile?.pseudo || "Utilisateur",
                pseudo: profile?.pseudo || "utilisateur"
            };
        });

        return createSuccessResponse(
            {
                requests: responseRequests,
                connections: responseConnections,
                totalConnections: responseConnections.length,
                newThisMonth
            },
            200
        );
    } catch (e) {
        return createErrorResponse("Erreur interne lors du chargement des connexions", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
