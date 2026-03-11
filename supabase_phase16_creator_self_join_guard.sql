-- Phase 16: Cleanup + hard guard against creator self-participation

-- 1) Cleanup legacy bad rows where creator joined own activity
DELETE FROM public.participations p
USING public.activities a
WHERE p.activity_id = a.id
  AND p.user_id = a.creator_id;

-- 2) DB-level guard to prevent future self-join attempts
CREATE OR REPLACE FUNCTION public.prevent_creator_self_participation()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_prevent_creator_self_participation ON public.participations;
CREATE TRIGGER trg_prevent_creator_self_participation
BEFORE INSERT OR UPDATE OF activity_id, user_id
ON public.participations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_creator_self_participation();
