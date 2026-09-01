import { createClient } from "@/lib/supabase/server";
import { getActivityCreationEligibility } from "@/lib/activity-creation-limit";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const eligibility = await getActivityCreationEligibility(supabase as never, user.id);
        return createSuccessResponse(eligibility, 200);
    } catch (error) {
        return createErrorResponse(
            "Impossible de vérifier la limite de création.",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}
