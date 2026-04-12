import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getCurrentSeasonId, getModerationServiceClient, getUserModerationAccessStatus } from "@/lib/moderation";

export async function GET() {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const seasonId = getCurrentSeasonId();
        const status = await getUserModerationAccessStatus(db as any, user.id, seasonId);

        return createSuccessResponse({ season_id: seasonId, status }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}
