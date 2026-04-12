import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getModerationServiceClient, getModeratorAccessDebug, isModeratorUser } from "@/lib/moderation";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const allowed = await isModeratorUser(supabase, user);
        if (!allowed) {
            const debug = await getModeratorAccessDebug(supabase as any, user as any);
            return createErrorResponse("Accès admin refusé", 403, debug);
        }

        const userId = req.nextUrl.searchParams.get("user_id")?.trim();
        if (!userId) return createErrorResponse("user_id requis", 400);

        const { data: logs, error } = await db
            .from("moderation_actions_log")
            .select("id,action_type,season_id,created_at,metadata")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1000);

        if (error) return createErrorResponse("Impossible de charger l'historique utilisateur", 400, error.message);

        const historyBySeason = new Map<string, { season_id: string; actions: Array<{ action_type: string; created_at: string }> }>();
        for (const row of logs || []) {
            const key = String(row.season_id || "unknown");
            if (!historyBySeason.has(key)) {
                historyBySeason.set(key, { season_id: key, actions: [] });
            }
            historyBySeason.get(key)!.actions.push({
                action_type: String(row.action_type || ""),
                created_at: String(row.created_at || ""),
            });
        }

        const history = Array.from(historyBySeason.values())
            .sort((a, b) => a.season_id < b.season_id ? 1 : -1)
            .map((season) => ({
                ...season,
                summary: {
                    warn1: season.actions.filter((a) => a.action_type === "manual_warn_1").length,
                    warn2: season.actions.filter((a) => a.action_type === "manual_warn_2").length,
                    restrict: season.actions.filter((a) => a.action_type === "manual_chat_restriction").length,
                    suspend: season.actions.filter((a) => a.action_type === "manual_suspension").length,
                },
            }));

        return createSuccessResponse({ user_id: userId, history }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}

