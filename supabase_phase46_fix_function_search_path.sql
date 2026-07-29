-- Phase 46 — Fix mutable search_path on database functions

BEGIN;

CREATE OR REPLACE FUNCTION public.set_moderation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND OLD.grade IS DISTINCT FROM NEW.grade THEN
    RAISE EXCEPTION 'grade_cannot_be_updated_directly';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_connection_request_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.sender_id = NEW.receiver_id THEN
    RAISE EXCEPTION 'cannot_request_self';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_connections c
    WHERE LEAST(c.user_a, c.user_b) = LEAST(NEW.sender_id, NEW.receiver_id)
      AND GREATEST(c.user_a, c.user_b) = GREATEST(NEW.sender_id, NEW.receiver_id)
  ) THEN
    RAISE EXCEPTION 'already_connected';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_user_connection_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a UUID;
  b UUID;
BEGIN
  a := LEAST(NEW.user_a, NEW.user_b);
  b := GREATEST(NEW.user_a, NEW.user_b);
  NEW.user_a := a;
  NEW.user_b := b;

  IF NEW.user_a = NEW.user_b THEN
    RAISE EXCEPTION 'invalid_connection_pair';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.connection_requests r
    WHERE LEAST(r.sender_id, r.receiver_id) = NEW.user_a
      AND GREATEST(r.sender_id, r.receiver_id) = NEW.user_b
  ) THEN
    RAISE EXCEPTION 'missing_connection_request';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_over_capacity_participation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_max_attendees INTEGER;
    v_creator_id UUID;
    v_confirmed_count INTEGER;
BEGIN
    IF NEW.status IS DISTINCT FROM 'confirmé' THEN
        RETURN NEW;
    END IF;

    SELECT a.max_attendees, a.creator_id
    INTO v_max_attendees, v_creator_id
    FROM public.activities a
    WHERE a.id = NEW.activity_id;

    IF v_max_attendees IS NULL OR v_max_attendees <= 0 THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*)
    INTO v_confirmed_count
    FROM public.participations p
    WHERE p.activity_id = NEW.activity_id
      AND p.status = 'confirmé'
      AND (TG_OP = 'INSERT' OR p.id <> NEW.id);

    IF (v_confirmed_count + 1) >= v_max_attendees THEN
        RAISE EXCEPTION 'activity is already full'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base_pseudo TEXT;
  v_pseudo TEXT;
  v_gender TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_accepted_terms BOOLEAN;
  v_accepted_terms_at TIMESTAMPTZ;
  v_marketing_opt_in BOOLEAN;
  v_accepted_legal_version INTEGER;
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

  BEGIN
    v_accepted_legal_version := COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'accepted_legal_version'), '')::INTEGER, 0);
  EXCEPTION WHEN OTHERS THEN
    v_accepted_legal_version := 0;
  END;

  IF v_accepted_terms AND v_accepted_legal_version < 1 THEN
    v_accepted_legal_version := 1;
  END IF;

  INSERT INTO public.profiles (
    id,
    pseudo,
    gender,
    first_name,
    last_name,
    accepted_terms,
    accepted_terms_at,
    marketing_opt_in,
    accepted_legal_version
  )
  VALUES (
    new.id,
    v_pseudo,
    v_gender,
    v_first_name,
    v_last_name,
    v_accepted_terms,
    v_accepted_terms_at,
    v_marketing_opt_in,
    GREATEST(v_accepted_legal_version, 0)
  );

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_creator_self_participation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_creator_id UUID;
BEGIN
    SELECT creator_id INTO v_creator_id
    FROM public.activities
    WHERE id = NEW.activity_id;

    IF v_creator_id IS NOT NULL AND NEW.user_id = v_creator_id THEN
        RAISE EXCEPTION 'creator cannot join own activity'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;
