-- Phase 22: Dedicated chat moderation system (separate from Pulse)

CREATE TABLE IF NOT EXISTS public.moderation_chat_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    reporter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL,
    report_text TEXT,
    report_reason_code TEXT NOT NULL,
    report_reason_label TEXT NOT NULL,
    season_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','dismissed')),
    validated_at TIMESTAMPTZ,
    validated_group_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT moderation_chat_reports_no_self_report CHECK (reporter_user_id <> reported_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_moderation_chat_reports_one_per_target
ON public.moderation_chat_reports(activity_id, reporter_user_id, reported_user_id);

CREATE INDEX IF NOT EXISTS idx_moderation_chat_reports_target_reason
ON public.moderation_chat_reports(activity_id, season_id, reported_user_id, report_reason_code);

CREATE INDEX IF NOT EXISTS idx_moderation_chat_reports_reporter_activity
ON public.moderation_chat_reports(reporter_user_id, activity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_chat_reports_created
ON public.moderation_chat_reports(created_at DESC);

CREATE TABLE IF NOT EXISTS public.moderation_user_status (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    season_id TEXT NOT NULL,
    incident_count INTEGER NOT NULL DEFAULT 0,
    moderation_level TEXT NOT NULL DEFAULT 'none' CHECK (moderation_level IN ('none','incident','warning','chat_restricted','suspended')),
    warning_sent_at TIMESTAMPTZ,
    chat_restricted_until TIMESTAMPTZ,
    suspended_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_moderation_user_status_active_chat_restriction
ON public.moderation_user_status(chat_restricted_until)
WHERE chat_restricted_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_moderation_user_status_active_suspension
ON public.moderation_user_status(suspended_until)
WHERE suspended_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.moderation_actions_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    reason TEXT,
    related_activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL,
    season_id TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_log_user_created
ON public.moderation_actions_log(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.moderation_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','restriction','suspension')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_moderation_notifications_user_created
ON public.moderation_notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_notifications_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moderation_report_id UUID REFERENCES public.moderation_chat_reports(id) ON DELETE CASCADE,
    target TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'email',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    sent_at TIMESTAMPTZ
);

ALTER TABLE public.moderation_chat_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_user_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own chat moderation reports" ON public.moderation_chat_reports;
CREATE POLICY "Users can insert own chat moderation reports"
    ON public.moderation_chat_reports
    FOR INSERT
    WITH CHECK (auth.uid() = reporter_user_id AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can read own chat moderation reports" ON public.moderation_chat_reports;
CREATE POLICY "Users can read own chat moderation reports"
    ON public.moderation_chat_reports
    FOR SELECT
    USING (auth.uid() = reporter_user_id AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can read own moderation notifications" ON public.moderation_notifications;
CREATE POLICY "Users can read own moderation notifications"
    ON public.moderation_notifications
    FOR SELECT
    USING (auth.uid() = user_id AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can mark own moderation notifications read" ON public.moderation_notifications;
CREATE POLICY "Users can mark own moderation notifications read"
    ON public.moderation_notifications
    FOR UPDATE
    USING (auth.uid() = user_id AND auth.role() = 'authenticated')
    WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

-- Service role handles inserts/updates/selects for back-office tables.

CREATE OR REPLACE FUNCTION public.set_moderation_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_moderation_chat_reports_updated_at ON public.moderation_chat_reports;
CREATE TRIGGER trg_moderation_chat_reports_updated_at
BEFORE UPDATE ON public.moderation_chat_reports
FOR EACH ROW
EXECUTE FUNCTION public.set_moderation_updated_at();

DROP TRIGGER IF EXISTS trg_moderation_user_status_updated_at ON public.moderation_user_status;
CREATE TRIGGER trg_moderation_user_status_updated_at
BEFORE UPDATE ON public.moderation_user_status
FOR EACH ROW
EXECUTE FUNCTION public.set_moderation_updated_at();
