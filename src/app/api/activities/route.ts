import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActivitySchema } from "@/lib/validations/activities";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import fs from "fs";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();

        // Options de filtrage (ex: /api/activities?sport=Running)
        const { searchParams } = new URL(req.url);
        const sport = searchParams.get('sport');
        const status = searchParams.get('status');
        const filter = searchParams.get('filter');

        // Nouveaux filtres Discover
        const genderFilterParam = searchParams.get('genderFilter');
        const cityFilterParam = searchParams.get('city');
        const maxDistanceParam = searchParams.get('maxDistance');

        let query = supabase
            .from('activities')
            .select(`
                *,
                creator:profiles(id, pseudo, grade),
                participations(status, user_id, profiles(pseudo)),
                activity_feedback(id, reviewer_id)
            `)
            .order('start_time', { ascending: true });

        // --- GENDER & USER FILTERING PREP ---
        const { data: { user } } = await supabase.auth.getUser();
        let userGender = 'male'; // Default safe assumption if missing

        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('gender')
                .eq('id', user.id)
                .single();
            if (profile?.gender) {
                userGender = profile.gender;
            }
        }

        // Apply route specific filters
        if (filter === 'my_activities') {
            if (!user) {
                return createErrorResponse("Vous devez être connecté pour voir vos activités", 401);
            }

            // Fetch IDs of activities where user is a participant
            const { data: userParticipations } = await supabase
                .from('participations')
                .select('activity_id')
                .eq('user_id', user.id);

            const joinedActivityIds = userParticipations?.map(p => p.activity_id) || [];

            // Fetch IDs of activities created by the user
            const { data: createdActivities } = await supabase
                .from('activities')
                .select('id')
                .eq('creator_id', user.id);

            const createdActivityIds = createdActivities?.map(a => a.id) || [];

            const allMyActivityIds = [...new Set([...joinedActivityIds, ...createdActivityIds])];

            if (allMyActivityIds.length === 0) {
                return createSuccessResponse([], 200); // Early return empty array if no activities
            }

            query = query.in('id', allMyActivityIds);

        } else {
            // Default feed behavior
            if (sport) {
                query = query.eq('sport', sport);
            }
            if (status) {
                query = query.eq('status', status);
            } else {
                query = query.in('status', ['ouvert', 'complet', 'confirmé', 'en_attente']);
            }
        }

        // --- FILTRES DISCOVER ---
        // 1. Group Type
        if (userGender === 'male') {
            // Un homme ne peut JAMAIS voir les activités 'filles'
            query = query.neq('gender_filter', 'filles');
        } else if (userGender === 'female' && genderFilterParam && genderFilterParam !== 'tout') {
            query = query.eq('gender_filter', genderFilterParam);
        }

        // 2. Localisation (Ville)
        if (cityFilterParam) {
            query = query.ilike('location', `%${cityFilterParam}%`);
        }

        const { data, error } = await query;

        if (error) {
            return createErrorResponse("Erreur lors de la récupération des activités", 500, error.message);
        }

        // 3. Distance (JS Post-filter MVP)
        let filteredData = data || [];
        if (maxDistanceParam && cityFilterParam) {
            const maxDist = parseInt(maxDistanceParam, 10);

            // Coordonnées de base pour le calcul de distance
            const cityCoords: Record<string, { lat: number, lng: number }> = {
                "Lausanne": { lat: 46.5197, lng: 6.6323 },
                "Genève": { lat: 46.2044, lng: 6.1432 },
                "Neuchâtel": { lat: 46.9900, lng: 6.9293 }
            };

            const origin = cityCoords[cityFilterParam];

            if (origin && maxDist < 100) {
                filteredData = filteredData.filter((a: any) => {
                    if (!a.lat || !a.lng) return true; // Si pas de coords exactes, on garde par défaut

                    // Formule de Haversine
                    const R = 6371; // Rayon de la terre en km
                    const dLat = (a.lat - origin.lat) * Math.PI / 180;
                    const dLng = (a.lng - origin.lng) * Math.PI / 180;
                    const authMath =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(origin.lat * Math.PI / 180) * Math.cos(a.lat * Math.PI / 180) *
                        Math.sin(dLng / 2) * Math.sin(dLng / 2);
                    const c = 2 * Math.atan2(Math.sqrt(authMath), Math.sqrt(1 - authMath));
                    const distance = R * c;

                    return distance <= maxDist;
                });
            }
        }

        // Transformer les données pour inclure le nombre de 'attendees' (Créateur + participants validés)
        const formattedData = filteredData.map((a: any) => {
            let feedbackStatus = undefined;
            const isConfirmedParticipant = a.participations?.some((p: any) => p.user_id === user?.id && p.status === 'confirmé');
            const isCreator = a.creator_id === user?.id;

            // In 'my_activities' view, if it's past, we know they are involved.
            // L'utilisateur peut laisser un feedback s'il est participant confirmé OU créateur,
            // ou si on est en mode "my_activities" (qui implique déjà qu'on est concerné).
            if (a.status === 'passé' && (filter === 'my_activities' || isConfirmedParticipant || isCreator)) {
                const hasProvidedFeedback = a.activity_feedback && a.activity_feedback.some((f: any) => f.reviewer_id === user?.id);

                if (hasProvidedFeedback) {
                    feedbackStatus = 'completed';
                } else {
                    // Logic for the Feedback Window
                    // Activity started less than 24 hours ago, and at least 1h30m ago (estimated duration)
                    const activityStartTime = new Date(a.start_time).getTime();
                    const now = Date.now();
                    const hoursSinceStart = (now - activityStartTime) / (1000 * 60 * 60);

                    if (hoursSinceStart >= 1.5 && hoursSinceStart <= 24) {
                        feedbackStatus = 'pending';
                    } else if (hoursSinceStart > 24) {
                        feedbackStatus = 'expired'; // Trop tard pour laisser un avis
                    } else {
                        // Moins de 1h30 depuis le début = activité potentiellement encore en cours
                        feedbackStatus = 'too_early';
                    }
                }
            }

            return {
                ...a,
                feedbackStatus,
                _debug: { isConfirmedParticipant, isCreator, hoursSinceStart: a.status === 'passé' ? (Date.now() - new Date(a.start_time).getTime()) / (1000 * 60 * 60) : null },
                attendees: 1 + (a.participations?.length || 0),
                activity_feedback: undefined // Ne pas envoyer le tableau au front pour alléger
            };
        });

        console.log("FORMATTED_DATA_MY_ACTIVITIES", formattedData.filter((a: any) => a.status === 'passé').map((a: any) => ({ sport: a.sport, status: a.status, feedbackStatus: a.feedbackStatus })));

        // Debug write to file
        try {
            fs.writeFileSync('/tmp/playzi_debug_activities.json', JSON.stringify({ userId: user?.id, formattedData: formattedData.filter((a: any) => a.status === 'passé').map((a: any) => ({ id: a.id, title: a.title, feedbackStatus: a.feedbackStatus, _debug: a._debug, participations_user_ids: a.participations?.map((p: any) => p.user_id), creator_id: a.creator_id })) }, null, 2));
        } catch (e) {
            console.error("Could not write debug file", e);
        }

        return createSuccessResponse(formattedData.map((a: any) => { const { _debug, ...rest } = a; return rest; }), 200);
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

        // Auto-assign status based on sport
        const isAutoConfirmed = ['running', 'vélo', 'velo', 'cycling'].includes(activityData.sport.toLowerCase());
        const initialStatus = isAutoConfirmed ? 'confirmé' : 'en_attente';

        // Fetch user profile to enforce business rules
        const { data: profile } = await supabase
            .from('profiles')
            .select('gender')
            .eq('id', user.id)
            .single();

        let finalGenderFilter = activityData.gender_filter;
        if (profile?.gender === 'male' || profile?.gender === 'homme') {
            finalGenderFilter = 'mixte';
        }

        // 3. Insertion dans la DataBase
        const { data, error } = await supabase
            .from('activities')
            .insert([
                {
                    ...activityData,
                    status: initialStatus,
                    gender_filter: finalGenderFilter,
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
