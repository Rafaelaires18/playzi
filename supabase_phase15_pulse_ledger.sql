-- Phase 15: Pulse ledger + feedback/reports hardening

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Canonical Pulse ledger
CREATE TABLE IF NOT EXISTS public.pulse_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_id UUID NULL REFERENCES public.activities(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
    points INTEGER NOT NULL CHECK (points > 0),
    signed_points INTEGER NOT NULL,
    reason_code TEXT NOT NULL,
    reason_label TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    unique_event_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT pulse_signed_points_consistency CHECK (
        (direction = 'credit' AND signed_points > 0)
        OR (direction = 'debit' AND signed_points < 0)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pulse_transactions_unique_event_key
    ON public.pulse_transactions(unique_event_key);
CREATE INDEX IF NOT EXISTS idx_pulse_transactions_user_created_at
    ON public.pulse_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_transactions_activity
    ON public.pulse_transactions(activity_id);

ALTER TABLE public.pulse_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own pulse transactions" ON public.pulse_transactions;
CREATE POLICY "Users can view their own pulse transactions"
    ON public.pulse_transactions
    FOR SELECT
    USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE policy on purpose.
-- All writes should go through SECURITY DEFINER function below.

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
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.record_pulse_transaction(UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, JSONB, TEXT)
    TO authenticated;

CREATE OR REPLACE VIEW public.pulse_user_totals AS
SELECT
    user_id,
    COALESCE(SUM(signed_points), 0)::INTEGER AS total_pulse
FROM public.pulse_transactions
GROUP BY user_id;

-- 2) Per-activity summary notifications
CREATE TABLE IF NOT EXISTS public.pulse_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_points INTEGER NOT NULL,
    breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pulse_summaries_user_created
    ON public.pulse_summaries(user_id, created_at DESC);

ALTER TABLE public.pulse_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own pulse summaries" ON public.pulse_summaries;
CREATE POLICY "Users can view their own pulse summaries"
    ON public.pulse_summaries
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated can insert pulse summaries" ON public.pulse_summaries;
CREATE POLICY "Authenticated can insert pulse summaries"
    ON public.pulse_summaries
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can update pulse summaries" ON public.pulse_summaries;
CREATE POLICY "Authenticated can update pulse summaries"
    ON public.pulse_summaries
    FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 3) Activity / feedback extensions for Pulse processing
ALTER TABLE public.activities
    ADD COLUMN IF NOT EXISTS pulse_finalized_at TIMESTAMPTZ;

ALTER TABLE public.activity_feedback
    ADD COLUMN IF NOT EXISTS pulse_score SMALLINT,
    ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;

-- 4) Reports hardening + anti-abuse constraints
ALTER TABLE public.reports
    ADD COLUMN IF NOT EXISTS reason_code TEXT,
    ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sanction_event_key TEXT,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Keep reason_code populated for legacy rows
UPDATE public.reports
SET reason_code = COALESCE(reason_code, 'legacy')
WHERE reason_code IS NULL;

-- Ensure no duplicates before unique constraint
DELETE FROM public.reports a
USING public.reports b
WHERE a.ctid < b.ctid
  AND a.activity_id = b.activity_id
  AND a.reporter_id = b.reporter_id
  AND a.reported_id = b.reported_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reports_activity_reporter_reported
    ON public.reports(activity_id, reporter_id, reported_id);

CREATE INDEX IF NOT EXISTS idx_reports_activity_reported_reason
    ON public.reports(activity_id, reported_id, reason_code);

DROP POLICY IF EXISTS "Users can view their own submitted reports" ON public.reports;
CREATE POLICY "Activity members can read reports"
    ON public.reports
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        AND (
            auth.uid() = reporter_id
            OR auth.uid() = reported_id
            OR EXISTS (
                SELECT 1
                FROM public.activities a
                WHERE a.id = reports.activity_id
                  AND a.creator_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1
                FROM public.participations p
                WHERE p.activity_id = reports.activity_id
                  AND p.user_id = auth.uid()
                  AND p.status = 'confirmé'
            )
        )
    );
