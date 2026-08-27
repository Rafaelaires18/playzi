"use client";

import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import PricingPlans from "@/components/options/PricingPlans";

export default function PricingPage() {
    return (
        <main className="mx-auto flex min-h-[100dvh] w-full flex-col bg-[#F7F8F7]">
            <Header />

            <div className="w-full flex-1 overflow-y-auto px-5 pb-28 pt-24">
                <section className="mx-auto mb-7 w-full max-w-5xl">
                    <h1 className="text-[32px] font-black tracking-tight text-[#242841]">Plans & tarifs</h1>
                    <p className="mt-2 text-[16px] font-black text-[#242841]">
                        Choisis l’expérience Playzi qui te correspond.
                    </p>
                    <p className="mt-1 text-[14px] font-semibold leading-relaxed text-gray-500">
                        Commence gratuitement et passe à Playzi+ quand tu veux.
                    </p>
                </section>

                <PricingPlans />
            </div>

            <BottomNavigation activeTab="profile" />
        </main>
    );
}
