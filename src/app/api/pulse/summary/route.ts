import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const activityId = req.nextUrl.searchParams.get("activity_id");
        if (!activityId) {
            return createErrorResponse("activity_id requis", 400);
        }

        const { data, error } = await supabase
            .from("pulse_summaries")
            .select("activity_id,user_id,total_points,breakdown,created_at")
            .eq("activity_id", activityId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (error) {
            return createErrorResponse("Impossible de charger le résumé Pulse", 400, error.message);
        }

        return createSuccessResponse(
            {
                summary: data || null,
            },
            200
        );
    } catch (error) {
        return createErrorResponse(
            "Erreur interne",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}

