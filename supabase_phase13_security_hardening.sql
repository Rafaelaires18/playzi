-- Phase 13 — Security hardening for implemented features

-- 1) Profiles: authenticated users only for reads, owner-only updates,
-- and block direct client-side grade escalation.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Utilisateurs peuvent voir tous les profils" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
CREATE POLICY "Authenticated can read profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Utilisateurs peuvent modifier leur propre profil" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_fields()
RETURNS trigger AS $$
BEGIN
  -- Prevent users from self-upgrading grade directly from client-side requests.
  IF auth.role() = 'authenticated' AND OLD.grade IS DISTINCT FROM NEW.grade THEN
    RAISE EXCEPTION 'grade_cannot_be_updated_directly';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_sensitive_fields();

-- 2) Connection requests: avoid pair duplicates and requests when already connected.
CREATE UNIQUE INDEX IF NOT EXISTS connection_requests_unique_pair
ON public.connection_requests (
  LEAST(sender_id, receiver_id),
  GREATEST(sender_id, receiver_id)
);

CREATE OR REPLACE FUNCTION public.validate_connection_request_insert()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_connection_request_insert ON public.connection_requests;
CREATE TRIGGER trg_validate_connection_request_insert
BEFORE INSERT ON public.connection_requests
FOR EACH ROW
EXECUTE FUNCTION public.validate_connection_request_insert();

-- 3) Connections: enforce reciprocal uniqueness and creation only from a real request.
CREATE UNIQUE INDEX IF NOT EXISTS user_connections_unique_pair
ON public.user_connections (
  LEAST(user_a, user_b),
  GREATEST(user_a, user_b)
);

CREATE OR REPLACE FUNCTION public.validate_user_connection_insert()
RETURNS trigger AS $$
DECLARE
  a UUID;
  b UUID;
BEGIN
  -- Canonical ordering for deterministic storage.
  a := LEAST(NEW.user_a, NEW.user_b);
  b := GREATEST(NEW.user_a, NEW.user_b);
  NEW.user_a := a;
  NEW.user_b := b;

  IF NEW.user_a = NEW.user_b THEN
    RAISE EXCEPTION 'invalid_connection_pair';
  END IF;

  -- Connection can only be created when a request exists in either direction.
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_user_connection_insert ON public.user_connections;
CREATE TRIGGER trg_validate_user_connection_insert
BEFORE INSERT ON public.user_connections
FOR EACH ROW
EXECUTE FUNCTION public.validate_user_connection_insert();
