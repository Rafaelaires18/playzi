"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Clock, X, Check, CalendarClock } from "lucide-react";
import { Activity } from "./SwipeCard";
import { cn } from "@/lib/utils";

interface BottomSheetConfirmationProps {
    activity: Activity | null;
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    onTimeout: () => void;
    isUrgent?: boolean;
}

const TIMER_DURATION = 120; // 2 minutes

export default function BottomSheetConfirmation({
    activity,
    isOpen,
    onConfirm,
    onCancel,
    onTimeout,
    isUrgent: _isUrgent,
}: BottomSheetConfirmationProps) {
    const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [isExpired, setIsExpired] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Reset timer when opened
    useEffect(() => {
        if (isOpen) {
            setTimeLeft(TIMER_DURATION);
            setIsConfirmed(false);
            setIsExpired(false);
            setIsSubmitting(false);
            setErrorMsg(null);
        }
    }, [isOpen]);

    // Countdown logic
    useEffect(() => {
        if (!isOpen || isConfirmed || isExpired || isSubmitting) return;

        if (timeLeft <= 0) {
            setIsExpired(true);
            const expiredTimer = setTimeout(() => {
                onTimeout();
            }, 2000);
            return () => clearTimeout(expiredTimer);
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, timeLeft, isConfirmed, isExpired, isSubmitting, onTimeout]);

    const handleConfirm = async () => {
        if (!activity) return;

        setIsSubmitting(true);
        setErrorMsg(null);

        try {
            const res = await fetch("/api/participations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activity_id: activity.id })
            });

            const body = await res.json();

            if (!res.ok) {
                // Using the standard error response format we defined
                throw new Error(body.message || body.error || "Impossible de rejoindre l'activit\u00e9");
            }

            // Success Animation
            setIsConfirmed(true);
            setTimeout(() => {
                onConfirm();
            }, 1500);

        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : "Impossible de rejoindre l'activité");
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const progressPercentage = (timeLeft / TIMER_DURATION) * 100;

    // HSL continuous color interpolation: 
    // Max timer (100%) = Hue 160 (playzi-green match) -> End timer (0%) = Hue 0 (Red)
    const hue = (timeLeft / TIMER_DURATION) * 160;
    const timerColor = `hsl(${Math.max(0, hue)}, 85%, 42%)`;

    // Discret pulse every 30 seconds
    const isPulsing = timeLeft > 0 && timeLeft < TIMER_DURATION && timeLeft % 30 === 0;

    if (!activity) return null;

    const formatSportLabel = (value: string) =>
        value
            .trim()
            .toLocaleLowerCase("fr-FR")
            .split(/([\s-]+)/)
            .map((part) => (/[\s-]+/.test(part) ? part : part.charAt(0).toLocaleUpperCase("fr-FR") + part.slice(1)))
            .join("");

    // Format ISO start_time wrapper for UI
    const dateObj = new Date(activity.start_time);
    const datePart = dateObj.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short"
    });
    const timePart = dateObj.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
    });
    const rawFormatedTime = `${datePart} à ${timePart}`.replace(/\./g, "");
    // Force lowercase except the very first letter (e.g., "mer 4 mars à 13:24" -> "Mer 4 mars à 13:24")
    const formattedTime = rawFormatedTime.charAt(0).toUpperCase() + rawFormatedTime.slice(1);
    const formattedSport = formatSportLabel(activity.sport || "Sport");
    const startsAtMs = dateObj.getTime();
    const isDepartureImminent = Number.isFinite(startsAtMs) && startsAtMs > Date.now() && startsAtMs - Date.now() <= 2 * 60 * 60 * 1000;
    const isEmergencyMode = _isUrgent || isDepartureImminent;
    const successMessage = isEmergencyMode
        ? "⚠️ Départ imminent. Prépare-toi."
        : "Tu es inscrit à cette activité.\nRetrouve-la dans Mes activités.";

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-md"
                        onClick={onCancel}
                    />

                    {/* Bottom Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-x-0 bottom-0 z-[80] p-6 bg-white rounded-t-[32px] shadow-2xl flex flex-col gap-6"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-playzi-orange uppercase tracking-wider">
                                    Pré-inscription
                                </p>
                                <h3 className="text-2xl font-black text-gray-dark leading-tight">
                                    {formattedSport}
                                </h3>
                            </div>
                            <button
                                onClick={onCancel}
                                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Recap info */}
                        <div className="rounded-2xl border border-gray-100 bg-gray-50/85 p-4">
                            <div className="grid grid-cols-[78px_1fr] items-center gap-2 text-[12px]">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-300">Sport</span>
                                <span className="truncate text-right font-black text-[#242841]">{formattedSport}</span>
                            </div>
                            <div className="mt-2 grid grid-cols-[78px_1fr] items-center gap-2 text-[12px]">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-300">
                                    <MapPin className="h-3.5 w-3.5" />
                                    Lieu
                                </span>
                                <span className="truncate text-right font-black text-[#242841]">{activity.location}</span>
                            </div>
                            <div className="mt-2 grid grid-cols-[78px_1fr] items-center gap-2 text-[12px]">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-300">
                                    <CalendarClock className="h-3.5 w-3.5" />
                                    Date
                                </span>
                                <span className="truncate text-right font-black text-[#242841]">{formattedTime}</span>
                            </div>
                        </div>

                        {isConfirmed ? (
                            // Success State
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.28, ease: "easeOut" }}
                                className="relative overflow-hidden rounded-2xl border border-emerald-100/80 bg-gradient-to-b from-emerald-100/65 via-emerald-50/55 to-white px-5 py-6 text-center"
                            >
                                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_48%)]" />
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-white/75" />
                                <div className="relative z-10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-100/80 shadow-[0_12px_22px_rgba(16,185,129,0.18)]">
                                    <motion.div
                                        initial={{ scale: 0.95, opacity: 0 }}
                                        animate={{ scale: [0.95, 1.05, 1], opacity: [0, 1, 1] }}
                                        transition={{ duration: 0.4, ease: "easeOut" }}
                                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-[0_0_0_6px_rgba(16,185,129,0.08)]"
                                    >
                                        <Check className="h-5 w-5 text-emerald-600 stroke-[2.8px]" />
                                    </motion.div>
                                </div>
                                <p className="relative z-10 text-[22px] font-black tracking-tight text-[#1F2438]">Participation confirmée</p>
                                <p className="relative z-10 mt-2 whitespace-pre-line text-[14px] font-medium leading-relaxed text-gray-500">{successMessage}</p>
                            </motion.div>
                        ) : isExpired ? (
                            // Expired State
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center py-6 text-center"
                            >
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className="mb-4 bg-gray-50 p-4 rounded-full"
                                >
                                    <Clock className="w-10 h-10 text-gray-400" />
                                </motion.div>
                                <p className="text-lg font-bold text-gray-dark mb-1">Pré-inscription expirée</p>
                                <p className="text-sm text-gray-500 font-medium tracking-tight">Le délai de confirmation est terminé</p>
                            </motion.div>
                        ) : (
                            // Actions State
                            <div className="flex flex-col gap-3">
                                {isEmergencyMode && (
                                    <div className="flex items-center gap-2 px-1">
                                        <span className="text-orange-400 text-[15px] leading-none">⚠️</span>
                                        <p className="text-[12px] font-semibold text-orange-500 leading-snug">
                                            Mode urgence actif. Inscription last-minute.
                                        </p>
                                    </div>
                                )}

                                {/* Error Message Display */}
                                {errorMsg && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl text-center border border-red-100"
                                    >
                                        {errorMsg}
                                    </motion.div>
                                )}

                                <div className="flex items-center gap-4">
                                    {/* Timer Circle */}
                                    <div className="relative flex-shrink-0 w-16 h-16 flex items-center justify-center bg-gray-50 rounded-full shadow-inner">
                                        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                                            <circle
                                                cx="32"
                                                cy="32"
                                                r="28"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                fill="transparent"
                                                className="text-gray-200"
                                            />
                                            <motion.circle
                                                cx="32"
                                                cy="32"
                                                r="28"
                                                stroke={timerColor}
                                                strokeWidth="4"
                                                fill="transparent"
                                                strokeDasharray="176"
                                                strokeDashoffset={176 - (176 * progressPercentage) / 100}
                                                animate={
                                                    isPulsing && !isSubmitting
                                                        ? { scale: [1, 1.08, 1], opacity: [1, 0.7, 1] }
                                                        : { scale: 1, opacity: 1 }
                                                }
                                                transition={{
                                                    duration: 1,
                                                    ease: "easeInOut"
                                                }}
                                                style={{ transformOrigin: "center" }}
                                                className="transition-colors duration-1000 ease-linear"
                                            />
                                        </svg>
                                        <motion.span
                                            animate={
                                                isPulsing && !isSubmitting
                                                    ? { scale: [1, 1.08, 1], opacity: [1, 0.7, 1] }
                                                    : { scale: 1, opacity: 1 }
                                            }
                                            transition={{
                                                duration: 1,
                                                ease: "easeInOut"
                                            }}
                                            style={{ color: timerColor }}
                                            className="text-sm font-black tabular-nums relative z-10 transition-colors duration-1000 ease-linear"
                                        >
                                            {formatTime(timeLeft)}
                                        </motion.span>
                                    </div>

                                    {/* Confirm Button */}
                                    <button
                                        onClick={handleConfirm}
                                        disabled={isSubmitting}
                                        className={cn(
                                            "flex-1 py-4 text-center text-white text-lg font-bold rounded-2xl transition-all",
                                            isSubmitting
                                                ? "bg-emerald-400 opacity-80 cursor-not-allowed"
                                                : "bg-playzi-green shadow-[0_8px_0_rgb(4,120,87)] hover:shadow-[0_4px_0_rgb(4,120,87)] hover:translate-y-1 active:shadow-none active:translate-y-2"
                                        )}
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Inscription...
                                            </span>
                                        ) : (
                                            "Confirmer ma place"
                                        )}
                                    </button>
                                </div>

                                {/* Cancel Button */}
                                <button
                                    onClick={onCancel}
                                    disabled={isSubmitting}
                                    className="text-sm font-medium text-gray-400 hover:text-gray-dark transition-colors py-2 disabled:opacity-50"
                                >
                                    Annuler
                                </button>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
