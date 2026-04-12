-- Phase 35: Age verification gate (18+ required before app access)

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS birth_date DATE,
    ADD COLUMN IF NOT EXISTS age_verification_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_age_verification_status_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_age_verification_status_check
            CHECK (age_verification_status IN ('pending', 'verified_adult', 'blocked_minor'));
    END IF;
END $$;
