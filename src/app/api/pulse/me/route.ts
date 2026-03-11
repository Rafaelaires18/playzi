import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

type ChartPoint = {
    label: string;
    value: number;
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

function buildBucketedSeries(
    rowsAsc: { ts: number; points: number }[],
    totalAllTime: number,
    nowMs: number,
    rangeDays: number,
    buckets: number,
    prefix: "S" | "M"
): ChartPoint[] {
    const startMs = startOfDayMs(nowMs - rangeDays * 24 * 60 * 60 * 1000);
    const endMs = nowMs;
    const rangeMs = endMs - startMs;
    const bucketSpan = Math.max(1, Math.floor(rangeMs / buckets));

    let totalBeforeRange = totalAllTime;
    for (const row of rowsAsc) {
        if (row.ts >= startMs) break;
        totalBeforeRange -= row.points;
    }

    const points: ChartPoint[] = [];
    let cursor = 0;
    let running = totalBeforeRange;

    for (let i = 0; i < buckets; i += 1) {
        const bucketEnd = i === buckets - 1 ? endMs : startMs + (i + 1) * bucketSpan;
        while (cursor < rowsAsc.length && rowsAsc[cursor].ts <= bucketEnd) {
            if (rowsAsc[cursor].ts >= startMs) {
                running += rowsAsc[cursor].points;
            }
            cursor += 1;
        }
        points.push({ label: `${prefix}${i + 1}`, value: running });
    }

    return points;
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
            return createErrorResponse("Impossible de charger les transactions Pulse", 400, txErr.message);
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

        const totalPulse = rows.reduce((sum, row) => sum + row.points, 0);
        const nowMs = Date.now();

        const series = {
            "1M": buildBucketedSeries(rows, totalPulse, nowMs, 30, 4, "S"),
            "3M": buildBucketedSeries(rows, totalPulse, nowMs, 90, 12, "S"),
            "6M": buildBucketedSeries(rows, totalPulse, nowMs, 180, 6, "M"),
            "1A": buildBucketedSeries(rows, totalPulse, nowMs, 365, 12, "M"),
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

