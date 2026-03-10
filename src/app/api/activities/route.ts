import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createActivitySchema } from "@/lib/validations/activities";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { sanitizeActivityLocationForViewer } from "@/lib/security/activity-location";
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
            .select(`*`)
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

        // 1. Localisation (Ville)
        if (cityFilterParam) {
            query = query.ilike('location', `%${cityFilterParam}%`);
        }

        const { data, error } = await query;

        if (error) {
            return createErrorResponse("Erreur lors de la récupération des activités", 500, error.message);
        }

        let filteredData = data || [];

        // Auto-cancel limited-group activities still pending when start_time is reached.
        const autoConfirmSports = new Set(["running", "footing", "velo", "vélo", "cycling"]);
        const normalizeSport = (sportValue: string | null | undefined) =>
            (sportValue || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

        const stalePendingActivityIds = filteredData
            .filter((a: any) => {
                const normalized = normalizeSport(a.sport);
                const isAutoConfirmed = autoConfirmSports.has(normalized);
                const hasStarted = new Date(a.start_time).getTime() <= Date.now();
                return !isAutoConfirmed && a.status === "en_attente" && hasStarted;
            })
            .map((a: any) => a.id);

        if (stalePendingActivityIds.length > 0) {
            const nowIso = new Date().toISOString();
            const { error: autoCancelError } = await supabase
                .from("activities")
                .update({ status: "annulé", updated_at: nowIso })
                .in("id", stalePendingActivityIds);

            if (autoCancelError) {
                console.warn("[ACTIVITIES] auto-cancel failed:", autoCancelError.message);
            } else {
                filteredData = filteredData.map((a: any) =>
                    stalePendingActivityIds.includes(a.id) ? { ...a, status: "annulé" } : a
                );
            }
        }

        // 2. Group type (Discover only) in JS to keep NULL values compatible
        if (filter !== 'my_activities') {
            if (userGender === 'male') {
                filteredData = filteredData.filter((a: any) => a.gender_filter !== 'filles');
            } else if (userGender === 'female' && genderFilterParam && genderFilterParam !== 'tout') {
                if (genderFilterParam === 'mixte') {
                    filteredData = filteredData.filter((a: any) => !a.gender_filter || a.gender_filter === 'mixte');
                } else {
                    filteredData = filteredData.filter((a: any) => a.gender_filter === genderFilterParam);
                }
            }
        }

        // 3. Distance (JS Post-filter MVP)
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

        // Load participations + feedback in separate queries for robustness
        const activityIds = filteredData.map((a: any) => a.id).filter(Boolean);
        const creatorIds = [...new Set(filteredData.map((a: any) => a.creator_id).filter(Boolean))];
        const participationsByActivity = new Map<string, any[]>();
        const feedbackByActivity = new Map<string, any[]>();
        const creatorById = new Map<string, { id: string; pseudo: string; grade?: string }>();

        if (creatorIds.length > 0) {
            const { data: creators, error: creatorsError } = await supabase
                .from("profiles")
                .select("id, pseudo, grade")
                .in("id", creatorIds);

            if (!creatorsError && creators) {
                for (const creator of creators as any[]) {
                    creatorById.set(creator.id, creator);
                }
            } else if (creatorsError) {
                console.warn("[ACTIVITIES] creators query failed:", creatorsError.message);
            }
        }

        if (activityIds.length > 0) {
            const { data: participationsData, error: partError } = await supabase
                .from('participations')
                .select('activity_id, status, user_id, profiles(pseudo)')
                .in('activity_id', activityIds);

            if (!partError && participationsData) {
                for (const p of participationsData as any[]) {
                    const list = participationsByActivity.get(p.activity_id) || [];
                    list.push(p);
                    participationsByActivity.set(p.activity_id, list);
                }
            } else if (partError) {
                console.warn("[ACTIVITIES] participations query failed:", partError.message);
            }

            const { data: feedbackData, error: feedbackError } = await supabase
                .from('activity_feedback')
                .select('activity_id, id, reviewer_id')
                .in('activity_id', activityIds);

            if (!feedbackError && feedbackData) {
                for (const f of feedbackData as any[]) {
                    const list = feedbackByActivity.get(f.activity_id) || [];
                    list.push(f);
                    feedbackByActivity.set(f.activity_id, list);
                }
            } else if (feedbackError) {
                console.warn("[ACTIVITIES] feedback query failed:", feedbackError.message);
            }
        }

        // Transformer les données pour inclure le nombre de 'attendees' (Créateur + participants validés)
        const formattedData = filteredData.map((a: any) => {
            const participations = participationsByActivity.get(a.id) || [];
            const activityFeedback = feedbackByActivity.get(a.id) || [];
            let feedbackStatus = undefined;
            const isConfirmedParticipant = participations.some((p: any) => p.user_id === user?.id && p.status === 'confirmé');
            const isCreator = a.creator_id === user?.id;

            const activityStartTime = new Date(a.start_time).getTime();
            const now = Date.now();
            const hoursSinceStart = (now - activityStartTime) / (1000 * 60 * 60);

            // Activity is "effectively past" if DB status is 'passé' OR the start_time has already passed
            // (real activities don't get their status auto-updated to 'passé' in the DB)
            const isEffectivelyPast = a.status === 'passé' || a.status === 'annulé' || activityStartTime < now;

            if (isEffectivelyPast && (filter === 'my_activities' || isConfirmedParticipant || isCreator)) {
                const hasProvidedFeedback = activityFeedback.some((f: any) => f.reviewer_id === user?.id);

                if (hasProvidedFeedback) {
                    feedbackStatus = 'completed';
                } else {
                    // Feedback window: 2h to 24h after start_time (matching the 2h 'En cours' frontend state)
                    if (hoursSinceStart >= 2 && hoursSinceStart <= 24) {
                        feedbackStatus = 'pending';
                    } else if (hoursSinceStart > 24) {
                        feedbackStatus = 'expired';
                    } else {
                        feedbackStatus = 'too_early'; // < 2h after start = activity still 'En cours'
                    }
                }
            }

            return {
                ...a,
                creator: creatorById.get(a.creator_id) || null,
                feedbackStatus,
                _debug: { isConfirmedParticipant, isCreator, hoursSinceStart, isEffectivelyPast, dbStatus: a.status },
                participations,
                attendees: 1 + participations.length,
                activity_feedback: undefined
            };
        });

        if (user) {
            const authorizedActivityIds = formattedData
                .filter((a: any) =>
                    a.creator_id === user.id
                    || (a.participations || []).some((p: any) => p.user_id === user.id && p.status === "confirmé")
                )
                .map((a: any) => a.id)
                .filter(Boolean);

            if (authorizedActivityIds.length > 0) {
                const { data: privateLocations } = await supabase
                    .from("activity_private_locations")
                    .select("activity_id, exact_address, exact_lat, exact_lng")
                    .in("activity_id", authorizedActivityIds);

                const privateByActivityId = new Map<string, { exact_address: string | null; exact_lat: number | null; exact_lng: number | null }>();
                for (const row of privateLocations || []) {
                    privateByActivityId.set(row.activity_id, {
                        exact_address: row.exact_address,
                        exact_lat: row.exact_lat,
                        exact_lng: row.exact_lng,
                    });
                }

                for (const activity of formattedData as any[]) {
                    const privateLocation = privateByActivityId.get(activity.id);
                    if (privateLocation) {
                        activity.exact_address = privateLocation.exact_address;
                        activity.exact_lat = privateLocation.exact_lat;
                        activity.exact_lng = privateLocation.exact_lng;
                    }
                }
            }
        }

        const sanitizedData = formattedData.map((a: any) => {
            const { _debug, ...rest } = a;
            return sanitizeActivityLocationForViewer(rest, user?.id);
        });

        return createSuccessResponse(sanitizedData, 200);
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
        const approximateCoordinate = (value?: number) =>
            typeof value === "number" && !Number.isNaN(value) ? Number(value.toFixed(2)) : null;
        const exactAddress = (activityData.address || "").trim() || null;
        const exactLat = typeof activityData.lat === "number" ? activityData.lat : null;
        const exactLng = typeof activityData.lng === "number" ? activityData.lng : null;

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
                    address: null,
                    lat: approximateCoordinate(activityData.lat),
                    lng: approximateCoordinate(activityData.lng),
                    public_location: activityData.location,
                    public_lat: approximateCoordinate(activityData.lat),
                    public_lng: approximateCoordinate(activityData.lng),
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

        if (data?.id) {
            const { error: privateLocationError } = await supabase
                .from("activity_private_locations")
                .upsert({
                    activity_id: data.id,
                    exact_address: exactAddress,
                    exact_lat: exactLat,
                    exact_lng: exactLng,
                    updated_at: new Date().toISOString(),
                }, { onConflict: "activity_id" });

            if (privateLocationError) {
                return createErrorResponse("Erreur lors de l'enregistrement de la localisation exacte", 500, privateLocationError.message);
            }
        }

        return createSuccessResponse({
            activity: data,
            message: "Activité créée avec succès"
        }, 201);

    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
