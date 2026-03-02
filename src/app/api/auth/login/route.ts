import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // 1. Validation Zod du payload
        const validation = loginSchema.safeParse(body);
        if (!validation.success) {
            return createErrorResponse(
                "Données invalides",
                400,
                validation.error.flatten().fieldErrors
            );
        }

        const { email, password } = validation.data;

        // 2. Connexion à Supabase Auth
        const supabase = await createClient();

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return createErrorResponse(
                "Email ou mot de passe incorrect.",
                401
            );
        }

        if (!data.user) {
            return createErrorResponse("Erreur inattendue lors de la connexion", 500);
        }

        // 3. Réponse Standardisée
        return createSuccessResponse(
            {
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    pseudo: data.user.user_metadata?.pseudo,
                },
                session: data.session,
                message: "Connexion réussie",
            },
            200
        );

    } catch (e) {
        return createErrorResponse(
            "Erreur interne du serveur lors de la connexion.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
