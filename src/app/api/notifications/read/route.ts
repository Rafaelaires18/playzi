import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return createErrorResponse("Non authentifié", 401);

        const body = await req.json().catch(() => ({}));
        const ids = Array.isArray(body?.ids) ? body.ids.map((v: unknown) => String(v || "")).filter(Boolean) : [];
        const markAll = body?.all === true;
        const nowIso = new Date().toISOString();

        if (!markAll && ids.length === 0) {
            return createErrorResponse("Aucune notification à marquer comme lue", 400);
        }

        let query = supabase
            .from("user_notifications")
            .update({ read_at: nowIso })
            .eq("user_id", user.id)
            .is("read_at", null);

        if (!markAll) query = query.in("id", ids);

        const { error } = await query;
        if (error) return createErrorResponse("Impossible de marquer les notifications comme lues", 400, error.message);
        return createSuccessResponse({ ok: true }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

