import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getModeratorAccessDebug } from "@/lib/moderation";

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const debug = await getModeratorAccessDebug(supabase as any, user as any);
        return createSuccessResponse({ moderator_access: debug }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}
