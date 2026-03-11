-- Phase 19: Feedback and Reports RLS Fixes for Creators

-- The previous feedback policy relied entirely on the 'participations' table, 
-- which blocked the Creator from leaving feedback or getting feedback because 
-- the Creator is not listed in 'participations'. 
-- It also broke Global feedback ('reviewed_user_id IS NULL') checks.

DROP POLICY IF EXISTS "Utilisateurs peuvent laisser un feedback s'ils ont participé" ON public.activity_feedback;

CREATE POLICY "Activity members can insert feedback"
  ON public.activity_feedback FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = reviewer_id 
    AND (
      EXISTS (
        SELECT 1 FROM public.activities a 
        WHERE a.id = activity_id AND a.creator_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.participations p 
        WHERE p.activity_id = activity_feedback.activity_id 
          AND p.user_id = auth.uid() 
          AND p.status = 'confirmé'
      )
    )
    AND (
      reviewed_user_id IS NULL 
      OR
      EXISTS (
        SELECT 1 FROM public.activities a 
        WHERE a.id = activity_id AND a.creator_id = reviewed_user_id
      )
      OR
      EXISTS (
        SELECT 1 FROM public.participations p 
        WHERE p.activity_id = activity_feedback.activity_id 
          AND p.user_id = activity_feedback.reviewed_user_id 
          AND p.status = 'confirmé'
      )
    )
  );

-- To ensure the API reports endpoint works without RLS blocks if it isn't using the security definer, 
-- we allow members of the activity to insert reports.
DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;

CREATE POLICY "Users can insert their own reports"
  ON public.reports FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() = reporter_id
    AND (
      EXISTS (
        SELECT 1 FROM public.activities a 
        WHERE a.id = activity_id AND a.creator_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.participations p 
        WHERE p.activity_id = reports.activity_id 
          AND p.user_id = auth.uid() 
          AND p.status = 'confirmé'
      )
    )
  );
