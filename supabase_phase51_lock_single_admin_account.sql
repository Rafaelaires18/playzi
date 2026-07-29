-- Phase 51 — Lock moderation/admin access to the current admin account only

CREATE TABLE IF NOT EXISTS public.admin_account_lock (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT NOT NULL DEFAULT 'single_admin_account'
);

WITH current_admin AS (
    SELECT id
    FROM public.profiles
    WHERE LOWER(COALESCE(grade, '')) IN ('admin', 'moderator', 'moderation', 'mod')
    ORDER BY created_at ASC, id ASC
    LIMIT 1
)
INSERT INTO public.admin_account_lock (user_id)
SELECT id
FROM current_admin
ON CONFLICT (user_id) DO NOTHING;

WITH locked_admin AS (
    SELECT user_id
    FROM public.admin_account_lock
    ORDER BY locked_at ASC, user_id ASC
    LIMIT 1
)
UPDATE public.profiles AS p
SET grade = 'Bronze'
WHERE LOWER(COALESCE(p.grade, '')) IN ('admin', 'moderator', 'moderation', 'mod')
  AND NOT EXISTS (
      SELECT 1
      FROM locked_admin la
      WHERE la.user_id = p.id
  );

CREATE OR REPLACE FUNCTION public.prevent_extra_admin_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_locked_admin_id UUID;
BEGIN
    IF LOWER(COALESCE(NEW.grade, '')) NOT IN ('admin', 'moderator', 'moderation', 'mod') THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('public.profiles.admin_account_lock'));

    SELECT user_id
    INTO v_locked_admin_id
    FROM public.admin_account_lock
    ORDER BY locked_at ASC, user_id ASC
    LIMIT 1;

    IF v_locked_admin_id IS NULL THEN
        INSERT INTO public.admin_account_lock (user_id)
        VALUES (NEW.id);
        RETURN NEW;
    END IF;

    IF v_locked_admin_id <> NEW.id THEN
        RAISE EXCEPTION 'Un compte admin est deja verrouille pour cette app.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_extra_admin_accounts ON public.profiles;
CREATE TRIGGER trg_prevent_extra_admin_accounts
BEFORE INSERT OR UPDATE OF grade ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_extra_admin_accounts();

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_account_lock aal
        JOIN public.profiles p ON p.id = aal.user_id
        WHERE aal.user_id = auth.uid()
          AND LOWER(COALESCE(p.grade, '')) IN ('admin', 'moderator', 'moderation', 'mod')
    );
$$;

ALTER TABLE public.admin_account_lock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to admin account lock" ON public.admin_account_lock;

REVOKE ALL ON public.admin_account_lock FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_account_lock TO service_role;

REVOKE ALL ON FUNCTION public.prevent_extra_admin_accounts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_extra_admin_accounts() TO postgres, service_role;

REVOKE ALL ON FUNCTION public.is_moderator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO authenticated, service_role;
