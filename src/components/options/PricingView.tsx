import { Check, ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PricingViewProps {
    onBack: () => void;
}

type PlanCardProps = {
    title: ReactNode;
    price?: string;
    badge?: string;
    features: string[];
    restrictions?: string[];
    footer?: string;
    highlighted?: boolean;
    launch?: boolean;
};

function FeatureRow({ text, tone = "default" }: { text: string; tone?: "default" | "muted" }) {
    return (
        <div className="flex items-start gap-3">
            <div
                className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    tone === "default" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                )}
            >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </div>
            <span className={cn("text-[13px] font-semibold leading-tight", tone === "default" ? "text-[#242841]" : "text-gray-500")}>
                {text}
            </span>
        </div>
    );
}

function PlanCard({ title, price, badge, features, restrictions, footer, highlighted, launch }: PlanCardProps) {
    return (
        <article
            className={cn(
                "relative rounded-[24px] border bg-white p-5 shadow-sm",
                launch
                    ? "border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white shadow-[0_12px_22px_rgba(16,185,129,0.08)]"
                    : highlighted
                        ? "border-amber-300 shadow-[0_14px_26px_rgba(245,158,11,0.16)]"
                        : "border-gray-100"
            )}
        >
            {highlighted && (
                <div className="absolute -top-3 right-4 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
                    ⭐ Recommandé
                </div>
            )}

            <div className="flex items-start justify-between gap-2">
                <h3 className="text-[22px] font-black leading-none text-[#242841]">{title}</h3>
                {badge && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                        {badge}
                    </span>
                )}
            </div>
            {price && <p className="mt-2 text-[18px] font-black text-[#242841]">{price}</p>}

            <div className="mt-4 space-y-2.5">
                {features.map((item) => (
                    <FeatureRow key={item} text={item} />
                ))}
            </div>

            {restrictions && restrictions.length > 0 && (
                <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                    <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-500">Restrictions</p>
                    <div className="space-y-2">
                        {restrictions.map((item) => (
                            <FeatureRow key={item} text={item} tone="muted" />
                        ))}
                    </div>
                </div>
            )}

            {footer && <p className="mt-4 text-[12px] font-semibold text-gray-500">{footer}</p>}
        </article>
    );
}

export default function PricingView({ onBack }: PricingViewProps) {
    return (
        <div className="flex h-full flex-col bg-[#F7F8F7]">
            <div className="flex items-center border-b border-gray-100 bg-white px-4 py-3">
                <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100">
                    <ChevronLeft className="h-6 w-6 text-gray-700" />
                </button>
                <h2 className="ml-2 text-[18px] font-black text-[#242841]">Plans & tarifs</h2>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
                <PlanCard
                    title="Offre de lancement"
                    launch
                    badge="3 mois offerts"
                    price="Playzi+ gratuit pendant 3 mois"
                    features={[
                        "Accès complet à toutes les fonctionnalités Playzi+",
                        "Création d'activités illimitée",
                        "Statistiques avancées et Graphique Pulse",
                        "Accès aux événements Playzi",
                    ]}
                    footer="Offre valable uniquement pendant la période de lancement (mai – juin – juillet)."
                />

                <PlanCard
                    title={
                        <>
                            Playzi <span className="text-amber-500">+</span>
                        </>
                    }
                    price="5 CHF / mois"
                    highlighted
                    features={[
                        "Création d'activités illimitée",
                        "Accès aux profils des participants avant inscription",
                        "Statistiques avancées",
                        "Graphique Pulse",
                        "Accès aux événements Playzi",
                        "Support prioritaire",
                    ]}
                />

                <PlanCard
                    title="Playzi"
                    price="0 CHF / mois"
                    features={[
                        "Rejoindre des activités illimitées",
                        "Création d'activités limitée (1 par semaine)",
                        "Filtres essentiels",
                        "Statistiques basiques",
                        "Support standard",
                    ]}
                    restrictions={[
                        "Pas d'accès aux événements Playzi",
                        "Pas de statistiques avancées",
                        "Pas de Graphique Pulse",
                    ]}
                />
            </div>
        </div>
    );
}
