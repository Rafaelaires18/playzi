import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { createModerationNotificationMessage, getCurrentSeasonId, getModerationServiceClient, getModeratorAccessDebug, isModeratorUser, notifyModerationStageByEmail } from "@/lib/moderation";

const schema = z.object({
    user_id: z.string().uuid(),
    kind: z.enum(["restrict_chat", "suspend"]),
    season_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const allowed = await isModeratorUser(supabase, user);
        if (!allowed) {
            const debug = await getModeratorAccessDebug(supabase, user);
            return createErrorResponse("Accès admin refusé", 403, debug);
        }

        const body = await req.json().catch(() => null);
        const parsed = schema.safeParse(body);
        if (!parsed.success) return createErrorResponse("Données invalides", 400, parsed.error.flatten().fieldErrors);

        const seasonId = parsed.data.season_id?.trim() || getCurrentSeasonId();
        const userId = parsed.data.user_id;
        const kind = parsed.data.kind;

        const patch = kind === "restrict_chat"
            ? { chat_restricted_until: null, moderation_level: "none" }
            : { suspended_until: null, chat_restricted_until: null, moderation_level: "none" };

        const { error: updateError } = await db
            .from("moderation_user_status")
            .update({
                ...patch,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("season_id", seasonId);

        if (updateError) return createErrorResponse("Impossible de lever la sanction", 400, updateError.message);

        await db.from("moderation_actions_log").insert({
            user_id: userId,
            action_type: kind === "restrict_chat" ? "manual_lift_chat_restriction" : "manual_lift_suspension",
            reason: "Sanction lifted by moderator",
            season_id: seasonId,
            metadata: { moderator_id: user.id, kind },
        });

        await createModerationNotificationMessage(db as never, userId, {
            title: "Sanction levée",
            body: "Une sanction active a été levée. Votre accès normal est rétabli.",
            level: "info",
            metadata: { season_id: seasonId, kind, moderator_id: user.id },
            eventKey: `lift:${seasonId}:${userId}:${kind}`,
        });

        const email = await notifyModerationStageByEmail(db as never, userId, "sanction_lifted");

        return createSuccessResponse({ lifted: true, user_id: userId, kind, season_id: seasonId, email }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}
