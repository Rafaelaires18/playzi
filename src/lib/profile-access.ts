import type { SupabaseClient } from "@supabase/supabase-js";
import { areUsersBlockedEitherWay } from "@/lib/blocks";
import { canUsePlayziPlusFeature, getUserEntitlements } from "@/lib/billing/entitlements";

export type ProfileConnectionState = "self" | "connected" | "outgoing_pending" | "incoming_pending" | "none";

export type ProfileAccessDecision =
    | {
        access: "full";
        reason: "self" | "connection" | "playzi_plus";
        connection_state: ProfileConnectionState;
    }
    | {
        access: "locked";
        reason: "requires_connection_or_playzi_plus";
        connection_state: Exclude<ProfileConnectionState, "self" | "connected">;
    }
    | {
        access: "not_found";
        reason: "blocked" | "missing";
    };

function getCanonicalPair(a: string, b: string) {
    return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

export async function getProfileConnectionState(
    supabase: SupabaseClient,
    viewerUserId: string,
    targetUserId: string
): Promise<ProfileConnectionState> {
    if (!viewerUserId || !targetUserId) return "none";
    if (viewerUserId === targetUserId) return "self";

    const pair = getCanonicalPair(viewerUserId, targetUserId);
    const [{ data: connection }, { data: request }] = await Promise.all([
        supabase
            .from("user_connections")
            .select("id")
            .eq("user_a", pair.user_a)
            .eq("user_b", pair.user_b)
            .maybeSingle(),
        supabase
            .from("connection_requests")
            .select("id, sender_id, receiver_id")
            .or(
                `and(sender_id.eq.${viewerUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${viewerUserId})`
            )
            .maybeSingle(),
    ]);

    if (connection?.id) return "connected";
    if (request?.id) {
        return request.sender_id === viewerUserId ? "outgoing_pending" : "incoming_pending";
    }

    return "none";
}

export async function getViewerProfileAccessDecision(
    supabase: SupabaseClient,
    viewerUserId: string,
    targetUserId: string
): Promise<ProfileAccessDecision> {
    if (!viewerUserId || !targetUserId) {
        return { access: "not_found", reason: "missing" };
    }

    if (viewerUserId === targetUserId) {
        return { access: "full", reason: "self", connection_state: "self" };
    }

    const [
        usersBlocked,
        { data: targetProfile },
        connectionState,
        entitlements,
    ] = await Promise.all([
        areUsersBlockedEitherWay(supabase, viewerUserId, targetUserId),
        supabase
            .from("profiles")
            .select("id")
            .eq("id", targetUserId)
            .maybeSingle(),
        getProfileConnectionState(supabase, viewerUserId, targetUserId),
        getUserEntitlements(viewerUserId, supabase),
    ]);

    if (usersBlocked) {
        return { access: "not_found", reason: "blocked" };
    }

    if (!targetProfile?.id) {
        return { access: "not_found", reason: "missing" };
    }

    if (connectionState === "self") {
        return { access: "full", reason: "self", connection_state: connectionState };
    }
    if (connectionState === "connected") {
        return { access: "full", reason: "connection", connection_state: connectionState };
    }

    if (canUsePlayziPlusFeature(entitlements, "participant_profiles")) {
        return { access: "full", reason: "playzi_plus", connection_state: connectionState };
    }

    return {
        access: "locked",
        reason: "requires_connection_or_playzi_plus",
        connection_state: connectionState,
    };
}

export async function canViewerAccessTargetProfile(
    supabase: SupabaseClient,
    viewerUserId: string,
    targetUserId: string
): Promise<boolean> {
    const decision = await getViewerProfileAccessDecision(supabase, viewerUserId, targetUserId);
    return decision.access === "full";
}
