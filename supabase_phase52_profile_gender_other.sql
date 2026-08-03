-- Phase 52 — Allow "other" as a profile gender value

DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.profiles'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%gender%'
    LOOP
        EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;
END $$;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_gender_check
    CHECK (gender IS NULL OR gender IN ('male', 'female', 'other'));
