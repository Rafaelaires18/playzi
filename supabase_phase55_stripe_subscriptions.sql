-- Phase 55 — Stripe test subscriptions for Playzi+

BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_customers (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.playzi_subscriptions (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL REFERENCES public.stripe_customers(stripe_customer_id) ON UPDATE CASCADE ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    status TEXT NOT NULL DEFAULT 'unknown',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    latest_invoice_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    stripe_event_id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    livemode BOOLEAN NOT NULL DEFAULT FALSE,
    processing_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processing_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_playzi_subscriptions_customer
ON public.playzi_subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_playzi_subscriptions_status
ON public.playzi_subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
ON public.stripe_webhook_events(processed_at);

ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playzi_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own Stripe customer" ON public.stripe_customers;
CREATE POLICY "Users can read own Stripe customer"
    ON public.stripe_customers
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own Playzi subscription" ON public.playzi_subscriptions;
CREATE POLICY "Users can read own Playzi subscription"
    ON public.playzi_subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

REVOKE ALL ON public.stripe_customers FROM anon, authenticated;
REVOKE ALL ON public.playzi_subscriptions FROM anon, authenticated;
REVOKE ALL ON public.stripe_webhook_events FROM anon, authenticated;

GRANT SELECT ON public.stripe_customers TO authenticated;
GRANT SELECT ON public.playzi_subscriptions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playzi_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_webhook_events TO service_role;

COMMIT;
