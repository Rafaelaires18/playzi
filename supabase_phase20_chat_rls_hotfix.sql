-- Phase 20: Chat RLS hotfix
-- Fix 1: Loosen SELECT policy to allow all active participants (not just confirmé)
--         so urgent-mode participants can read messages
-- Fix 2: INSERT policy uses `sender_id` (actual column name, not user_id)

-- ─── SELECT policy ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Chat messages are visible to activity members" ON public.activity_chat_messages;
CREATE POLICY "Chat messages are visible to activity members"
  ON public.activity_chat_messages
  FOR SELECT
  USING (
    -- Creator can always read
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_chat_messages.activity_id
        AND a.creator_id = auth.uid()
    )
    OR
    -- Any participant (regardless of status) can read
    EXISTS (
      SELECT 1 FROM public.participations p
      WHERE p.activity_id = activity_chat_messages.activity_id
        AND p.user_id = auth.uid()
    )
  );

-- ─── INSERT policy ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Activity members can send chat messages" ON public.activity_chat_messages;
CREATE POLICY "Activity members can send chat messages"
  ON public.activity_chat_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      EXISTS (
        SELECT 1 FROM public.activities a
        WHERE a.id = activity_chat_messages.activity_id
          AND a.creator_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.participations p
        WHERE p.activity_id = activity_chat_messages.activity_id
          AND p.user_id = auth.uid()
      )
    )
  );
