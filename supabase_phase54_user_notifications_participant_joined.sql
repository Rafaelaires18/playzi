-- Phase 54 — Add participant_joined user notification type

DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.user_notifications'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%type%'
    LOOP
        EXECUTE format('ALTER TABLE public.user_notifications DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;
END $$;

ALTER TABLE public.user_notifications
    ADD CONSTRAINT user_notifications_type_check
    CHECK (
        type IN (
            'new_activity_nearby',
            'participant_joined',
            'chat_open',
            'urgent_mode',
            'group_complete',
            'activity_reminder_30m'
        )
    );
