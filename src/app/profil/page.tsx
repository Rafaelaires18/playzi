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

const pulseSeries: Record<TimeFilter, { label: string; value: number }[]> = {
    "1M": [
        { label: "S1", value: 58 },
        { label: "S2", value: 63 },
        { label: "S3", value: 61 },
        { label: "S4", value: 67 }
    ],
    "3M": [
        { label: "S1", value: 42 }, { label: "S2", value: 47 }, { label: "S3", value: 49 },
        { label: "S4", value: 53 }, { label: "S5", value: 56 }, { label: "S6", value: 60 },
        { label: "S7", value: 58 }, { label: "S8", value: 62 }, { label: "S9", value: 66 },
        { label: "S10", value: 68 }, { label: "S11", value: 71 }, { label: "S12", value: 74 }
    ],
    "6M": [
        { label: "M1", value: 35 }, { label: "M2", value: 44 }, { label: "M3", value: 52 },
        { label: "M4", value: 46 }, { label: "M5", value: 58 }, { label: "M6", value: 67 }
    ],
    "1A": [
        { label: "M1", value: 28 }, { label: "M2", value: 31 }, { label: "M3", value: 38 },
        { label: "M4", value: 34 }, { label: "M5", value: 40 }, { label: "M6", value: 45 },
        { label: "M7", value: 42 }, { label: "M8", value: 50 }, { label: "M9", value: 58 },
        { label: "M10", value: 55 }, { label: "M11", value: 63 }, { label: "M12", value: 71 }
    ]
};

const freeStats = [
    { label: "Activités rejointes", value: "38", icon: Activity },
    { label: "Activités créées", value: "11", icon: Trophy },
    { label: "Personnes rencontrées", value: "57", icon: Users },
    { label: "Sport préféré", value: "Beach-volley", icon: Footprints },
    { label: "Pulse total", value: "742", icon: Sparkles },
    { label: "Connexions", value: "63", icon: Users, href: "/profil/connexions", highlight: true }
];

const premiumStats = [
    { label: "Taux de présence", value: "96%" },
    { label: "Running/Vélo", value: "214 km" },
    { label: "Sessions collectives", value: "29" },
    { label: "Événements Playzi", value: "8" }
];

const trophies = [
    { title: "Pilier", subtitle: "50 matchs joués", tone: "bg-emerald-100 text-emerald-700" },
    { title: "Invincible", subtitle: "10 semaines", tone: "bg-rose-100 text-rose-700" },
    { title: "Couteau suisse", subtitle: "4 sports testés", tone: "bg-sky-100 text-sky-700" },
    { title: "Ambassadeur+", subtitle: "Badge rare", tone: "bg-amber-100 text-amber-700", premium: true }
];

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

    // Simule un utilisateur freemium. Brancher cette valeur au vrai abonnement plus tard.
    const isPlayziPlus = false;
    const pulseProgress = 68;

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F5F7F6]">
            <Header />

            <div className="flex-1 overflow-y-auto px-4 pt-20 pb-28 space-y-5">
                <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                            <User className="h-8 w-8 text-gray-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h1 className="truncate text-[22px] font-black text-[#242841]">Rafael D.</h1>
                                {isPlayziPlus && (
                                    <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                                        Playzi+
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 text-[15px] font-bold text-gray-700">Argent II</p>
                            <p className="mt-1 text-[12px] font-semibold text-gray-500">Runner régulier</p>
                            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Saison 2 - Printemps 2026</p>
                        </div>
                    </div>
                    <button className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 px-3 text-[12px] font-bold text-gray-700 hover:bg-gray-50">
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier profil
                    </button>
                </section>

                <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Progression</p>
                            <h2 className="mt-1 text-[26px] font-black text-[#242841]">Argent II</h2>
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2">
                            <Flame className="h-5 w-5 text-rose-500" />
                            <span className="text-[15px] font-black text-rose-600">4 semaines</span>
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="mb-2 flex items-end justify-between">
                            <span className="text-[12px] font-bold text-gray-600">Vers Argent I</span>
                            <span className="text-[11px] font-bold text-gray-400">{pulseProgress}%</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pulseProgress}%` }}
                                transition={{ duration: 0.7, ease: "easeOut" }}
                                className="h-full rounded-full bg-gradient-to-r from-[#11B981] to-[#34D399]"
                            />
                        </div>
                        <p className="mt-2 text-center text-[11px] font-semibold text-gray-500">
                            En bonne voie vers Argent I
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
                                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }} width={28} />
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
                    {freeStats.map((stat) => (
                        stat.href ? (
                            <Link
                                key={stat.label}
                                href={stat.href}
                                className="rounded-[20px] border border-emerald-100 bg-white p-4 shadow-sm transition hover:shadow-md"
                            >
                                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                                    <stat.icon className="h-4 w-4 text-emerald-600" />
                                </div>
                                <p className="text-[19px] font-black text-[#242841]">{stat.value}</p>
                                <div className="mt-1 flex items-center justify-between">
                                    <p className="text-[11px] font-semibold text-gray-500">{stat.label}</p>
                                    <ChevronRight className="h-3.5 w-3.5 text-emerald-600" />
                                </div>
                            </Link>
                        ) : (
                            <article key={stat.label} className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                                    <stat.icon className="h-4 w-4 text-gray-500" />
                                </div>
                                <p className="text-[19px] font-black text-[#242841]">{stat.value}</p>
                                <p className="mt-1 text-[11px] font-semibold text-gray-500">{stat.label}</p>
                            </article>
                        )
                    ))}
                </section>

                <section className="relative rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className={cn(!isPlayziPlus && "blur-[4px] contrast-75")}>
                        <div className="mb-3 flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-amber-500" />
                            <h3 className="text-[16px] font-black text-[#242841]">Statistiques Playzi+</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {premiumStats.map((stat) => (
                                <div key={stat.label} className="rounded-xl bg-gray-50 p-3">
                                    <p className="text-[16px] font-black text-[#242841]">{stat.value}</p>
                                    <p className="mt-0.5 text-[11px] font-semibold text-gray-500">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 rounded-xl bg-gray-50 p-3">
                            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Résumé mensuel</p>
                            <p className="mt-1 text-[12px] font-semibold text-gray-600">Activités 7 • Rencontres 12 • Pulse +84 • Streak 4 semaines</p>
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

                {!isPlayziPlus && (
                    <section className="rounded-[26px] border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-wider text-amber-600">Playzi+</p>
                                <h3 className="mt-1 text-[20px] font-black text-[#242841]">Débloque toutes tes stats</h3>
                                <p className="mt-1 text-[12px] font-semibold text-gray-600">
                                    Graphique Pulse complet, taux de présence, profils participants, événements Playzi.
                                </p>
                            </div>
                            <Crown className="h-7 w-7 shrink-0 text-amber-500" />
                        </div>
                        <Link
                            href="/pricing"
                            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[#242841] text-[14px] font-black text-white"
                        >
                            Voir les plans
                        </Link>
                    </section>
                )}
            </div>

            <BottomNavigation activeTab="profile" />
        </main>
    );
}
