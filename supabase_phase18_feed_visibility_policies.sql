-- Phase 18: Ensure Discover feed visibility across authenticated accounts

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read activities" ON public.activities;
CREATE POLICY "Authenticated can read activities"
    ON public.activities
    FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can read participations" ON public.participations;
CREATE POLICY "Authenticated can read participations"
    ON public.participations
    FOR SELECT
    USING (auth.role() = 'authenticated');

