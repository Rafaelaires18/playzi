-- Ce script va insérer 3 belles activités de test dans ta base de données.
-- Il va automatiquement s'attribuer au premier utilisateur inscrit dans ta base.
-- IMPORTANT : Assure-toi d'avoir au moins 1 utilisateur dans la section "Authentication" de Supabase.

DO $$
DECLARE
    first_user_id UUID;
BEGIN
    SELECT id INTO first_user_id FROM public.profiles LIMIT 1;

    IF first_user_id IS NULL THEN
        RAISE EXCEPTION 'Aucun utilisateur trouvé. Inscris-toi d''abord sur l''app avant de lancer ce script.';
    END IF;

    -- 1. Football 5v5 (Match, Avancé)
    INSERT INTO public.activities (
        title, sport, location, address, level, max_attendees, gender_filter, status, start_time, creator_id,
        tags, description, lat, lng
    ) VALUES (
        'Match de Foot 5v5 Intensif', 'Football', 'Renens', 'Stade du Censuy', 'Avancé', 10, 'mixte', 'ouvert', 
        (NOW() + INTERVAL '1 day')::timestamptz, first_user_id,
        ARRAY['5v5', 'Match', 'Compétitif'], 'Recherche de très bons joueurs pour un match engagé sur synthétique.', 46.5361, 6.5898
    );

    -- 2. Running (10 km, Allure 5:30/km)
    INSERT INTO public.activities (
        title, sport, location, address, level, max_attendees, gender_filter, status, start_time, creator_id,
        distance, pace, tags, description, lat, lng
    ) VALUES (
        'Footing matinal au bord du Lac', 'Running', 'Lausanne', 'Ouchy, au bord du lac', 'Intermédiaire', 15, 'mixte', 'ouvert', 
        (NOW() + INTERVAL '2 days')::timestamptz, first_user_id,
        10.5, 330, ARRAY['Endurance', 'Bord de lac'], 'Sortie tranquille de 10km le long des quais, allure 5:30/km environ.', 46.5074, 6.6276
    );

    -- 3. Beach Volley (Filles, 2v2)
    INSERT INTO public.activities (
        title, sport, location, address, level, max_attendees, gender_filter, status, start_time, creator_id,
        tags, description, lat, lng
    ) VALUES (
        'Beach Volley détente (Filles)', 'Beach Volley', 'Genève', 'Plage des Eaux-Vives', 'Débutant', 4, 'filles', 'ouvert', 
        (NOW() + INTERVAL '3 days')::timestamptz, first_user_id,
        ARRAY['2v2', 'Entraînement', 'Détente'], 'On cherche deux filles pour s''entraîner tranquillement. Ambiance chill !', 46.2085, 6.1600
    );

    -- 4. Vélo (45 km)
    INSERT INTO public.activities (
        title, sport, location, address, level, max_attendees, gender_filter, status, start_time, creator_id,
        distance, tags, description, lat, lng
    ) VALUES (
        'Sortie Vélo dans le Lavaux', 'Vélo', 'Lutry', 'Gare de Lutry', 'Intermédiaire', 8, 'mixte', 'ouvert', 
        (NOW() + INTERVAL '4 days')::timestamptz, first_user_id,
        45.0, ARRAY['Route', 'Sortie Chill', 'Paysages'], 'Petite boucle vallonnée dans la région du Lavaux avec arrêt café prévu.', 46.5020, 6.6844
    );

END $$;
