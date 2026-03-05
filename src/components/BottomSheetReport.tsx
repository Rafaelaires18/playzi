"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

interface BottomSheetReportProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    initialReportType?: "absence" | "problem" | null;
    activityId: string;
    participants: { id: string; user_id: string; status: string; profiles?: { pseudo: string } }[];
    currentUserId?: string;
}

export default function BottomSheetReport({ isOpen, onClose, onSubmit, initialReportType, activityId, participants, currentUserId }: BottomSheetReportProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
    const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialReportType === "absence") {
                setStep(2);
                setSelectedProblem("Faux plan (No-show)");
            } else {
                setStep(1);
                setSelectedProblem(null);
            }
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

    const [description, setDescription] = useState("");

    const handleComplete = async () => {
        if (!selectedProblem || selectedParticipants.length === 0) return;

        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/activities/${activityId}/report`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: initialReportType,
                    reason: selectedProblem,
                    description: description.trim() || undefined,
                    reported_users: selectedParticipants
                })
            });

            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "Erreur lors de l'enregistrement du signalement");
                setIsSubmitting(false);
                return;
            }

            onSubmit();
            onClose();
        } catch (err) {
            alert("Erreur r\u00e9seau ou interne.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

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

    const MOTIFS = [
        "Insulte ou propos déplacés",
        "Harcèlement",
        "Spam",
        "Comportement inapproprié",
        "Autre"
    ];

    const validParticipants = participants.filter(p => p.status === 'confirm\u00e9' && p.user_id !== currentUserId);

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
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-gray-400" />
                                <h2 className="text-xl font-black text-gray-dark">
                                    {initialReportType === "absence" ? "Signaler une absence" : "Signaler un problème"}
                                </h2>
                            </div>
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
                                    ? "Séléctionnez le motif. Nous modérons les signalements pour garantir un bon esprit au sein de la communauté."
                                    : "Précisez votre signalement pour nous aider à agir efficacement."}
                            </p>
                        </div>

                        {/* DYNAMIC CONTENT */}
                        <div className="px-6 pb-8 overflow-y-auto">
                            {step === 1 ? (
                                <div className="flex flex-col gap-2">
                                    {MOTIFS.map(motif => (
                                        <button
                                            key={motif}
                                            onClick={() => {
                                                setSelectedProblem(motif);
                                                setStep(2);
                                            }}
                                            className="text-left px-5 py-4 rounded-xl font-bold transition-all text-[15px] bg-gray-50 hover:bg-gray-100/80 text-gray-700 active:scale-[0.98]"
                                        >
                                            {motif}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-5">
                                    {/* SELECTED MOTIF RECAP */}
                                    {initialReportType === "problem" && (
                                        <div className="bg-gray-100/50 rounded-xl p-3 flex items-center gap-3">
                                            <div className="flex-1 truncate">
                                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Motif</span>
                                                <span className="text-[14px] font-extrabold text-gray-700 truncate block">{selectedProblem}</span>
                                            </div>
                                            <button
                                                onClick={() => setStep(1)}
                                                className="text-[12px] font-bold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg active:scale-95"
                                            >
                                                Modifier
                                            </button>
                                        </div>
                                    )}

                                    {/* PERSONNES CONCERNÉES */}
                                    <div className="flex flex-col gap-2 mt-2">
                                        <label className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">
                                            Personnes concernées
                                        </label>
                                        <div className="flex flex-col gap-2">
                                            {validParticipants.map(participant => {
                                                const userId = participant.user_id;
                                                const name = participant.profiles?.pseudo || "Utilisateur";
                                                const isSelected = selectedParticipants.includes(userId);
                                                return (
                                                    <button
                                                        key={userId}
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setSelectedParticipants(prev => prev.filter(id => id !== userId));
                                                            } else {
                                                                setSelectedParticipants(prev => [...prev, userId]);
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
                                            {validParticipants.length === 0 && (
                                                <div className="text-center py-4 bg-gray-50 rounded-xl text-gray-500 text-[13px] font-medium">
                                                    Aucun autre participant disponible.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* OPTIONAL TEXT */}
                                    <div className="flex flex-col gap-2 mt-2">
                                        <label className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">
                                            Explication (facultatif)
                                        </label>
                                        <textarea
                                            placeholder="Un détail à ajouter ?"
                                            maxLength={300}
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-[15px] text-gray-dark min-h-[100px] resize-none focus:outline-none focus:border-rose-400 focus:bg-white transition-all placeholder:text-gray-400"
                                        />
                                    </div>

                                    {/* SUBMIT BUTTON */}
                                    <button
                                        disabled={!selectedProblem || (selectedProblem !== "Autre" && selectedParticipants.length === 0) || isSubmitting}
                                        onClick={handleComplete}
                                        className={`mt-4 w-full py-4 rounded-2xl font-black text-[15px] flex justify-center items-center transition-all ${selectedProblem && (selectedProblem === "Autre" || selectedParticipants.length > 0) && !isSubmitting
                                            ? "bg-gray-dark text-white shadow-lg active:scale-95 hover:bg-black"
                                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                            }`}
                                    >
                                        {isSubmitting ? "Envoi du signalement..." : "Valider le signalement"}
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
