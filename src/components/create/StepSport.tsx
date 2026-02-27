"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

const SPORTS = [
    { id: "running", label: "Running", emoji: "🏃" },
    { id: "velo", label: "Vélo", emoji: "🚴" },
    { id: "beach-volley", label: "Beach-volley", emoji: "🏐" },
    { id: "football", label: "Football", emoji: "⚽" },
];

const LEVELS = [
    { id: "tout", label: "Tous niveaux" },
    { id: "chill", label: "Chill" },
    { id: "intermediaire", label: "Intermédiaire" },
    { id: "avance", label: "Avancé" },
];

export interface SportParams {
    distance: number;  // km
    pace: number;      // seconds per km (only for running)
}

interface StepSportProps {
    sport: string | null;
    level: string | null;
    sportParams: SportParams;
    onSportChange: (s: string) => void;
    onLevelChange: (l: string) => void;
    onSportParamsChange: (p: SportParams) => void;
}

const DEFAULT_RUNNING_PARAMS: SportParams = { distance: 10, pace: 330 }; // 5:30/km
const DEFAULT_VELO_PARAMS: SportParams = { distance: 40, pace: 0 };

/** Format seconds → "M:SS" */
function formatPace(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Custom thumb-styled range slider via CSS custom property */
function RangeSlider({
    min,
    max,
    value,
    step = 1,
    onChange,
}: {
    min: number;
    max: number;
    value: number;
    step?: number;
    onChange: (v: number) => void;
}) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
        <div className="relative w-full">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="sport-slider w-full appearance-none h-2 rounded-full outline-none cursor-pointer"
                style={
                    {
                        "--pct": `${pct}%`,
                    } as React.CSSProperties
                }
            />
        </div>
    );
}

/** Panel for sports that have extra params (slides in/out) */
function SportParamsPanel({
    sport,
    params,
    onChange,
}: {
    sport: string;
    params: SportParams;
    onChange: (p: SportParams) => void;
}) {
    if (sport === "running") {
        return (
            <div className="flex flex-col gap-6">
                {/* Distance */}
                <div className="flex flex-col gap-3">
                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        Distance prévue
                    </h3>
                    <div className="text-center">
                        <span className="text-5xl font-black text-gray-dark tabular-nums">
                            {params.distance}
                        </span>
                        <span className="text-[15px] font-semibold text-gray-400 ml-1.5">km</span>
                    </div>
                    <RangeSlider
                        min={3}
                        max={30}
                        value={params.distance}
                        onChange={(v) => onChange({ ...params, distance: v })}
                    />
                    <div className="flex justify-between text-[11px] text-gray-300 font-medium">
                        <span>3 km</span>
                        <span>30 km</span>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-gray-100" />

                {/* Allure */}
                <div className="flex flex-col gap-3">
                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        Allure moyenne
                    </h3>
                    <div className="text-center">
                        <span className="text-5xl font-black text-gray-dark tabular-nums">
                            {formatPace(params.pace)}
                        </span>
                        <span className="text-[13px] font-semibold text-gray-400 ml-1.5">/ km</span>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center justify-center gap-4 mt-1">
                        <button
                            type="button"
                            onClick={() =>
                                onChange({ ...params, pace: Math.max(180, params.pace - 5) })
                            }
                            className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 font-bold text-xl flex items-center justify-center active:scale-90 transition-transform"
                        >
                            −
                        </button>
                        <span className="text-[11px] text-gray-300 font-medium w-14 text-center">
                            ±5 sec
                        </span>
                        <button
                            type="button"
                            onClick={() =>
                                onChange({ ...params, pace: Math.min(600, params.pace + 5) })
                            }
                            className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 font-bold text-xl flex items-center justify-center active:scale-90 transition-transform"
                        >
                            +
                        </button>
                    </div>
                    <p className="text-center text-[11px] text-gray-400 font-medium">
                        3:00 / km &nbsp;&bull;&nbsp; 10:00 / km
                    </p>
                </div>
            </div>
        );
    }

    if (sport === "velo") {
        return (
            <div className="flex flex-col gap-3">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    Distance prévue
                </h3>
                <div className="text-center">
                    <span className="text-5xl font-black text-gray-dark tabular-nums">
                        {params.distance}
                    </span>
                    <span className="text-[15px] font-semibold text-gray-400 ml-1.5">km</span>
                </div>
                <RangeSlider
                    min={10}
                    max={200}
                    step={5}
                    value={params.distance}
                    onChange={(v) => onChange({ ...params, distance: v })}
                />
                <div className="flex justify-between text-[11px] text-gray-300 font-medium">
                    <span>10 km</span>
                    <span>200 km</span>
                </div>
            </div>
        );
    }

    return null;
}

const SPORTS_WITH_PARAMS = ["running", "velo"];

export default function StepSport({
    sport,
    level,
    sportParams,
    onSportChange,
    onLevelChange,
    onSportParamsChange,
}: StepSportProps) {
    const prevSport = useRef<string | null>(null);

    // Reset params when sport changes
    useEffect(() => {
        if (sport !== prevSport.current) {
            prevSport.current = sport;
            if (sport === "running") onSportParamsChange(DEFAULT_RUNNING_PARAMS);
            else if (sport === "velo") onSportParamsChange(DEFAULT_VELO_PARAMS);
        }
    }, [sport]);

    const hasParams = sport !== null && SPORTS_WITH_PARAMS.includes(sport);
    // Level shown for all sports except Running (distance+pace already captures effort)
    const showLevel = sport !== null && sport !== "running";

    return (
        <div className="flex flex-col gap-8">
            {/* Sport Grid */}
            <div>
                <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-4">Sport</h2>
                <div className="grid grid-cols-2 gap-3">
                    {SPORTS.map((s) => (
                        <motion.button
                            key={s.id}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => onSportChange(s.id)}
                            className={cn(
                                "flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all font-semibold",
                                sport === s.id
                                    ? "border-playzi-green bg-playzi-green/10 text-playzi-green shadow-[0_0_0_3px_rgba(16,185,129,0.1)]"
                                    : "border-gray-100 bg-white text-gray-dark hover:border-gray-200"
                            )}
                        >
                            <span className="text-3xl">{s.emoji}</span>
                            <span className="text-[13px]">{s.label}</span>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Dynamic Sport Params */}
            <AnimatePresence mode="wait">
                {hasParams && (
                    <motion.div
                        key={sport}
                        initial={{ opacity: 0, height: 0, y: -8 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="overflow-hidden"
                    >
                        <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
                            <SportParamsPanel
                                sport={sport!}
                                params={sportParams}
                                onChange={onSportParamsChange}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Level Pills — only for Football & Beach-volley */}
            <AnimatePresence>
                {showLevel && (
                    <motion.div
                        key="level"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden"
                    >
                        <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-4">Niveau</h2>
                        <div className="flex flex-wrap gap-2">
                            {LEVELS.map((l) => (
                                <motion.button
                                    key={l.id}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => onLevelChange(l.id)}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-[13px] font-semibold border-2 transition-all",
                                        level === l.id
                                            ? "border-playzi-green bg-playzi-green text-white"
                                            : "border-gray-100 bg-white text-gray-500 hover:border-gray-200"
                                    )}
                                >
                                    {l.label}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
