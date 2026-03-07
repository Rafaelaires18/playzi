"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";

function PremiumLock() {
    return (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/75 backdrop-blur-[3px]">
            <div className="rounded-full border border-amber-300 bg-white/95 px-3 py-1.5 text-[11px] font-black text-gray-700">
                Disponible avec Playzi+
            </div>
        </div>
    );
}

export default function ProfileMonthlySummaryPage() {
    const router = useRouter();
    const isPlayziPlus = false;

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F5F7F6]">
            <Header />

            <header className="fixed top-16 left-0 right-0 z-40 mx-auto flex h-16 w-full max-w-md items-center border-b border-gray-100 bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <button onClick={() => router.back()} className="rounded-full p-3 text-gray-700 hover:bg-gray-100">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div className="ml-1">
                    <h1 className="text-[17px] font-black text-[#242841]">Résumé mensuel</h1>
                    <p className="text-[11px] font-semibold text-gray-500">Mars 2026</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-10 pt-36">
                <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                    <h2 className="text-[16px] font-black text-[#242841]">Ce mois-ci</h2>
                    <div className="mt-3 space-y-2.5">
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] font-semibold text-gray-700">
                            <span>Activités rejointes</span>
                            <span className="font-black text-[#242841]">7</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] font-semibold text-gray-700">
                            <span>Activités créées</span>
                            <span className="font-black text-[#242841]">2</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] font-semibold text-gray-700">
                            <span>Personnes rencontrées</span>
                            <span className="font-black text-[#242841]">12</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] font-semibold text-gray-700">
                            <span>Pulse gagné</span>
                            <span className="font-black text-emerald-600">+84</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] font-semibold text-gray-700">
                            <span>Streak du mois</span>
                            <span className="font-black text-[#242841]">4 semaines</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] font-semibold text-gray-700">
                            <span>Sport principal</span>
                            <span className="font-black text-[#242841]">Beach-volley</span>
                        </div>
                    </div>
                </section>

                <section className="relative mt-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className={cn(!isPlayziPlus && "blur-[4px] contrast-75")}>
                        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
                            <Crown className="h-3.5 w-3.5" />
                            Playzi+
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 text-[13px] font-semibold text-gray-700">
                            <span>Événements Playzi participés</span>
                            <span className="font-black text-[#242841]">3</span>
                        </div>
                    </div>
                    {!isPlayziPlus && <PremiumLock />}
                </section>
            </div>
        </main>
    );
}
