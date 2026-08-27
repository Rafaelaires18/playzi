import type { SupabaseClient } from "@supabase/supabase-js";
import {
    isWebPushConfigured,
    sendWebPushNotification,
    type WebPushSubscriptionInput,
} from "@/lib/web-push";
import { formatActivitySportLabel } from "@/lib/sport-labels";

export const USER_NOTIFICATION_TYPES = {
    NEW_ACTIVITY_NEARBY: "new_activity_nearby",
    PARTICIPANT_JOINED: "participant_joined",
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

type ActivityNotificationSource = {
    id?: string | null;
    sport?: string | null;
    start_time?: string | null;
};

type WebPushSubscriptionRow = {
    user_id?: unknown;
    endpoint?: unknown;
    p256dh?: unknown;
    auth?: unknown;
};

const ACTIVITY_NOTIFICATION_TIME_ZONE = "Europe/Zurich";

function isMissingRelationError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error || "");
    return message.includes("relation") && message.includes("does not exist");
}

function getCalendarParts(date: Date) {
    const parts = new Intl.DateTimeFormat("fr-FR", {
        timeZone: ACTIVITY_NOTIFICATION_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    return {
        year: getPart("year"),
        month: getPart("month"),
        day: getPart("day"),
    };
}

function calendarDayNumber(parts: { year: number; month: number; day: number }) {
    return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / (24 * 60 * 60 * 1000));
}

function formatActivityDay(date: Date) {
    const now = new Date();
    const today = calendarDayNumber(getCalendarParts(now));
    const target = calendarDayNumber(getCalendarParts(date));
    const dayDiff = target - today;

    if (dayDiff === 0) return "Aujourd’hui";
    if (dayDiff === 1) return "Demain";
    if (dayDiff > 1 && dayDiff < 7) {
        const weekday = new Intl.DateTimeFormat("fr-FR", {
            timeZone: ACTIVITY_NOTIFICATION_TIME_ZONE,
            weekday: "long",
        }).format(date);
        return `${weekday.charAt(0).toLocaleUpperCase("fr-FR")}${weekday.slice(1)}`;
    }
    return new Intl.DateTimeFormat("fr-FR", {
        timeZone: ACTIVITY_NOTIFICATION_TIME_ZONE,
        day: "2-digit",
        month: "short",
    }).format(date);
}

function formatActivityTime(date: Date) {
    return new Intl.DateTimeFormat("fr-FR", {
        timeZone: ACTIVITY_NOTIFICATION_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date).replace(":", "h");
}

export function buildActivityNotificationTitle(activity: ActivityNotificationSource) {
    const sport = formatActivitySportLabel(activity.sport);
    const startDate = activity.start_time ? new Date(activity.start_time) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) return sport;
    return `${sport} · ${formatActivityDay(startDate)} à ${formatActivityTime(startDate)}`;
}

export function buildActivityNotificationUrl(activityId?: string | null) {
    const id = String(activityId || "").trim();
    if (!id) return "/notifications";
    return `/activities?focus=${encodeURIComponent(id)}`;
}

export function buildActivityPushPayload(input: {
    type: UserNotificationType | string;
    activity_id?: string | null;
    title: string;
    body: string;
    url?: string;
}) {
    return {
        type: input.type,
        activity_id: input.activity_id || null,
        title: input.title,
        body: input.body,
        url: input.url || buildActivityNotificationUrl(input.activity_id),
    };
}

export async function createUserNotifications(
    supabase: SupabaseClient,
    rows: NotificationInsert[]
) {
    if (!rows.length) return;
    const { data, error } = await supabase
        .from("user_notifications")
        .upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
        .select("user_id,type,title,message,activity_id,dedupe_key");
    if (error && !isMissingRelationError(error)) {
        throw new Error(error.message);
    }

    const insertedRows = Array.isArray(data) ? data : [];
    if (insertedRows.length > 0) {
        await sendUserNotificationPushes(supabase, insertedRows as NotificationInsert[]);
    }
}

async function sendUserNotificationPushes(supabase: SupabaseClient, rows: NotificationInsert[]) {
    if (!isWebPushConfigured()) return;

    const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
    if (userIds.length === 0) return;

    const { data: subscriptions, error } = await supabase
        .from("web_push_subscriptions")
        .select("user_id,endpoint,p256dh,auth")
        .in("user_id", userIds)
        .is("disabled_at", null);

    if (error) {
        if (!isMissingRelationError(error)) {
            console.warn("[USER_NOTIFICATIONS] push subscriptions query failed:", error.message);
        }
        return;
    }

    const subscriptionsByUserId = new Map<string, WebPushSubscriptionInput[]>();
    for (const row of (subscriptions || []) as WebPushSubscriptionRow[]) {
        const userId = String(row.user_id || "");
        const subscription = {
            endpoint: String(row.endpoint || ""),
            keys: {
                p256dh: String(row.p256dh || ""),
                auth: String(row.auth || ""),
            },
        };
        if (!userId || !subscription.endpoint || !subscription.keys.p256dh || !subscription.keys.auth) continue;
        const current = subscriptionsByUserId.get(userId) || [];
        current.push(subscription);
        subscriptionsByUserId.set(userId, current);
    }

    await Promise.all(rows.map(async (row) => {
        const subscriptionsForUser = subscriptionsByUserId.get(row.user_id) || [];
        if (subscriptionsForUser.length === 0) return;
        const payload = buildActivityPushPayload({
            type: row.type,
            activity_id: row.activity_id || null,
            title: row.title,
            body: row.message,
        });
        await Promise.all(subscriptionsForUser.map(async (subscription) => {
            try {
                await sendWebPushNotification(subscription, payload);
            } catch (error) {
                console.warn("[USER_NOTIFICATIONS] web push failed:", error instanceof Error ? error.message : error);
            }
        }));
    }));
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
