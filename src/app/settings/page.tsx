"use client";

import { useState } from "react";
import Header from "@/components/Header";
import OptionsSheet from "@/components/options/OptionsSheet";
import { ChevronRight } from "lucide-react";

export default function SettingsPage() {
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);

    // Form fields
    const [pseudo, setPseudo] = useState("Rafael D.");
    const email = "rafael@playzi.app"; // Affiché
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [language, setLanguage] = useState<"FR" | "EN">("FR");
    const [units, setUnits] = useState<"km" | "miles">("km");

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white relative">
            <Header onOpenOptions={() => setIsOptionsOpen(true)} />
            <OptionsSheet open={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} />

            <div className="flex-1 overflow-y-auto px-6 pb-12 pt-24 space-y-8 bg-gray-50/50">
                <div>
                    <h1 className="text-[32px] font-black tracking-tight text-[#2D2E3B]">Paramètres</h1>
                </div>

                {/* Section Compte */}
                <section>
                    <h2 className="text-[14px] font-black uppercase tracking-wider text-gray-400 mb-4 px-1">Compte</h2>
                    <div className="bg-white rounded-[24px] overflow-hidden border border-gray-100 shadow-sm">
                        <div className="p-4 border-b border-gray-50 flex flex-col gap-1.5">
                            <label className="text-[13px] font-bold text-gray-400">Pseudo</label>
                            <input
                                value={pseudo}
                                onChange={(e) => setPseudo(e.target.value)}
                                className="w-full text-[16px] font-bold text-[#2D2E3B] focus:outline-none placeholder-gray-300"
                            />
                        </div>
                        <div className="p-4 border-b border-gray-50 flex flex-col gap-1.5 bg-gray-50/50">
                            <label className="text-[13px] font-bold text-gray-400">Email</label>
                            <span className="text-[16px] font-medium text-gray-500">{email}</span>
                        </div>
                        <button
                            type="button"
                            className="w-full p-4 flex items-center justify-between active:bg-gray-50 transition-colors group"
                            onClick={() => window.alert("Modification du mot de passe...")}
                        >
                            <span className="text-[16px] font-bold text-[#2D2E3B]">Modifier le mot de passe</span>
                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-400 transition-colors" strokeWidth={2.5} />
                        </button>
                    </div>
                </section>

                {/* Section Notifications */}
                <section>
                    <h2 className="text-[14px] font-black uppercase tracking-wider text-gray-400 mb-4 px-1">Notifications</h2>
                    <div className="bg-white rounded-[24px] border border-gray-100 p-4 flex items-center justify-between shadow-sm">
                        <span className="text-[16px] font-bold text-[#2D2E3B]">Notifications sportives</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={notificationsEnabled}
                            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                            className={`relative h-8 w-14 rounded-full transition-colors ${notificationsEnabled ? "bg-playzi-green" : "bg-gray-200"}`}
                        >
                            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all ${notificationsEnabled ? "left-7" : "left-1"}`} />
                        </button>
                    </div>
                    {!notificationsEnabled && (
                        <p className="mt-3 px-2 text-[13px] font-medium leading-relaxed text-gray-400">
                            Si vous désactivez les notifications, vous ne serez pas informé(e) des nouvelles activités, confirmations et messages.
                        </p>
                    )}
                </section>

                {/* Section Préférences */}
                <section>
                    <h2 className="text-[14px] font-black uppercase tracking-wider text-gray-400 mb-4 px-1">Préférences</h2>
                    <div className="bg-white rounded-[24px] overflow-hidden border border-gray-100 shadow-sm flex flex-col">
                        <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                            <span className="text-[16px] font-bold text-[#2D2E3B]">Langue</span>
                            <div className="flex items-center bg-gray-100 rounded-full p-1">
                                <button
                                    className={`px-4 py-1.5 rounded-full text-[13px] font-black transition-all ${language === 'FR' ? 'bg-white shadow-sm text-[#2D2E3B]' : 'text-gray-500'}`}
                                    onClick={() => setLanguage('FR')}
                                >FR</button>
                                <button
                                    className={`px-4 py-1.5 rounded-full text-[13px] font-black transition-all ${language === 'EN' ? 'bg-white shadow-sm text-[#2D2E3B]' : 'text-gray-500'}`}
                                    onClick={() => setLanguage('EN')}
                                >EN</button>
                            </div>
                        </div>
                        <div className="p-4 flex items-center justify-between">
                            <span className="text-[16px] font-bold text-[#2D2E3B]">Unités</span>
                            <div className="flex items-center bg-gray-100 rounded-full p-1">
                                <button
                                    className={`px-4 py-1.5 rounded-full text-[13px] font-black transition-all ${units === 'km' ? 'bg-white shadow-sm text-[#2D2E3B]' : 'text-gray-500'}`}
                                    onClick={() => setUnits('km')}
                                >km</button>
                                <button
                                    className={`px-4 py-1.5 rounded-full text-[13px] font-black transition-all ${units === 'miles' ? 'bg-white shadow-sm text-[#2D2E3B]' : 'text-gray-500'}`}
                                    onClick={() => setUnits('miles')}
                                >miles</button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Section Sécurité */}
                <section>
                    <h2 className="text-[14px] font-black uppercase tracking-wider text-gray-400 mb-4 px-1">Sécurité</h2>
                    <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-gray-50">
                            <h3 className="text-[16px] font-bold text-[#2D2E3B] mb-2">Utilisateurs bloqués</h3>
                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                <span className="text-[14px] font-medium text-gray-400">
                                    Vous pourrez bloquer des utilisateurs prochainement.
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            disabled
                            className="w-full p-4 flex items-center justify-center bg-gray-50/50 text-[15px] font-bold text-gray-400"
                        >
                            Gérer les blocages
                        </button>
                    </div>
                </section>

            </div>
        </main>
    );
}
