-- Phase 47 — Harden SECURITY DEFINER function exposure

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
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

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND LOWER(COALESCE(p.grade, '')) IN ('admin','moderator','moderation','mod')
  );
$$;

CREATE OR REPLACE FUNCTION public.record_pulse_transaction(
    p_user_id UUID,
    p_activity_id UUID,
    p_source_type TEXT,
    p_direction TEXT,
    p_points INTEGER,
    p_signed_points INTEGER,
    p_reason_code TEXT,
    p_reason_label TEXT,
    p_metadata JSONB,
    p_unique_event_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF p_points <= 0 THEN
        RAISE EXCEPTION 'p_points must be > 0';
    END IF;

    INSERT INTO public.pulse_transactions (
        user_id,
        activity_id,
        source_type,
        direction,
        points,
        signed_points,
        reason_code,
        reason_label,
        metadata,
        unique_event_key
    )
    VALUES (
        p_user_id,
        p_activity_id,
        p_source_type,
        p_direction,
        p_points,
        p_signed_points,
        p_reason_code,
        p_reason_label,
        COALESCE(p_metadata, '{}'::jsonb),
        p_unique_event_key
    )
    ON CONFLICT (unique_event_key)
    DO UPDATE SET unique_event_key = EXCLUDED.unique_event_key
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_sensitive_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_moderator() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_pulse_transaction(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_connection_request_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_user_connection_insert() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_pulse_transaction(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, JSONB, TEXT) TO service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rls_auto_enable'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;

COMMIT;
