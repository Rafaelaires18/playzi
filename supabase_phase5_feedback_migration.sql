-- ===========================================================
-- PLAYZI - FEEDBACK SYSTEM: Clean RLS Policy Setup
-- Run this ENTIRE script in Supabase SQL Editor each time
-- ===========================================================

-- Step 1: Allow reviewed_user_id to be NULL (for global activity feedback)
ALTER TABLE public.activity_feedback ALTER COLUMN reviewed_user_id DROP NOT NULL;

-- Step 2: Re-enable RLS (in case it was disabled for testing)
ALTER TABLE public.activity_feedback ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop ALL existing INSERT policies on activity_feedback
DROP POLICY IF EXISTS "Utilisateurs peuvent laisser un feedback s'ils ont participé" ON public.activity_feedback;
DROP POLICY IF EXISTS "Utilisateurs peuvent laisser un feedback s'ils ont participé ou créé l'activité" ON public.activity_feedback;
DROP POLICY IF EXISTS "feedback_insert_policy" ON public.activity_feedback;
DROP POLICY IF EXISTS "feedback_select_own" ON public.activity_feedback;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.activity_feedback;

-- Step 4: Create the correct INSERT policy
-- Allows: confirmed participants AND the activity creator to insert feedback
CREATE POLICY "feedback_insert_policy"
  ON public.activity_feedback FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND (
        -- Confirmed participant
        EXISTS (
            SELECT 1 FROM participations
            WHERE activity_id = activity_feedback.activity_id
              AND user_id = auth.uid()
              AND status = 'confirmé'
        )
        -- OR activity creator
        OR EXISTS (
            SELECT 1 FROM activities
            WHERE id = activity_feedback.activity_id
              AND creator_id = auth.uid()
        )
    )
    AND (
        -- Either a global (null) feedback or targeting a real confirmed participant
        reviewed_user_id IS NULL
        OR EXISTS (
            SELECT 1 FROM participations
            WHERE activity_id = activity_feedback.activity_id
              AND user_id = activity_feedback.reviewed_user_id
              AND status = 'confirmé'
        )
    )
  );

-- Step 5: Allow users to read their own submitted feedback
DROP POLICY IF EXISTS "feedback_select_own" ON public.activity_feedback;
CREATE POLICY "feedback_select_own"
  ON public.activity_feedback FOR SELECT
  USING (auth.uid() = reviewer_id);

-- Done! The RLS policies are now correctly configured.
-- Confirmed participants AND the creator can submit feedback.
