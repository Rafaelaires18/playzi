"use client";

import { cn } from "@/lib/utils";
import { Minus, Plus, Infinity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Sports that require a fixed limit (no unlimited option)
const FIXED_LIMIT_SPORTS = ["beach-volley", "football"];
const UNLIMITED_BY_DEFAULT_SPORTS = ["running", "velo"];

interface StepParticipantsProps {
    sport: string | null;
    maxParticipants: number;
    isUnlimited: boolean;
    groupType: "mixte" | "filles" | null;
    isFemale: boolean;
    onMaxChange: (n: number) => void;
    onUnlimitedChange: (v: boolean) => void;
    onGroupTypeChange: (g: "mixte" | "filles") => void;
}

export default function StepParticipants({
    sport,
    maxParticipants,
    isUnlimited,
    groupType,
    isFemale,
    onMaxChange,
    onUnlimitedChange,
    onGroupTypeChange,
}: StepParticipantsProps) {
    const isFixedLimitRequired = sport ? FIXED_LIMIT_SPORTS.includes(sport) : false;
    const supportsUnlimited = sport ? UNLIMITED_BY_DEFAULT_SPORTS.includes(sport) : false;

    return (
        <div className="flex flex-col gap-8">

            {/* Participants section */}
            <div className="flex flex-col gap-4">
                <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">
                    Nombre de participants
                </h2>

                {/* Unlimited toggle — Running / Vélo only */}
                {supportsUnlimited && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => onUnlimitedChange(true)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-[13px] font-semibold transition-all",
                                isUnlimited
                                    ? "border-playzi-green bg-playzi-green/10 text-playzi-green"
                                    : "border-gray-100 bg-white text-gray-500"
                            )}
                        >
                            <Infinity className="w-4 h-4" />
                            Illimité
                        </button>
                        <button
                            onClick={() => onUnlimitedChange(false)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-[13px] font-semibold transition-all",
                                !isUnlimited
                                    ? "border-playzi-green bg-playzi-green/10 text-playzi-green"
                                    : "border-gray-100 bg-white text-gray-500"
                            )}
                        >
                            <Minus className="w-4 h-4" />
                            Limité
                        </button>
                    </div>
                )}

                {/* Stepper — always shown for fixed-limit sports, or when "Limité" is selected */}
                <AnimatePresence>
                    {(!supportsUnlimited || !isUnlimited) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-gray-100 p-4">
                                <button
                                    onClick={() => onMaxChange(Math.max(2, maxParticipants - 1))}
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-dark active:bg-gray-200 transition-colors"
                                >
                                    <Minus className="w-5 h-5" />
                                </button>
                                <div className="flex flex-col items-center">
                                    <span className="text-4xl font-bold text-gray-dark tabular-nums">{maxParticipants}</span>
                                    <span className="text-[11px] text-gray-400 mt-0.5">participants max</span>
                                </div>
                                <button
                                    onClick={() => onMaxChange(Math.min(30, maxParticipants + 1))}
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-playzi-green text-white active:opacity-80 transition-opacity"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Creator included note */}
                            <p className="text-[11px] text-gray-400 text-center mt-2.5">
                                👤 Le créateur est inclus dans le total
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Unlimited confirmation */}
                {supportsUnlimited && isUnlimited && (
                    <div className="bg-playzi-green/5 border border-playzi-green/20 rounded-2xl px-4 py-3 text-center">
                        <p className="text-[13px] font-semibold text-playzi-green">∞ Ouvert à tous</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Aucune limite de participants</p>
                    </div>
                )}
            </div>

            {/* Group type — female profile only */}
            {isFemale && (
                <div className="flex flex-col gap-4">
                    <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">
                        Type de groupe
                    </h2>
                    <div className="flex gap-3">
                        {(["mixte", "filles"] as const).map((g) => (
                            <button
                                key={g}
                                onClick={() => onGroupTypeChange(g)}
                                className={cn(
                                    "flex-1 py-3.5 rounded-2xl border-2 text-[13px] font-semibold transition-all",
                                    groupType === g
                                        ? "border-playzi-green bg-playzi-green/10 text-playzi-green"
                                        : "border-gray-100 bg-white text-gray-500"
                                )}
                            >
                                {g === "mixte" ? "⚧ Mixte" : "👯‍♀️ Entre filles"}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
