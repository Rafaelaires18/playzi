-- Phase 37 — Support requests for blocked/minor access flows

CREATE TABLE IF NOT EXISTS public.support_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT support_requests_type_check CHECK (type IS NULL OR type IN ('age_verification', 'account_access', 'question')),
    CONSTRAINT support_requests_status_check CHECK (status IN ('new', 'in_progress', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_support_requests_user_created
ON public.support_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_requests_status_created
ON public.support_requests(status, created_at DESC);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own support requests" ON public.support_requests;
CREATE POLICY "Users can insert own support requests"
    ON public.support_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own support requests" ON public.support_requests;
CREATE POLICY "Users can read own support requests"
    ON public.support_requests
    FOR SELECT
    USING (auth.uid() = user_id);
