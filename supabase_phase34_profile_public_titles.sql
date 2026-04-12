-- Phase 34 — Persist public profile title selection for cross-user profile rendering

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS primary_title_id TEXT,
ADD COLUMN IF NOT EXISTS secondary_title_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS seasonal_title_id TEXT;

UPDATE public.profiles
SET secondary_title_ids = ARRAY[]::text[]
WHERE secondary_title_ids IS NULL;
