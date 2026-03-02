import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActivitySchema } from "@/lib/validations/activities";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();

        // Options de filtrage (ex: /api/activities?sport=Running)
        const { searchParams } = new URL(req.url);
        const sport = searchParams.get('sport');
        const status = searchParams.get('status');

        let query = supabase
            .from('activities')
            .select(`
                *,
                creator:profiles(id, pseudo, grade)
            `)
            .order('start_time', { ascending: true });

        if (sport) {
            query = query.eq('sport', sport);
        }
        if (status) {
            query = query.eq('status', status);
        } else {
            // Par défaut, on ne montre que les activités ouvertes ou complètes (pas celles annulées ou passées)
            query = query.in('status', ['ouvert', 'complet']);
        }

        // --- GENDER FILTERING LOGIC ---
        // 1. Get current Authenticated User details to enforce male restriction on "filles"
        const { data: { user } } = await supabase.auth.getUser();
        let userGender = 'male'; // Default safe assumption if missing

        if (user) {
            // Fetch the user's gender from profiles table
            const { data: profile } = await supabase
                .from('profiles')
                .select('gender')
                .eq('id', user.id)
                .single();
            if (profile?.gender) {
                userGender = profile.gender;
            }
        }

        // Restrictions strictes : Un homme ne peut JAMAIS voir les activités 'filles'
        if (userGender === 'male') {
            query = query.neq('gender_filter', 'filles');
        }

        const { data, error } = await query;

        if (error) {
            return createErrorResponse("Erreur lors de la récupération des activités", 500, error.message);
        }

        return createSuccessResponse(data, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();

        // 1. Vérifier l'authentification SSR
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return createErrorResponse("Non autorisé. Vous devez être connecté pour créer une activité.", 401);
        }

        const body = await req.json();

        // 2. Validation Zod stricte
        const validation = createActivitySchema.safeParse(body);
        if (!validation.success) {
            return createErrorResponse("Données invalides", 400, validation.error.flatten().fieldErrors);
        }

        const activityData = validation.data;

        // 3. Insertion dans la DataBase
        const { data, error } = await supabase
            .from('activities')
            .insert([
                {
                    ...activityData,
                    creator_id: user.id
                }
            ])
            .select()
            .single();

        if (error) {
            return createErrorResponse("Erreur lors de la création de l'activité", 500, error.message);
        }

        return createSuccessResponse({
            activity: data,
            message: "Activité créée avec succès"
        }, 201);

    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
