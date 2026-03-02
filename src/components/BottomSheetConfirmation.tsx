"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Clock, X, CheckCircle2 } from "lucide-react";
import { Activity } from "./SwipeCard";
import { cn } from "@/lib/utils";

interface BottomSheetConfirmationProps {
    activity: Activity | null;
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    onTimeout: () => void;
}

const TIMER_DURATION = 120; // 2 minutes

export default function BottomSheetConfirmation({
    activity,
    isOpen,
    onConfirm,
    onCancel,
    onTimeout,
}: BottomSheetConfirmationProps) {
    const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [isExpired, setIsExpired] = useState(false);

    // Reset timer when opened
    useEffect(() => {
        if (isOpen) {
            setTimeLeft(TIMER_DURATION);
            setIsConfirmed(false);
            setIsExpired(false);
        }
    }, [isOpen]);

    // Countdown logic
    useEffect(() => {
        if (!isOpen || isConfirmed || isExpired) return;

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
    }, [isOpen, timeLeft, isConfirmed, isExpired, onTimeout]);

    const handleConfirm = () => {
        setIsConfirmed(true);
        // Add a slight delay to allow the "success" animation to play before calling onConfirm
        setTimeout(() => {
            onConfirm();
        }, 1500);
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

    // Format ISO start_time wrapper for UI
    const formattedTime = new Date(activity.start_time).toLocaleString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).replace(/,/g, " à").replace(/\./g, "");

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                        onClick={onCancel}
                    />

                    {/* Bottom Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-x-0 bottom-0 z-50 p-6 bg-white rounded-t-[32px] shadow-2xl flex flex-col gap-6"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-playzi-orange uppercase tracking-wider">
                                    Pré-inscription
                                </p>
                                <h3 className="text-2xl font-black text-gray-dark leading-tight">
                                    {activity.sport}
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
                        <div className="p-4 bg-gray-50 rounded-2xl space-y-3">
                            <div className="flex items-center gap-3 text-gray-dark font-medium">
                                <div className="p-2 bg-white rounded-full shadow-sm">
                                    <MapPin className="w-5 h-5 text-playzi-purple" />
                                </div>
                                <span>{activity.location}</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-dark font-medium">
                                <div className="p-2 bg-white rounded-full shadow-sm">
                                    <Clock className="w-5 h-5 text-playzi-green" />
                                </div>
                                <span className="capitalize">{formattedTime}</span>
                            </div>
                        </div>

                        {isConfirmed ? (
                            // Success State
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="flex flex-col items-center justify-center py-6 space-y-4"
                            >
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", delay: 0.2 }}
                                    className="rounded-full bg-playzi-green/20 p-4"
                                >
                                    <CheckCircle2 className="w-16 h-16 text-playzi-green" />
                                </motion.div>
                                <p className="text-xl font-bold text-gray-dark">Participant confirmé !</p>
                                <p className="text-sm text-gray-500">Prépare tes affaires 🙌</p>
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
                                                    isPulsing
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
                                                isPulsing
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
                                        className="flex-1 py-4 text-center bg-playzi-green text-white text-lg font-bold rounded-2xl shadow-[0_8px_0_rgb(4,120,87)] hover:shadow-[0_4px_0_rgb(4,120,87)] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all"
                                    >
                                        Confirmer ma place
                                    </button>
                                </div>

                                {/* Cancel Button */}
                                <button
                                    onClick={onCancel}
                                    className="text-sm font-medium text-gray-400 hover:text-gray-dark transition-colors py-2"
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
