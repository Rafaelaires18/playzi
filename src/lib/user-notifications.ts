import type { SupabaseClient } from "@supabase/supabase-js";

export const USER_NOTIFICATION_TYPES = {
    NEW_ACTIVITY_NEARBY: "new_activity_nearby",
    CHAT_OPEN: "chat_open",
    URGENT_MODE: "urgent_mode",
    GROUP_COMPLETE: "group_complete",
    ACTIVITY_REMINDER_30M: "activity_reminder_30m",
} as const;

export type UserNotificationType = (typeof USER_NOTIFICATION_TYPES)[keyof typeof USER_NOTIFICATION_TYPES];

type NotificationInsert = {
    user_id: string;
    type: UserNotificationType;
    title: string;
    message: string;
    activity_id?: string | null;
    dedupe_key: string;
};

function isMissingRelationError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || "");
    return message.includes("relation") && message.includes("does not exist");
}

export async function createUserNotifications(
    supabase: SupabaseClient,
    rows: NotificationInsert[]
) {
    if (!rows.length) return;
    const { error } = await supabase
        .from("user_notifications")
        .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
    if (error && !isMissingRelationError(error)) {
        throw new Error(error.message);
    }
}

export async function getSportsNotificationsEnabledMap(
    supabase: SupabaseClient,
    userIds: string[]
) {
    const map = new Map<string, boolean>();
    if (!userIds.length) return map;

    const { data, error } = await supabase
        .from("user_notification_preferences")
        .select("user_id,sports_enabled")
        .in("user_id", userIds);

    if (error && !isMissingRelationError(error)) {
        throw new Error(error.message);
    }

    for (const userId of userIds) {
        map.set(userId, true);
    }
    for (const row of data || []) {
        map.set(String(row.user_id), row.sports_enabled !== false);
    }
    return map;
}

export function buildActivityNotificationDedupeKey(input: {
    type: UserNotificationType;
    activityId?: string | null;
    suffix?: string;
}) {
    const base = `${input.type}:${String(input.activityId || "na")}`;
    if (!input.suffix) return base;
    return `${base}:${input.suffix}`;
}

