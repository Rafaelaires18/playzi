-- Phase 43 — Web push subscriptions (Safari + Chrome)

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disabled_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user_active
ON public.web_push_subscriptions(user_id, disabled_at, updated_at DESC);

ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own web push subscriptions" ON public.web_push_subscriptions;
CREATE POLICY "Users can read own web push subscriptions"
    ON public.web_push_subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own web push subscriptions" ON public.web_push_subscriptions;
CREATE POLICY "Users can insert own web push subscriptions"
    ON public.web_push_subscriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own web push subscriptions" ON public.web_push_subscriptions;
CREATE POLICY "Users can update own web push subscriptions"
    ON public.web_push_subscriptions
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
