import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getCurrentSeasonId, getModerationServiceClient, getModeratorAccessDebug, isModeratorUser } from "@/lib/moderation";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const { data: { user }, error: authErr } = await supabase.auth.getUser();

        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const allowed = await isModeratorUser(supabase, user);
        if (!allowed) {
            const debug = await getModeratorAccessDebug(supabase as any, user as any);
            return createErrorResponse("Accès admin refusé", 403, {
                ...debug,
                help: "Mettre profiles.grade à admin/moderator/moderation/mod, ou configurer MODERATION_ADMIN_EMAILS / MODERATION_ADMIN_USER_IDS.",
            });
        }

        const body = await req.json().catch(() => null);
        const seasonId = typeof body?.season_id === "string" && body.season_id.trim() ? body.season_id.trim() : getCurrentSeasonId();

        const { error: resetError } = await db
            .from("moderation_user_status")
            .update({
                incident_count: 0,
                moderation_level: "none",
                warning_sent_at: null,
                chat_restricted_until: null,
                suspended_until: null,
                updated_at: new Date().toISOString(),
            })
            .eq("season_id", seasonId);

        if (resetError) {
            return createErrorResponse("Impossible de réinitialiser les statuts de modération", 400, resetError.message);
        }

        await db.from("moderation_actions_log").insert({
            user_id: user.id,
            action_type: "season_reset",
            reason: "Season moderation reset",
            season_id: seasonId,
            metadata: { triggered_by: user.id },
        });

        return createSuccessResponse({ season_id: seasonId, reset: true }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}
