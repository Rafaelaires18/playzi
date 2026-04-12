-- Phase 24 — Monthly summary read state (per user, per month)

CREATE TABLE IF NOT EXISTS public.monthly_summary_reads (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month_key TEXT NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, month_key),
    CONSTRAINT monthly_summary_reads_month_key_format
        CHECK (month_key ~ '^[0-9]{4}-[0-9]{2}$')
);

ALTER TABLE public.monthly_summary_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own monthly summary reads" ON public.monthly_summary_reads;
CREATE POLICY "Users can read own monthly summary reads"
    ON public.monthly_summary_reads
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own monthly summary reads" ON public.monthly_summary_reads;
CREATE POLICY "Users can insert own monthly summary reads"
    ON public.monthly_summary_reads
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own monthly summary reads" ON public.monthly_summary_reads;
CREATE POLICY "Users can update own monthly summary reads"
    ON public.monthly_summary_reads
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
