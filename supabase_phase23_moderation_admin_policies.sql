-- Phase 23: Moderator access policies for moderation back-office (without service role key)

CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND LOWER(COALESCE(p.grade, '')) IN ('admin','moderator','moderation','mod')
  );
$$;

REVOKE ALL ON FUNCTION public.is_moderator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_moderator() TO authenticated;

-- moderation_chat_reports
DROP POLICY IF EXISTS "Moderators can read chat moderation reports" ON public.moderation_chat_reports;
CREATE POLICY "Moderators can read chat moderation reports"
    ON public.moderation_chat_reports
    FOR SELECT
    USING (auth.role() = 'authenticated' AND public.is_moderator());

-- moderation_user_status
DROP POLICY IF EXISTS "Moderators can read moderation user status" ON public.moderation_user_status;
CREATE POLICY "Moderators can read moderation user status"
    ON public.moderation_user_status
    FOR SELECT
    USING (auth.role() = 'authenticated' AND public.is_moderator());

DROP POLICY IF EXISTS "Moderators can update moderation user status" ON public.moderation_user_status;
CREATE POLICY "Moderators can update moderation user status"
    ON public.moderation_user_status
    FOR UPDATE
    USING (auth.role() = 'authenticated' AND public.is_moderator())
    WITH CHECK (auth.role() = 'authenticated' AND public.is_moderator());

DROP POLICY IF EXISTS "Moderators can insert moderation user status" ON public.moderation_user_status;
CREATE POLICY "Moderators can insert moderation user status"
    ON public.moderation_user_status
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND public.is_moderator());

-- moderation_actions_log
DROP POLICY IF EXISTS "Moderators can read moderation actions log" ON public.moderation_actions_log;
CREATE POLICY "Moderators can read moderation actions log"
    ON public.moderation_actions_log
    FOR SELECT
    USING (auth.role() = 'authenticated' AND public.is_moderator());

DROP POLICY IF EXISTS "Moderators can insert moderation actions log" ON public.moderation_actions_log;
CREATE POLICY "Moderators can insert moderation actions log"
    ON public.moderation_actions_log
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND public.is_moderator());

-- moderation_notifications
DROP POLICY IF EXISTS "Moderators can insert moderation notifications" ON public.moderation_notifications;
CREATE POLICY "Moderators can insert moderation notifications"
    ON public.moderation_notifications
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND public.is_moderator());

DROP POLICY IF EXISTS "Moderators can read moderation notifications" ON public.moderation_notifications;
CREATE POLICY "Moderators can read moderation notifications"
    ON public.moderation_notifications
    FOR SELECT
    USING (auth.role() = 'authenticated' AND public.is_moderator());

-- admin_notifications_log
DROP POLICY IF EXISTS "Moderators can read admin notifications log" ON public.admin_notifications_log;
CREATE POLICY "Moderators can read admin notifications log"
    ON public.admin_notifications_log
    FOR SELECT
    USING (auth.role() = 'authenticated' AND public.is_moderator());

DROP POLICY IF EXISTS "Moderators can insert admin notifications log" ON public.admin_notifications_log;
CREATE POLICY "Moderators can insert admin notifications log"
    ON public.admin_notifications_log
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND public.is_moderator());
