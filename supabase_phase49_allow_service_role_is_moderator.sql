-- Phase 49 — Allow service_role to execute moderator helper for admin backups/reads

GRANT EXECUTE ON FUNCTION public.is_moderator() TO service_role;
