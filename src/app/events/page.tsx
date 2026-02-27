"use client";

import FlagPlayziIcon from "@/components/icons/FlagPlayziIcon";
import BottomNavigation from "@/components/BottomNavigation";
import Header from "@/components/Header";

export default function EventsPage() {
    return (
        <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background relative overflow-hidden">
            <Header />
            <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 pt-16 pb-24">
                {/* Icon */}
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-playzi-green/10 to-playzi-purple/10 flex items-center justify-center shadow-sm">
                    <FlagPlayziIcon className="w-9 h-9 text-playzi-green" isActive />
                </div>

                {/* Text */}
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-black text-gray-dark tracking-tight">Events</h1>
                    <p className="text-[15px] font-medium text-gray-400 leading-relaxed max-w-[260px]">
                        Tournois, défis et événements sportifs arrivent bientôt sur Playzi.
                    </p>
                </div>

                {/* Pill badge */}
                <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-playzi-green/8 border border-playzi-green/20 rounded-full text-[12px] font-bold text-playzi-green tracking-wide">
                    <span className="w-1.5 h-1.5 bg-playzi-green rounded-full animate-pulse" />
                    Bientôt disponible
                </span>
            </div>
            <BottomNavigation activeTab="events" />
        </main>
    );
}
