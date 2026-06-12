"use client";

import { Compass, Plus, CalendarCheck, User } from "lucide-react";
import FlagPlayziIcon from "@/components/icons/FlagPlayziIcon";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { refreshPendingConnectionRequests, usePendingConnectionRequests } from "@/lib/connection-notification-store";
import { refreshActivitiesNotificationState, useActivitiesNotificationState } from "@/lib/activities-notification-store";
import { refreshUserNotificationsUnreadCount, useUserNotificationsUnreadCount } from "@/lib/user-notifications-store";
import NotificationBadge, { NotificationBadgeTone } from "@/components/NotificationBadge";
import { PLAYZI_ONBOARDING_ACTION_EVENT } from "@/lib/playzi-onboarding";
import { getTutorialModeSnapshot } from "@/lib/tutorial-mode";

export type Tab = "discover" | "events" | "activities" | "profile";

interface BottomNavigationProps {
    isHidden?: boolean;
    activeTab?: Tab;
}

const NOTIFICATIONS_CHANGED_EVENT = "playzi:notifications-changed";

export default function BottomNavigation({ isHidden = false, activeTab = "discover" }: BottomNavigationProps) {
    const {
        upcomingRedCount,
        upcomingInvitationCount,
        upcomingCancellationVoteCount,
        pastPostActionCount,
    } = useActivitiesNotificationState();
    const pendingConnectionRequests = usePendingConnectionRequests();
    const unreadUserNotifications = useUserNotificationsUnreadCount();

    useEffect(() => {
        const loadUnread = async () => {
            try {
                await refreshActivitiesNotificationState();
                await refreshPendingConnectionRequests();
                await refreshUserNotificationsUnreadCount();
            } catch {
                // Keep previous values to avoid visual flicker.
            }
        };

        void loadUnread();
        const onFocus = () => { void loadUnread(); };
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void loadUnread();
            }
        };
        const onNotificationsChanged = () => { void loadUnread(); };
        const intervalId = window.setInterval(() => { void loadUnread(); }, 15000);
        window.addEventListener("focus", onFocus);
        window.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
        };
    }, []);

    const activitiesBadge = useMemo((): { tone: NotificationBadgeTone; count: number } | null => {
        if (upcomingRedCount > 0) {
            return { tone: "red", count: upcomingRedCount };
        }
        if (upcomingCancellationVoteCount > 0) {
            return { tone: "amber", count: upcomingCancellationVoteCount };
        }
        if (upcomingInvitationCount > 0) {
            return { tone: "blue", count: upcomingInvitationCount };
        }
        if (pastPostActionCount > 0) {
            return { tone: "orange", count: pastPostActionCount };
        }
        return null;
    }, [upcomingRedCount, upcomingCancellationVoteCount, upcomingInvitationCount, pastPostActionCount]);

    const handleCreateClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        const tutorialSnapshot = getTutorialModeSnapshot();
        const isTutorialPlusStep = tutorialSnapshot.enabled && tutorialSnapshot.stepId === "create-entry";
        if (!isTutorialPlusStep) return;

        event.preventDefault();
        window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_ACTION_EVENT, {
            detail: { type: "plus_press", stepId: "create-entry" },
        }));
    };

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
                <Link data-onboarding-id="nav-events" href="/events" className={cn("flex flex-col items-center justify-center gap-1 transition-all active:scale-95", activeTab === "events" ? "text-playzi-green" : "text-gray-400 hover:text-gray-dark")}>
                    <FlagPlayziIcon className="w-6 h-6" isActive={activeTab === "events"} />
                    <span className={cn("text-[10px]", activeTab === "events" ? "font-bold" : "font-medium")}>Events</span>
                </Link>

                {/* CRÉER */}
                <div className="relative -top-5">
                    <div className="absolute inset-x-0 -inset-y-0.5 bg-white/50 backdrop-blur-md rounded-full scale-110 pointer-events-none" />
                    <Link data-onboarding-id="nav-create" href="/create" onClick={handleCreateClick} className="relative flex items-center justify-center w-14 h-14 bg-playzi-green text-white rounded-full
                             shadow-[0_3px_0_rgb(5,150,105),0_8px_18px_rgba(16,185,129,0.24)] hover:shadow-[0_2px_0_rgb(5,150,105),0_9px_20px_rgba(16,185,129,0.26)]
                             hover:translate-y-[1px] active:translate-y-[2px] active:shadow-[0_1px_0_rgb(5,150,105),0_6px_14px_rgba(16,185,129,0.22)] transition-all">
                        <Plus className="w-8 h-8 stroke-[3px]" />
                    </Link>
                </div>

                {/* Mes activités */}
                <Link data-onboarding-id="nav-activities" href="/activities" className={cn("relative flex flex-col items-center justify-center gap-1 transition-colors", activeTab === "activities" ? "text-playzi-green" : "text-gray-400 hover:text-gray-dark")}>
                    <div className="relative">
                        <CalendarCheck className={cn("w-6 h-6 stroke-[1.5px]", activeTab === "activities" ? "fill-playzi-green/20" : "")} />
                        {activitiesBadge && (
                            <NotificationBadge tone={activitiesBadge.tone} count={activitiesBadge.count} />
                        )}
                    </div>
                    <span className={cn("text-[10px]", activeTab === "activities" ? "font-bold" : "font-medium")}>Mes activités</span>
                </Link>

                {/* Profil */}
                <Link href="/profil" className={cn("relative flex flex-col items-center justify-center gap-1 transition-colors", activeTab === "profile" ? "text-playzi-green" : "text-gray-400 hover:text-gray-dark")}>
                    <div className="relative">
                        <User className={cn("w-6 h-6 stroke-[1.5px]", activeTab === "profile" ? "fill-playzi-green/20" : "")} />
                        {unreadUserNotifications > 0 ? (
                            <NotificationBadge tone="red" count={unreadUserNotifications} />
                        ) : pendingConnectionRequests > 0 ? (
                            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border border-white/95 shadow-[0_1px_4px_rgba(59,130,246,0.20)] pointer-events-none bg-blue-500/95" />
                        ) : null}
                    </div>
                    <span className={cn("text-[10px]", activeTab === "profile" ? "font-bold" : "font-medium")}>Profil</span>
                </Link>

            </div>
        </div>
    );
}
