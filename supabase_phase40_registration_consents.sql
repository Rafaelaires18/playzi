-- Phase 40 — Registration consents (terms + marketing opt-in)

BEGIN;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_accepted_terms_consistency_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_accepted_terms_consistency_check
CHECK (
  (accepted_terms = FALSE)
  OR (accepted_terms = TRUE AND accepted_terms_at IS NOT NULL)
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_base_pseudo TEXT;
  v_pseudo TEXT;
  v_gender TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_accepted_terms BOOLEAN;
  v_accepted_terms_at TIMESTAMPTZ;
  v_marketing_opt_in BOOLEAN;
  v_counter INTEGER := 0;
BEGIN
  v_base_pseudo := COALESCE(
    NULLIF(TRIM(new.raw_user_meta_data->>'pseudo'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'name'), ''),
    SPLIT_PART(COALESCE(new.email, ''), '@', 1),
    'joueur'
  );
  v_base_pseudo := regexp_replace(lower(v_base_pseudo), '[^a-z0-9_]', '', 'g');
  IF v_base_pseudo = '' THEN
    v_base_pseudo := 'joueur';
  END IF;

  v_pseudo := v_base_pseudo;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(pseudo) = LOWER(v_pseudo)) LOOP
    v_counter := v_counter + 1;
    v_pseudo := v_base_pseudo || v_counter::TEXT;
  END LOOP;

  v_gender := NULLIF(TRIM(new.raw_user_meta_data->>'gender'), '');
  v_first_name := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'first_name'), ''), 'Utilisateur');
  v_last_name := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'last_name'), ''), '');

  v_accepted_terms := COALESCE(
    LOWER(COALESCE(TRIM(new.raw_user_meta_data->>'accepted_terms'), '')) IN ('true', 't', '1', 'yes', 'y'),
    FALSE
  );
  v_marketing_opt_in := COALESCE(
    LOWER(COALESCE(TRIM(new.raw_user_meta_data->>'marketing_opt_in'), '')) IN ('true', 't', '1', 'yes', 'y'),
    FALSE
  );

  IF v_accepted_terms THEN
    BEGIN
      v_accepted_terms_at := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'accepted_terms_at'), '')::TIMESTAMPTZ, NOW());
    EXCEPTION WHEN OTHERS THEN
      v_accepted_terms_at := NOW();
    END;
  ELSE
    v_accepted_terms_at := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    pseudo,
    gender,
    first_name,
    last_name,
    accepted_terms,
    accepted_terms_at,
    marketing_opt_in
  )
  VALUES (
    new.id,
    v_pseudo,
    v_gender,
    v_first_name,
    v_last_name,
    v_accepted_terms,
    v_accepted_terms_at,
    v_marketing_opt_in
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
