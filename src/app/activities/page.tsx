"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { CalendarHeart, CalendarX, Compass } from "lucide-react";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import ActivityMiniCard from "@/components/ActivityMiniCard";
import { MOCK_ACTIVITIES } from "@/lib/data";
import { cn } from "@/lib/utils";

import BottomSheetFeedback from "@/components/BottomSheetFeedback";
import { Activity } from "@/components/SwipeCard";

type Tab = "a_venir" | "passees";

export default function ActivitiesPage() {
    const [activeTab, setActiveTab] = useState<Tab>("a_venir");
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [feedbackActivity, setFeedbackActivity] = useState<Activity | null>(null);

    useEffect(() => {
        const fetchMyActivities = async () => {
            try {
                // In a real app we would have a specific endpoint or query param like ?tab=upcoming
                // For now we get everything and filter client-side, assuming the API returns
                // activities the user has joined or created.
                const res = await fetch(`/api/activities?filter=my_activities&t=${Date.now()}`, { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    console.log("MY_ACTIVITIES_FETCHED:", data.data);
                    setActivities(data.data || []);
                }
            } catch (error) {
                console.error("Failed to fetch activities", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMyActivities();
    }, []);

    // Filter activities
    const now = Date.now();

    // Upcoming: status is non-final AND date is in the future
    const upcomingActivities = activities.filter(
        (a) => ["ouvert", "complet", "confirmé", "en_attente"].includes(a.status) && new Date(a.start_time).getTime() > now
    ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // Past: status is final (passé, annulé) OR date is in the past
    const pastActivities = activities.filter(
        (a) => ["passé", "annulé"].includes(a.status) || new Date(a.start_time).getTime() <= now
    ).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

    const hasPendingFeedback = pastActivities.some((a: any) => a.feedbackStatus === "pending");

    // Animation Variants
    const tabVariants = {
        hidden: { opacity: 0, x: 20 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
        exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { stiffness: 300, damping: 24 } }
    };

    return (
        <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto relative bg-[#F4F7F6] overflow-hidden">

            {/* GLOBAL HEADER - Trapped in pointer-events-none to prevent blocking scrolling */}
            <div className="absolute inset-0 z-50 pointer-events-none">
                <Header />
            </div>

            {/* STICKY TOP SECTION: Title + Tabs */}
            <div className="z-30 bg-[#F4F7F6]/90 backdrop-blur-xl pt-20 pb-3 px-6 flex flex-col gap-4 border-b border-gray-100 shadow-sm relative shrink-0">

                <h1 className="text-3xl font-black text-gray-dark tracking-tight mt-2">
                    Mes activités
                </h1>

                {/* Tab Switcher */}
                <div className="flex bg-gray-200/50 p-1 rounded-2xl relative">
                    <button
                        onClick={() => setActiveTab("a_venir")}
                        className={cn(
                            "flex-1 py-2.5 text-sm font-bold rounded-xl transition-all z-10 border border-transparent",
                            activeTab === "a_venir" ? "text-gray-dark" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        À venir
                    </button>
                    <button
                        onClick={() => setActiveTab("passees")}
                        className={cn(
                            "relative flex-1 py-2.5 flex items-center justify-center gap-1.5 text-sm font-bold rounded-xl transition-all z-10 border border-transparent",
                            activeTab === "passees" ? "text-gray-dark" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        Passées
                        {hasPendingFeedback && (
                            <span className="w-2 h-2 bg-rose-500 rounded-full border-2 border-transparent shadow-sm" />
                        )}
                    </button>

                    {/* Active Indicator Base Background */}
                    <div
                        className={cn(
                            "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-out",
                            activeTab === "a_venir" ? "translate-x-0" : "translate-x-[calc(100%+4px)]"
                        )}
                    />
                </div>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto pb-28 px-4 pt-6">
                {isLoading ? (
                    <div className="flex flex-col gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse bg-white rounded-[26px] h-[180px] w-full border border-gray-100 shadow-sm" />
                        ))}
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {/* UPCOMING TAB */}
                        {activeTab === "a_venir" && (
                            <motion.div
                                key="a_venir"
                                variants={tabVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="flex flex-col min-h-full"
                            >
                                {upcomingActivities.length > 0 ? (
                                    <motion.div
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="show"
                                        className="flex flex-col gap-4"
                                    >
                                        {upcomingActivities.map(activity => (
                                            <motion.div key={activity.id} variants={itemVariants}>
                                                <Link href={`/activities/${activity.id}`} className="block">
                                                    <ActivityMiniCard activity={activity} />
                                                </Link>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                ) : (
                                    // Empty State: A Venir
                                    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 -mt-10">
                                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                                            <CalendarHeart className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
                                        </div>
                                        <h2 className="text-xl font-black text-gray-dark mb-2">Prêt à transpirer ?</h2>
                                        <p className="text-gray-500 text-[15px] mb-8 leading-relaxed max-w-xs">
                                            Tu n'as pas encore d'activité prévue. Rejoins une équipe ou crée la tienne !
                                        </p>
                                        <Link href="/" className="flex items-center gap-2 bg-[#10B981] text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                                            <Compass className="w-5 h-5" />
                                            Trouver une activité
                                        </Link>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* PAST TAB */}
                        {activeTab === "passees" && (
                            <motion.div
                                key="passees"
                                variants={tabVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="flex flex-col min-h-full"
                            >
                                {pastActivities.length > 0 ? (
                                    <motion.div
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="show"
                                        className="flex flex-col gap-4"
                                    >
                                        {pastActivities.map(activity => (
                                            <motion.div key={activity.id} variants={itemVariants}>
                                                {/* Si en attente de feedback, pas de Link (géré par onFeedbackClick) */}
                                                {(activity as any).feedbackStatus === 'pending' ? (
                                                    <div>
                                                        <ActivityMiniCard
                                                            activity={activity}
                                                            onFeedbackClick={() => setFeedbackActivity(activity)}
                                                        />
                                                    </div>
                                                ) : (
                                                    <Link href={`/activities/${activity.id}`} className="block">
                                                        <ActivityMiniCard activity={activity} />
                                                    </Link>
                                                )}
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                ) : (
                                    // Empty State: Historique
                                    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 -mt-10">
                                        <div className="w-24 h-24 bg-transparent border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center mb-6">
                                            <CalendarX className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
                                        </div>
                                        <p className="text-gray-400 font-medium text-[15px]">
                                            Ton historique est vide pour le moment.
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>

            {/* FIXED BOTTOM NAV */}
            <div className="relative z-20">
                <BottomNavigation activeTab="activities" />
            </div>

            {/* FEEDBACK BOTTOM SHEET */}
            <BottomSheetFeedback
                isOpen={!!feedbackActivity}
                onClose={() => setFeedbackActivity(null)}
                activity={feedbackActivity}
            />
        </main>
    );
}
