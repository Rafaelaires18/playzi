import { ChevronLeft } from "lucide-react";
import PricingPlans from "./PricingPlans";

interface PricingViewProps {
    onBack: () => void;
}

export default function PricingView({ onBack }: PricingViewProps) {
    return (
        <div className="flex h-full flex-col bg-[#F7F8F7]">
            <div className="flex items-center border-b border-gray-100 bg-white px-4 py-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100"
                    aria-label="Retour"
                >
                    <ChevronLeft className="h-6 w-6 text-gray-700" />
                </button>
                <h2 className="ml-2 text-[18px] font-black text-[#242841]">Plans & tarifs</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
                <div className="mb-5">
                    <p className="text-[15px] font-black text-[#242841]">Choisis l’expérience Playzi qui te correspond.</p>
                    <p className="mt-1 text-[13px] font-semibold leading-relaxed text-gray-500">
                        Commence gratuitement et passe à Playzi+ quand tu veux.
                    </p>
                </div>
                <PricingPlans compact />
            </div>
        </div>
    );
}
