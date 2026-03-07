"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
    User,
    Flame,
    Crown,
    Trophy,
    Activity,
    Users,
    Footprints,
    ShieldCheck,
    Lock,
    Sparkles,
    ChevronRight,
    Pencil
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { cn } from "@/lib/utils";

type TimeFilter = "1M" | "3M" | "6M" | "1A";

type RankStep = {
    min: number;
    label: string;
    next: number | null;
};

const rankSteps: RankStep[] = [
    { min: 0, label: "Bronze III", next: 100 },
    { min: 100, label: "Bronze II", next: 200 },
    { min: 200, label: "Bronze I", next: 300 },
    { min: 300, label: "Argent III", next: 400 },
    { min: 400, label: "Argent II", next: 500 },
    { min: 500, label: "Argent I", next: 600 },
    { min: 600, label: "Or III", next: 700 },
    { min: 700, label: "Or II", next: 800 },
    { min: 800, label: "Or I", next: 900 },
    { min: 900, label: "Platine", next: null }
];

const pulseSeries: Record<TimeFilter, { label: string; value: number }[]> = {
    "1M": [
        { label: "S1", value: 726 },
        { label: "S2", value: 733 },
        { label: "S3", value: 738 },
        { label: "S4", value: 742 }
    ],
    "3M": [
        { label: "S1", value: 648 }, { label: "S2", value: 661 }, { label: "S3", value: 673 },
        { label: "S4", value: 682 }, { label: "S5", value: 694 }, { label: "S6", value: 703 },
        { label: "S7", value: 711 }, { label: "S8", value: 719 }, { label: "S9", value: 726 },
        { label: "S10", value: 733 }, { label: "S11", value: 738 }, { label: "S12", value: 742 }
    ],
    "6M": [
        { label: "M1", value: 552 }, { label: "M2", value: 590 }, { label: "M3", value: 628 },
        { label: "M4", value: 669 }, { label: "M5", value: 706 }, { label: "M6", value: 742 }
    ],
    "1A": [
        { label: "M1", value: 408 }, { label: "M2", value: 451 }, { label: "M3", value: 494 },
        { label: "M4", value: 532 }, { label: "M5", value: 571 }, { label: "M6", value: 610 },
        { label: "M7", value: 644 }, { label: "M8", value: 673 }, { label: "M9", value: 701 },
        { label: "M10", value: 718 }, { label: "M11", value: 731 }, { label: "M12", value: 742 }
    ]
};

const trophies = [
    { title: "Pilier", subtitle: "50 matchs joués", tone: "bg-emerald-100 text-emerald-700" },
    { title: "Invincible", subtitle: "10 semaines", tone: "bg-rose-100 text-rose-700" },
    { title: "Couteau suisse", subtitle: "4 sports testés", tone: "bg-sky-100 text-sky-700" },
    { title: "Ambassadeur+", subtitle: "Badge rare", tone: "bg-amber-100 text-amber-700", premium: true }
];

const titleOptions = [
    "Runner régulier",
    "Organisateur actif",
    "Pilier de la communauté",
    "Beach-volley addict",
    "Cycliste du dimanche",
    "Community builder"
];

const coreStats = [
    { label: "Activités rejointes", value: "38", icon: Activity },
    { label: "Activités créées", value: "11", icon: Trophy },
    { label: "Personnes rencontrées", value: "57", icon: Users },
    { label: "Sport préféré", value: "Beach-volley", icon: Footprints }
];

function getRankData(currentPulse: number) {
    const current = [...rankSteps].reverse().find((step) => currentPulse >= step.min) ?? rankSteps[0];
    const nextThreshold = current.next;
    const progressPercent = nextThreshold
        ? Math.max(0, Math.min(100, ((currentPulse - current.min) / (nextThreshold - current.min)) * 100))
        : 100;
    return {
        currentPulse,
        rankLabel: current.label,
        nextThreshold,
        progressPercent: Math.round(progressPercent)
    };
}

