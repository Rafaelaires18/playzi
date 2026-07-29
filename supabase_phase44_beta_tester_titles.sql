-- Phase 44 — Persist beta tester title for the earliest users

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS beta_tester_title BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS beta_tester_title_granted_at TIMESTAMPTZ NULL;

WITH earliest_profiles AS (
    SELECT id, created_at
    FROM public.profiles
    ORDER BY created_at ASC, id ASC
    LIMIT 30
)
UPDATE public.profiles AS p
SET
    beta_tester_title = TRUE,
    beta_tester_title_granted_at = COALESCE(p.beta_tester_title_granted_at, NOW())
FROM earliest_profiles ep
WHERE p.id = ep.id;
