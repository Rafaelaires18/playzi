"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, CalendarCheck, CheckCircle2, Trophy, Bike, Flame as FlameIcon, Medal, Dumbbell, Zap, ChevronRight } from "lucide-react";
import BottomNavigation from "@/components/BottomNavigation";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";

const data1M = [
    { name: "S1", grade: 2.33 },
    { name: "S2", grade: 2.66 },
    { name: "S3", grade: 2.33, pointContext: "Pénalité: Absence non excusée (-1 Sous-niveau)" },
    { name: "S4", grade: 2.66 }
];

const data3M = [
    { name: "S1", grade: 1.66 }, { name: "S2", grade: 2.0 },
    { name: "S3", grade: 2.0 }, { name: "S4", grade: 2.33 },
    { name: "S5", grade: 2.33 }, { name: "S6", grade: 2.33 },
    { name: "S7", grade: 2.66 }, { name: "S8", grade: 2.66 },
    { name: "S9", grade: 3.0 }, { name: "S10", grade: 3.0 },
    { name: "S11", grade: 3.0 }, { name: "S12", grade: 3.0 } // Fin S1
];

const data6M = [
    { name: "M1", grade: 1.66 }, { name: "M2", grade: 2.33 },
    { name: "M3", grade: 3.0 }, // Fin Saison 1
    { name: "M4", grade: 2.0, pointContext: "Nouvelle Saison" }, // Reset
    { name: "M5", grade: 2.33 }, { name: "M6", grade: 2.66 }
];

const data1A = [
    { name: "M1", grade: 1.0 }, { name: "M2", grade: 1.33 }, { name: "M3", grade: 2.0 }, // S1
    { name: "M4", grade: 1.0, pointContext: "Saison 2" }, { name: "M5", grade: 1.66 }, { name: "M6", grade: 2.33 }, // S2
    { name: "M7", grade: 1.33, pointContext: "Saison 3" }, { name: "M8", grade: 2.0 }, { name: "M9", grade: 3.0 }, // S3
    { name: "M10", grade: 2.0, pointContext: "Saison 4" }, { name: "M11", grade: 2.33 }, { name: "M12", grade: 2.66 }  // S4
];

// Helper function to convert numeric grade to full string for Tooltip
const getFullGradeName = (value: number) => {
    const grades = ["", "Bronze", "Argent", "Or", "Platine"];
    const baseGrade = grades[Math.floor(value)];
    const decimal = value - Math.floor(value);

    let subLevel = "I";
    if (decimal > 0.3) subLevel = "II";
    if (decimal > 0.6) subLevel = "III";

    return `${baseGrade} ${subLevel}`;
};

// Mapping Y values to labels
const formatYAxis = (tickItem: number) => {
    if (tickItem === 1) return "Br";
    if (tickItem === 2) return "Ar";
    if (tickItem === 3) return "Or";
    if (tickItem === 4) return "Pl";
    return "";
};

