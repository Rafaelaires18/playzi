import type { SupabaseClient } from "@supabase/supabase-js";
import { canUsePlayziPlusFeature, getUserEntitlements } from "@/lib/billing/entitlements";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const FREE_ACTIVITY_CREATION_WEEKLY_LIMIT = 1;
export const ACTIVITY_CREATION_LIMIT_ERROR_CODE = "weekly_creation_limit_reached";
const APP_TIME_ZONE = "Europe/Zurich";

export type ActivityCreationAccess = "unlimited" | "standard" | "replacement" | "blocked";

type DateParts = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
};

export type ActivityCreationEligibility = {
    can_create_activity: boolean;
    has_unlimited_activity_creation: boolean;
    weekly_limit: number | null;
    created_this_week: number;
    replacement_available: boolean;
    creation_access: ActivityCreationAccess;
    week_starts_at: string;
    next_reset_at: string;
    upgrade_url: "/pricing";
};

type CreationEventRow = {
    id: string;
    deleted_without_participants_at: string | null;
};

function getZonedParts(date: Date, timeZone = APP_TIME_ZONE): DateParts {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const byType = new Map(parts.map((part) => [part.type, part.value]));

    return {
        year: Number(byType.get("year")),
        month: Number(byType.get("month")),
        day: Number(byType.get("day")),
        hour: Number(byType.get("hour")),
        minute: Number(byType.get("minute")),
        second: Number(byType.get("second")),
    };
}

function getTimeZoneOffsetMs(date: Date, timeZone = APP_TIME_ZONE) {
    const parts = getZonedParts(date, timeZone);
    const utcFromZonedParts = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
    );
    return utcFromZonedParts - date.getTime();
}

function zonedDateTimeToUtc(input: Omit<DateParts, "second"> & { second?: number }, timeZone = APP_TIME_ZONE) {
    const utcGuess = Date.UTC(
        input.year,
        input.month - 1,
        input.day,
        input.hour,
        input.minute,
        input.second || 0
    );
    const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
    return new Date(utcGuess - offset);
}

export function getSwissCalendarWeekBounds(now = new Date()) {
    const parts = getZonedParts(now);
    const zonedMiddayUtc = zonedDateTimeToUtc({
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: 12,
        minute: 0,
    });
    const dayOfWeek = zonedMiddayUtc.getUTCDay() || 7;
    const mondayDay = parts.day - (dayOfWeek - 1);

    const weekStart = zonedDateTimeToUtc({
        year: parts.year,
        month: parts.month,
        day: mondayDay,
        hour: 0,
        minute: 0,
    });
    const nextReset = zonedDateTimeToUtc({
        year: parts.year,
        month: parts.month,
        day: mondayDay + 7,
        hour: 0,
        minute: 0,
    });

    return {
        weekStartsAt: weekStart.toISOString(),
        nextResetAt: nextReset.toISOString(),
    };
}

export async function loadActivityCreationEventsThisWeek(
    supabase: SupabaseClient,
    userId: string,
    now = new Date()
) {
    const { weekStartsAt, nextResetAt } = getSwissCalendarWeekBounds(now);
    const { data, count, error } = await supabase
        .from("playzi_activity_creation_events")
        .select("id,deleted_without_participants_at", { count: "exact" })
        .eq("user_id", userId)
        .eq("week_starts_at", weekStartsAt)
        .order("created_at", { ascending: true })
        .returns<CreationEventRow[]>();

    if (error) throw error;

    return {
        createdThisWeek: Number(count || 0),
        events: data || [],
        weekStartsAt,
        nextResetAt,
    };
}

export async function getActivityCreationEligibility(
    supabase: SupabaseClient,
    userId: string
): Promise<ActivityCreationEligibility> {
    const entitlements = await getUserEntitlements(userId);
    const hasUnlimitedActivityCreation = canUsePlayziPlusFeature(entitlements, "unlimited_activity_creation");
    const { weekStartsAt, nextResetAt } = getSwissCalendarWeekBounds();

    if (hasUnlimitedActivityCreation) {
        return {
            can_create_activity: true,
            has_unlimited_activity_creation: true,
            weekly_limit: null,
            created_this_week: 0,
            replacement_available: false,
            creation_access: "unlimited",
            week_starts_at: weekStartsAt,
            next_reset_at: nextResetAt,
            upgrade_url: "/pricing",
        };
    }

    const { createdThisWeek, events } = await loadActivityCreationEventsThisWeek(supabase, userId);
    const firstEvent = events[0] || null;
    const replacementAvailable = createdThisWeek === 1 && firstEvent?.deleted_without_participants_at !== null;
    const canCreateActivity = createdThisWeek === 0 || replacementAvailable;
    const creationAccess: ActivityCreationAccess = createdThisWeek === 0
        ? "standard"
        : (replacementAvailable ? "replacement" : "blocked");

    return {
        can_create_activity: canCreateActivity,
        has_unlimited_activity_creation: false,
        weekly_limit: FREE_ACTIVITY_CREATION_WEEKLY_LIMIT,
        created_this_week: createdThisWeek,
        replacement_available: replacementAvailable,
        creation_access: creationAccess,
        week_starts_at: weekStartsAt,
        next_reset_at: nextResetAt,
        upgrade_url: "/pricing",
    };
}

export async function recordActivityCreationEvent(input: {
    userId: string;
    activityId: string;
    activityCreatedAt?: string | null;
}) {
    const db = createServiceRoleClient();
    const createdAt = input.activityCreatedAt || new Date().toISOString();
    const { weekStartsAt } = getSwissCalendarWeekBounds(new Date(createdAt));
    const { error } = await db
        .from("playzi_activity_creation_events")
        .insert({
            user_id: input.userId,
            activity_id: input.activityId,
            created_at: createdAt,
            week_starts_at: weekStartsAt,
            deleted_without_participants_at: null,
        });

    if (error) throw error;
}

export async function deleteActivityAfterCreationEventFailure(input: {
    userId: string;
    activityId: string;
}) {
    const db = createServiceRoleClient();
    const { error } = await db
        .from("activities")
        .delete()
        .eq("id", input.activityId)
        .eq("creator_id", input.userId);

    if (error) throw error;
}

export async function restoreActivityCreationEventAfterDeleteFailure(input: {
    userId: string;
    activityId: string;
}) {
    const db = createServiceRoleClient();
    const { error } = await db
        .from("playzi_activity_creation_events")
        .update({ deleted_without_participants_at: null })
        .eq("user_id", input.userId)
        .eq("activity_id", input.activityId);

    if (error) throw error;
}

export async function markActivityCreationEventDeletedWithoutParticipants(input: {
    userId: string;
    activityId: string;
}) {
    const db = createServiceRoleClient();
    const deletedAt = new Date().toISOString();
    const { data, error } = await db
        .from("playzi_activity_creation_events")
        .update({ deleted_without_participants_at: deletedAt })
        .eq("user_id", input.userId)
        .eq("activity_id", input.activityId)
        .is("deleted_without_participants_at", null)
        .select("id")
        .maybeSingle<{ id: string }>();

    if (error) throw error;
    if (!data?.id) {
        throw new Error("activity_creation_event_not_found");
    }
}
