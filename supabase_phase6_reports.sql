-- Migration: Add Reports table for Chat Moderation / Absence Reporting
-- Description: Creates a table to store moderation reports (absence or problem) submitted from the chat UI.

CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('absence', 'problem')),
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved'))
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policies
-- Anyone authenticated can insert a report
CREATE POLICY "Users can insert their own reports" ON public.reports
    FOR INSERT 
    WITH CHECK (auth.uid() = reporter_id);

-- Users can only see reports they submitted (privacy for reported user)
CREATE POLICY "Users can view their own submitted reports" ON public.reports
    FOR SELECT 
    USING (auth.uid() = reporter_id);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reports_reported_id ON public.reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_reports_activity_id ON public.reports(activity_id);
