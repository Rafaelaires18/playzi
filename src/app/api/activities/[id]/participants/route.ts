import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getRankLabelFromPulse } from "@/lib/rank";
import { getBlockedUserIdsForUser } from "@/lib/blocks";
import { createServiceRoleClient, loadPulseTotalsByUserIds } from "@/lib/pulse";

type ParticipantRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    pseudo: string | null;
};

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: activityId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return createErrorResponse("Non autorisé", 401);
        const blockedIds = await getBlockedUserIdsForUser(supabase as never, user.id);

        const { data: activity, error: activityError } = await supabase
            .from("activities")
            .select("id, creator_id")
            .eq("id", activityId)
            .maybeSingle();

        if (activityError || !activity) {
            return createErrorResponse("Activité introuvable", 404);
        }
        if (blockedIds.has(String(activity.creator_id || ""))) {
            return createErrorResponse("Activité introuvable", 404);
        }

        const isCreator = activity.creator_id === user.id;
        let isParticipant = false;
        if (!isCreator) {
            const { data: participation } = await supabase
                .from("participations")
                .select("id")
                .eq("activity_id", activityId)
                .eq("user_id", user.id)
                .maybeSingle();
            isParticipant = !!participation;
        }

        if (!isCreator && !isParticipant) {
            return createErrorResponse("Accès refusé", 403);
        }

        const { data: participations, error: participationsError } = await supabase
            .from("participations")
            .select("user_id")
            .eq("activity_id", activityId);

        if (participationsError) {
            return createErrorResponse("Impossible de charger les participants", 500, participationsError.message);
        }

        const uniqueIds = new Set<string>();
        if (activity.creator_id) uniqueIds.add(activity.creator_id);
        for (const row of participations || []) {
            if (row.user_id) uniqueIds.add(row.user_id);
        }
        const participantIds = Array.from(uniqueIds);
        if (participantIds.some((participantId) => blockedIds.has(String(participantId || "")))) {
            return createErrorResponse("Activité introuvable", 404);
        }

        if (participantIds.length === 0) {
            return createSuccessResponse({ participants: [] }, 200);
        }

        const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, pseudo")
            .in("id", participantIds);

        if (profilesError) {
            return createErrorResponse("Impossible de charger les profils des participants", 500, profilesError.message);
        }

        const totalByUser = await loadPulseTotalsByUserIds(participantIds, createServiceRoleClient() ?? supabase);

        const normalized = ((profiles || []) as ParticipantRow[])
            .map((profile) => {
                const totalPulse = totalByUser.get(profile.id) || 0;
                return {
                    user_id: profile.id,
                    first_name: profile.first_name || null,
                    last_name: profile.last_name || null,
                    pseudo: profile.pseudo || "utilisateur",
                    rank_label: getRankLabelFromPulse(totalPulse),
                    total_pulse: totalPulse,
                    is_creator: profile.id === activity.creator_id
                };
            })
            .sort((a, b) => {
                if (a.is_creator && !b.is_creator) return -1;
                if (!a.is_creator && b.is_creator) return 1;
                const aName = `${a.first_name || ""} ${a.last_name || ""}`.trim() || a.pseudo;
                const bName = `${b.first_name || ""} ${b.last_name || ""}`.trim() || b.pseudo;
                return aName.localeCompare(bName, "fr");
            });

        return createSuccessResponse({ participants: normalized }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
