import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function POST() {
    try {
        const supabase = await createClient();

        // Supprime le cookie de session Next.js
        await supabase.auth.signOut({ scope: "global" }).catch(() => null);

        return createSuccessResponse(
            { message: "Déconnexion réussie" },
            200
        );

    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors de la déconnexion.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
