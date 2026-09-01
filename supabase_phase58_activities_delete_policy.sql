-- Phase 58: allow creators to physically delete their own activities.
-- Backend routes still enforce activity ownership and solo-participant checks
-- before this RLS policy can be used.

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les créateurs peuvent supprimer leurs activités"
ON public.activities;

CREATE POLICY "Les créateurs peuvent supprimer leurs activités"
ON public.activities
FOR DELETE
TO authenticated
USING (auth.uid() = creator_id);
