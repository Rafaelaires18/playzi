"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Smile, Meh, Frown, CheckCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Activity } from "@/components/SwipeCard";

export interface BottomSheetFeedbackProps {
    isOpen: boolean;
    onClose: () => void;
    activity: Activity & {
        feedbackStatus?: string;
        creator?: {
            id: string;
            pseudo: string;
        } | null;
        participations?: {
            status: string;
            user_id: string;
            profiles?: { pseudo: string }
        }[]
    } | null;
}

export default function BottomSheetFeedback({ isOpen, onClose, activity }: BottomSheetFeedbackProps) {
    type PulseSummaryBreakdownItem = {
        reason_code?: string;
        reason_label?: string;
        signed_points?: number;
        created_at?: string | null;
    };
    const LAST_SEEN_KEY = "playzi_last_seen_pulse_summary_at";

    const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
    const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
    const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
    const [rating, setRating] = useState<number>(5);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [fallbackParticipants, setFallbackParticipants] = useState<{ id: string; pseudo: string }[]>([]);
    const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
    const [pulseSummary, setPulseSummary] = useState<{ total_points: number; breakdown: PulseSummaryBreakdownItem[]; created_at?: string | null } | null>(null);

    useEffect(() => {
        fetch("/api/auth/me").then(r => r.json()).then(d => {
            if (d.data?.user?.id) setUserId(d.data.user.id);
        }).catch(console.error);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSelectedProblem(null);
            setSelectedParticipant(null);
            setRating(5);
            setComment("");
            setIsSubmitting(false);
            setFallbackParticipants([]);
            setIsLoadingParticipants(false);
            setPulseSummary(null);
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
            // Ensure positive feedback never sends a targeted issue payload
            setSelectedProblem(null);
            setSelectedParticipant(null);
            setComment("");
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
                        reported_user: selectedParticipant || undefined,
                        comment: comment ? comment : undefined
                    })
                });

                if (res.ok) {
                    let okData: any = null;
                    try { okData = await res.json(); } catch (e) { }
                    const summary = okData?.data?.pulse_summary;
                    const parsedSummary = summary && Array.isArray(summary.breakdown)
                        ? {
                            total_points: Number(summary.total_points || 0),
                            breakdown: summary.breakdown as PulseSummaryBreakdownItem[],
                            created_at: summary.created_at || null,
                        }
                        : null;
                    setPulseSummary(parsedSummary);

                    if (!parsedSummary && activity?.id) {
                        try {
                            const summaryRes = await fetch(`/api/pulse/summary?activity_id=${activity.id}`, { cache: "no-store" });
                            const summaryJson = await summaryRes.json();
                            const fallback = summaryJson?.data?.summary;
                            if (summaryRes.ok && fallback && Array.isArray(fallback.breakdown)) {
                                setPulseSummary({
                                    total_points: Number(fallback.total_points || 0),
                                    breakdown: fallback.breakdown as PulseSummaryBreakdownItem[],
                                    created_at: fallback.created_at || null,
                                });
                            }
                        } catch (e) {
                            console.error("Failed to load pulse summary fallback", e);
                        }
                    }
                    activity.feedbackStatus = 'completed';
                    setStep(4);
                } else {
                    let errData;
                    try { errData = await res.json(); } catch (e) { }

                    let errorMsg = "Erreur inconnue";
                    if (errData?.error) {
                        if (typeof errData.error === 'string') {
                            errorMsg = errData.error;
                        } else if (typeof errData.error === 'object') {
                            errorMsg = errData.error.details || errData.error.message || JSON.stringify(errData.error);
                        }
                    }

                    console.error("Failed to submit feedback:", errorMsg);
                    alert(`Erreur: ${errorMsg}`);
                }
            }
        } catch (e: any) {
            console.error("Feedback fetch exception:", e);
            alert(`Erreur réseau: ${e?.message || 'Connexion impossible'}`);
        } finally {
            setIsSubmitting(false);
            if (overrideRating && !activity) onClose(); // Fallback
        }
    };

    const baseParticipants = [
        ...(activity?.creator && activity.creator.id !== userId
            ? [{ id: activity.creator.id, pseudo: activity.creator.pseudo || "Organisateur" }]
            : []),
        ...(activity?.participations
            ?.filter(p => p.status === 'confirmé' && p.user_id !== userId)
            ?.map(p => ({
                id: p.user_id,
                pseudo: p.profiles?.pseudo || "Utilisateur"
            })) || [])
    ].filter((participant, index, self) => self.findIndex((p) => p.id === participant.id) === index);

    const participantsObjects = useMemo(() => {
        const source = baseParticipants.length > 0 ? baseParticipants : fallbackParticipants;
        return source.filter((participant, index, self) => self.findIndex((p) => p.id === participant.id) === index);
    }, [baseParticipants, fallbackParticipants]);

    useEffect(() => {
        const loadParticipantsFallback = async () => {
            if (!isOpen || !activity?.id || !userId) return;
            if (baseParticipants.length > 0) return;
            if (step !== 3) return;

            setIsLoadingParticipants(true);
            try {
                const res = await fetch(`/api/activities/${activity.id}?t=${Date.now()}`, { cache: "no-store" });
                if (!res.ok) return;

                const json = await res.json();
                const apiActivity = json?.data;
                if (!apiActivity) return;

                const loadedParticipants = [
                    ...(apiActivity.creator?.id && apiActivity.creator.id !== userId
                        ? [{ id: apiActivity.creator.id, pseudo: apiActivity.creator.pseudo || "Organisateur" }]
                        : []),
                    ...((apiActivity.participations || [])
                        .filter((p: any) => p.status === "confirmé" && p.user_id !== userId)
                        .map((p: any) => ({
                            id: p.user_id,
                            pseudo: p.profiles?.pseudo || "Utilisateur",
                        }))),
                ].filter((participant: { id: string; pseudo: string }, index: number, self: { id: string; pseudo: string }[]) =>
                    self.findIndex((p) => p.id === participant.id) === index
                );

                setFallbackParticipants(loadedParticipants);
            } catch (error) {
                console.error("Failed to load participants fallback", error);
            } finally {
                setIsLoadingParticipants(false);
            }
        };

        loadParticipantsFallback();
    }, [isOpen, activity?.id, userId, baseParticipants.length, step]);

    const isAutre = selectedProblem === "Autre";
    const hasValidCommentForAutre = !isAutre || comment.trim().length > 0;
    const canSubmitIssue = Boolean(selectedProblem && selectedParticipant && hasValidCommentForAutre && !isSubmitting);
    const formatSignedPoints = (value: number) => `${value >= 0 ? "+" : ""}${value}`;
    const markSummarySeen = () => {
        if (!pulseSummary?.created_at) return;
        window.localStorage.setItem(LAST_SEEN_KEY, pulseSummary.created_at);
    };
    const handleThanksOk = () => {
        if (pulseSummary) {
            setStep(5);
            return;
        }
        onClose();
    };

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
            {isOpen && activity && (
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

                    {step === 5 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 12, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 12, scale: 0.98 }}
                            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
                        >
                            <div className="w-full max-w-[320px] rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_18px_40px_rgba(12,20,35,0.18)]">
                                <h3 className="text-[20px] font-black text-[#242841]">Résumé Pulse</h3>
                                <div className="mt-3 space-y-1.5">
                                    {pulseSummary?.breakdown.map((line, index) => {
                                        const points = Number(line.signed_points || 0);
                                        return (
                                            <div key={`${line.reason_code || "line"}-${index}`} className="flex items-center justify-between gap-2 text-[12px]">
                                                <span className="font-semibold text-gray-600 truncate">{line.reason_label || line.reason_code || "Variation Pulse"}</span>
                                                <span className={`font-black ${points >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{formatSignedPoints(points)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                                    <span className="text-[12px] font-bold text-gray-700">Total</span>
                                    <span className={`text-[19px] font-black ${Number(pulseSummary?.total_points || 0) >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                        {formatSignedPoints(Number(pulseSummary?.total_points || 0))}
                                    </span>
                                </div>
                                <button
                                    onClick={() => {
                                        markSummarySeen();
                                        onClose();
                                    }}
                                    className="mt-4 w-full rounded-2xl bg-[#242841] py-3 text-[14px] font-black text-white transition hover:opacity-95 active:scale-[0.98]"
                                >
                                    Compris
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            variants={sheetVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            drag={step !== 4 ? "y" : false}
                            dragConstraints={{ top: 0 }}
                            dragElastic={0.05}
                            onDragEnd={(_, info) => {
                                if (info.offset.y > 100 && step !== 4) onClose();
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
                                {step === 1 ? "Ton avis" : step === 2 ? "Quel est le problème ?" : step === 3 ? "Qui est concerné ?" : "Merci pour ton feedback"}
                            </h2>
                            {step !== 4 && (
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* SUBTITLE */}
                        {step !== 4 && (
                            <div className="px-6 py-4">
                                <p className="text-[15px] font-medium text-gray-500 leading-relaxed">
                                    {step === 1
                                        ? `Comment s'est passée l'activité de ${activity.sport} ?`
                                        : step === 2
                                            ? "Choisis le motif du problème."
                                            : "Sélectionne la personne concernée pour valider le signalement."}
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
                                            "Participant absent (no-show)",
                                            "Retard important (+30 min)",
                                            "Mauvais comportement",
                                            "Autre"
                                        ].map(motif => (
                                            <button
                                                key={motif}
                                                onClick={() => {
                                                    setSelectedProblem(motif);
                                                    setSelectedParticipant(null);
                                                    setComment("");
                                                    setStep(3);
                                                }}
                                                className={`text-left px-5 py-3.5 rounded-xl border-2 font-bold transition-all text-[14px] ${selectedProblem === motif
                                                    ? "bg-rose-500 border-rose-500 text-white"
                                                    : "bg-white border-gray-200 text-gray-600 hover:border-rose-200"
                                                    }`}
                                            >
                                                {motif}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => setStep(1)}
                                        className="text-gray-400 font-bold text-sm text-center py-2"
                                    >
                                        Retour
                                    </button>
                                </div>
                            ) : step === 3 ? (
                                <div className="flex flex-col gap-5">
                                    <div className="bg-gray-100/60 rounded-xl p-3 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Motif</span>
                                            <span className="text-[14px] font-extrabold text-gray-700 truncate block">{selectedProblem}</span>
                                        </div>
                                        <button
                                            onClick={() => setStep(2)}
                                            className="text-[12px] font-bold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg active:scale-95"
                                        >
                                            Modifier
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-2 mt-1">
                                        <label className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">
                                            Qui est concerné ?
                                        </label>
                                        {isLoadingParticipants && (
                                            <div className="text-center py-4 bg-gray-50 rounded-xl text-gray-500 text-[13px] font-medium">
                                                Chargement des participants...
                                            </div>
                                        )}
                                        {!isLoadingParticipants && participantsObjects.length === 0 && (
                                            <div className="text-center py-4 bg-gray-50 rounded-xl text-gray-500 text-[13px] font-medium">
                                                Aucun participant signalable pour cette activité.
                                            </div>
                                        )}
                                        {!isLoadingParticipants && participantsObjects.length > 0 && (
                                            <div className="flex flex-col gap-2 mt-1">
                                                {participantsObjects.map(participant => {
                                                    const isSelected = selectedParticipant === participant.id;
                                                    return (
                                                        <button
                                                            key={participant.id}
                                                            onClick={() => setSelectedParticipant(participant.id)}
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
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2 mt-1">
                                        <label className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">
                                            Explication {isAutre ? "(obligatoire)" : "(facultatif)"}
                                        </label>
                                        <textarea
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            placeholder={isAutre ? "Décris le problème." : "Un détail à ajouter ?"}
                                            maxLength={300}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-[15px] text-gray-dark min-h-[100px] resize-none focus:outline-none focus:border-rose-400 focus:bg-white transition-all placeholder:text-gray-400"
                                        />
                                    </div>

                                    <button
                                        disabled={!canSubmitIssue}
                                        onClick={() => handleComplete()}
                                        className={`mt-2 w-full py-4 rounded-2xl font-black text-[15px] flex justify-center items-center transition-all ${canSubmitIssue
                                            ? "bg-gray-dark text-white shadow-lg active:scale-95 hover:bg-black"
                                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                            }`}
                                    >
                                        {isSubmitting ? "Envoi..." : "Envoyer le signalement"}
                                    </button>

                                    <button
                                        onClick={() => {
                                            setSelectedParticipant(null);
                                            setComment("");
                                            setStep(2);
                                        }}
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
                                    <h3 className="text-lg font-bold text-gray-800">Merci pour ton feedback</h3>
                                    <p className="text-sm font-medium text-gray-500 max-w-[270px]">
                                        Merci pour ton avis, ça aide à garder Playzi fiable, sportive et agréable pour tout le monde.
                                    </p>
                                    <button
                                        onClick={handleThanksOk}
                                        className="mt-2 w-full max-w-[240px] rounded-2xl bg-[#242841] py-3 text-[14px] font-black text-white transition hover:opacity-95 active:scale-[0.98]"
                                    >
                                        OK
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                    )}
                </>
            )}
        </AnimatePresence>
    );
}
