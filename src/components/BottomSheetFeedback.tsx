"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Smile, Meh, Frown, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Activity } from "@/components/SwipeCard";

export interface BottomSheetFeedbackProps {
    isOpen: boolean;
    onClose: () => void;
    activity: Activity & { feedbackStatus?: string } | null;
}

export default function BottomSheetFeedback({ isOpen, onClose, activity }: BottomSheetFeedbackProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
    const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSelectedProblem(null);
            setSelectedParticipants([]);
            setIsSubmitting(false);
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    const handleQuickFeedback = (type: 'super' | 'ok' | 'problem') => {
        if (type === 'problem') {
            setStep(2);
        } else {
            // "Super" or "Ça va" -> Complete immediately
            handleComplete();
        }
    };

    const handleComplete = () => {
        setIsSubmitting(true);
        // Simulate network request
        setTimeout(() => {
            if (activity) {
                // In a real app, this would be an API call
                activity.feedbackStatus = 'completed';
            }
            setIsSubmitting(false);
            onClose();
        }, 500);
    };

    if (!isOpen || !activity) return null;

    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2 } },
        exit: { opacity: 0, transition: { duration: 0.2 } },
    };

    const sheetVariants = {
        hidden: { y: "100%", transition: { type: "tween" as const, duration: 0.3 } },
        visible: { y: 0, transition: { type: "spring" as const, damping: 25, stiffness: 200 } },
        exit: { y: "100%", transition: { type: "tween" as const, duration: 0.3 } },
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* BACKDROP */}
                    <motion.div
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                    />

                    {/* BOTTOM SHEET */}
                    <motion.div
                        variants={sheetVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        drag="y"
                        dragConstraints={{ top: 0 }}
                        dragElastic={0.05}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 100) onClose();
                        }}
                        className="fixed bottom-0 inset-x-0 z-[101] bg-white rounded-t-3xl shadow-xl flex flex-col max-h-[90vh] pb-safe"
                    >
                        {/* DRAG HANDLE */}
                        <div className="w-full flex justify-center pt-3 pb-2 touch-none cursor-grab active:cursor-grabbing">
                            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                        </div>

                        {/* HEADER */}
                        <div className="flex items-center justify-between px-6 pb-4 border-b border-gray-100">
                            <h2 className="text-xl font-black text-gray-dark">
                                {step === 1 ? "Ton avis" : "Quel est le problème ?"}
                            </h2>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* SUBTITLE */}
                        <div className="px-6 py-4">
                            <p className="text-[15px] font-medium text-gray-500 leading-relaxed">
                                {step === 1
                                    ? `Comment s'est passée l'activité de ${activity.variant || activity.sport} ?`
                                    : "Précise le motif pour maintenir une communauté saine et fiable."}
                            </p>
                        </div>

                        {/* DYNAMIC CONTENT */}
                        <div className="px-6 pb-8 overflow-y-auto">
                            {step === 1 ? (
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => handleQuickFeedback('super')}
                                        className="flex flex-col items-center justify-center gap-2 bg-[#10B981]/10 border-2 border-[#10B981]/20 hover:border-[#10B981] active:bg-[#10B981]/20 rounded-2xl p-4 transition-all"
                                    >
                                        <Smile className="w-8 h-8 text-[#10B981]" />
                                        <span className="font-extrabold text-[#10B981] text-[15px]">Super</span>
                                    </button>

                                    <button
                                        onClick={() => handleQuickFeedback('ok')}
                                        className="flex flex-col items-center justify-center gap-2 bg-indigo-50 border-2 border-indigo-100 hover:border-indigo-300 active:bg-indigo-100 rounded-2xl p-4 transition-all"
                                    >
                                        <Meh className="w-8 h-8 text-indigo-400" />
                                        <span className="font-extrabold text-indigo-500 text-[15px]">Ça va</span>
                                    </button>

                                    <button
                                        onClick={() => handleQuickFeedback('problem')}
                                        className="flex flex-col items-center justify-center gap-2 bg-rose-50 border-2 border-rose-100 hover:border-rose-400 active:bg-rose-100 rounded-2xl p-4 transition-all"
                                    >
                                        <Frown className="w-8 h-8 text-rose-500" />
                                        <span className="font-extrabold text-rose-500 text-[15px]">Problème</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-5">
                                    {/* ISSUE SELECTOR */}
                                    <div className="flex flex-col gap-2">
                                        {[
                                            "Faux plan (No-show)",
                                            "Retard important sans prévenir",
                                            "Mauvais comportement",
                                            "Autre"
                                        ].map(motif => (
                                            <button
                                                key={motif}
                                                onClick={() => setSelectedProblem(motif)}
                                                className={`text-left px-5 py-3.5 rounded-xl border-2 font-bold transition-all text-[14px] ${selectedProblem === motif
                                                    ? "bg-rose-500 border-rose-500 text-white"
                                                    : "bg-white border-gray-200 text-gray-600 hover:border-rose-200"
                                                    }`}
                                            >
                                                {motif}
                                            </button>
                                        ))}
                                    </div>

                                    {/* PERSONNES CONCERNÉES */}
                                    {selectedProblem && (
                                        <div className="flex flex-col gap-2 mt-2">
                                            <div>
                                                <label className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">
                                                    Personnes concernées
                                                </label>
                                            </div>
                                            <div className="flex flex-col gap-2 mt-1">
                                                {["Léo", "Alice", "Sam", "Marie"].map(name => {
                                                    const isSelected = selectedParticipants.includes(name);
                                                    return (
                                                        <button
                                                            key={name}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setSelectedParticipants(prev => prev.filter(p => p !== name));
                                                                } else {
                                                                    setSelectedParticipants(prev => [...prev, name]);
                                                                }
                                                            }}
                                                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${isSelected
                                                                ? "border-rose-500 bg-rose-50"
                                                                : "border-gray-200 bg-white hover:border-rose-200"
                                                                }`}
                                                        >
                                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-rose-500 border-rose-500" : "border-gray-300"
                                                                }`}>
                                                                {isSelected && <CheckCircle className="w-3 h-3 text-white" strokeWidth={3} />}
                                                            </div>
                                                            <span className={`font-bold text-[14px] ${isSelected ? "text-rose-600" : "text-gray-700"}`}>
                                                                {name}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* OPTIONAL TEXT */}
                                    {selectedProblem && (
                                        <div className="flex flex-col gap-2 mt-2">
                                            <label className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">
                                                Explication (facultatif)
                                            </label>
                                            <textarea
                                                placeholder="Un détail à ajouter ?"
                                                maxLength={300}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-[15px] text-gray-dark min-h-[100px] resize-none focus:outline-none focus:border-rose-400 focus:bg-white transition-all placeholder:text-gray-400"
                                            />
                                        </div>
                                    )}

                                    {/* SUBMIT BUTTON */}
                                    <button
                                        disabled={!selectedProblem || (selectedProblem !== "Autre" && selectedParticipants.length === 0) || isSubmitting}
                                        onClick={handleComplete}
                                        className={`mt-4 w-full py-4 rounded-2xl font-black text-[15px] flex justify-center items-center transition-all ${selectedProblem && (selectedProblem === "Autre" || selectedParticipants.length > 0) && !isSubmitting
                                            ? "bg-gray-dark text-white shadow-lg active:scale-95 hover:bg-black"
                                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                            }`}
                                    >
                                        {isSubmitting ? "Envoi..." : "Envoyer le signalement"}
                                    </button>

                                    <button
                                        onClick={() => setStep(1)}
                                        className="text-gray-400 font-bold text-sm text-center py-2"
                                    >
                                        Retour
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
