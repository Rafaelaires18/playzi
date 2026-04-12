-- Phase 38 — Support requests anti-spam lookup index
-- Optimizes per-user/per-type checks over recent 24h window.

CREATE INDEX IF NOT EXISTS idx_support_requests_user_type_created
ON public.support_requests(user_id, type, created_at DESC);
