import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getRankLabelFromPulse } from "@/lib/rank";
import { getViewerProfileAccessDecision } from "@/lib/profile-access";
import { createServiceRoleClient, loadPulseTotalsByUserIds } from "@/lib/pulse";

type ConnectionRow = {
    id: string;
    user_a: string;
    user_b: string;
};

type ProfileRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    pseudo: string | null;
};

type ActivityIdRow = { id: string };
type ActivityCreatorRow = { id: string; creator_id: string };
type ParticipationActivityRow = { activity_id: string };
type ParticipationByUserRow = { activity_id: string; user_id: string };

async function computeSharedActivitiesCountByConnectionUser(
    supabase: Awaited<ReturnType<typeof createClient>>,
    viewerUserId: string,
    connectionUserIds: string[]
) {
    const countsByConnectionUserId = new Map<string, number>();
    for (const id of connectionUserIds) countsByConnectionUserId.set(id, 0);
    if (connectionUserIds.length === 0) return countsByConnectionUserId;

    const nowIso = new Date().toISOString();
    const [viewerCreatedActivitiesRes, viewerParticipationsRes] = await Promise.all([
        supabase
            .from("activities")
            .select("id")
            .eq("creator_id", viewerUserId)
            .lte("start_time", nowIso)
            .neq("status", "annulé"),
        supabase
            .from("participations")
            .select("activity_id")
            .eq("user_id", viewerUserId)
            .eq("status", "confirmé"),
    ]);

    if (viewerCreatedActivitiesRes.error || viewerParticipationsRes.error) {
        return countsByConnectionUserId;
    }

    const createdIds = (viewerCreatedActivitiesRes.data || []).map((row: ActivityIdRow) => String(row.id)).filter(Boolean);
    const participationIds = (viewerParticipationsRes.data || []).map((row: ParticipationActivityRow) => String(row.activity_id)).filter(Boolean);

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

    const viewerActivityIds = Array.from(new Set([...createdIds, ...eligibleParticipationIds]));
    if (viewerActivityIds.length === 0) return countsByConnectionUserId;

    const [connectionCreatedActivitiesRes, connectionParticipationsRes] = await Promise.all([
        supabase
            .from("activities")
            .select("id,creator_id")
            .in("id", viewerActivityIds)
            .in("creator_id", connectionUserIds),
        supabase
            .from("participations")
            .select("activity_id,user_id")
            .in("activity_id", viewerActivityIds)
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

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: profileId } = await params;
        const supabase = await createClient();
        const db = createServiceRoleClient() ?? supabase;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return createErrorResponse("Non autorisé", 401);
        const accessDecision = await getViewerProfileAccessDecision(db as never, user.id, profileId);
        if (accessDecision.access !== "full") {
            return createErrorResponse("Profil introuvable", 404);
        }

        const { data: connections, error: connectionsError } = await db
            .from("user_connections")
            .select("id,user_a,user_b")
            .or(`user_a.eq.${profileId},user_b.eq.${profileId}`);

        if (connectionsError) {
            return createErrorResponse("Impossible de charger les connexions", 400, connectionsError.message);
        }

        const otherIds = Array.from(new Set(((connections || []) as ConnectionRow[]).map((row) =>
            row.user_a === profileId ? row.user_b : row.user_a
        )));
        const sharedActivitiesByUserId = await computeSharedActivitiesCountByConnectionUser(supabase, user.id, otherIds);

        if (otherIds.length === 0) {
            return createSuccessResponse({ connections: [] }, 200);
        }

        const [{ data: profiles }, pulseById] = await Promise.all([
            db
                .from("profiles")
                .select("id,first_name,last_name,pseudo")
                .in("id", otherIds),
            loadPulseTotalsByUserIds(otherIds, createServiceRoleClient() ?? supabase),
        ]);
        const profileById = new Map<string, ProfileRow>(
            ((profiles || []) as ProfileRow[]).map((row) => [row.id, row])
        );

        const rows = otherIds
            .map((id) => {
                const p = profileById.get(id);
                if (!p) return null;
                const totalPulse = pulseById.get(id) || 0;
                return {
                    id,
                    first_name: p.first_name,
                    last_name: p.last_name,
                    pseudo: p.pseudo || "utilisateur",
                    rank_label: getRankLabelFromPulse(totalPulse),
                    activities_together: sharedActivitiesByUserId.get(id) || 0,
                };
            })
            .filter((row): row is NonNullable<typeof row> => !!row)
            .sort((a, b) => {
                const aName = `${a.first_name || ""} ${a.last_name || ""}`.trim() || a.pseudo;
                const bName = `${b.first_name || ""} ${b.last_name || ""}`.trim() || b.pseudo;
                return aName.localeCompare(bName, "fr");
            });

        return createSuccessResponse({ connections: rows }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
