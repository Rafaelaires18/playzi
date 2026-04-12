-- Phase 28 — In-app "Signaler un problème" tickets

CREATE TABLE IF NOT EXISTS public.support_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT support_reports_category_check CHECK (category IN ('bug', 'abuse', 'payment', 'other')),
    CONSTRAINT support_reports_status_check CHECK (status IN ('new', 'in_progress', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_support_reports_status_created
ON public.support_reports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_reports_user_created
ON public.support_reports(user_id, created_at DESC);

ALTER TABLE public.support_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own support reports" ON public.support_reports;
CREATE POLICY "Users can insert own support reports"
    ON public.support_reports
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own support reports" ON public.support_reports;
CREATE POLICY "Users can read own support reports"
    ON public.support_reports
    FOR SELECT
    USING (auth.uid() = user_id);
