"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Smile, Meh, Frown, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Activity } from "@/components/SwipeCard";

export interface BottomSheetFeedbackProps {
    isOpen: boolean;
    onClose: () => void;
    activity: Activity & {
        feedbackStatus?: string;
        participations?: {
            status: string;
            user_id: string;
            profiles?: { pseudo: string }
        }[]
    } | null;
}

export default function BottomSheetFeedback({ isOpen, onClose, activity }: BottomSheetFeedbackProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
    const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
    const [rating, setRating] = useState<number>(5);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/auth/me").then(r => r.json()).then(d => {
            if (d.data?.user?.id) setUserId(d.data.user.id);
        }).catch(console.error);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSelectedProblem(null);
            setSelectedParticipants([]);
            setRating(5);
            setComment("");
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
            setRating(1);
            setStep(2);
        } else {
            // "Super" or "Ça va" -> Complete immediately with specific rating
            const val = type === 'super' ? 5 : 3;
            setRating(val);
            handleComplete(val);
        }
    };

    const handleComplete = async (overrideRating?: number) => {
        setIsSubmitting(true);
        const finalRating = overrideRating || rating;

        try {
            if (activity) {
                const res = await fetch(`/api/activities/${activity.id}/feedback`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        rating: finalRating,
                        issues: selectedProblem ? [selectedProblem] : [],
                        reported_users: selectedParticipants,
                        comment: comment ? comment : undefined
                    })
                });

                if (res.ok) {
                    activity.feedbackStatus = 'completed';
                    setStep(3); // Show success message
                    setTimeout(() => {
                        onClose();
                    }, 2000);
                } else {
                    console.error("Failed to submit feedback");
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
            if (overrideRating && !activity) onClose(); // Fallback
        }
    };

    if (!isOpen || !activity) return null;

    const participantsObjects = activity?.participations
        ?.filter(p => p.status === 'confirmé' && p.user_id !== userId)
        ?.map(p => ({
            id: p.user_id,
            pseudo: p.profiles?.pseudo || "Utilisateur"
        })) || [];

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
                        drag={step !== 3 ? "y" : false} // Disable drag on success step
                        dragConstraints={{ top: 0 }}
                        dragElastic={0.05}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 100 && step !== 3) onClose();
                        }}
                        className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-md z-[101] bg-white rounded-t-3xl shadow-xl flex flex-col max-h-[90vh] pb-safe"
                    >
                        {/* DRAG HANDLE */}
                        <div className="w-full flex justify-center pt-3 pb-2 touch-none cursor-grab active:cursor-grabbing">
                            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                        </div>

                        {/* HEADER */}
                        <div className="flex items-center justify-between px-6 pb-4 border-b border-gray-100">
                            <h2 className="text-xl font-black text-gray-dark">
                                {step === 1 ? "Ton avis" : step === 2 ? "Quel est le problème ?" : "Merci !"}
                            </h2>
                            {step !== 3 && (
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* SUBTITLE */}
                        {step !== 3 && (
                            <div className="px-6 py-4">
                                <p className="text-[15px] font-medium text-gray-500 leading-relaxed">
                                    {step === 1
                                        ? `Comment s'est passée l'activité de ${activity.sport} ?`
                                        : "Précise le motif pour maintenir une communauté saine et fiable."}
                                </p>
                            </div>
                        )}

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
                            ) : step === 2 ? (
                                <div className="flex flex-col gap-5">
                                    {/* ISSUE SELECTOR */}
                                    <div className="flex flex-col gap-2">
                                        {[
                                            "Absent (No-show)",
                                            "Retard imprévu",
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
                                    {selectedProblem && participantsObjects.length > 0 && (
                                        <div className="flex flex-col gap-2 mt-2">
                                            <div>
                                                <label className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">
                                                    Personnes concernées
                                                </label>
                                            </div>
                                            <div className="flex flex-col gap-2 mt-1">
                                                {participantsObjects.map(participant => {
                                                    const isSelected = selectedParticipants.includes(participant.id);
                                                    return (
                                                        <button
                                                            key={participant.id}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setSelectedParticipants(prev => prev.filter(p => p !== participant.id));
                                                                } else {
                                                                    setSelectedParticipants(prev => [...prev, participant.id]);
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
                                                                {participant.pseudo}
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
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                                placeholder="Un détail à ajouter ?"
                                                maxLength={300}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-[15px] text-gray-dark min-h-[100px] resize-none focus:outline-none focus:border-rose-400 focus:bg-white transition-all placeholder:text-gray-400"
                                            />
                                        </div>
                                    )}

                                    {/* SUBMIT BUTTON */}
                                    <button
                                        disabled={!selectedProblem || (selectedProblem !== "Autre" && selectedParticipants.length === 0 && participantsObjects.length > 0) || isSubmitting}
                                        onClick={() => handleComplete()}
                                        className={`mt-4 w-full py-4 rounded-2xl font-black text-[15px] flex justify-center items-center transition-all ${selectedProblem && (selectedProblem === "Autre" || selectedParticipants.length > 0 || participantsObjects.length === 0) && !isSubmitting
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
                            ) : (
                                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                                    <div className="w-16 h-16 bg-[#10B981]/10 rounded-full flex items-center justify-center mb-2">
                                        <CheckCircle className="w-8 h-8 text-[#10B981]" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800">Merci pour ton avis !</h3>
                                    <p className="text-sm font-medium text-gray-500 max-w-[240px]">
                                        Ton retour est précieux pour maintenir une communauté fiable et respectueuse.
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
