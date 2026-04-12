-- Phase 33 — Dedicated invitation notifications for invited users

CREATE TABLE IF NOT EXISTS public.activity_invitation_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'activity_invitation',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    read_at TIMESTAMPTZ,
    CONSTRAINT activity_invitation_notifications_type_check
        CHECK (type = 'activity_invitation'),
    CONSTRAINT activity_invitation_notifications_unique_user_activity
        UNIQUE (activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_invitation_notifications_user_unread
ON public.activity_invitation_notifications(user_id, read_at, created_at DESC);

ALTER TABLE public.activity_invitation_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own invitation notifications" ON public.activity_invitation_notifications;
CREATE POLICY "Users can read own invitation notifications"
    ON public.activity_invitation_notifications
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert invitation notifications" ON public.activity_invitation_notifications;
CREATE POLICY "Service role can insert invitation notifications"
    ON public.activity_invitation_notifications
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can mark own invitation notifications as read" ON public.activity_invitation_notifications;
CREATE POLICY "Users can mark own invitation notifications as read"
    ON public.activity_invitation_notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
