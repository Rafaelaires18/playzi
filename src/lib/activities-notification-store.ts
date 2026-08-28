"use client";

import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "playzi_activities_notification_state_v1";

type ActivitiesNotificationState = {
    upcomingRedCount: number;
    upcomingInvitationCount: number;
    upcomingUnreadCount: number;
    upcomingCancellationVoteCount: number;
    pastPostActionCount: number;
    pastNeedsAttention: boolean;
    pastHasGoldClaim: boolean;
};

const DEFAULT_STATE: ActivitiesNotificationState = {
    upcomingRedCount: 0,
    upcomingInvitationCount: 0,
    upcomingUnreadCount: 0,
    upcomingCancellationVoteCount: 0,
    pastPostActionCount: 0,
    pastNeedsAttention: false,
    pastHasGoldClaim: false,
};

let state: ActivitiesNotificationState = DEFAULT_STATE;
let isHydrated = false;
const listeners = new Set<() => void>();

function emit() {
    for (const listener of listeners) listener();
}

function clampInt(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
}

function sanitize(input: Partial<ActivitiesNotificationState>): ActivitiesNotificationState {
    return {
        upcomingRedCount: clampInt(input.upcomingRedCount),
        upcomingInvitationCount: clampInt(input.upcomingInvitationCount),
        upcomingUnreadCount: clampInt(input.upcomingUnreadCount),
        upcomingCancellationVoteCount: clampInt(input.upcomingCancellationVoteCount),
        pastPostActionCount: clampInt(input.pastPostActionCount),
        pastNeedsAttention: !!input.pastNeedsAttention,
        pastHasGoldClaim: !!input.pastHasGoldClaim,
    };
}

function persist() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hydrate() {
    if (isHydrated || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw) as Partial<ActivitiesNotificationState>;
            state = sanitize(parsed);
        } catch {
            state = DEFAULT_STATE;
        }
    }
    isHydrated = true;
}

export function getActivitiesNotificationSnapshot() {
    return state;
}

export function subscribeActivitiesNotification(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function setActivitiesNotificationState(next: Partial<ActivitiesNotificationState>) {
    const sanitized = sanitize(next);
    const unchanged = sanitized.upcomingUnreadCount === state.upcomingUnreadCount
        && sanitized.upcomingRedCount === state.upcomingRedCount
        && sanitized.upcomingInvitationCount === state.upcomingInvitationCount
        && sanitized.upcomingCancellationVoteCount === state.upcomingCancellationVoteCount
        && sanitized.pastPostActionCount === state.pastPostActionCount
        && sanitized.pastNeedsAttention === state.pastNeedsAttention
        && sanitized.pastHasGoldClaim === state.pastHasGoldClaim;
    if (unchanged) return;
    state = sanitized;
    persist();
    emit();
}

export async function refreshActivitiesNotificationState() {
    try {
        const res = await fetch(`/api/activities/notification-state?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return state;
        const json = await res.json().catch(() => null);
        setActivitiesNotificationState(json?.data || {});
        return state;
    } catch {
        // Keep previous state to avoid badge flicker on transient errors.
        return state;
    }
}

export function useActivitiesNotificationState() {
    const snapshot = useSyncExternalStore(
        subscribeActivitiesNotification,
        getActivitiesNotificationSnapshot,
        () => DEFAULT_STATE
    );

    useEffect(() => {
        hydrate();
        emit();
    }, []);

    return snapshot;
}
