import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const { data, error } = await supabase
            .from("pulse_summaries")
            .select(`
                activity_id,user_id,total_points,breakdown,created_at,
                activities ( sport, start_time )
            `)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            return createErrorResponse("Impossible de charger le dernier résumé Pulse", 400, error.message);
        }

        const summary = data ? {
            ...data,
            activity_context: data.activities ? {
                sport: (data.activities as any)?.sport || "Activité",
                start_time: (data.activities as any)?.start_time || new Date().toISOString()
            } : null
        } : null;

        return createSuccessResponse({ summary }, 200);
    } catch (error) {
        return createErrorResponse(
            "Erreur interne",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}

