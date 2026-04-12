import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    try {
        const { token } = await params;
        const trimmedToken = String(token || "").trim();
        if (!trimmedToken) {
            return createErrorResponse("Lien d'invitation invalide", 400);
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const { data: link, error: linkError } = await supabase
            .from("activity_invite_links")
            .select("activity_id")
            .eq("token", trimmedToken)
            .maybeSingle();

        if (linkError) {
            return createErrorResponse("Impossible de résoudre ce lien", 400, linkError.message);
        }
        if (!link?.activity_id) {
            return createErrorResponse("Lien d'invitation introuvable", 404);
        }

        return createSuccessResponse({ activity_id: link.activity_id }, 200);
    } catch (e) {
        return createErrorResponse(
            "Erreur interne",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
