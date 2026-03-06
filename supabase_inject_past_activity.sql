-- ===========================================================
-- PLAYZI - FEEDBACK RESET + CLEAN RE-INJECTION
-- Run this ENTIRE script in Supabase SQL Editor
-- This clears old test data and creates a fresh test scenario
-- ===========================================================

-- Step 1: Delete ALL existing feedback for the test activities
-- (prevents unique constraint violations from previous debug sessions)
DELETE FROM public.activity_feedback
WHERE activity_id IN (
  SELECT id FROM public.activities WHERE title = 'Match Amical Dimanche'
);

-- Step 2: Delete old test activities and their participations to start fresh
DELETE FROM public.participations
WHERE activity_id IN (
  SELECT id FROM public.activities WHERE title = 'Match Amical Dimanche'
);

DELETE FROM public.activities WHERE title = 'Match Amical Dimanche';

-- Step 3: Re-inject a clean past activity
-- creator_id = the most recently created user (= YOU if you just registered)
WITH new_activity AS (
  INSERT INTO public.activities (
    title, sport, level, location, address, start_time, max_attendees,
    status, creator_id, gender_filter, variant, distance, session_type
  )
  VALUES (
    'Match Amical Dimanche',
    'Beach Volley',
    'Intermédiaire',
    'Lausanne',
    'Plage de Vidy, Lausanne',
    NOW() - INTERVAL '3 hours',  -- 3h ago: within the 1.5h-24h feedback window
    4,
    'passé',
    (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1),  -- Most recent user = YOU
    'mixte',
    '2v2',
    0,
    'match'
  )
  RETURNING id, creator_id
)
-- Step 4: Add YOU as a confirmed participant too (belt AND suspenders)
INSERT INTO public.participations (activity_id, user_id, status)
SELECT id, creator_id, 'confirmé'
FROM new_activity;

-- Done! A fresh test activity has been created linked to your account.
-- You can now test the feedback from the Playzi app on your phone.
