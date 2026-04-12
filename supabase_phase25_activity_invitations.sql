-- Phase 25 — Activity invitations by pseudo (creator -> invitees)

CREATE TABLE IF NOT EXISTS public.activity_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (activity_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_invitations_invitee_created
ON public.activity_invitations(invitee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_invitations_activity
ON public.activity_invitations(activity_id);

ALTER TABLE public.activity_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read invitations they send or receive" ON public.activity_invitations;
CREATE POLICY "Users can read invitations they send or receive"
    ON public.activity_invitations
    FOR SELECT
    USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

DROP POLICY IF EXISTS "Creators can insert own invitations" ON public.activity_invitations;
CREATE POLICY "Creators can insert own invitations"
    ON public.activity_invitations
    FOR INSERT
    WITH CHECK (
        auth.uid() = inviter_id
        AND EXISTS (
            SELECT 1
            FROM public.activities a
            WHERE a.id = activity_id
              AND a.creator_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Invitees can update own invitation status" ON public.activity_invitations;
CREATE POLICY "Invitees can update own invitation status"
    ON public.activity_invitations
    FOR UPDATE
    USING (auth.uid() = invitee_id)
    WITH CHECK (auth.uid() = invitee_id);
