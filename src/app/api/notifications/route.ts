import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return createErrorResponse("Non authentifié", 401);

        const limitParam = Number(req.nextUrl.searchParams.get("limit") || 30);
        const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;

        const { data, error } = await supabase
            .from("user_notifications")
            .select("id,user_id,type,title,message,activity_id,read_at,created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) return createErrorResponse("Impossible de charger les notifications", 400, error.message);
        return createSuccessResponse({ notifications: data || [] }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

