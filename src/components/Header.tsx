"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, Menu, Shield } from "lucide-react";
import OptionsSheet from "@/components/options/OptionsSheet";
import { PLAYZI_ONBOARDING_ACTION_EVENT } from "@/lib/playzi-onboarding";
import { getTutorialModeSnapshot } from "@/lib/tutorial-mode";
import NotificationBadge from "@/components/NotificationBadge";
import { refreshUserNotificationsUnreadCount, useUserNotificationsUnreadCount } from "@/lib/user-notifications-store";

interface HeaderProps {
    onOpenOptions?: () => void;
}

const STAFF_BADGE_CACHE_KEY = "playzi_staff_badge_v1";
const STAFF_BADGE_CACHE_TTL_MS = 15 * 60 * 1000;
const DISCOVER_REFRESH_REQUEST_EVENT = "playzi:discover-refresh-requested";
const NOTIFICATIONS_CHANGED_EVENT = "playzi:notifications-changed";

export default function Header({ onOpenOptions }: HeaderProps = {}) {
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [isStaffAccount, setIsStaffAccount] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        try {
            const raw = window.sessionStorage.getItem(STAFF_BADGE_CACHE_KEY);
            if (!raw) return false;
            const parsed = JSON.parse(raw) as { value?: boolean; ts?: number };
            const ts = typeof parsed?.ts === "number" ? parsed.ts : 0;
            const value = !!parsed?.value;
            if (!value) return false;
            if (Date.now() - ts > STAFF_BADGE_CACHE_TTL_MS) return false;
            return true;
        } catch {
            return false;
        }
    });
    const router = useRouter();
    const pathname = usePathname();
    const [isLogoRefreshing, setIsLogoRefreshing] = useState(false);
    const unreadUserNotifications = useUserNotificationsUnreadCount();

    useEffect(() => {
        let mounted = true;
        const checkStaffAccount = async () => {
            try {
                const res = await fetch(`/api/admin/moderation/whoami?t=${Date.now()}`, { cache: "no-store" });
                if (!res.ok) return;
                const body = await res.json().catch(() => null);
                if (!mounted) return;
                const allowed = !!body?.data?.moderator_access?.allowed;
                setIsStaffAccount(allowed);
                window.sessionStorage.setItem(
                    STAFF_BADGE_CACHE_KEY,
                    JSON.stringify({ value: allowed, ts: Date.now() })
                );
            } catch {
                // Keep cached state on temporary network failures.
            }
        };
        void checkStaffAccount();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        const loadUnread = async () => {
            await refreshUserNotificationsUnreadCount();
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

    const handleOpen = () => {
        setIsOptionsOpen(true);
        if (onOpenOptions) onOpenOptions();
    };

    const handlePlayziClick = () => {
        const tutorialSnapshot = getTutorialModeSnapshot();
        const isTutorialLogoStep = tutorialSnapshot.enabled && tutorialSnapshot.stepId === "discover-refresh";

        const isDiscoverRoute = pathname === "/" || pathname === "/discover";
        if (!isDiscoverRoute) {
            router.push("/discover");
            return;
        }

        if (isTutorialLogoStep) {
            setIsLogoRefreshing(true);
            window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_ACTION_EVENT, {
                detail: { type: "logo_refreshing", stepId: "discover-refresh" },
            }));
            window.setTimeout(() => {
                setIsLogoRefreshing(false);
                window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_ACTION_EVENT, {
                    detail: { type: "logo_refreshed", stepId: "discover-refresh" },
                }));
            }, 1200);
            return;
        }

        setIsLogoRefreshing(true);
        window.dispatchEvent(new CustomEvent(DISCOVER_REFRESH_REQUEST_EVENT));
        window.setTimeout(() => setIsLogoRefreshing(false), 650);
    };

    return (
        <>
            {/* Header (Fixed to viewport for strict adherence to user request) */}
            <header className="pointer-events-auto fixed top-0 w-full max-w-md mx-auto h-16 z-50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border-b border-[#F0F0F0] flex items-center justify-between px-6 transition-all">
                <div className="flex items-center">
                    <motion.button
                        type="button"
                        onClick={handlePlayziClick}
                        data-onboarding-id="logo"
                        whileTap={{ scale: 0.95, opacity: 0.85 }}
                        animate={isLogoRefreshing ? { scale: [1, 0.97, 1.02, 1], opacity: [1, 0.88, 1] } : undefined}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                        className="rounded-md px-1 py-0.5 text-left transition hover:opacity-85"
                        aria-label="Aller à Discover ou actualiser les activités"
                    >
                        <h1 className="text-2xl font-black text-gray-dark tracking-tight">
                            Playzi<span className="text-playzi-green">.</span>
                        </h1>
                    </motion.button>
                </div>
                {isStaffAccount && (
                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
                            <Shield className="h-3.5 w-3.5" />
                            Admin
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-1">
                    <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => router.push("/notifications")}
                        className="relative p-2 text-gray-600 hover:text-black hover:bg-gray-100/80 rounded-full transition-colors"
                        aria-label="Ouvrir les notifications"
                    >
                        <Bell className="w-5 h-5" strokeWidth={2} />
                        {unreadUserNotifications > 0 ? (
                            <NotificationBadge tone="red" className="-top-1 -right-1.5 min-w-[16px] h-[16px] text-[9px] border-[1.5px]" count={undefined} />
                        ) : null}
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.9, rotate: -5 }}
                        onClick={handleOpen}
                        className="p-2 -mr-2 text-gray-600 hover:text-black hover:bg-gray-100/80 rounded-full transition-colors"
                        aria-label="Ouvrir le menu"
                    >
                        <Menu className="w-6 h-6" strokeWidth={2} />
                    </motion.button>
                </div>
            </header>

            <OptionsSheet open={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} />
        </>
    );
}
