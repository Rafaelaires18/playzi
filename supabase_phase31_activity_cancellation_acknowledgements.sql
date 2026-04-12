-- Phase 31 — User acknowledgement for cancelled activities before archive move

CREATE TABLE IF NOT EXISTS public.activity_cancellation_acknowledgements (
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_cancellation_acknowledgements_user
ON public.activity_cancellation_acknowledgements(user_id, acknowledged_at DESC);

ALTER TABLE public.activity_cancellation_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own cancellation acknowledgements" ON public.activity_cancellation_acknowledgements;
CREATE POLICY "Users can read own cancellation acknowledgements"
    ON public.activity_cancellation_acknowledgements
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cancellation acknowledgements" ON public.activity_cancellation_acknowledgements;
CREATE POLICY "Users can insert own cancellation acknowledgements"
    ON public.activity_cancellation_acknowledgements
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cancellation acknowledgements" ON public.activity_cancellation_acknowledgements;
CREATE POLICY "Users can update own cancellation acknowledgements"
    ON public.activity_cancellation_acknowledgements
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
