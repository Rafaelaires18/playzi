-- Phase 32 — Share links for activity invites + temporary seat reservations

-- Bootstrap dependency if phase 25 was not applied yet.
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

ALTER TABLE public.activity_invitations
ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_activity_invitations_active_reservations
ON public.activity_invitations(activity_id, status, reservation_expires_at DESC);

CREATE TABLE IF NOT EXISTS public.activity_invite_links (
    activity_id UUID PRIMARY KEY REFERENCES public.activities(id) ON DELETE CASCADE,
    token UUID NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_activity_invite_links_token
ON public.activity_invite_links(token);

ALTER TABLE public.activity_invite_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can resolve invite links" ON public.activity_invite_links;
CREATE POLICY "Authenticated users can resolve invite links"
    ON public.activity_invite_links
    FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Creators can create own invite links" ON public.activity_invite_links;
CREATE POLICY "Creators can create own invite links"
    ON public.activity_invite_links
    FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
        AND EXISTS (
            SELECT 1
            FROM public.activities a
            WHERE a.id = activity_id
              AND a.creator_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Creators can update own invite links" ON public.activity_invite_links;
CREATE POLICY "Creators can update own invite links"
    ON public.activity_invite_links
    FOR UPDATE
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);
