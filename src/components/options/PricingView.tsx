import { Check, ChevronLeft, Crown, Sparkles } from "lucide-react";

interface PricingViewProps {
    onBack: () => void;
}

const basicFeatures = ["Accès aux activités", "Filtres essentiels", "Support standard"];
const plusFeatures = [
    "Création d'activités illimitée",
    "Filtres avancés",
    "Accès profils participants",
    "Statistiques avancées",
    "Graphique Pulse",
    "Événements Playzi",
    "Support prioritaire"
];

export default function PricingView({ onBack }: PricingViewProps) {
    return (
        <div className="flex h-full flex-col bg-[#F7F8F7]">
            <div className="flex items-center border-b border-gray-100 bg-white px-4 py-3">
                <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100">
                    <ChevronLeft className="h-6 w-6 text-gray-700" />
                </button>
                <h2 className="ml-2 text-[18px] font-black text-[#242841]">Abonnement Playzi</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
                <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[21px] font-black text-[#242841]">Playzi Basic</h3>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-gray-600">Starter</span>
                    </div>
                    <p className="mt-1.5 text-[17px] font-black text-[#242841]">5 CHF / mois</p>
                    <div className="mt-4 space-y-2.5">
                        {basicFeatures.map((item) => (
                            <div key={item} className="flex items-center gap-3">
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[#242841]">
                                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                </div>
                                <span className="text-[13px] font-bold text-[#242841]">{item}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="relative mt-4 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#262A43] via-[#30375C] to-[#20253E] p-5 shadow-lg">
                    <div className="absolute -right-5 -top-6 opacity-20">
                        <Sparkles className="h-20 w-20 text-amber-300" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[21px] font-black text-white">Playzi+</h3>
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-300">
                                <Crown className="h-3.5 w-3.5" />
                                Premium
                            </span>
                        </div>
                        <p className="mt-1.5 text-[17px] font-black text-white">10 CHF / mois</p>
                        <div className="mt-4 space-y-2.5">
                            {plusFeatures.map((item) => (
                                <div key={item} className="flex items-center gap-3">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-white">
                                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                    </div>
                                    <span className="text-[13px] font-bold text-white">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
