"use client";

import { createClient } from "@/lib/supabase/client";

declare global {
    interface Window {
        supabase?: {
            auth?: {
                signOut?: () => Promise<unknown>;
            };
        };
    }
}

const AUTH_STATE_RESET_EVENT = "playzi:auth-state-reset";

function purgeWebStorage() {
    if (typeof window === "undefined") return;
    const shouldRemove = (key: string) =>
        key.startsWith("playzi")
        || key.startsWith("sb-")
        || key.toLowerCase().includes("supabase");

    try {
        for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
            const key = window.localStorage.key(i);
            if (!key) continue;
            if (shouldRemove(key)) window.localStorage.removeItem(key);
        }
    } catch {
        // Ignore storage exceptions.
    }

    try {
        window.sessionStorage.clear();
    } catch {
        // Ignore storage exceptions.
    }
}

async function purgeRuntimeCaches() {
    if (typeof window === "undefined" || !("caches" in window)) return;
    try {
        const cacheNames = await window.caches.keys();
        await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
    } catch {
        // Ignore cache API failures.
    }
}

export async function hardResetClientAuthState() {
    try {
        const supabase = createClient();
        await supabase.auth.signOut({ scope: "global" });
    } catch {
        // Ignore browser signout failures and continue cleanup.
    }
    purgeWebStorage();
    await purgeRuntimeCaches();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(AUTH_STATE_RESET_EVENT));
    }
}

export async function logoutUser() {
    await hardResetClientAuthState();
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
}

export const authStateResetEvent = AUTH_STATE_RESET_EVENT;
