"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CANCELLATION_REASON_OPTIONS, CancellationReasonCode } from "@/lib/activity-cancellation";

interface BottomSheetCancellationProposalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (payload: { reason_code: CancellationReasonCode; reason_text?: string }) => Promise<void>;
    isSubmitting?: boolean;
}

export default function BottomSheetCancellationProposal({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting = false,
}: BottomSheetCancellationProposalProps) {
    const [reasonCode, setReasonCode] = useState<CancellationReasonCode>("weather");
    const [reasonText, setReasonText] = useState("");

    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "unset";
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

    const isOther = reasonCode === "other";
    const trimmedOtherReason = reasonText.trim();
    const isSubmitDisabled = useMemo(() => {
        if (isSubmitting) return true;
        if (!isOther) return false;
        return trimmedOtherReason.length === 0 || trimmedOtherReason.length > 120;
    }, [isOther, isSubmitting, trimmedOtherReason.length]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[120] bg-black/35 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 28, stiffness: 240 }}
                        className="fixed inset-x-0 bottom-0 z-[121] rounded-t-3xl bg-white shadow-2xl max-h-[88vh] overflow-y-auto pb-[max(16px,env(safe-area-inset-bottom))]"
                    >
                        <div className="flex justify-center py-3">
                            <div className="h-1.5 w-12 rounded-full bg-gray-200" />
                        </div>

                        <div className="px-5 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                    <AlertTriangle className="h-4 w-4" />
                                </div>
                                <h3 className="text-[17px] font-bold text-gray-900">Proposer l&apos;annulation</h3>
                            </div>

                            <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
                                Un vote sera lancé dans le groupe. Si la majorité accepte, l&apos;activité sera annulée sans conséquence.
                            </p>

                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                                <p className="text-[12px] font-semibold leading-snug text-amber-700">
                                    Proposition possible uniquement jusqu&apos;à 45 minutes avant le début de l&apos;activité
                                </p>
                            </div>

                            <div className="mt-4 space-y-2">
                                {CANCELLATION_REASON_OPTIONS.map((option) => (
                                    <button
                                        key={option.code}
                                        type="button"
                                        onClick={() => setReasonCode(option.code)}
                                        className={`w-full rounded-xl border px-3 py-2.5 text-left text-[14px] font-semibold transition ${
                                            reasonCode === option.code
                                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                                : "border-gray-200 bg-white text-gray-700"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            {isOther && (
                                <div className="mt-3">
                                    <textarea
                                        value={reasonText}
                                        onChange={(event) => setReasonText(event.target.value.slice(0, 120))}
                                        placeholder="Décris brièvement la situation"
                                        className="h-20 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[14px] text-gray-800 outline-none focus:border-emerald-300 focus:bg-white"
                                    />
                                    <div className="mt-1 text-right text-[11px] text-gray-400">
                                        {trimmedOtherReason.length}/120
                                    </div>
                                </div>
                            )}

                            <div className="mt-5 flex gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[14px] font-semibold text-gray-700"
                                    disabled={isSubmitting}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="button"
                                    disabled={isSubmitDisabled}
                                    onClick={() => onSubmit({
                                        reason_code: reasonCode,
                                        reason_text: isOther ? trimmedOtherReason : undefined,
                                    })}
                                    className={`flex-1 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white transition ${
                                        isSubmitDisabled ? "bg-emerald-300" : "bg-emerald-500 active:scale-[0.98]"
                                    }`}
                                >
                                    {isSubmitting ? "Publication..." : "Publier la proposition"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
