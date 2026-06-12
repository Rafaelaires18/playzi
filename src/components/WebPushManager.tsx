"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isPushSupported, subscribeCurrentBrowser, unsubscribeCurrentBrowser } from "@/lib/push-client";

const PUBLIC_PATH_PREFIXES = [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/auth/confirm",
    "/auth/email-change",
];

function isPublicPath(pathname: string) {
    return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default function WebPushManager() {
    const pathname = usePathname();

    useEffect(() => {
        if (!pathname || isPublicPath(pathname) || !isPushSupported()) return;

        const supabase = createClient();
        let cancelled = false;

        const syncIfEligible = async () => {
            const prefRes = await fetch("/api/profile/notifications", { cache: "no-store" }).catch(() => null);
            const prefJson = prefRes && prefRes.ok ? await prefRes.json().catch(() => null) : null;
            const sportsEnabled = prefJson?.data?.notifications?.sports_enabled !== false;

            if (!sportsEnabled) {
                await unsubscribeCurrentBrowser();
                return;
            }

            if (Notification.permission === "granted") {
                await subscribeCurrentBrowser();
            }
        };

        void syncIfEligible();
        const { data: listener } = supabase.auth.onAuthStateChange(async (event) => {
            if (cancelled) return;
            if (event === "SIGNED_OUT") {
                await unsubscribeCurrentBrowser();
                return;
            }
            if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
                await syncIfEligible();
            }
        });

        return () => {
            cancelled = true;
            listener.subscription.unsubscribe();
        };
    }, [pathname]);

    return null;
}
