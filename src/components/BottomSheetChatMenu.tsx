"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

interface BottomSheetChatMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onReportIssue: (type: "problem") => void;
}

export default function BottomSheetChatMenu({ isOpen, onClose, onReportIssue }: BottomSheetChatMenuProps) {
    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "unset";
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

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

                        {/* MENU ITEMS */}
                        <div className="px-6 py-4 flex flex-col gap-1 pb-10">
                            <button
                                onClick={() => {
                                    onClose();
                                    onReportIssue("problem");
                                }}
                                className="flex items-center gap-4 py-4 px-2 hover:bg-gray-50 rounded-xl transition-colors active:scale-[0.98] w-full text-left"
                            >
                                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-[16px] text-gray-dark">Signaler un problème</span>
                                    <span className="text-[13px] text-gray-400 font-medium">Comportement, sécurité, autre...</span>
                                </div>
                            </button>

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
