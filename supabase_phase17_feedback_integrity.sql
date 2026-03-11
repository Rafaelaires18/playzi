-- Phase 17: Feedback integrity hardening (anti-farming + cancelled safety)

-- 1) Cleanup duplicate global feedback rows (one feedback per reviewer per activity)
DELETE FROM public.activity_feedback a
USING public.activity_feedback b
WHERE a.ctid < b.ctid
  AND a.activity_id = b.activity_id
  AND a.reviewer_id = b.reviewer_id
  AND a.reviewed_user_id IS NULL
  AND b.reviewed_user_id IS NULL;

-- 2) Cleanup duplicate targeted feedback trace rows
DELETE FROM public.activity_feedback a
USING public.activity_feedback b
WHERE a.ctid < b.ctid
  AND a.activity_id = b.activity_id
  AND a.reviewer_id = b.reviewer_id
  AND a.reviewed_user_id = b.reviewed_user_id
  AND a.reviewed_user_id IS NOT NULL;

-- 3) Strong DB constraints
CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_feedback_global_once
    ON public.activity_feedback(activity_id, reviewer_id)
    WHERE reviewed_user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_feedback_target_once
    ON public.activity_feedback(activity_id, reviewer_id, reviewed_user_id)
    WHERE reviewed_user_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'activity_feedback_no_self_target'
    ) THEN
        ALTER TABLE public.activity_feedback
            ADD CONSTRAINT activity_feedback_no_self_target
            CHECK (reviewed_user_id IS NULL OR reviewed_user_id <> reviewer_id);
    END IF;
END $$;

