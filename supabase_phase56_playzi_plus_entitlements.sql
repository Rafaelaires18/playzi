-- Phase 56 - Central Playzi+ entitlements

BEGIN;

CREATE TABLE IF NOT EXISTS public.playzi_app_settings (
    key TEXT PRIMARY KEY,
    bool_value BOOLEAN,
    text_value TEXT,
    json_value JSONB,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.playzi_plus_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    grant_type TEXT NOT NULL CHECK (grant_type IN ('beta_tester', 'founder', 'partner', 'gift', 'manual')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    reason TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT playzi_plus_grants_valid_dates CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_playzi_plus_grants_user_active
ON public.playzi_plus_grants(user_id, active);

CREATE INDEX IF NOT EXISTS idx_playzi_plus_grants_expires_at
ON public.playzi_plus_grants(expires_at)
WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playzi_plus_grants_user_window
ON public.playzi_plus_grants(user_id, starts_at, expires_at)
WHERE active = TRUE AND revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_playzi_app_settings_updated_at ON public.playzi_app_settings;
CREATE TRIGGER set_playzi_app_settings_updated_at
    BEFORE UPDATE ON public.playzi_app_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_playzi_plus_grants_updated_at ON public.playzi_plus_grants;
CREATE TRIGGER set_playzi_plus_grants_updated_at
    BEFORE UPDATE ON public.playzi_plus_grants
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.playzi_app_settings (key, bool_value, description)
VALUES (
    'playzi_plus_launch_free_access',
    TRUE,
    'Enable Playzi+ access for every authenticated user during launch.'
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.playzi_app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playzi_plus_grants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.playzi_app_settings FROM anon, authenticated;
REVOKE ALL ON public.playzi_plus_grants FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.playzi_app_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playzi_plus_grants TO service_role;

COMMIT;
