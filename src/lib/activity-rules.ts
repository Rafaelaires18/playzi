export type ActivityRuleInput = {
    sport?: string | null;
    status?: string | null;
    start_time?: string | null;
    max_attendees?: number | null;
    attendees?: number | null;
};

type SportRule = {
    soloCapable: boolean;
};

const SPORT_RULES: Record<string, SportRule> = {
    running: { soloCapable: true },
    footing: { soloCapable: true },
    velo: { soloCapable: true },
    cycling: { soloCapable: true },
    football: { soloCapable: false },
    foot: { soloCapable: false },
    "beach volley": { soloCapable: false },
    "beach-volley": { soloCapable: false },
    beachvolley: { soloCapable: false },
};

export type ComputedActivityStatus =
    | "cancelled"
    | "completed"
    | "confirmed"
    | "full"
    | "pending"
    | "open"
    | "unknown";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const PLAYZI_TIMEZONE = "Europe/Zurich";

type ZonedParts = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
};

const ZONED_FORMATTER = new Intl.DateTimeFormat("en-GB", {
    timeZone: PLAYZI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
});

function getZonedPartsFromMs(ms: number): ZonedParts {
    const parts = ZONED_FORMATTER.formatToParts(new Date(ms));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((p) => p.type === type)?.value || 0);

    return {
        year: part("year"),
        month: part("month"),
        day: part("day"),
        hour: part("hour"),
        minute: part("minute"),
        second: part("second"),
    };
}

function zonedDateTimeToUtcMs(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second = 0
) {
    // Convert "local time in Europe/Zurich" to UTC ms without adding external deps.
    let guess = Date.UTC(year, month - 1, day, hour, minute, second);
    const target = Date.UTC(year, month - 1, day, hour, minute, second);

    for (let i = 0; i < 4; i += 1) {
        const zoned = getZonedPartsFromMs(guess);
        const seen = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
        const diff = target - seen;
        if (diff === 0) return guess;
        guess += diff;
    }

    return guess;
}

export function normalizeSportName(sport?: string | null) {
    return (sport || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

export function isRunningOrCyclingSport(sport?: string | null) {
    return isSoloCapableSport(sport);
}

export function isSoloCapableSport(sport?: string | null) {
    const normalized = normalizeSportName(sport);
    return !!SPORT_RULES[normalized]?.soloCapable;
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

    const startLocal = getZonedPartsFromMs(startMs);
    // Morning rule: from 00:01 to 11:59 local Europe/Zurich.
    const isMorningActivity = startLocal.hour < 12 && !(startLocal.hour === 0 && startLocal.minute === 0);

    if (isMorningActivity) {
        const dayBeforeUtcNoon = Date.UTC(startLocal.year, startLocal.month - 1, startLocal.day - 1, 12, 0, 0);
        const dayBeforeLocal = getZonedPartsFromMs(dayBeforeUtcNoon);
        return zonedDateTimeToUtcMs(
            dayBeforeLocal.year,
            dayBeforeLocal.month,
            dayBeforeLocal.day,
            20,
            0,
            0
        );
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

export function getActivityComputedStatus(
    activity: ActivityRuleInput,
    options?: { nowMs?: number; pastBufferMs?: number }
): ComputedActivityStatus {
    const nowMs = options?.nowMs ?? Date.now();
    const pastBufferMs = options?.pastBufferMs ?? 0;
    const status = String(activity.status || "");
    const startMs = getActivityStartMs(activity);

    if (status === "annulé") return "cancelled";
    if (status === "passé") return "completed";

    if (startMs !== null && Number.isFinite(startMs) && nowMs >= (startMs + pastBufferMs)) {
        return "completed";
    }

    if (status === "complet" || isGroupComplete(activity)) return "full";
    if (status === "confirmé") return "confirmed";
    if (status === "en_attente") return "pending";
    if (status === "ouvert") return "open";
    return "unknown";
}

export function isSoloCompletedWithoutPeers(input: { sport?: string | null; attendees?: number | null }) {
    const attendees = Number(input.attendees || 0);
    return isSoloCapableSport(input.sport) && attendees <= 1;
}

export function resolveStartedPendingActivityStatus(input: {
    sport?: string | null;
    max_attendees?: number | null;
    confirmed_participants?: number | null;
}) {
    if (isSoloCapableSport(input.sport)) {
        return "confirmé" as const;
    }

    const maxAttendees = Number(input.max_attendees || 0);
    const confirmedParticipants = Number(input.confirmed_participants || 0);
    const attendees = 1 + confirmedParticipants; // creator + confirmed participants
    const isFull = maxAttendees > 0 && attendees >= maxAttendees;
    return isFull ? ("complet" as const) : ("annulé" as const);
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
