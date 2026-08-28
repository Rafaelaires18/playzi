import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { buildRateLimitKey, isSameOriginRequest } from "@/lib/security/request";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";
import { enforceUserCapability, getModerationServiceClient } from "@/lib/moderation";
import { areUsersBlockedEitherWay, getBlockedUserIdsForUser } from "@/lib/blocks";

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
type ConnectionRequestStateRow = {
    sender_id: string;
    receiver_id: string;
};

type ActivityIdRow = { id: string };
type ActivityCreatorRow = { id: string; creator_id: string };
type ParticipationActivityRow = { activity_id: string };
type ParticipationByUserRow = { activity_id: string; user_id: string };

async function computeSharedActivitiesCountByConnectionUser(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
    connectionUserIds: string[]
) {
    const countsByConnectionUserId = new Map<string, number>();
    for (const id of connectionUserIds) countsByConnectionUserId.set(id, 0);
    if (connectionUserIds.length === 0) return countsByConnectionUserId;

    const nowIso = new Date().toISOString();
    const [userCreatedActivitiesRes, userParticipationsRes] = await Promise.all([
        supabase
            .from("activities")
            .select("id")
            .eq("creator_id", userId)
            .lte("start_time", nowIso)
            .neq("status", "annulé"),
        supabase
            .from("participations")
            .select("activity_id")
            .eq("user_id", userId)
            .eq("status", "confirmé"),
    ]);

    if (userCreatedActivitiesRes.error || userParticipationsRes.error) {
        return countsByConnectionUserId;
    }

    const createdIds = (userCreatedActivitiesRes.data || []).map((row: ActivityIdRow) => String(row.id)).filter(Boolean);
    const participationIds = (userParticipationsRes.data || []).map((row: ParticipationActivityRow) => String(row.activity_id)).filter(Boolean);

    let eligibleParticipationIds: string[] = [];
    if (participationIds.length > 0) {
        const { data: eligibleParticipationActivities, error: eligibleParticipationActivitiesError } = await supabase
            .from("activities")
            .select("id")
            .in("id", participationIds)
            .lte("start_time", nowIso)
            .neq("status", "annulé");
        if (!eligibleParticipationActivitiesError) {
            eligibleParticipationIds = (eligibleParticipationActivities || []).map((row: ActivityIdRow) => String(row.id)).filter(Boolean);
        }
    }

    const userActivityIds = Array.from(new Set([...createdIds, ...eligibleParticipationIds]));
    if (userActivityIds.length === 0) return countsByConnectionUserId;

    const [connectionCreatedActivitiesRes, connectionParticipationsRes] = await Promise.all([
        supabase
            .from("activities")
            .select("id,creator_id")
            .in("id", userActivityIds)
            .in("creator_id", connectionUserIds),
        supabase
            .from("participations")
            .select("activity_id,user_id")
            .in("activity_id", userActivityIds)
            .in("user_id", connectionUserIds)
            .eq("status", "confirmé"),
    ]);

    if (connectionCreatedActivitiesRes.error || connectionParticipationsRes.error) {
        return countsByConnectionUserId;
    }

    const activityIdsByConnectionUser = new Map<string, Set<string>>();
    for (const id of connectionUserIds) activityIdsByConnectionUser.set(id, new Set<string>());

    for (const row of (connectionCreatedActivitiesRes.data || []) as ActivityCreatorRow[]) {
        const userSet = activityIdsByConnectionUser.get(String(row.creator_id));
        if (userSet) userSet.add(String(row.id));
    }
    for (const row of (connectionParticipationsRes.data || []) as ParticipationByUserRow[]) {
        const userSet = activityIdsByConnectionUser.get(String(row.user_id));
        if (userSet) userSet.add(String(row.activity_id));
    }

    for (const [connectionUserId, activityIds] of activityIdsByConnectionUser.entries()) {
        countsByConnectionUserId.set(connectionUserId, activityIds.size);
    }

    return countsByConnectionUserId;
}

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) return createErrorResponse("Non authentifié", 401);
        const blockedIds = await getBlockedUserIdsForUser(supabase as never, user.id);
        const scope = req.nextUrl.searchParams.get("scope");

        const rate = checkRateLimit(
            buildRateLimitKey(req, "connections:list", user.id),
            { limit: 120, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        if (scope === "ids") {
            const [{ data: connA, error: connAErr }, { data: connB, error: connBErr }, { data: pendingRequests, error: pendingErr }] = await Promise.all([
                supabase
                    .from("user_connections")
                    .select("user_b")
                    .eq("user_a", user.id),
                supabase
                    .from("user_connections")
                    .select("user_a")
                    .eq("user_b", user.id),
                supabase
                    .from("connection_requests")
                    .select("sender_id,receiver_id")
                    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
            ]);

            if (connAErr || connBErr || pendingErr) {
                return createErrorResponse("Impossible de charger les connexions", 400);
            }

            const connected_user_ids = Array.from(new Set([
                ...((connA || []) as Array<{ user_b?: string | null }>)
                    .map((row) => String(row.user_b || ""))
                    .filter(Boolean),
                ...((connB || []) as Array<{ user_a?: string | null }>)
                    .map((row) => String(row.user_a || ""))
                    .filter(Boolean),
            ].filter((id) => !blockedIds.has(id))));

            const outgoing_pending_user_ids = new Set<string>();
            const incoming_pending_user_ids = new Set<string>();
            for (const request of (pendingRequests || []) as ConnectionRequestStateRow[]) {
                if (request.sender_id === user.id && request.receiver_id && !blockedIds.has(request.receiver_id)) {
                    outgoing_pending_user_ids.add(request.receiver_id);
                } else if (request.receiver_id === user.id && request.sender_id && !blockedIds.has(request.sender_id)) {
                    incoming_pending_user_ids.add(request.sender_id);
                }
            }

            return createSuccessResponse(
                {
                    connected_user_ids,
                    outgoing_pending_user_ids: Array.from(outgoing_pending_user_ids),
                    incoming_pending_user_ids: Array.from(incoming_pending_user_ids),
                },
                200
            );
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
        const sharedActivitiesByUserId = await computeSharedActivitiesCountByConnectionUser(supabase, user.id, otherProfileIds);
        const requestSenderIds = Array.from(new Set((requests || []).map((r) => r.sender_id)));
        const profileIds = Array.from(new Set([...otherProfileIds, ...requestSenderIds]));

        const { data: profiles, error: profileErr } =
            profileIds.length > 0
                ? await supabase.from("profiles").select("id, pseudo, avatar_url, gender").in("id", profileIds)
                : { data: [], error: null as { message?: string } | null };

        if (profileErr) {
            return createErrorResponse("Impossible de charger les profils connexes", 400);
        }

        const profileById = new Map<string, { pseudo: string; avatar_url: string | null; gender: string | null }>(
            (profiles || []).map((p) => [p.id, { pseudo: p.pseudo || "Utilisateur", avatar_url: p.avatar_url || null, gender: p.gender || null }])
        );

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const newThisMonth = allConnections.filter((c) => new Date(c.created_at) >= monthStart).length;

        const responseConnections = allConnections
            .map((c) => {
            const otherId = c.user_a === user.id ? c.user_b : c.user_a;
            if (blockedIds.has(String(otherId || ""))) return null;
            const profile = profileById.get(otherId);
            return {
                id: c.id,
                user_id: otherId,
                name: profile?.pseudo || "Utilisateur",
                pseudo: profile?.pseudo || "utilisateur",
                avatar_url: profile?.avatar_url || null,
                gender: profile?.gender || null,
                activities: sharedActivitiesByUserId.get(otherId) || 0,
                connectedAt: c.created_at
            };
        })
            .filter((row): row is NonNullable<typeof row> => !!row);

        const responseRequests = (requests as ConnectionRequestRow[] | null || [])
            .filter((r) => !blockedIds.has(String(r.sender_id || "")))
            .map((r) => {
            const profile = profileById.get(r.sender_id);
            return {
                id: r.id,
                sender_id: r.sender_id,
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

export async function POST(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const supabase = await createClient();
        const moderationDb = getModerationServiceClient() ?? supabase;
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) return createErrorResponse("Non authentifié", 401);

        const moderationGate = await enforceUserCapability(moderationDb as never, user.id, "connect_send");
        if (!moderationGate.allowed) {
            return createErrorResponse(moderationGate.message, 403, {
                code: moderationGate.code,
                until: moderationGate.until || null,
                message: moderationGate.message,
            });
        }

        const rate = checkRateLimit(
            buildRateLimitKey(req, "connections:request:create", user.id),
            { limit: 120, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const body = await req.json().catch(() => null);
        const receiverId = typeof body?.receiver_id === "string" ? body.receiver_id : null;

        if (!receiverId) return createErrorResponse("receiver_id requis", 400);
        if (receiverId === user.id) return createErrorResponse("Vous ne pouvez pas vous connecter à vous-même", 400);
        const usersBlocked = await areUsersBlockedEitherWay(supabase as never, user.id, receiverId);
        if (usersBlocked) {
            return createErrorResponse("Impossible d'envoyer cette demande", 403);
        }

        const canonicalA = user.id < receiverId ? user.id : receiverId;
        const canonicalB = user.id < receiverId ? receiverId : user.id;

        const { data: existingConnection } = await supabase
            .from("user_connections")
            .select("id")
            .eq("user_a", canonicalA)
            .eq("user_b", canonicalB)
            .maybeSingle();

        if (existingConnection) {
            return createSuccessResponse({ status: "already_connected" }, 200);
        }

        const { data: existingRequest } = await supabase
            .from("connection_requests")
            .select("id, sender_id, receiver_id")
            .or(
                `and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`
            )
            .maybeSingle();

        if (existingRequest) {
            const status = existingRequest.sender_id === user.id ? "already_requested" : "incoming_request_exists";
            return createSuccessResponse({ status }, 200);
        }

        const { error: insertError } = await supabase
            .from("connection_requests")
            .insert({ sender_id: user.id, receiver_id: receiverId });

        if (insertError) {
            return createErrorResponse("Impossible d'envoyer la demande de connexion", 400, insertError.message);
        }

        return createSuccessResponse({ status: "request_sent" }, 201);
    } catch (e) {
        return createErrorResponse("Erreur interne lors de l'envoi de la demande", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
