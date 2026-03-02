"use client";

declare global {
    interface Window {
        supabase?: {
            auth?: {
                signOut?: () => Promise<unknown>;
            };
        };
    }
}

export async function logoutUser() {
    await fetch("/api/auth/logout", { method: "POST" });
}