export default function ProfilePage() {
    type TimeFilter = "1M" | "3M" | "6M" | "1A";
    const [timeFilter, setTimeFilter] = useState<TimeFilter>("3M");

    // Dynamic config based on filter
    const getChartConfig = () => {
        switch (timeFilter) {
            case "1M": return { data: data1M, interval: 0, showSeasonLine: null };
            case "3M": return { data: data3M, interval: 1, showSeasonLine: null };
            case "6M": return { data: data6M, interval: 0, showSeasonLine: "M4" };
            case "1A": return { data: data1A, interval: 1, showSeasonLine: false }; // Show drops visually, too many lines
        }
    };

    const { data: chartData, interval, showSeasonLine } = getChartConfig();

    return (
        <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-gray-50 relative overflow-hidden">

            {/* Global Application Header */}
            <Header />

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-4 pt-20 pb-28 space-y-6">

                {/* 1. Header (Identity & Season) */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center space-y-3"
                >
                    <div className="w-20 h-20 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                        <User className="w-10 h-10 text-gray-400 stroke-[1.5px]" />
                    </div>
                    <div className="text-center space-y-1">
                        <h1 className="text-xl font-black text-gray-dark tracking-tight">Rafael D.</h1>
                        <div className="inline-block text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-200/50 px-3 py-1 rounded-full">
                            Saison 2 - Printemps 2026
                        </div>
                    </div>
                </motion.div>

                {/* 2. CORE: Grade & Streak */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                    className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100/50 flex flex-col items-center relative overflow-hidden"
                >
                    <div className="text-xs uppercase font-bold text-gray-400 tracking-wider mb-4">Progression</div>

                    <div className="flex items-center gap-4">
                        {/* Main Grade Badge */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 p-1 shadow-sm">
                            <div className="bg-white/40 backdrop-blur-md px-6 py-3 rounded-xl border border-white/50 flex items-center gap-2">
                                <Trophy className="w-6 h-6 text-gray-600" />
                                <span className="text-2xl font-black text-gray-700 tracking-tight">Argent II</span>
                            </div>
                        </div>

                        {/* Streak Badge */}
                        <div className="flex items-center gap-1.5 px-4 py-3 bg-red-50 rounded-2xl border border-red-100/50 text-red-600">
                            <FlameIcon className="w-6 h-6 fill-red-500 stroke-red-500 animate-pulse" />
                            <span className="text-xl font-black tabular-nums">4</span>
                        </div>
                    </div>

                    {/* Sub-level Gauge (0/5 activities to pass a sub-level) */}
                    <div className="w-full mt-6 space-y-2">
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-gray-dirty">Vers Argent III</span>
                            <span className="text-[10px] font-bold text-gray-400">3 / 5 act.</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: "60%" }}
                                transition={{ delay: 0.4, duration: 1, type: "spring" }}
                                className="h-full bg-gray-700 rounded-full"
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 text-center mt-2 font-medium">✨ Encore 2 participations complètes sans pénalité !</p>
                    </div>
                </motion.div>

                {/* 3. CHART: Evolution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100/50"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-gray-dark">Évolution</h2>
                        <div className="flex bg-gray-50 rounded-full p-1 border border-gray-100/50 shadow-inner">
                            {(["1M", "3M", "6M", "1A"] as TimeFilter[]).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setTimeFilter(filter)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-bold rounded-full transition-all",
                                        timeFilter === filter
                                            ? "bg-white text-gray-dark shadow-sm"
                                            : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-40 w-full ml-[-10px] relative">
                        {/* Animated transition wrapper for recharts */}
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 15, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorGrade" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="name"
                                    interval={interval}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }}
                                    dy={10}
                                    padding={{ right: 10 }}
                                />
                                <YAxis
                                    domain={[0, 4]}
                                    ticks={[1, 2, 3, 4]}
                                    tickFormatter={formatYAxis}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 700 }}
                                    width={30}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontWeight: 'bold' }}
                                    labelStyle={{ display: 'none' }}
                                    cursor={{ stroke: '#F3F4F6', strokeWidth: 2 }}
                                    formatter={(value: any, name: any, props: any) => {
                                        // Custom logic to show the Grade and any penalty context
                                        const gradeName = getFullGradeName(value);
                                        const context = props.payload.pointContext;

                                        if (context) {
                                            return [context, gradeName];
                                        }
                                        return [gradeName, ""];
                                    }}
                                />
                                {typeof showSeasonLine === "string" && (
                                    <ReferenceLine
                                        x={showSeasonLine}
                                        stroke="#E5E7EB"
                                        strokeWidth={1}
                                        label={{
                                            position: 'insideTopLeft',
                                            value: 'Saison 2',
                                            fill: '#9CA3AF',
                                            fontSize: 10,
                                            offset: 10
                                        }}
                                    />
                                )}
                                <Area
                                    type="monotone"
                                    dataKey="grade"
                                    stroke="#10B981"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorGrade)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-center text-sm font-medium text-playzi-green mt-4 bg-playzi-green/10 py-2 rounded-xl">Rythme de croisière validé 🌿</p>
                </motion.div>

                {/* 4. BADGES (New V2 Showcase) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-black text-gray-dark">Trophées</h2>
                        <button className="text-xs font-bold text-gray-500 flex items-center hover:text-gray-dark transition-colors">
                            Tout voir <ChevronRight className="w-3 h-3 ml-0.5" />
                        </button>
                    </div>

                    {/* Horizontal Scroll for Badges */}
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar">
                        {/* Badge 1 */}
                        <div className="snap-start shrink-0 w-32 bg-white border border-gray-100/50 rounded-[20px] p-4 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 inset-x-0 h-1 bg-playzi-green/40 mix-blend-multiply" />
                            <div className="w-12 h-12 rounded-full bg-playzi-green/10 flex items-center justify-center mb-3">
                                <Medal className="w-6 h-6 text-playzi-green" />
                            </div>
                            <h3 className="text-xs font-black text-gray-dark mb-1">Pilier</h3>
                            <p className="text-[10px] text-gray-400 font-medium leading-tight">50 matchs joués</p>
                        </div>

                        {/* Badge 2 */}
                        <div className="snap-start shrink-0 w-32 bg-white border border-gray-100/50 rounded-[20px] p-4 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 inset-x-0 h-1 bg-red-400/40 mix-blend-multiply" />
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                                <Zap className="w-6 h-6 fill-red-400 text-red-500" />
                            </div>
                            <h3 className="text-xs font-black text-gray-dark mb-1">Invincible</h3>
                            <p className="text-[10px] text-gray-400 font-medium leading-tight">Série de 10 sem.</p>
                        </div>

                        {/* Badge 3 */}
                        <div className="snap-start shrink-0 w-32 bg-white border border-gray-100/50 rounded-[20px] p-4 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 inset-x-0 h-1 bg-blue-400/40 mix-blend-multiply" />
                            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                                <Dumbbell className="w-6 h-6 text-blue-500" />
                            </div>
                            <h3 className="text-xs font-black text-gray-dark mb-1">Couteau Suisse</h3>
                            <p className="text-[10px] text-gray-400 font-medium leading-tight">4 sports testés</p>
                        </div>

                        {/* Edge padding */}
                        <div className="w-2 shrink-0" />
                    </div>
                </motion.div>

                {/* 5. STATS: Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="grid grid-cols-2 gap-4"
                >
                    <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100/50 flex flex-col justify-between">
                        <div className="p-2 w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-4">
                            <CalendarCheck className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                            <div className="text-3xl font-black text-gray-dark">28</div>
                            <div className="text-xs font-medium text-gray-400 mt-1">Activités rejointes</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100/50 flex flex-col justify-between">
                        <div className="p-2 w-10 h-10 bg-playzi-green/10 rounded-xl flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-5 h-5 text-playzi-green" />
                        </div>
                        <div>
                            <div className="text-3xl font-black text-playzi-green">100<span className="text-lg">%</span></div>
                            <div className="text-xs font-medium text-gray-400 mt-1">Taux de présence</div>
                        </div>
                    </div>
                </motion.div>

                {/* 6. SPORTS: Tags */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100/50"
                >
                    <h2 className="text-lg font-black text-gray-dark mb-4">Sports pratiqués</h2>
                    <div className="flex flex-wrap gap-2">
                        <div className="px-4 py-2 bg-gray-50 rounded-full border border-gray-100 flex items-center gap-2 text-sm font-bold text-gray-dark">
                            <span>🏐</span> Beach-Volley
                        </div>
                        <div className="px-4 py-2 bg-gray-50 rounded-full border border-gray-100 flex items-center gap-2 text-sm font-bold text-gray-dark">
                            <span>🏃</span> Running
                        </div>
                        <div className="px-4 py-2 bg-gray-50 rounded-full border border-gray-100 flex items-center gap-2 text-sm font-bold text-gray-dark">
                            <Bike className="w-4 h-4 text-gray-400" /> Vélo
                        </div>
                    </div>
                </motion.div>

            </div>

            <BottomNavigation activeTab="profile" />
        </main>
    );
}
