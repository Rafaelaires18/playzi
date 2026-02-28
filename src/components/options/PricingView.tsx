import { Sparkles, Check, Bell, ChevronLeft } from "lucide-react";

interface PricingViewProps {
    onBack: () => void;
}

export default function PricingView({ onBack }: PricingViewProps) {
    return (
        <div className="flex flex-col h-full bg-gray-50/50 animate-in slide-in-from-right-8 duration-300 ease-out">
            <div className="flex items-center px-4 py-3 shrink-0 bg-white border-b border-gray-100">
                <button
                    onClick={onBack}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                    <ChevronLeft className="w-6 h-6 text-gray-700" strokeWidth={2.5} />
                </button>
                <h2 className="text-[18px] font-black text-[#2D2E3B] ml-2">Plans & tarifs</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 pb-safe space-y-6">
                <div>
                    <h1 className="text-[28px] font-black tracking-tight text-[#2D2E3B]">Plans & tarifs</h1>
                    <p className="mt-2 text-[15px] font-bold text-gray-500">
                        Les 3 premiers mois sont gratuits.
                    </p>
                </div>

                {/* Basic Plan */}
                <section className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-6 opacity-5">
                        <Sparkles className="w-24 h-24" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-[22px] font-black text-[#2D2E3B]">Basic</h2>
                        </div>
                        <p className="text-[16px] font-bold text-gray-500 mb-5">5 CHF / mois</p>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[#2D2E3B]">
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                </div>
                                <span className="text-[14px] font-bold text-[#2D2E3B]">Accès aux activités</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[#2D2E3B]">
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                </div>
                                <span className="text-[14px] font-bold text-[#2D2E3B]">Filtres essentiels</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[#2D2E3B]">
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                </div>
                                <span className="text-[14px] font-bold text-[#2D2E3B]">Support standard</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Premium Plan */}
                <section className="rounded-[24px] bg-gradient-to-br from-[#2D2E3B] to-gray-800 p-6 shadow-md overflow-hidden relative text-white">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Sparkles className="w-24 h-24 text-amber-500" />
                    </div>
                    <div className="relative">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h2 className="text-[22px] font-black">Premium</h2>
                            <div className="bg-amber-500/20 text-amber-500 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase mt-0.5">
                                Prochainement
                            </div>
                        </div>
                        <p className="text-[16px] font-bold text-gray-300 mb-5">10 CHF / mois</p>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                </div>
                                <span className="text-[14px] font-bold text-white">Filtres avancés</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                </div>
                                <span className="text-[14px] font-bold text-white">Badges & streaks avancés</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                </div>
                                <span className="text-[14px] font-bold text-white">Priorité sur certaines activités</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                </div>
                                <span className="text-[14px] font-bold text-white">Support prioritaire</span>
                            </div>
                        </div>
                    </div>
                </section>

                <p className="text-center text-[12px] font-medium text-gray-400">
                    Les fonctionnalités exactes peuvent évoluer.
                </p>

                <div className="pt-2 pb-6">
                    <button
                        type="button"
                        onClick={() => window.alert("Vous serez notifié lors du lancement.")}
                        className="w-full h-14 bg-playzi-green text-white font-bold text-[16px] rounded-[20px] shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                        <Bell className="w-5 h-5" strokeWidth={2.5} />
                        Être notifié
                    </button>
                </div>
            </div>
        </div>
    );
}
