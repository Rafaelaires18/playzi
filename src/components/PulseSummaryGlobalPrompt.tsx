"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type BreakdownItem = {
    reason_code?: string;
    reason_label?: string;
    signed_points?: number;
};

type SummaryPayload = {
    activity_id: string;
    total_points: number;
    breakdown: BreakdownItem[];
    created_at: string;
};

const LAST_SEEN_KEY = "playzi_last_seen_pulse_summary_at";

function parseTimestamp(value: string | null) {
    if (!value) return 0;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
}

export default function PulseSummaryGlobalPrompt() {
    const [summary, setSummary] = useState<SummaryPayload | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const markSeen = useCallback((createdAt: string) => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(LAST_SEEN_KEY, createdAt);
    }, []);

    const loadLatestSummary = useCallback(async () => {
        try {
            const res = await fetch("/api/pulse/latest-summary", { cache: "no-store" });
            if (!res.ok) return;
            const json = await res.json();
            const latest = json?.data?.summary;
            if (!latest || !latest.created_at) return;

            const seenAt = typeof window !== "undefined" ? window.localStorage.getItem(LAST_SEEN_KEY) : null;
            const seenMs = parseTimestamp(seenAt);
            const latestMs = parseTimestamp(latest.created_at);

            if (latestMs <= seenMs) return;

            setSummary({
                activity_id: latest.activity_id,
                total_points: Number(latest.total_points || 0),
                breakdown: Array.isArray(latest.breakdown) ? latest.breakdown : [],
                created_at: latest.created_at,
            });
            setIsOpen(true);
        } catch (error) {
            console.error("Failed to load latest pulse summary", error);
        }
    }, []);

    useEffect(() => {
        void loadLatestSummary();
        const intervalId = window.setInterval(() => {
            void loadLatestSummary();
        }, 60000);

        const onFocus = () => { void loadLatestSummary(); };
        window.addEventListener("focus", onFocus);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener("focus", onFocus);
        };
    }, [loadLatestSummary]);

    const totalTextClass = useMemo(
        () => (summary && summary.total_points >= 0 ? "text-emerald-700" : "text-rose-600"),
        [summary]
    );

    if (!summary) return null;

    const close = () => {
        markSeen(summary.created_at);
        setIsOpen(false);
    };

    const formatSigned = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[140] flex items-center justify-center bg-black/35 backdrop-blur-[2px] p-4"
                >
                    <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="w-full max-w-[320px] rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_18px_40px_rgba(12,20,35,0.18)]"
                    >
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-600">Nouveau</p>
                        <h3 className="mt-1 text-[20px] font-black text-[#242841]">Résumé Pulse</h3>
                        <div className="mt-3 space-y-1.5">
                            {summary.breakdown.map((item, index) => {
                                const points = Number(item.signed_points || 0);
                                return (
                                    <div key={`${item.reason_code || "line"}-${index}`} className="flex items-center justify-between gap-2 text-[12px]">
                                        <span className="truncate font-semibold text-gray-600">{item.reason_label || item.reason_code || "Variation Pulse"}</span>
                                        <span className={points >= 0 ? "font-black text-emerald-700" : "font-black text-rose-600"}>{formatSigned(points)}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                            <span className="text-[12px] font-bold text-gray-700">Total</span>
                            <span className={`text-[19px] font-black ${totalTextClass}`}>{formatSigned(summary.total_points)}</span>
                        </div>
                        <button
                            onClick={close}
                            className="mt-4 w-full rounded-2xl bg-[#242841] py-3 text-[14px] font-black text-white transition hover:opacity-95 active:scale-[0.98]"
                        >
                            Compris
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