function LockedOverlay() {
    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[20px] bg-white/72 backdrop-blur-[4px]">
            <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-white/95 px-3 py-1.5 shadow-sm">
                <Crown className="h-4 w-4 text-amber-500" />
                <span className="text-[11px] font-black text-gray-700">Disponible avec Playzi+</span>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    const [timeFilter, setTimeFilter] = useState<TimeFilter>("3M");
    const [activeTitle, setActiveTitle] = useState(titleOptions[0]);

    const isPlayziPlus = false;
    const streakWeeks = 4;
    const rankData = getRankData(742);

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F5F7F6]">
            <Header />

            <div className="flex-1 overflow-y-auto px-4 pt-20 pb-28 space-y-5">
                <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                                <User className="h-8 w-8 text-gray-500" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="truncate text-[22px] font-black text-[#242841]">Rafael D.</h1>
                                <p className="mt-0.5 text-[15px] font-bold text-gray-700">{rankData.rankLabel}</p>
                                <p className="mt-1 text-[12px] font-semibold text-gray-500">{activeTitle}</p>
                                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Saison 2 - Printemps 2026</p>
                            </div>
                        </div>

                        <button
                            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 px-2.5 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
                            aria-label="Modifier profil"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            Modifier
                        </button>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-400">Titre actif</label>
                        <select
                            value={activeTitle}
                            onChange={(e) => setActiveTitle(e.target.value)}
                            className="w-full bg-transparent text-[12px] font-bold text-gray-700 outline-none"
                        >
                            {titleOptions.map((title) => (
                                <option key={title} value={title}>{title}</option>
                            ))}
                        </select>
                    </div>
                </section>

                <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[26px] font-black text-[#242841]">{rankData.rankLabel}</h2>
                        <div className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2">
                            <Flame className="h-5 w-5 text-rose-500" />
                            <span className="text-[15px] font-black text-rose-600">{streakWeeks} semaines</span>
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${rankData.progressPercent}%` }}
                                transition={{ duration: 0.7, ease: "easeOut" }}
                                className="h-full rounded-full bg-gradient-to-r from-[#11B981] to-[#34D399]"
                            />
                        </div>
                        <p className="mt-2 text-center text-[12px] font-semibold text-gray-600">
                            {rankData.nextThreshold
                                ? `${rankData.currentPulse} / ${rankData.nextThreshold} Pulse`
                                : `${rankData.currentPulse} Pulse · palier maximum`}
                        </p>
                    </div>
                </section>

                <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-[18px] font-black text-[#242841]">Évolution Pulse</h3>
                        <div className="flex rounded-full border border-gray-100 bg-gray-50 p-1">
                            {(Object.keys(pulseSeries) as TimeFilter[]).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setTimeFilter(filter)}
                                    className={cn(
                                        "rounded-full px-2.5 py-1 text-[11px] font-black transition",
                                        timeFilter === filter ? "bg-white text-[#242841] shadow-sm" : "text-gray-400"
                                    )}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="relative">
                        <div className={cn("h-40", !isPlayziPlus && "blur-[4px] contrast-75")}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={pulseSeries[timeFilter]} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="pulseGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.22} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }} />
                                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }} width={40} />
                                    <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2.5} fill="url(#pulseGradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        {!isPlayziPlus && <LockedOverlay />}
                    </div>
                </section>

                <section>
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-[18px] font-black text-[#242841]">Trophées</h3>
                        <button className="flex items-center text-[12px] font-black text-gray-500">
                            Tout voir <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {trophies.map((badge) => (
                            <article key={badge.title} className="relative w-[150px] shrink-0 rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                                <div className={cn("inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase", badge.tone)}>
                                    {badge.premium ? "Playzi+" : "Standard"}
                                </div>
                                <h4 className="mt-3 text-[13px] font-black text-[#242841]">{badge.title}</h4>
                                <p className="mt-1 text-[11px] font-semibold text-gray-500">{badge.subtitle}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="grid grid-cols-2 gap-3">
                    {coreStats.map((stat) => (
                        <article key={stat.label} className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                                <stat.icon className="h-4 w-4 text-gray-500" />
                            </div>
                            <p className="text-[19px] font-black text-[#242841]">{stat.value}</p>
                            <p className="mt-1 text-[11px] font-semibold text-gray-500">{stat.label}</p>
                        </article>
                    ))}

                    <Link
                        href="/profil/resume-mensuel"
                        className="rounded-[20px] border border-[#CFEFE6] bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                            <Sparkles className="h-4 w-4 text-emerald-600" />
                        </div>
                        <p className="text-[16px] font-black text-[#242841]">Résumé mensuel</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Mars 2026 · 7 activités</p>
                        <div className="mt-1 flex items-center justify-end">
                            <ChevronRight className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                    </Link>

                    <Link
                        href="/profil/connexions"
                        className="rounded-[20px] border border-emerald-100 bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                            <Users className="h-4 w-4 text-emerald-600" />
                        </div>
                        <p className="text-[19px] font-black text-[#242841]">63</p>
                        <div className="mt-1 flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-gray-500">Connexions</p>
                            <ChevronRight className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                    </Link>
                </section>

                <section className="relative rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className={cn(!isPlayziPlus && "blur-[4px] contrast-75")}>
                        <div className="mb-3 flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-amber-500" />
                            <h3 className="text-[16px] font-black text-[#242841]">Statistiques Playzi+</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-gray-50 p-3">
                                <p className="text-[16px] font-black text-[#242841]">96%</p>
                                <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Taux de présence</p>
                            </div>
                            <div className="rounded-xl bg-gray-50 p-3">
                                <p className="text-[16px] font-black text-[#242841]">214 km</p>
                                <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Running/Vélo</p>
                            </div>
                            <div className="rounded-xl bg-gray-50 p-3">
                                <p className="text-[16px] font-black text-[#242841]">29</p>
                                <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Sessions collectives</p>
                            </div>
                            <div className="rounded-xl bg-gray-50 p-3">
                                <p className="text-[16px] font-black text-[#242841]">8</p>
                                <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Événements Playzi</p>
                            </div>
                        </div>
                    </div>
                    {!isPlayziPlus && <LockedOverlay />}
                </section>

                <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <h3 className="text-[16px] font-black text-[#242841]">Sports pratiqués</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-[12px] font-bold text-gray-700">🏐 Beach-volley</span>
                        <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-[12px] font-bold text-gray-700">🏃 Running</span>
                        <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-[12px] font-bold text-gray-700">🚴 Vélo</span>
                    </div>
                    <div className="relative mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                        <div className={cn("space-y-2", !isPlayziPlus && "blur-[4px] contrast-75")}>
                            <p className="text-[12px] font-bold text-gray-700">Par sport (Playzi+)</p>
                            <div className="flex items-center justify-between text-[12px] font-semibold text-gray-500">
                                <span>Running</span>
                                <span>126 km</span>
                            </div>
                            <div className="flex items-center justify-between text-[12px] font-semibold text-gray-500">
                                <span>Vélo</span>
                                <span>88 km</span>
                            </div>
                            <div className="flex items-center justify-between text-[12px] font-semibold text-gray-500">
                                <span>Collectif</span>
                                <span>29 sessions</span>
                            </div>
                        </div>
                        {!isPlayziPlus && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/75 backdrop-blur-[3px]">
                                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white/95 px-3 py-1.5 text-[11px] font-black text-gray-700">
                                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                                    Disponible avec Playzi+
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <BottomNavigation activeTab="profile" />
        </main>
    );
}
