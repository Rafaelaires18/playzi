-- Phase 39 — Support requests: replace legacy "other" type with "question"

BEGIN;

ALTER TABLE public.support_requests
DROP CONSTRAINT IF EXISTS support_requests_type_check;

UPDATE public.support_requests
SET type = 'question'
WHERE type = 'other';

ALTER TABLE public.support_requests
ADD CONSTRAINT support_requests_type_check
CHECK (type IS NULL OR type IN ('age_verification', 'account_access', 'question'));

COMMIT;
