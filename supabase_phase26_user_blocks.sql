-- Phase 26 — Bilateral user blocks (source of truth for content separation)

CREATE TABLE IF NOT EXISTS public.user_blocks (
    blocker_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (blocker_user_id, blocked_user_id),
    CONSTRAINT user_blocks_no_self_block CHECK (blocker_user_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user
ON public.user_blocks(blocked_user_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read blocks they are part of" ON public.user_blocks;
CREATE POLICY "Users can read blocks they are part of"
    ON public.user_blocks
    FOR SELECT
    USING (auth.uid() = blocker_user_id OR auth.uid() = blocked_user_id);

DROP POLICY IF EXISTS "Users can create own blocks" ON public.user_blocks;
CREATE POLICY "Users can create own blocks"
    ON public.user_blocks
    FOR INSERT
    WITH CHECK (auth.uid() = blocker_user_id AND blocker_user_id <> blocked_user_id);

DROP POLICY IF EXISTS "Users can delete own blocks" ON public.user_blocks;
CREATE POLICY "Users can delete own blocks"
    ON public.user_blocks
    FOR DELETE
    USING (auth.uid() = blocker_user_id);
