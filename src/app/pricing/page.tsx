"use client";

import { Check, Crown, Sparkles } from "lucide-react";
import Header from "@/components/Header";

const basicFeatures = [
    "Accès aux activités",
    "Filtres essentiels",
    "Support standard"
];

const plusFeatures = [
    "Création d'activités illimitée",
    "Filtres avancés",
    "Accès profils participants",
    "Statistiques avancées",
    "Streak avancé",
    "Graphique Pulse complet",
    "Événements Playzi",
    "Badge Playzi+",
    "Accès activités passées dans Discover",
    "Support prioritaire"
];

export default function PricingPage() {
    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F7F8F7]">
            <Header />

            <div className="flex-1 overflow-y-auto px-5 pb-10 pt-24">
                <h1 className="text-[32px] font-black tracking-tight text-[#242841]">Abonnement Playzi</h1>
                <p className="mt-2 text-[14px] font-semibold text-gray-500">
                    Choisis ton plan et débloque ton meilleur niveau communautaire.
                </p>

                <section className="mt-6 rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[24px] font-black text-[#242841]">Playzi Basic</h2>
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-gray-600">
                            Starter
                        </span>
                    </div>
                    <p className="mt-2 text-[18px] font-black text-[#242841]">5 CHF / mois</p>
                    <div className="mt-5 space-y-3">
                        {basicFeatures.map((feature) => (
                            <div key={feature} className="flex items-center gap-3">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[#242841]">
                                    <Check className="h-4 w-4" strokeWidth={3} />
                                </div>
                                <span className="text-[14px] font-bold text-[#242841]">{feature}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="relative mt-5 overflow-hidden rounded-[28px] border border-amber-200 bg-gradient-to-br from-[#262A43] via-[#2F3558] to-[#1D2033] p-6 shadow-xl">
                    <div className="absolute -right-5 -top-6 opacity-20">
                        <Sparkles className="h-24 w-24 text-amber-300" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[24px] font-black text-white">Playzi+</h2>
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
                                <Crown className="h-3.5 w-3.5" />
                                Premium
                            </span>
                        </div>
                        <p className="mt-2 text-[18px] font-black text-white">10 CHF / mois</p>
                        <div className="mt-5 space-y-3">
                            {plusFeatures.map((feature) => (
                                <div key={feature} className="flex items-center gap-3">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white">
                                        <Check className="h-4 w-4" strokeWidth={3} />
                                    </div>
                                    <span className="text-[14px] font-bold text-white">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <button
                    type="button"
                    onClick={() => window.alert("Paiement Playzi+ à connecter (Stripe).")}
                    className="mt-6 h-14 w-full rounded-[20px] bg-[#10B981] text-[16px] font-black text-white shadow-[0_8px_20px_rgba(16,185,129,0.25)]"
                >
                    Passer à Playzi+
                </button>
            </div>
        </main>
    );
}
