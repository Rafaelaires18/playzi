import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerSchema } from "@/lib/validations/auth";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // 1. Validation Zod du payload
        const validation = registerSchema.safeParse(body);
        if (!validation.success) {
            return createErrorResponse(
                "Données invalides",
                400,
                validation.error.flatten().fieldErrors
            );
        }

        const { email, password, pseudo, gender } = validation.data;

        // 2. Connexion à Supabase Auth
        const supabase = await createClient();

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    pseudo,
                    gender,
                },
            },
        });

        if (error) {
            // Identifier le type d'erreur Supabase (ex: email déjà pris)
            if (error.message.includes("already registered")) {
                return createErrorResponse("Cette adresse email est déjà utilisée.", 409);
            }
            return createErrorResponse(error.message, 400);
        }

        if (!data.user) {
            return createErrorResponse("Erreur lors de la création de l'utilisateur", 500);
        }

        // 3. Réponse Standardisée
        return createSuccessResponse(
            {
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    pseudo: data.user.user_metadata.pseudo,
                },
                message: "Inscription réussie",
            },
            201
        );

    } catch (e) {
        return createErrorResponse(
            "Erreur interne du serveur lors de l'inscription.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
