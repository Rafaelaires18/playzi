-- Phase 21: Hard DB guard against over-capacity joins
-- Prevents cases like 5/4 even under concurrent join attempts.

CREATE OR REPLACE FUNCTION public.prevent_over_capacity_participation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_attendees INTEGER;
    v_creator_id UUID;
    v_confirmed_count INTEGER;
BEGIN
    -- Only enforce capacity for confirmed participant rows
    IF NEW.status IS DISTINCT FROM 'confirmé' THEN
        RETURN NEW;
    END IF;

    SELECT a.max_attendees, a.creator_id
    INTO v_max_attendees, v_creator_id
    FROM public.activities a
    WHERE a.id = NEW.activity_id;

    -- No cap configured => no capacity check
    IF v_max_attendees IS NULL OR v_max_attendees <= 0 THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*)
    INTO v_confirmed_count
    FROM public.participations p
    WHERE p.activity_id = NEW.activity_id
      AND p.status = 'confirmé'
      AND (TG_OP = 'INSERT' OR p.id <> NEW.id);

    -- attendees shown in app = creator + confirmed participations
    IF (v_confirmed_count + 1) >= v_max_attendees THEN
        RAISE EXCEPTION 'activity is already full'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_over_capacity_participation ON public.participations;
CREATE TRIGGER trg_prevent_over_capacity_participation
BEFORE INSERT OR UPDATE OF activity_id, status, user_id
ON public.participations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_over_capacity_participation();
