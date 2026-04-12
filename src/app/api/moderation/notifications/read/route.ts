import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const body = await req.json().catch(() => null);
        const ids = Array.isArray(body?.ids) ? body.ids.filter((v: unknown) => typeof v === "string") : [];

        if (ids.length === 0) {
            const { error } = await supabase
                .from("moderation_notifications")
                .update({ read_at: new Date().toISOString() })
                .eq("user_id", user.id)
                .is("read_at", null);
            if (error) return createErrorResponse("Impossible de marquer les notifications comme lues", 400, error.message);
            return createSuccessResponse({ updated: "all" }, 200);
        }

        const { error } = await supabase
            .from("moderation_notifications")
            .update({ read_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .in("id", ids);

        if (error) {
            return createErrorResponse("Impossible de marquer les notifications comme lues", 400, error.message);
        }

        return createSuccessResponse({ updated: ids.length }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}
