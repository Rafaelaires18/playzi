-- Phase 27 — Secure email change requests with confirm/cancel tokens

CREATE TABLE IF NOT EXISTS public.email_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_email TEXT NOT NULL,
    pending_email TEXT,
    confirm_token_hash TEXT UNIQUE NOT NULL,
    cancel_token_hash TEXT UNIQUE NOT NULL,
    confirm_expires_at TIMESTAMPTZ NOT NULL,
    cancel_expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT email_change_request_email_diff
        CHECK (pending_email IS NULL OR lower(current_email) <> lower(pending_email))
);

CREATE INDEX IF NOT EXISTS idx_email_change_requests_user_created
    ON public.email_change_requests (user_id, created_at DESC);

ALTER TABLE public.email_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own email change requests" ON public.email_change_requests;
CREATE POLICY "Users can read own email change requests"
    ON public.email_change_requests
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own email change requests" ON public.email_change_requests;
CREATE POLICY "Users can create own email change requests"
    ON public.email_change_requests
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
