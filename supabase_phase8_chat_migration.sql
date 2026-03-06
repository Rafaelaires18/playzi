-- Phase 8: chat persistant par activité
CREATE TABLE IF NOT EXISTS public.activity_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_chat_messages_activity_created
  ON public.activity_chat_messages(activity_id, created_at);

ALTER TABLE public.activity_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chat messages are visible to activity members" ON public.activity_chat_messages;
CREATE POLICY "Chat messages are visible to activity members"
  ON public.activity_chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.activities a
      WHERE a.id = activity_chat_messages.activity_id
        AND a.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.participations p
      WHERE p.activity_id = activity_chat_messages.activity_id
        AND p.user_id = auth.uid()
        AND p.status = 'confirmé'
    )
  );

DROP POLICY IF EXISTS "Activity members can send chat messages" ON public.activity_chat_messages;
CREATE POLICY "Activity members can send chat messages"
  ON public.activity_chat_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.activities a
        WHERE a.id = activity_chat_messages.activity_id
          AND a.creator_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.participations p
        WHERE p.activity_id = activity_chat_messages.activity_id
          AND p.user_id = auth.uid()
          AND p.status = 'confirmé'
      )
    )
  );

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_chat_messages;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;
