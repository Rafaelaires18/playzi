-- Phase 9 Migration: Suivi des messages lus par utilisateur et activite
CREATE TABLE IF NOT EXISTS public.activity_chat_reads (
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_chat_reads_user
  ON public.activity_chat_reads(user_id, activity_id);

ALTER TABLE public.activity_chat_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own chat read states" ON public.activity_chat_reads;
CREATE POLICY "Users can read their own chat read states"
  ON public.activity_chat_reads
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert their own chat read states" ON public.activity_chat_reads;
CREATE POLICY "Users can upsert their own chat read states"
  ON public.activity_chat_reads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own chat read states" ON public.activity_chat_reads;
CREATE POLICY "Users can update their own chat read states"
  ON public.activity_chat_reads
  FOR UPDATE
  USING (auth.uid() = user_id);
