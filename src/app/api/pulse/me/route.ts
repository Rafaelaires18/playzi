import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { loadPulseTotalsByUserIds } from "@/lib/pulse";

type ChartPoint = {
    label: string;
    value: number;
    date_ms: number;
};

type PulseRows = {
    signed_points: number | null;
    created_at: string | null;
    reason_code: string | null;
    reason_label: string | null;
    activity_id: string | null;
};

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
) {
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

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const { data: txRows, error: txErr } = await supabase
            .from("pulse_transactions")
            .select("signed_points,created_at,reason_code,reason_label,activity_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });
        if (txErr) {
            return createErrorResponse(
                "Impossible de charger les transactions Pulse",
                400,
                txErr.message
            );
        }

        const rows = ((txRows || []) as PulseRows[])
            .map((row) => ({
                ts: row.created_at ? new Date(row.created_at).getTime() : NaN,
                points: Number(row.signed_points || 0),
                reason_code: row.reason_code,
                reason_label: row.reason_label,
                activity_id: row.activity_id,
                created_at: row.created_at,
            }))
            .filter((row) => Number.isFinite(row.ts))
            .sort((a, b) => a.ts - b.ts);

        const totalPulseByUserId = await loadPulseTotalsByUserIds([user.id], supabase);
        const totalPulse = totalPulseByUserId.get(user.id) || 0;
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

        const recentTransactions = rows
            .slice(-30)
            .reverse()
            .map((row) => ({
                created_at: row.created_at,
                signed_points: row.points,
                reason_code: row.reason_code,
                reason_label: row.reason_label,
                activity_id: row.activity_id,
            }));

        return createSuccessResponse(
            {
                total_pulse: totalPulse,
                series,
                recent_transactions: recentTransactions,
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
