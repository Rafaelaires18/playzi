import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getRankLabelFromPulse } from "@/lib/rank";
import { getViewerProfileAccessDecision } from "@/lib/profile-access";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { normalizeProfileTitleSelection, parseSelectionFromProfileRow } from "@/lib/profile-title-selection";
import { getBetaTitleStatusForUser } from "@/lib/beta-titles";
import { loadPulseTotalsByUserIds } from "@/lib/pulse";
import { BETA_TESTER_TITLE_ID, PLAYZI_COMMUNITY_TITLES } from "@/lib/titles";

type ChartPoint = {
    label: string;
    value: number;
    date_ms: number;
};

function getAllowedTitles(isBetaTester: boolean) {
    return PLAYZI_COMMUNITY_TITLES.filter((title) => title.id !== BETA_TESTER_TITLE_ID || isBetaTester);
}

type PulseRow = {
    signed_points: number | null;
    created_at: string | null;
};

const PROFILE_DEBUG_ENABLED = process.env.NODE_ENV !== "production";

function profileDebug(...args: unknown[]) {
    if (!PROFILE_DEBUG_ENABLED) return;
    console.log(...args);
}

function startOfDayMs(ms: number) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function formatDayLabel(ms: number) {
    return new Date(ms).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function formatWeekLabel(ms: number) {
    return new Date(ms).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatMonthLabel(ms: number) {
    return new Date(ms).toLocaleDateString("fr-FR", { month: "short" });
}

function buildSeriesFromBoundaries(
    rowsAsc: { ts: number; points: number }[],
    trustedTotalAllTime: number,
    rangeStartMs: number,
    boundaries: number[],
    labelFormatter: (ms: number) => string
): ChartPoint[] {
    const points: ChartPoint[] = [];
    let cursor = 0;
    const pointsInRange = rowsAsc.reduce((sum, row) => {
        if (row.ts < rangeStartMs) return sum;
        if (row.ts > boundaries[boundaries.length - 1]) return sum;
        return sum + row.points;
    }, 0);
    let running = trustedTotalAllTime - pointsInRange;

    for (let i = 0; i < boundaries.length; i += 1) {
        const bucketEnd = boundaries[i];
        while (cursor < rowsAsc.length && rowsAsc[cursor].ts <= bucketEnd) {
            if (rowsAsc[cursor].ts >= rangeStartMs) {
                running += rowsAsc[cursor].points;
            }
            cursor += 1;
        }
        points.push({ label: labelFormatter(bucketEnd), value: running, date_ms: bucketEnd });
    }

    return points;
}

function buildDailyBoundaries(nowMs: number, days: number) {
    const boundaries: number[] = [];
    const todayStart = startOfDayMs(nowMs);
    for (let i = days - 1; i >= 0; i -= 1) {
        const dayStart = todayStart - i * 24 * 60 * 60 * 1000;
        const dayEnd = dayStart + (24 * 60 * 60 * 1000 - 1);
        boundaries.push(i === 0 ? nowMs : dayEnd);
    }
    return {
        boundaries,
        rangeStartMs: todayStart - (days - 1) * 24 * 60 * 60 * 1000,
    };
}

function buildWeeklyBoundaries(nowMs: number, weeks: number) {
    const boundaries: number[] = [];
    const todayStart = startOfDayMs(nowMs);
    for (let i = weeks - 1; i >= 0; i -= 1) {
        const weekEnd = todayStart - i * 7 * 24 * 60 * 60 * 1000 + (24 * 60 * 60 * 1000 - 1);
        const boundary = i === 0 ? nowMs : weekEnd;
        boundaries.push(boundary);
    }
    return {
        boundaries,
        rangeStartMs: boundaries[0] - (7 * 24 * 60 * 60 * 1000 - 1),
    };
}

function buildMonthlyBoundaries(nowMs: number, months: number) {
    const boundaries: number[] = [];
    for (let i = months - 1; i >= 0; i -= 1) {
        const date = new Date(nowMs);
        date.setMonth(date.getMonth() - i);
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        boundaries.push(i === 0 ? nowMs : end);
    }
    const firstMonth = new Date(nowMs);
    firstMonth.setMonth(firstMonth.getMonth() - (months - 1));
    const rangeStartMs = new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1, 0, 0, 0, 0).getTime();
    return {
        boundaries,
        rangeStartMs,
    };
}

function resolveAvatarPublicUrl(
    rawAvatarUrl: string | null | undefined,
    db: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createSupabaseClient>
) {
    if (!rawAvatarUrl) return null;
    const value = rawAvatarUrl.trim();
    if (!value) return null;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;

    let objectPath = value;
    if (objectPath.startsWith("avatars/")) {
        objectPath = objectPath.slice("avatars/".length);
    }
    const marker = "/storage/v1/object/public/avatars/";
    const markerIndex = objectPath.indexOf(marker);
    if (markerIndex >= 0) {
        objectPath = objectPath.slice(markerIndex + marker.length);
    }
    const { data } = db.storage.from("avatars").getPublicUrl(objectPath);
    return data.publicUrl || null;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: profileId } = await params;
        const supabase = await createClient();
        const serviceRoleClient = (() => {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (!url || !key) return null;
            return createSupabaseClient(url, key, {
                auth: { persistSession: false, autoRefreshToken: false },
            });
        })();
        const db = serviceRoleClient ?? supabase;
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return createErrorResponse("Non autorisé", 401);
        const accessDecision = await getViewerProfileAccessDecision(db as never, user.id, profileId);
        if (accessDecision.access === "not_found") {
            return createErrorResponse("Profil introuvable", 404);
        }

        profileDebug("[PROFILE_DEBUG] profiles/[id] request", {
            viewer_user_id: user.id,
            profile_id: profileId,
            using_service_role: !!serviceRoleClient,
            access: accessDecision.access,
            reason: accessDecision.reason,
        });

        if (accessDecision.access === "locked") {
            const { data: summary, error: summaryError } = await db
                .from("profiles")
                .select("id, pseudo, avatar_url")
                .eq("id", profileId)
                .maybeSingle();

            if (summaryError || !summary) {
                return createErrorResponse("Profil introuvable", 404);
            }

            return createSuccessResponse(
                {
                    access: "locked",
                    profile_exists: true,
                    connection_state: accessDecision.connection_state,
                    profile_summary: {
                        id: summary.id,
                        pseudo: summary.pseudo || "utilisateur",
                        avatar_url: resolveAvatarPublicUrl(summary.avatar_url, db),
                    },
                },
                200
            );
        }

        let profileResult = await db
            .from("profiles")
            .select("id, first_name, last_name, pseudo, avatar_url, grade, primary_title_id, secondary_title_ids, seasonal_title_id")
            .eq("id", profileId)
            .maybeSingle();

        const needsTitleColumnsFallback = !!profileResult.error && (
            profileResult.error.code === "42703"
            || profileResult.error.code === "PGRST204"
            || String(profileResult.error.message || "").toLowerCase().includes("primary_title_id")
            || String(profileResult.error.message || "").toLowerCase().includes("secondary_title_ids")
            || String(profileResult.error.message || "").toLowerCase().includes("seasonal_title_id")
        );

        if (needsTitleColumnsFallback) {
            profileResult = await db
                .from("profiles")
                .select("id, first_name, last_name, pseudo, avatar_url, grade")
                .eq("id", profileId)
                .maybeSingle();
        }

        const { data: profile, error: profileError } = profileResult;

        if (profileError || !profile) {
            return createErrorResponse("Profil introuvable", 404);
        }

        const [
            { data: pulseRows },
            { count: connectionsCount },
            { count: joinedActivitiesCount },
            { count: createdActivitiesCount },
            { data: joinedSportsRows },
            { data: createdSportsRows },
        ] = await Promise.all([
            db
                .from("pulse_transactions")
                .select("signed_points,created_at")
                .eq("user_id", profileId)
                .order("created_at", { ascending: true }),
            db
                .from("user_connections")
                .select("id", { count: "exact", head: true })
                .or(`user_a.eq.${profileId},user_b.eq.${profileId}`),
            db
                .from("participations")
                .select("id", { count: "exact", head: true })
                .eq("user_id", profileId),
            db
                .from("activities")
                .select("id", { count: "exact", head: true })
                .eq("creator_id", profileId),
            db
                .from("participations")
                .select("activities!participations_activity_id_fkey(sport)")
                .eq("user_id", profileId),
            db
                .from("activities")
                .select("sport")
                .eq("creator_id", profileId),
        ]);

        const [pulseTotalsByUserId, betaTitle] = await Promise.all([
            loadPulseTotalsByUserIds([profileId], db),
            getBetaTitleStatusForUser(db as never, profileId),
        ]);
        const totalPulse = pulseTotalsByUserId.get(profileId) || 0;
        const rows = ((pulseRows || []) as PulseRow[])
            .map((row) => ({
                ts: row.created_at ? new Date(row.created_at).getTime() : NaN,
                points: Number(row.signed_points || 0),
            }))
            .filter((row) => Number.isFinite(row.ts))
            .sort((a, b) => a.ts - b.ts);
        const nowMs = Date.now();
        const boundaries1M = buildDailyBoundaries(nowMs, 30);
        const boundaries3M = buildWeeklyBoundaries(nowMs, 13);
        const boundaries6M = buildMonthlyBoundaries(nowMs, 6);
        const boundaries1A = buildMonthlyBoundaries(nowMs, 12);
        const series = {
            "1M": buildSeriesFromBoundaries(rows, totalPulse, boundaries1M.rangeStartMs, boundaries1M.boundaries, formatDayLabel),
            "3M": buildSeriesFromBoundaries(rows, totalPulse, boundaries3M.rangeStartMs, boundaries3M.boundaries, formatWeekLabel),
            "6M": buildSeriesFromBoundaries(rows, totalPulse, boundaries6M.rangeStartMs, boundaries6M.boundaries, formatMonthLabel),
            "1A": buildSeriesFromBoundaries(rows, totalPulse, boundaries1A.rangeStartMs, boundaries1A.boundaries, formatMonthLabel),
        };
        profileDebug("[PROFILE_DEBUG] profiles/[id] computed stats", {
            profile_id: profileId,
            connections_count: connectionsCount || 0,
            pulse_rows_count: rows.length,
            graph_user_id: profileId,
            pulse_total_user_id: profileId,
            stats_user_id: profileId,
            connections_user_id: profileId,
            favorite_sport_user_id: profileId,
            pulse_series_sizes: {
                "1M": series["1M"].length,
                "3M": series["3M"].length,
                "6M": series["6M"].length,
                "1A": series["1A"].length,
            },
            pulse_series_samples: {
                "1M_first": series["1M"][0]?.value ?? null,
                "1M_last": series["1M"][series["1M"].length - 1]?.value ?? null,
                "3M_first": series["3M"][0]?.value ?? null,
                "3M_last": series["3M"][series["3M"].length - 1]?.value ?? null,
            },
        });
        const normalizedSport = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const sportDisplay = (value: string) => {
            const normalized = normalizedSport(value);
            if (["football", "foot"].includes(normalized)) return "Football";
            if (["running", "footing"].includes(normalized)) return "Running";
            if (["velo", "cycling", "cyclisme"].includes(normalized)) return "Cyclisme";
            if (["beach volley", "beach-volley", "beachvolley"].includes(normalized)) return "Beach volley";
            return value;
        };
        const sportCounts = new Map<string, { sport: string; count: number }>();
        for (const row of (joinedSportsRows || []) as Array<{ activities?: { sport?: string | null } | null }>) {
            const sport = row.activities?.sport;
            if (!sport) continue;
            const key = normalizedSport(sport);
            const current = sportCounts.get(key);
            sportCounts.set(key, { sport: sportDisplay(sport), count: (current?.count || 0) + 1 });
        }
        for (const row of (createdSportsRows || []) as Array<{ sport?: string | null }>) {
            const sport = row.sport;
            if (!sport) continue;
            const key = normalizedSport(sport);
            const current = sportCounts.get(key);
            sportCounts.set(key, { sport: sportDisplay(sport), count: (current?.count || 0) + 1 });
        }
        const favoriteSport = Array.from(sportCounts.values()).sort((a, b) => b.count - a.count)[0]?.sport || null;
        const allowedTitles = getAllowedTitles(betaTitle.isBetaTester);
        const titleSelection = "primary_title_id" in profile
            ? parseSelectionFromProfileRow(profile as { primary_title_id?: string | null; secondary_title_ids?: string[] | null; seasonal_title_id?: string | null }, allowedTitles)
            : normalizeProfileTitleSelection(null, allowedTitles);
        const resolvedAvatarUrl = resolveAvatarPublicUrl(profile.avatar_url, db);
        profileDebug("[PROFILE_DEBUG] profiles/[id] title selection", {
            profile_id: profileId,
            primary_title_id: titleSelection.primaryId,
            secondary_title_ids: titleSelection.secondaryIds,
            seasonal_title_id: titleSelection.seasonalId,
        });
        profileDebug("[PROFILE_DEBUG] profiles/[id] avatar", {
            profile_id: profileId,
            raw_avatar_url: profile.avatar_url || null,
            resolved_avatar_url: resolvedAvatarUrl,
        });

        const connectionState = accessDecision.connection_state;

        return createSuccessResponse(
            {
                access: "full",
                access_reason: accessDecision.reason,
                profile: {
                    id: profile.id,
                    first_name: profile.first_name,
                    last_name: profile.last_name,
                    pseudo: profile.pseudo,
                    avatar_url: resolvedAvatarUrl,
                    grade: profile.grade,
                    total_pulse: totalPulse,
                    rank_label: getRankLabelFromPulse(totalPulse),
                },
                title_selection: titleSelection,
                beta_title: betaTitle,
                connection_state: connectionState,
                pulse_series: series,
                stats: {
                    connections: connectionsCount || 0,
                    joined_activities: joinedActivitiesCount || 0,
                    created_activities: createdActivitiesCount || 0,
                },
                favorite_sport: favoriteSport,
            },
            200
        );
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
