-- Phase 30 — Dedicated in-app notifications for activity cancellation votes

CREATE TABLE IF NOT EXISTS public.activity_cancellation_vote_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.activity_cancellation_proposals(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'activity_cancellation_vote',
    title TEXT NOT NULL DEFAULT 'Vote d’annulation en cours',
    body TEXT NOT NULL DEFAULT 'Donnez votre avis',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    read_at TIMESTAMPTZ,
    CONSTRAINT activity_cancellation_vote_notifications_type_check
        CHECK (type = 'activity_cancellation_vote'),
    CONSTRAINT activity_cancellation_vote_notifications_unique_user_proposal
        UNIQUE (proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_cancellation_vote_notifications_user_unread
ON public.activity_cancellation_vote_notifications(user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_cancellation_vote_notifications_activity_user
ON public.activity_cancellation_vote_notifications(activity_id, user_id, read_at);

ALTER TABLE public.activity_cancellation_vote_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own cancellation vote notifications" ON public.activity_cancellation_vote_notifications;
CREATE POLICY "Users can read own cancellation vote notifications"
    ON public.activity_cancellation_vote_notifications
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert cancellation vote notifications" ON public.activity_cancellation_vote_notifications;
CREATE POLICY "Service role can insert cancellation vote notifications"
    ON public.activity_cancellation_vote_notifications
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can mark own cancellation vote notifications as read" ON public.activity_cancellation_vote_notifications;
CREATE POLICY "Users can mark own cancellation vote notifications as read"
    ON public.activity_cancellation_vote_notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
