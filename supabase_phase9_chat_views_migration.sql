-- Phase 9: état "vu" par message
CREATE TABLE IF NOT EXISTS public.activity_chat_message_views (
  message_id UUID NOT NULL REFERENCES public.activity_chat_messages(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_chat_message_views_message
  ON public.activity_chat_message_views(message_id);

ALTER TABLE public.activity_chat_message_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Message views are visible to activity members" ON public.activity_chat_message_views;
CREATE POLICY "Message views are visible to activity members"
  ON public.activity_chat_message_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.activity_chat_messages m
      JOIN public.activities a ON a.id = m.activity_id
      WHERE m.id = activity_chat_message_views.message_id
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

DROP POLICY IF EXISTS "Users can mark messages as viewed" ON public.activity_chat_message_views;
CREATE POLICY "Users can mark messages as viewed"
  ON public.activity_chat_message_views
  FOR INSERT
  WITH CHECK (
    auth.uid() = viewer_id
    AND EXISTS (
      SELECT 1
      FROM public.activity_chat_messages m
      JOIN public.activities a ON a.id = m.activity_id
      WHERE m.id = activity_chat_message_views.message_id
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

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_chat_message_views;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;
