-- Phase 12 — User identity fields (first/last name) and pseudo uniqueness

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Backfill for existing users to keep profile rendering stable
UPDATE public.profiles
SET first_name = COALESCE(NULLIF(first_name, ''), 'Utilisateur')
WHERE first_name IS NULL OR first_name = '';

UPDATE public.profiles
SET last_name = COALESCE(last_name, '')
WHERE last_name IS NULL;

-- Normalize duplicated pseudos before creating a case-insensitive unique index.
-- Any duplicate (after LOWER) keeps the first row as-is and rewrites the others.
WITH ranked AS (
  SELECT
    id,
    pseudo,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(pseudo)
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM public.profiles
),
duplicates AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.profiles p
SET pseudo =
  LEFT(
    REGEXP_REPLACE(COALESCE(NULLIF(p.pseudo, ''), 'user'), '[^a-zA-Z0-9_]', '', 'g'),
    12
  ) || '_' || RIGHT(REPLACE(p.id::text, '-', ''), 7)
WHERE p.id IN (SELECT id FROM duplicates);

-- Pseudo must be unique (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pseudo_unique_ci
ON public.profiles (LOWER(pseudo));

-- Ensure new auth users populate identity fields in profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_pseudo TEXT;
  v_gender TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  v_pseudo := NULLIF(TRIM(new.raw_user_meta_data->>'pseudo'), '');
  v_gender := NULLIF(TRIM(new.raw_user_meta_data->>'gender'), '');
  v_first_name := NULLIF(TRIM(new.raw_user_meta_data->>'first_name'), '');
  v_last_name := NULLIF(TRIM(new.raw_user_meta_data->>'last_name'), '');

  IF v_pseudo IS NULL THEN
    v_pseudo := SPLIT_PART(COALESCE(new.email, ''), '@', 1);
  END IF;

  IF v_first_name IS NULL THEN
    v_first_name := 'Utilisateur';
  END IF;

  IF v_last_name IS NULL THEN
    v_last_name := '';
  END IF;

  INSERT INTO public.profiles (id, pseudo, gender, first_name, last_name)
  VALUES (new.id, v_pseudo, v_gender, v_first_name, v_last_name);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
