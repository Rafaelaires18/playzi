import { createClient } from "@/lib/supabase/server";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

        const entitlements = await getUserEntitlements(user.id);
        return createSuccessResponse(entitlements, 200);
    } catch (error) {
        return createErrorResponse(
            "Impossible de charger les droits Playzi+.",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}
