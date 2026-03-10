export type ActivityRuleInput = {
    sport?: string | null;
    status?: string | null;
    start_time?: string | null;
    max_attendees?: number | null;
    attendees?: number | null;
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export function normalizeSportName(sport?: string | null) {
    return (sport || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

export function isRunningOrCyclingSport(sport?: string | null) {
    const normalized = normalizeSportName(sport);
    return ["running", "footing", "velo", "cycling"].includes(normalized);
}

export function isFootballOrBeachVolleySport(sport?: string | null) {
    const normalized = normalizeSportName(sport);
    return ["football", "foot", "beach volley", "beach-volley", "beachvolley"].includes(normalized);
}

export function getActivityStartMs(activity: ActivityRuleInput) {
    const start = new Date(activity.start_time || "").getTime();
    return Number.isNaN(start) ? null : start;
}

export function getUrgentChatOpenMs(activity: ActivityRuleInput) {
    const startMs = getActivityStartMs(activity);
    if (!startMs) return null;

    const startDate = new Date(startMs);
    const startHour = startDate.getHours();
    const isMorningActivity = startHour >= 6 && startHour < 12;

    if (isMorningActivity) {
        const dayBefore = new Date(startMs);
        dayBefore.setDate(dayBefore.getDate() - 1);
        dayBefore.setHours(20, 0, 0, 0);
        return dayBefore.getTime();
    }

    return startMs - TWO_HOURS_MS;
}

export function isGroupComplete(activity: ActivityRuleInput) {
    if (activity.status === "complet") return true;
    const max = typeof activity.max_attendees === "number" ? activity.max_attendees : null;
    const attendees = typeof activity.attendees === "number" ? activity.attendees : null;
    if (!max || max <= 0 || attendees === null) return false;
    return attendees >= max;
}

export function canAuthorizedMemberAccessChat(activity: ActivityRuleInput, nowMs = Date.now()) {
    const status = activity.status || "";
    if (status === "annulé") return false;

    const startMs = getActivityStartMs(activity);
    if (!startMs) return false;
    if (nowMs >= startMs) return true;

    if (isRunningOrCyclingSport(activity.sport)) {
        return nowMs >= (startMs - TWENTY_FOUR_HOURS_MS);
    }

    if (status === "confirmé" || isGroupComplete(activity)) {
        return true;
    }

    const urgentOpenMs = getUrgentChatOpenMs(activity);
    return urgentOpenMs !== null && nowMs >= urgentOpenMs;
}

export function canAuthorizedMemberViewExactLocation(activity: ActivityRuleInput, nowMs = Date.now()) {
    const status = activity.status || "";
    if (status === "annulé") return false;

    const startMs = getActivityStartMs(activity);
    if (!startMs) return false;

    if (isRunningOrCyclingSport(activity.sport)) {
        return nowMs >= (startMs - TWENTY_FOUR_HOURS_MS);
    }

    if (isFootballOrBeachVolleySport(activity.sport)) {
        return status === "confirmé" || isGroupComplete(activity);
    }

    return status === "confirmé" || isGroupComplete(activity);
}
