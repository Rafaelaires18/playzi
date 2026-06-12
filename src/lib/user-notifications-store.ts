"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "playzi_user_notifications_unread_v1";

type State = {
    unreadCount: number;
};

const fallbackState: State = { unreadCount: 0 };
let state: State = fallbackState;
const listeners = new Set<() => void>();

function readPersistedState(): State {
    if (typeof window === "undefined") return fallbackState;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return fallbackState;
        const parsed = JSON.parse(raw) as Partial<State>;
        return { unreadCount: Math.max(0, Number(parsed.unreadCount || 0)) };
    } catch {
        return fallbackState;
    }
}

function persistState(next: State) {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // ignore
    }
}

function emit() {
    for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
    state = readPersistedState();
}

export function useUserNotificationsUnreadCount() {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        () => state.unreadCount,
        () => 0
    );
}

export async function refreshUserNotificationsUnreadCount() {
    try {
        const res = await fetch(`/api/notifications/unread-count?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return state.unreadCount;
        const body = await res.json().catch(() => null);
        const unreadCount = Math.max(0, Number(body?.data?.unread_count || 0));
        if (unreadCount === state.unreadCount) return unreadCount;
        state = { unreadCount };
        persistState(state);
        emit();
        return unreadCount;
    } catch {
        return state.unreadCount;
    }
}

