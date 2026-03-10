-- Phase 11 — Connections and connection requests

CREATE TABLE IF NOT EXISTS public.connection_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id),
  CHECK (sender_id <> receiver_id)
);

CREATE TABLE IF NOT EXISTS public.user_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_a, user_b),
  CHECK (user_a <> user_b)
);

ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their connection requests" ON public.connection_requests;
DROP POLICY IF EXISTS "Users can create sent connection requests" ON public.connection_requests;
DROP POLICY IF EXISTS "Users can delete related connection requests" ON public.connection_requests;

CREATE POLICY "Users can view their connection requests"
  ON public.connection_requests
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create sent connection requests"
  ON public.connection_requests
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can delete related connection requests"
  ON public.connection_requests
  FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can view their connections" ON public.user_connections;
DROP POLICY IF EXISTS "Users can create their connections" ON public.user_connections;
DROP POLICY IF EXISTS "Users can delete their connections" ON public.user_connections;

CREATE POLICY "Users can view their connections"
  ON public.user_connections
  FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can create their connections"
  ON public.user_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Users can delete their connections"
  ON public.user_connections
  FOR DELETE
  USING (auth.uid() = user_a OR auth.uid() = user_b);
