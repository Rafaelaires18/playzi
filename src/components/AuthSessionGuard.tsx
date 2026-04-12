"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hardResetClientAuthState } from "@/lib/auth";

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

const AUTH_GUARD_GRACE_KEY = "playzi_auth_guard_grace_until";
const AUTH_GUARD_DEFAULT_GRACE_MS = 2500;
const AUTH_GUARD_RECHECK_DELAY_MS = 1200;

function getGuardGraceUntil() {
    if (typeof window === "undefined") return 0;
    const raw = window.sessionStorage.getItem(AUTH_GUARD_GRACE_KEY);
    const parsed = Number(raw || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function setGuardGrace(msFromNow: number) {
    if (typeof window === "undefined") return;
    const until = Date.now() + msFromNow;
    window.sessionStorage.setItem(AUTH_GUARD_GRACE_KEY, String(until));
}

export default function AuthSessionGuard() {
    const pathname = usePathname();
    const checkingRef = useRef(false);
    const mismatchRetryRef = useRef<number | null>(null);

    useEffect(() => {
        if (!pathname || isPublicPath(pathname)) return;

        const supabase = createClient();
        let cancelled = false;

        const forceLogoutOnMismatch = async () => {
            console.warn("[AUTH][guard][force_logout_on_mismatch]", { pathname });
            await hardResetClientAuthState();
            await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => null);
            if (!cancelled) window.location.replace("/login?force_login=1&session_mismatch=1");
        };

        const verifySession = async (allowRetry = true) => {
            if (checkingRef.current) return;
            const graceUntil = getGuardGraceUntil();
            if (Date.now() < graceUntil) {
                console.info("[AUTH][guard][skip_during_grace]", { pathname, grace_until: graceUntil });
                return;
            }
            checkingRef.current = true;
            try {
                const [{ data: authData }, meRes] = await Promise.all([
                    supabase.auth.getUser(),
                    fetch(`/api/auth/me?t=${Date.now()}`, { cache: "no-store" }),
                ]);

                const authUser = authData?.user || null;
                const meBody = await meRes.json().catch(() => null);
                const apiUser = meRes.ok ? (meBody?.data?.user || null) : null;

                const authId = typeof authUser?.id === "string" ? authUser.id : "";
                const apiId = typeof apiUser?.id === "string" ? apiUser.id : "";
                const authEmail = typeof authUser?.email === "string" ? authUser.email.trim().toLowerCase() : "";
                const apiEmail = typeof apiUser?.email === "string" ? apiUser.email.trim().toLowerCase() : "";

                const mismatch =
                    (Boolean(authId) !== Boolean(apiId))
                    || (authId && apiId && authId !== apiId)
                    || (authEmail && apiEmail && authEmail !== apiEmail);

                if (mismatch) {
                    console.warn("[AUTH][guard][mismatch_detected]", {
                        pathname,
                        auth_id: authId || null,
                        api_id: apiId || null,
                        auth_email: authEmail || null,
                        api_email: apiEmail || null,
                    });
                    if (allowRetry) {
                        if (mismatchRetryRef.current) window.clearTimeout(mismatchRetryRef.current);
                        mismatchRetryRef.current = window.setTimeout(() => {
                            if (!cancelled) void verifySession(false);
                        }, AUTH_GUARD_RECHECK_DELAY_MS);
                        return;
                    }
                    await forceLogoutOnMismatch();
                }
            } finally {
                checkingRef.current = false;
            }
        };

        void verifySession();
        const { data: listener } = supabase.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
                setGuardGrace(AUTH_GUARD_DEFAULT_GRACE_MS);
                console.info("[AUTH][guard][auth_event]", { event, pathname });
            }
            if (!cancelled) void verifySession();
        });

        return () => {
            cancelled = true;
            if (mismatchRetryRef.current) {
                window.clearTimeout(mismatchRetryRef.current);
                mismatchRetryRef.current = null;
            }
            listener?.subscription.unsubscribe();
        };
    }, [pathname]);

    return null;
}
