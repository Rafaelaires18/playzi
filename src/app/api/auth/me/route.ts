import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { CURRENT_LEGAL_VERSION } from "@/lib/legal-consents";

export async function GET() {
    try {
        const supabase = await createClient();

        // Récupérer l'utilisateur actuel via le cookie HTTPOnly de Supabase
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        // On récupère le profil pour avoir le gender
        const { data: profile } = await supabase
            .from('profiles')
            .select('gender, pseudo, avatar_url, first_name, last_name, birth_date, age_verification_status, age_verified_at, accepted_terms, accepted_terms_at, marketing_opt_in, accepted_legal_version')
            .eq('id', user.id)
            .single();

        return createSuccessResponse(
            {
                user: {
                    id: user.id,
                    email: user.email,
                    first_name: profile?.first_name || user.user_metadata?.first_name || null,
                    last_name: profile?.last_name || user.user_metadata?.last_name || null,
                    pseudo: profile?.pseudo || user.user_metadata?.pseudo,
                    gender: profile?.gender || 'male', // Default
                    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
                    birth_date: profile?.birth_date || null,
                    age_verification_status: profile?.age_verification_status || "pending",
                    age_verified_at: profile?.age_verified_at || null,
                    accepted_terms: profile?.accepted_terms === true,
                    accepted_terms_at: profile?.accepted_terms_at || null,
                    marketing_opt_in: profile?.marketing_opt_in === true,
                    accepted_legal_version: Number(profile?.accepted_legal_version || 0),
                    current_legal_version: CURRENT_LEGAL_VERSION,
                }
            },
            200
        );

    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors de la vérification de session.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
