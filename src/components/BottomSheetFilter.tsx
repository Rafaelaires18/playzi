"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Map } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface BottomSheetFilterProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyParams: (distance: number, genderFilter: 'mixte' | 'filles' | 'tout', city: string | null) => void;
    currentDistance: number;
    currentGenderFilter: 'mixte' | 'filles' | 'tout';
    currentCity: string | null;
    isFemale: boolean;
}

export default function BottomSheetFilter({
    isOpen,
    onClose,
    onApplyParams,
    currentDistance,
    currentGenderFilter,
    currentCity,
    isFemale
}: BottomSheetFilterProps) {
    const [distance, setDistance] = useState<number>(currentDistance);
    const [genderPref, setGenderPref] = useState<'mixte' | 'filles' | 'tout'>(currentGenderFilter);
    const [city, setCity] = useState<string | null>(currentCity);
    const router = useRouter();

    // Reset local state when opened
    useEffect(() => {
        if (isOpen) {
            setDistance(currentDistance);
            setGenderPref(currentGenderFilter);
            setCity(currentCity);
        }
    }, [isOpen, currentDistance, currentGenderFilter, currentCity]);

    const handleApply = () => {
        onApplyParams(distance, genderPref, city);
        onClose();
    };

    const distanceOptions = [
        { label: "0 km", value: 0 },
        { label: "5 km", value: 5 },
        { label: "10 km", value: 10 },
        { label: "20 km", value: 20 },
        { label: "30 km", value: 30 },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Bottom Sheet */}
                    <motion.div
                        initial={{ y: "100%", opacity: 0.5 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0.5 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="absolute bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] max-h-[85vh] flex flex-col pt-2 pb-6 px-6"
                    >
                        {/* Drag Handle */}
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 shrink-0" />

                        {/* Header */}
                        <div className="flex items-center justify-between mb-8 shrink-0">
                            <h2 className="text-xl font-bold text-gray-dark tracking-tight">Filtres</h2>
                            <button
                                onClick={onClose}
                                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content Scrollable */}
                        <div className="flex-1 overflow-y-auto shrink-0 mb-6 space-y-7 no-scrollbar px-1">
                            {/* Filter Section: Distance */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Distance maximale</h3>
                                    <span className="text-sm font-bold text-playzi-green">{distance} km</span>
                                </div>
                                <div className="pt-2 pb-2">
                                    <input
                                        type="range"
                                        min="5"
                                        max="30"
                                        step="5"
                                        value={distance}
                                        onChange={(e) => setDistance(Number(e.target.value))}
                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-playzi-green"
                                    />
                                    <div className="flex justify-between text-[11px] text-gray-400 font-medium mt-3">
                                        <span>5 km</span>
                                        <span>30 km</span>
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="w-full h-[1px] bg-gray-100" />

                            {/* Filter Section: Group Type (Female-only logic) */}
                            {isFemale && (
                                <div className="space-y-4">
                                    <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Type de groupe</h3>
                                    <div className="flex p-1 bg-gray-100/70 rounded-[14px]">
                                        {[
                                            { label: "Mixte", value: "mixte" as const },
                                            { label: "Entre filles", value: "filles" as const },
                                            { label: "Tout", value: "tout" as const },
                                        ].map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setGenderPref(opt.value)}
                                                className={`flex-1 py-2.5 rounded-[10px] text-[13px] font-bold transition-all ${genderPref === opt.value
                                                    ? "bg-white text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                                                    : "text-gray-500 hover:text-gray-700"
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Future Filter Section Skeleton: Niveau */}
                            {/* 
                            <div className="w-full h-[1px] bg-gray-100" />
                            <div className="space-y-4 opacity-50 pointer-events-none">
                                <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Niveau recommandé</h3>
                                <div className="p-3 border border-gray-100 rounded-2xl flex justify-center text-xs font-medium text-gray-400">
                                    Bientôt disponible
                                </div>
                            </div> 
                            */}

                            {/* Divider */}
                            <div className="w-full h-[1px] bg-gray-100" />

                            {/* Section: Localisation / Carte */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Localisation</h3>
                                <button
                                    onClick={() => {
                                        onClose();
                                        const params = new URLSearchParams();
                                        if (distance !== 30) params.append("distance", distance.toString());
                                        if (genderPref !== (isFemale ? 'tout' : 'mixte')) params.append("gender", genderPref);
                                        const q = params.toString();
                                        router.push(q ? `/map?${q}` : "/map");
                                    }}
                                    className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-colors active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                                            <Map className="w-4 h-4 text-gray-500" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[13px] font-bold text-gray-dark">Carte</p>
                                            <p className="text-[11px] text-gray-400 font-medium">Choisir une ville ou une zone</p>
                                        </div>
                                    </div>
                                    <span className="text-gray-300 text-lg">›</span>
                                </button>
                            </div>

                        </div>

                        {/* Apply Button Area */}
                        <div className="shrink-0 pt-3 flex flex-col items-center gap-2">
                            <button
                                onClick={handleApply}
                                className="w-full bg-playzi-green text-white font-bold py-3.5 rounded-[16px] shadow-[0_4px_16px_rgba(33,197,94,0.2)] hover:opacity-95 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <Check className="w-[18px] h-[18px]" strokeWidth={2.5} />
                                Appliquer les filtres
                            </button>
                            <button
                                onClick={() => {
                                    setDistance(30);
                                    setGenderPref(isFemale ? 'tout' : 'mixte');
                                    setCity(null);
                                }}
                                className={`text-[13px] font-medium py-2 px-6 transition-colors rounded-full active:bg-gray-50 ${distance !== 30 || genderPref !== (isFemale ? 'tout' : 'mixte') || city !== null
                                    ? 'text-gray-500'
                                    : 'opacity-0 pointer-events-none'
                                    }`}
                            >
                                Réinitialiser
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
