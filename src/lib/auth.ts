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
    // TODO: replace this fallback with the shared Supabase client once auth is wired in the repo.
    if (typeof window !== "undefined" && window.supabase?.auth?.signOut) {
        await window.supabase.auth.signOut();
    }
}
