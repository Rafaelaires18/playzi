"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/Header";

export default function ProfileMonthlySummaryPage() {
    const router = useRouter();
    const [requestedMonth, setRequestedMonth] = useState<string | null>(null);
    const [monthlySummary, setMonthlySummary] = useState<{
        month_key: string;
        activities_count: number;
        streak_weeks: number;
        main_sport: string;
        pulse_gained: number;
        playzi_events?: number;
    } | null>(null);
    const [previousMonthlySummary, setPreviousMonthlySummary] = useState<{
        month_key: string;
        activities_count: number;
        streak_weeks: number;
        main_sport: string;
        pulse_gained: number;
        playzi_events?: number;
    } | null>(null);
    const [isAcknowledging, setIsAcknowledging] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        setRequestedMonth(params.get("month"));
    }, []);

    useEffect(() => {
        let mounted = true;
        const loadStats = async () => {
            try {
                const res = await fetch(`/api/profile/stats?t=${Date.now()}`, { cache: "no-store" });
                if (!res.ok) return;
                const json = await res.json().catch(() => null);
                if (!mounted) return;
                setMonthlySummary(json?.data?.monthly_summary || null);
                setPreviousMonthlySummary(json?.data?.previous_month_summary || null);
            } catch {
                // Keep fallback values
            }
        };
        void loadStats();
        const onFocus = () => { void loadStats(); };
        const onVisibility = () => {
            if (document.visibilityState === "visible") {
                void loadStats();
            }
        };
        window.addEventListener("focus", onFocus);
        window.addEventListener("visibilitychange", onVisibility);
        return () => {
            mounted = false;
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    const displayedSummary = useMemo(() => {
        if (requestedMonth && previousMonthlySummary?.month_key === requestedMonth) {
            return previousMonthlySummary;
        }
        if (requestedMonth && monthlySummary?.month_key === requestedMonth) {
            return monthlySummary;
        }
        return previousMonthlySummary || monthlySummary;
    }, [monthlySummary, previousMonthlySummary, requestedMonth]);

    const monthLabel = useMemo(() => {
        if (!displayedSummary?.month_key) return "Mois précédent";
        return new Date(`${displayedSummary.month_key}-01T00:00:00`).toLocaleDateString("fr-FR", {
            month: "long",
            year: "numeric"
        });
    }, [displayedSummary]);

    const acknowledgeAndLeave = async () => {
        if (!displayedSummary?.month_key) {
            router.back();
            return;
        }
        if (isAcknowledging) return;
        try {
            setIsAcknowledging(true);
            await fetch("/api/profile/monthly-summary/read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month_key: displayedSummary.month_key }),
            }).catch(() => null);
        } finally {
            setIsAcknowledging(false);
            router.back();
        }
    };

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F5F7F6]">
            <Header />

            <header className="fixed top-16 left-0 right-0 z-40 mx-auto flex h-16 w-full max-w-md items-center border-b border-gray-100 bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <button onClick={() => void acknowledgeAndLeave()} className="rounded-full p-3 text-gray-700 hover:bg-gray-100">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div className="ml-1">
                    <h1 className="text-[17px] font-black text-[#242841]">Résumé mensuel</h1>
                    <p className="text-[11px] font-semibold text-gray-500">{monthLabel}</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-10 pt-36">
                <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                    <h2 className="text-[16px] font-black text-[#242841]">Ce mois-ci</h2>
                    <div className="mt-3 space-y-2.5">
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] font-semibold text-gray-700">
                            <span>Activités du mois</span>
                            <span className="font-black text-[#242841]">{displayedSummary?.activities_count ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] font-semibold text-gray-700">
                            <span>Pulse gagné</span>
                            <span className="font-black text-emerald-600">{Number(displayedSummary?.pulse_gained || 0) >= 0 ? "+" : ""}{Number(displayedSummary?.pulse_gained || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] font-semibold text-gray-700">
                            <span>Streak du mois</span>
                            <span className="font-black text-[#242841]">{displayedSummary?.streak_weeks ?? 0} semaine{Number(displayedSummary?.streak_weeks || 0) > 1 ? "s" : ""}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] font-semibold text-gray-700">
                            <span>Sport principal</span>
                            <span className="font-black text-[#242841]">{displayedSummary?.main_sport || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] font-semibold text-gray-700">
                            <span>Événements Playzi participés</span>
                            <span className="font-black text-[#242841]">{displayedSummary?.playzi_events ?? 0}</span>
                        </div>
                    </div>
                </section>
                <button
                    type="button"
                    onClick={() => void acknowledgeAndLeave()}
                    disabled={isAcknowledging}
                    className="mt-4 h-12 w-full rounded-[14px] border border-emerald-200 bg-emerald-50 text-[14px] font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-70"
                >
                    {isAcknowledging ? "Enregistrement..." : "OK"}
                </button>
            </div>
        </main>
    );
}
