import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { joinActivitySchema } from "@/lib/validations/participations";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return createErrorResponse("Non autorisé. Connectez-vous pour rejoindre.", 401);
        }

        const body = await req.json();

        // Validation stricte du payload
        const validation = joinActivitySchema.safeParse(body);
        if (!validation.success) {
            return createErrorResponse("Données invalides", 400, validation.error.flatten().fieldErrors);
        }

        const { activity_id } = validation.data;

        // 1. Vérifier si l'activité existe et n'est pas complète
        const { data: activity, error: activityError } = await supabase
            .from('activities')
            .select('creator_id, max_attendees, status, participations (id, user_id)')
            .eq('id', activity_id)
            .single();

        if (activityError || !activity) {
            return createErrorResponse("Activité introuvable", 404);
        }
        if (!['ouvert', 'confirm\u00e9', 'en_attente'].includes(activity.status)) {
            return createErrorResponse("Cette activit\u00e9 n'est plus ouverte aux inscriptions", 400);
        }

        if (activity.creator_id === user.id) {
            return createErrorResponse("Vous êtes déjà organisateur de cette activité.", 400);
        }

        const currentParticipantsCount = activity.participations
            ? activity.participations.filter((p: any) => p.user_id && p.user_id !== activity.creator_id).length
            : 0;
        if (currentParticipantsCount >= activity.max_attendees) {
            return createErrorResponse("Désolé, cette activité est complète", 400);
        }

        // 2. Tenter de rejoindre
        const { error } = await supabase
            .from('participations')
            .insert([{
                activity_id,
                user_id: user.id,
                status: 'confirmé'
            }]);

        if (error) {
            if (error.code === '23505') { // Code Unique Violation dans PostgreSQL (User a déjà rejoint)
                return createErrorResponse("Vous participez déjà à cette activité", 400);
            }
            if (error.code === '23514' || error.message?.toLowerCase().includes('creator cannot join own activity')) {
                return createErrorResponse("Vous êtes déjà organisateur de cette activité.", 400);
            }
            return createErrorResponse("Erreur lors de l'inscription", 500, error.message);
        }

        return createSuccessResponse({ message: "Vous avez rejoint l'activité avec succès ! 🎉" }, 201);

    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
