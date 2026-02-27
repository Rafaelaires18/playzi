"use client";

import { Compass, Plus, CalendarCheck, User } from "lucide-react";
import FlagPlayziIcon from "@/components/icons/FlagPlayziIcon";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { MOCK_ACTIVITIES } from "@/lib/data";

export type Tab = "discover" | "events" | "activities" | "profile";

interface BottomNavigationProps {
    isHidden?: boolean;
    activeTab?: Tab;
}

export default function BottomNavigation({ isHidden = false, activeTab = "discover" }: BottomNavigationProps) {
    const totalUnread = MOCK_ACTIVITIES.reduce((sum, activity) => sum + (activity.unreadMessagesCount || 0), 0);

    return (
        <div
            className={cn(
                "fixed bottom-0 inset-x-0 z-40 transition-transform duration-300 ease-in-out",
                isHidden ? "translate-y-full" : "translate-y-0"
            )}
        >
            {/* Background with blur */}
            <div className="absolute inset-0 bg-white/90 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]" />

            <div className="relative flex justify-around items-center h-20 max-w-md mx-auto px-4 pb-4">

                {/* Découvrir */}
                <Link href="/" className={cn("flex flex-col items-center justify-center gap-1 transition-colors", activeTab === "discover" ? "text-playzi-green" : "text-gray-400 hover:text-gray-dark")}>
                    <Compass className={cn("w-6 h-6 stroke-[2px]", activeTab === "discover" ? "fill-playzi-green/20" : "")} />
                    <span className={cn("text-[10px]", activeTab === "discover" ? "font-bold" : "font-medium")}>Découvrir</span>
                </Link>

                {/* Events */}
                <Link href="/events" className={cn("flex flex-col items-center justify-center gap-1 transition-colors", activeTab === "events" ? "text-playzi-green" : "text-gray-400 hover:text-gray-dark")}>
                    <FlagPlayziIcon className={cn("w-6 h-6", activeTab === "events" ? "fill-playzi-green/20" : "")} />
                    <span className={cn("text-[10px]", activeTab === "events" ? "font-bold" : "font-medium")}>Events</span>
                </Link>

                {/* CRÉER */}
                <div className="relative -top-5">
                    <div className="absolute inset-x-0 -inset-y-0.5 bg-white/50 backdrop-blur-md rounded-full scale-110 pointer-events-none" />
                    <Link href="/create" className="relative flex items-center justify-center w-14 h-14 bg-playzi-green text-white rounded-full 
                             shadow-[0_8px_0_rgb(4,120,87)] hover:shadow-[0_4px_0_rgb(4,120,87)] 
                             hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all">
                        <Plus className="w-8 h-8 stroke-[3px]" />
                    </Link>
                </div>

                {/* Mes activités */}
                <Link href="/activities" className={cn("relative flex flex-col items-center justify-center gap-1 transition-colors", activeTab === "activities" ? "text-playzi-green" : "text-gray-400 hover:text-gray-dark")}>
                    <div className="relative">
                        <CalendarCheck className={cn("w-6 h-6 stroke-[1.5px]", activeTab === "activities" ? "fill-playzi-green/20" : "")} />
                        {totalUnread > 0 && (
                            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white shadow-sm pointer-events-none" />
                        )}
                    </div>
                    <span className={cn("text-[10px]", activeTab === "activities" ? "font-bold" : "font-medium")}>Mes activités</span>
                </Link>

                {/* Profil */}
                <Link href="/profil" className={cn("flex flex-col items-center justify-center gap-1 transition-colors", activeTab === "profile" ? "text-playzi-green" : "text-gray-400 hover:text-gray-dark")}>
                    <User className={cn("w-6 h-6 stroke-[1.5px]", activeTab === "profile" ? "fill-playzi-green/20" : "")} />
                    <span className={cn("text-[10px]", activeTab === "profile" ? "font-bold" : "font-medium")}>Profil</span>
                </Link>

            </div>
        </div>
    );
}
