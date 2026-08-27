export type NotificationActivityState = {
    status?: string | null;
    start_time?: string | null;
};

export function isNotificationActivityPast(
    activity: NotificationActivityState | null | undefined,
    nowMs = Date.now()
) {
    if (!activity) return false;

    const status = String(activity.status || "").trim().toLowerCase();
    if (status === "annulé" || status === "annule" || status === "cancelled") return true;
    if (status === "passé" || status === "passe" || status === "completed") return true;

    const startMs = new Date(activity.start_time || "").getTime();
    return Number.isFinite(startMs) && startMs <= nowMs;
}
