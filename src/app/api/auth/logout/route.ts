import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        // Supprime le cookie de session Next.js
        const { error } = await supabase.auth.signOut();

        if (error) {
            return createErrorResponse("Erreur lors de la déconnexion", 500);
        }

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
