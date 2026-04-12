import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const { count, error } = await supabase
            .from("connection_requests")
            .select("id", { count: "exact", head: true })
            .eq("receiver_id", user.id);

        if (error) {
            return createErrorResponse("Impossible de charger le compteur de demandes", 400, error.message);
        }

        return createSuccessResponse({ pending_count: count || 0 }, 200);
    } catch (error) {
        return createErrorResponse(
            "Erreur interne",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}

