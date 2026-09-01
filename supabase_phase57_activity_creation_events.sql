-- Phase 57 - Activity creation quota events

BEGIN;

CREATE TABLE IF NOT EXISTS public.playzi_activity_creation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    week_starts_at TIMESTAMPTZ NOT NULL,
    deleted_without_participants_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_playzi_activity_creation_events_activity_id
ON public.playzi_activity_creation_events(activity_id)
WHERE activity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playzi_activity_creation_events_user_week_created
ON public.playzi_activity_creation_events(user_id, week_starts_at, created_at);

ALTER TABLE public.playzi_activity_creation_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.playzi_activity_creation_events FROM anon, authenticated;
GRANT SELECT ON public.playzi_activity_creation_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playzi_activity_creation_events TO service_role;

DROP POLICY IF EXISTS "Users can read own activity creation events"
ON public.playzi_activity_creation_events;

CREATE POLICY "Users can read own activity creation events"
ON public.playzi_activity_creation_events
FOR SELECT
USING (auth.uid() = user_id);

INSERT INTO public.playzi_activity_creation_events (
    user_id,
    activity_id,
    created_at,
    week_starts_at
)
SELECT
    creator_id,
    id,
    created_at,
    date_trunc(
        'week',
        created_at AT TIME ZONE 'Europe/Zurich'
    ) AT TIME ZONE 'Europe/Zurich'
FROM public.activities
WHERE creator_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
