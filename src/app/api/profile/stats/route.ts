import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

type ActivityLite = {
    id: string;
    sport: string | null;
    start_time: string | null;
    status: string | null;
    creator_id: string | null;
    max_attendees: number | null;
    distance: number | null;
    session_type: string | null;
    tags: string[] | null;
};

type SportMetric = {
    key: string;
    label: string;
    value: number;
    unit?: string;
    type?: "count" | "distance";
};

type SportBreakdownItem = {
    sport_key: string;
    sport_label: string;
    metrics: SportMetric[];
};

type WeeklyStreakSnapshot = {
    streakWeeks: number;
    currentWeekValidated: boolean;
    isLastDayToKeepStreak: boolean;
    weekStartIso: string;
    weekEndIso: string;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toWeekStartMs(timestampMs: number) {
    const d = new Date(timestampMs);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sunday
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + mondayOffset);
    return d.getTime();
}

function normalizeSport(value: string | null | undefined) {
    return (value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function displaySport(value: string | null | undefined) {
    const normalized = normalizeSport(value);
    if (["football", "foot"].includes(normalized)) return "Football";
    if (["running", "footing"].includes(normalized)) return "Running";
    if (["velo", "cycling", "cyclisme"].includes(normalized)) return "Cyclisme";
    if (["beach volley", "beach-volley", "beachvolley", "volley", "volleyball"].includes(normalized)) return "Beach-volley";
    if (!value || !value.trim()) return "—";
    return value;
}

function computeWeeklyStreak(activities: ActivityLite[], nowMs: number) {
    return computeWeeklyStreakSnapshot(activities, nowMs).streakWeeks;
}

function computeWeeklyStreakSnapshot(activities: ActivityLite[], nowMs: number): WeeklyStreakSnapshot {
    const weeksWithActivity = new Set<number>();
    for (const activity of activities) {
        if (!activity.start_time) continue;
        const startMs = new Date(activity.start_time).getTime();
        if (!Number.isFinite(startMs) || startMs > nowMs) continue;
        weeksWithActivity.add(toWeekStartMs(startMs));
    }

    const currentWeekStart = toWeekStartMs(nowMs);
    const previousWeekStart = currentWeekStart - WEEK_MS;
    const currentWeekValidated = weeksWithActivity.has(currentWeekStart);
    const previousWeekValidated = weeksWithActivity.has(previousWeekStart);

    // Streak remains alive during the current week as long as last week was validated.
    let streak = 0;
    let cursor = currentWeekValidated ? currentWeekStart : previousWeekStart;
    while (weeksWithActivity.has(cursor)) {
        streak += 1;
        cursor -= WEEK_MS;
    }

    const nowDate = new Date(nowMs);
    const isSunday = nowDate.getDay() === 0;
    const isLastDayToKeepStreak = isSunday && !currentWeekValidated && previousWeekValidated;
    const weekStartDate = new Date(currentWeekStart);
    const weekEndDate = new Date(currentWeekStart + (WEEK_MS - 1));

    return {
        streakWeeks: streak,
        currentWeekValidated,
        isLastDayToKeepStreak,
        weekStartIso: weekStartDate.toISOString(),
        weekEndIso: weekEndDate.toISOString(),
    };
}

function pickFavoriteSport(activities: ActivityLite[]) {
    const counts = new Map<string, { label: string; count: number }>();
    for (const activity of activities) {
        const key = normalizeSport(activity.sport);
        if (!key) continue;
        const current = counts.get(key);
        counts.set(key, { label: displaySport(activity.sport), count: (current?.count || 0) + 1 });
    }
    const winner = Array.from(counts.values()).sort((a, b) => b.count - a.count)[0];
    return winner?.label || "—";
}

function getSessionMetricLabel(normalizedSport: string) {
    if (["randonnee", "hiking", "trek", "trekking", "marche", "walking"].includes(normalizedSport)) {
        return "sorties";
    }
    return "sessions";
}

function supportsDistanceMetric(normalizedSport: string) {
    return ["running", "footing", "velo", "cycling", "cyclisme"].includes(normalizedSport);
}

function buildSportsBreakdown(activities: ActivityLite[]): SportBreakdownItem[] {
    const grouped = new Map<string, { sport_label: string; sessions: number; distance_km: number }>();

    for (const activity of activities) {
        const sportKey = normalizeSport(activity.sport);
        if (!sportKey) continue;
        const current = grouped.get(sportKey) || {
            sport_label: displaySport(activity.sport),
            sessions: 0,
            distance_km: 0,
        };
        current.sessions += 1;
        current.distance_km += Math.max(0, Number(activity.distance || 0));
        grouped.set(sportKey, current);
    }

    return Array.from(grouped.entries())
        .sort((a, b) => {
            const aSessions = a[1].sessions;
            const bSessions = b[1].sessions;
            if (bSessions !== aSessions) return bSessions - aSessions;
            return a[1].sport_label.localeCompare(b[1].sport_label, "fr", { sensitivity: "base" });
        })
        .map(([sport_key, aggregate]) => {
            const metrics: SportMetric[] = [
                {
                    key: "sessions",
                    label: getSessionMetricLabel(sport_key),
                    value: aggregate.sessions,
                    type: "count",
                },
            ];

            const roundedDistanceKm = Math.round(aggregate.distance_km);
            if (supportsDistanceMetric(sport_key) && roundedDistanceKm > 0) {
                metrics.push({
                    key: "distance_km",
                    label: "distance totale",
                    value: roundedDistanceKm,
                    unit: "km",
                    type: "distance",
                });
            }

            return {
                sport_key,
                sport_label: aggregate.sport_label,
                metrics,
            };
        });
}

function monthBounds(date: Date) {
    const startMs = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime();
    const endMs = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
    return { startMs, endMs };
}

function formatMonthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthlySummary(
    activities: ActivityLite[],
    pulseRows: Array<{ signed_points: number | null; created_at: string | null }>,
    monthDate: Date,
    nowMs: number
) {
    const { startMs, endMs } = monthBounds(monthDate);
    const monthlyValidatedActivities = activities.filter((activity) => {
        if (!activity.start_time) return false;
        const startTime = new Date(activity.start_time).getTime();
        return Number.isFinite(startTime) && startTime >= startMs && startTime < endMs;
    });
    const pulseGained = pulseRows
        .filter((row) => {
            if (!row.created_at) return false;
            const ts = new Date(row.created_at).getTime();
            return Number.isFinite(ts) && ts >= startMs && ts < endMs;
        })
        .reduce((sum, row) => sum + Number(row.signed_points || 0), 0);
    const playziEvents = monthlyValidatedActivities.filter((activity) => {
        const sessionType = (activity.session_type || "").toLowerCase();
        if (sessionType.includes("playzi") || sessionType.includes("event")) return true;
        return Array.isArray(activity.tags) && activity.tags.some((tag) => {
            const normalized = String(tag || "").toLowerCase();
            return normalized.includes("playzi") || normalized.includes("event");
        });
    }).length;
    return {
        month_key: formatMonthKey(monthDate),
        activities_count: monthlyValidatedActivities.length,
        streak_weeks: computeWeeklyStreak(monthlyValidatedActivities, nowMs),
        main_sport: pickFavoriteSport(monthlyValidatedActivities),
        pulse_gained: pulseGained,
        playzi_events: playziEvents,
    };
}

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const userId = user.id;

        const [
            { count: createdCount, error: createdError },
            { data: myParticipations, error: participationError },
            { count: connectionsAsA, error: connAError },
            { count: connectionsAsB, error: connBError },
            { data: createdActivitiesRaw, error: createdActivitiesError },
            { data: pulseRowsRaw, error: pulseRowsError },
        ] = await Promise.all([
            supabase
                .from("activities")
                .select("id", { count: "exact", head: true })
                .eq("creator_id", userId),
            supabase
                .from("participations")
                .select("activity_id")
                .eq("user_id", userId)
                .eq("status", "confirmé"),
            supabase
                .from("user_connections")
                .select("id", { count: "exact", head: true })
                .eq("user_a", userId),
            supabase
                .from("user_connections")
                .select("id", { count: "exact", head: true })
                .eq("user_b", userId),
            supabase
                .from("activities")
                .select("id,sport,start_time,status,creator_id,max_attendees,distance,session_type,tags")
                .eq("creator_id", userId),
            supabase
                .from("pulse_transactions")
                .select("signed_points,created_at,reason_code")
                .eq("user_id", userId),
        ]);

        if (createdError || participationError || connAError || connBError || createdActivitiesError || pulseRowsError) {
            return createErrorResponse("Impossible de charger les statistiques du profil", 400);
        }

        const joinedCount = (myParticipations || []).length;
        const connectionCount = (connectionsAsA || 0) + (connectionsAsB || 0);

        const joinedActivityIds = (myParticipations || []).map((p) => p.activity_id).filter(Boolean);
        const [{ data: myCreatedActivities, error: myCreatedError }, { data: joinedActivitiesRaw, error: joinedActivitiesError }] = await Promise.all([
            supabase
                .from("activities")
                .select("id")
                .eq("creator_id", userId),
            joinedActivityIds.length > 0
                ? supabase
                    .from("activities")
                    .select("id,sport,start_time,status,creator_id,max_attendees,distance,session_type,tags")
                    .in("id", joinedActivityIds)
                : Promise.resolve({ data: [] as ActivityLite[], error: null }),
        ]);

        if (myCreatedError || joinedActivitiesError) {
            return createErrorResponse(
                "Impossible de charger les activités créées",
                400,
                myCreatedError?.message || joinedActivitiesError?.message
            );
        }

        const relatedActivityIds = new Set<string>();
        for (const row of myCreatedActivities || []) {
            if (row.id) relatedActivityIds.add(row.id);
        }
        for (const row of myParticipations || []) {
            if (row.activity_id) relatedActivityIds.add(row.activity_id);
        }

        let peopleMetCount = 0;
        if (relatedActivityIds.size > 0) {
            const activityIds = Array.from(relatedActivityIds);
            const [{ data: activityCreators, error: creatorLoadError }, { data: participants, error: participantLoadError }] = await Promise.all([
                supabase
                    .from("activities")
                    .select("id,creator_id")
                    .in("id", activityIds),
                supabase
                    .from("participations")
                    .select("activity_id,user_id,status")
                    .in("activity_id", activityIds)
                    .eq("status", "confirmé"),
            ]);

            if (creatorLoadError || participantLoadError) {
                return createErrorResponse("Impossible de charger les personnes rencontrées", 400);
            }

            const metIds = new Set<string>();
            for (const row of activityCreators || []) {
                if (row.creator_id && row.creator_id !== userId) {
                    metIds.add(row.creator_id);
                }
            }
            for (const row of participants || []) {
                if (row.user_id && row.user_id !== userId) {
                    metIds.add(row.user_id);
                }
            }
            peopleMetCount = metIds.size;
        }

        const nowMs = Date.now();
        const validStatuses = new Set(["confirmé", "complet", "passé"]);
        const combinedActivityById = new Map<string, ActivityLite>();
        for (const row of (createdActivitiesRaw || []) as ActivityLite[]) {
            if (!row?.id) continue;
            combinedActivityById.set(row.id, row);
        }
        for (const row of (joinedActivitiesRaw || []) as ActivityLite[]) {
            if (!row?.id) continue;
            combinedActivityById.set(row.id, row);
        }

        const validatedActivities = Array.from(combinedActivityById.values()).filter((activity) => {
            if (!activity.start_time) return false;
            const startMs = new Date(activity.start_time).getTime();
            if (!Number.isFinite(startMs) || startMs > nowMs) return false;
            if (activity.status === "annulé") return false;
            return validStatuses.has(String(activity.status || "").toLowerCase());
        });

        const pulseRows = (pulseRowsRaw || []) as Array<{ signed_points: number | null; created_at: string | null; reason_code?: string | null }>;
        const streakSnapshot = computeWeeklyStreakSnapshot(validatedActivities, nowMs);
        const streakWeeks = streakSnapshot.streakWeeks;
        const favoriteSport = pickFavoriteSport(validatedActivities);

        const presenceConfirmedCount = pulseRows.filter((row) => row.reason_code === "presence_confirmed").length;
        const noShowConfirmedCount = pulseRows.filter((row) => row.reason_code === "no_show_confirmed").length;
        const attendanceDenominator = presenceConfirmedCount + noShowConfirmedCount;
        const attendanceRate = attendanceDenominator > 0
            ? Math.round((presenceConfirmedCount / attendanceDenominator) * 100)
            : 100;

        const runningKm = Math.round(validatedActivities
            .filter((activity) => ["running", "footing"].includes(normalizeSport(activity.sport)))
            .reduce((sum, activity) => sum + Number(activity.distance || 0), 0));
        const cyclingKm = Math.round(validatedActivities
            .filter((activity) => ["velo", "cycling", "cyclisme"].includes(normalizeSport(activity.sport)))
            .reduce((sum, activity) => sum + Number(activity.distance || 0), 0));
        const collectiveSessions = validatedActivities.filter((activity) => Number(activity.max_attendees || 0) > 1).length;
        const playziEventsCount = validatedActivities.filter((activity) => {
            const sessionType = (activity.session_type || "").toLowerCase();
            if (sessionType.includes("playzi") || sessionType.includes("event")) return true;
            return Array.isArray(activity.tags) && activity.tags.some((tag) => {
                const normalized = String(tag || "").toLowerCase();
                return normalized.includes("playzi") || normalized.includes("event");
            });
        }).length;
        const sportsBreakdown = buildSportsBreakdown(validatedActivities);

        const currentMonthDate = new Date(nowMs);
        const previousMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
        const currentMonthSummary = buildMonthlySummary(validatedActivities, pulseRows, currentMonthDate, nowMs);
        const previousMonthSummary = buildMonthlySummary(validatedActivities, pulseRows, previousMonthDate, nowMs);
        const { data: previousMonthReadRow } = await supabase
            .from("monthly_summary_reads")
            .select("month_key")
            .eq("user_id", userId)
            .eq("month_key", previousMonthSummary.month_key)
            .maybeSingle();
        const monthlyNotificationAvailable = !previousMonthReadRow;
        const streakLastDayNotificationAvailable = streakSnapshot.isLastDayToKeepStreak && streakWeeks > 0;

        return createSuccessResponse(
            {
                activities_created: createdCount || 0,
                activities_joined: joinedCount,
                connections_total: connectionCount,
                people_met: peopleMetCount,
                streak_weeks: streakWeeks,
                streak_status: {
                    streak_weeks: streakWeeks,
                    current_week_validated: streakSnapshot.currentWeekValidated,
                    is_last_day_to_keep_streak: streakSnapshot.isLastDayToKeepStreak,
                    week_start: streakSnapshot.weekStartIso,
                    week_end: streakSnapshot.weekEndIso,
                },
                favorite_sport: favoriteSport,
                sports_breakdown: sportsBreakdown,
                stats: {
                    attendance_rate: attendanceRate,
                    collective_sessions: collectiveSessions,
                    running_km: runningKm,
                    cycling_km: cyclingKm,
                    playzi_events: playziEventsCount,
                    no_show_confirmed: noShowConfirmedCount,
                    presence_confirmed: presenceConfirmedCount,
                },
                monthly_summary: currentMonthSummary,
                previous_month_summary: previousMonthSummary,
                monthly_notification: {
                    available: monthlyNotificationAvailable,
                    month_key: previousMonthSummary.month_key,
                    title: "Résumé mensuel disponible",
                    body: `Votre résumé du mois de ${new Date(`${previousMonthSummary.month_key}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "long" })} est disponible`,
                },
                streak_notification: {
                    available: streakLastDayNotificationAvailable,
                    type: "streak_last_day_warning",
                    title: "Dernier jour pour garder ton streak",
                    body: "Il te reste aujourd'hui pour garder ton streak.",
                    metadata: {
                        week_start: streakSnapshot.weekStartIso,
                        week_end: streakSnapshot.weekEndIso,
                        streak_weeks: streakWeeks,
                    },
                },
            },
            200
        );
    } catch (error) {
        return createErrorResponse(
            "Erreur interne",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}
