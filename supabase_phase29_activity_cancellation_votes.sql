-- Phase 29 — Activity cancellation proposals and group vote

CREATE TABLE IF NOT EXISTS public.activity_cancellation_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    initiated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason_code TEXT NOT NULL,
    reason_text TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT activity_cancellation_proposals_reason_check
        CHECK (reason_code IN ('weather', 'injury', 'low_participants', 'collective_unforeseen', 'other')),
    CONSTRAINT activity_cancellation_proposals_status_check
        CHECK (status IN ('active', 'accepted', 'rejected')),
    CONSTRAINT activity_cancellation_proposals_other_reason_text_required
        CHECK ((reason_code <> 'other') OR (length(trim(coalesce(reason_text, ''))) > 0))
);

CREATE INDEX IF NOT EXISTS idx_activity_cancellation_proposals_activity_created
ON public.activity_cancellation_proposals(activity_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_activity_cancellation_proposals_active
ON public.activity_cancellation_proposals(activity_id)
WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.activity_cancellation_votes (
    proposal_id UUID NOT NULL REFERENCES public.activity_cancellation_proposals(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vote TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (proposal_id, voter_id),
    CONSTRAINT activity_cancellation_votes_vote_check
        CHECK (vote IN ('yes', 'no'))
);

CREATE INDEX IF NOT EXISTS idx_activity_cancellation_votes_proposal
ON public.activity_cancellation_votes(proposal_id);

ALTER TABLE public.activity_cancellation_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_cancellation_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activity members can view cancellation proposals" ON public.activity_cancellation_proposals;
CREATE POLICY "Activity members can view cancellation proposals"
    ON public.activity_cancellation_proposals
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.activities a
            WHERE a.id = activity_cancellation_proposals.activity_id
            AND (
                a.creator_id = auth.uid()
                OR EXISTS (
                    SELECT 1
                    FROM public.participations p
                    WHERE p.activity_id = a.id
                    AND p.user_id = auth.uid()
                    AND p.status = 'confirmé'
                )
            )
        )
    );

DROP POLICY IF EXISTS "Creators can insert cancellation proposals" ON public.activity_cancellation_proposals;
CREATE POLICY "Creators can insert cancellation proposals"
    ON public.activity_cancellation_proposals
    FOR INSERT
    WITH CHECK (
        auth.uid() = initiated_by
        AND EXISTS (
            SELECT 1
            FROM public.activities a
            WHERE a.id = activity_cancellation_proposals.activity_id
            AND a.creator_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Activity members can update cancellation proposals" ON public.activity_cancellation_proposals;
CREATE POLICY "Activity members can update cancellation proposals"
    ON public.activity_cancellation_proposals
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.activities a
            WHERE a.id = activity_cancellation_proposals.activity_id
            AND (
                a.creator_id = auth.uid()
                OR EXISTS (
                    SELECT 1
                    FROM public.participations p
                    WHERE p.activity_id = a.id
                    AND p.user_id = auth.uid()
                    AND p.status = 'confirmé'
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.activities a
            WHERE a.id = activity_cancellation_proposals.activity_id
            AND (
                a.creator_id = auth.uid()
                OR EXISTS (
                    SELECT 1
                    FROM public.participations p
                    WHERE p.activity_id = a.id
                    AND p.user_id = auth.uid()
                    AND p.status = 'confirmé'
                )
            )
        )
    );

DROP POLICY IF EXISTS "Activity members can view cancellation votes" ON public.activity_cancellation_votes;
CREATE POLICY "Activity members can view cancellation votes"
    ON public.activity_cancellation_votes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.activity_cancellation_proposals cp
            JOIN public.activities a ON a.id = cp.activity_id
            WHERE cp.id = activity_cancellation_votes.proposal_id
            AND (
                a.creator_id = auth.uid()
                OR EXISTS (
                    SELECT 1
                    FROM public.participations p
                    WHERE p.activity_id = a.id
                    AND p.user_id = auth.uid()
                    AND p.status = 'confirmé'
                )
            )
        )
    );

DROP POLICY IF EXISTS "Eligible members can vote cancellation proposals" ON public.activity_cancellation_votes;
CREATE POLICY "Eligible members can vote cancellation proposals"
    ON public.activity_cancellation_votes
    FOR INSERT
    WITH CHECK (
        auth.uid() = voter_id
        AND EXISTS (
            SELECT 1
            FROM public.activity_cancellation_proposals cp
            JOIN public.activities a ON a.id = cp.activity_id
            WHERE cp.id = activity_cancellation_votes.proposal_id
            AND (
                a.creator_id = auth.uid()
                OR EXISTS (
                    SELECT 1
                    FROM public.participations p
                    WHERE p.activity_id = a.id
                    AND p.user_id = auth.uid()
                    AND p.status = 'confirmé'
                )
            )
        )
    );

DROP POLICY IF EXISTS "Eligible members can update own vote cancellation proposals" ON public.activity_cancellation_votes;
CREATE POLICY "Eligible members can update own vote cancellation proposals"
    ON public.activity_cancellation_votes
    FOR UPDATE
    USING (
        auth.uid() = voter_id
        AND EXISTS (
            SELECT 1
            FROM public.activity_cancellation_proposals cp
            JOIN public.activities a ON a.id = cp.activity_id
            WHERE cp.id = activity_cancellation_votes.proposal_id
            AND (
                a.creator_id = auth.uid()
                OR EXISTS (
                    SELECT 1
                    FROM public.participations p
                    WHERE p.activity_id = a.id
                    AND p.user_id = auth.uid()
                    AND p.status = 'confirmé'
                )
            )
        )
    )
    WITH CHECK (
        auth.uid() = voter_id
        AND EXISTS (
            SELECT 1
            FROM public.activity_cancellation_proposals cp
            JOIN public.activities a ON a.id = cp.activity_id
            WHERE cp.id = activity_cancellation_votes.proposal_id
            AND (
                a.creator_id = auth.uid()
                OR EXISTS (
                    SELECT 1
                    FROM public.participations p
                    WHERE p.activity_id = a.id
                    AND p.user_id = auth.uid()
                    AND p.status = 'confirmé'
                )
            )
        )
    );
