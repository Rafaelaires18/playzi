"use client";

import { useState } from "react";
import Header from "@/components/Header";
import OptionsSheet from "@/components/options/OptionsSheet";
import { Sparkles, Check, Bell } from "lucide-react";

export default function PricingPage() {
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white relative">
            <Header onOpenOptions={() => setIsOptionsOpen(true)} />
            <OptionsSheet open={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} />

            <div className="flex-1 overflow-y-auto px-6 pb-10 pt-24 space-y-6 bg-gray-50/50">
                {/* Header Title */}
                <div>
                    <h1 className="text-[32px] font-black tracking-tight text-[#2D2E3B]">Plans & tarifs</h1>
                    <p className="mt-2 text-[16px] font-bold text-gray-500">
                        Les 3 premiers mois sont gratuits.
                    </p>
                </div>

                {/* Basic Plan */}
                <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-6 opacity-5">
                        <Sparkles className="w-24 h-24" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-[24px] font-black text-[#2D2E3B]">Basic</h2>
                        </div>
                        <p className="text-[18px] font-bold text-gray-500 mb-6">5 CHF / mois</p>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[#2D2E3B]">
                                    <Check className="h-4 w-4" strokeWidth={3} />
                                </div>
                                <span className="text-[15px] font-bold text-[#2D2E3B]">Accès aux activités</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[#2D2E3B]">
                                    <Check className="h-4 w-4" strokeWidth={3} />
                                </div>
                                <span className="text-[15px] font-bold text-[#2D2E3B]">Filtres essentiels</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[#2D2E3B]">
                                    <Check className="h-4 w-4" strokeWidth={3} />
                                </div>
                                <span className="text-[15px] font-bold text-[#2D2E3B]">Support standard</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Premium Plan */}
                <section className="rounded-[28px] bg-gradient-to-br from-[#2D2E3B] to-gray-800 p-6 shadow-xl overflow-hidden relative text-white">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Sparkles className="w-24 h-24 text-amber-500" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-[24px] font-black">Premium</h2>
                            <div className="bg-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-[11px] font-black tracking-widest uppercase">
                                Prochainement
                            </div>
                        </div>
                        <p className="text-[18px] font-bold text-gray-300 mb-6">10 CHF / mois</p>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                                    <Check className="h-4 w-4" strokeWidth={3} />
                                </div>
                                <span className="text-[15px] font-bold text-white">Filtres avancés</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                                    <Check className="h-4 w-4" strokeWidth={3} />
                                </div>
                                <span className="text-[15px] font-bold text-white">Badges & streaks avancés</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                                    <Check className="h-4 w-4" strokeWidth={3} />
                                </div>
                                <span className="text-[15px] font-bold text-white">Priorité sur certaines activités</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                                    <Check className="h-4 w-4" strokeWidth={3} />
                                </div>
                                <span className="text-[15px] font-bold text-white">Support prioritaire</span>
                            </div>
                        </div>
                    </div>
                </section>

                <p className="text-center text-[13px] font-medium text-gray-400 mt-6">
                    Les fonctionnalités exactes peuvent évoluer.
                </p>

                <div className="pt-4 pb-8">
                    <button
                        type="button"
                        onClick={() => window.alert("Vous serez notifié lors du lancement.")}
                        className="w-full h-14 bg-playzi-green text-white font-bold text-[16px] rounded-[20px] shadow-[0_8px_20px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                        <Bell className="w-5 h-5" strokeWidth={2.5} />
                        Être notifié
                    </button>
                </div>
            </div>
        </main>
    );
}
