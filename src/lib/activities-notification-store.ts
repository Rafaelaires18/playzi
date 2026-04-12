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

type MyActivityNotificationPayload = {
    start_time: string;
    status: string;
    feedbackStatus?: string;
    unreadRedCount?: number;
    unreadInvitationCount?: number;
    unreadAmberCount?: number;
    unreadBlueCount?: number;
    unreadGoldCount?: number;
    pulseClaimable?: boolean;
    pendingInvitation?: {
        status?: "pending" | "accepted" | "expired";
    } | null;
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

function deriveFromActivities(activities: MyActivityNotificationPayload[]) {
    const nowMs = Date.now();
    const upcoming = activities.filter((a) =>
        new Date(a.start_time).getTime() > nowMs
        && ["ouvert", "complet", "confirmé", "en_attente"].includes(a.status)
    );
    const past = activities.filter((a) =>
        new Date(a.start_time).getTime() <= nowMs || ["passé", "annulé"].includes(a.status)
    );

    return {
        upcomingRedCount: upcoming.reduce((sum, a) => sum + Math.max(0, Number(a.unreadRedCount || 0)), 0),
        upcomingInvitationCount: upcoming.reduce((sum, a) => {
            const invitationUnread = Math.max(0, Number(a.unreadInvitationCount || 0));
            const pendingInvitation = a.pendingInvitation?.status === "pending" ? 1 : 0;
            return sum + Math.max(invitationUnread, pendingInvitation);
        }, 0),
        upcomingUnreadCount: upcoming.reduce((sum, a) => {
            const chatAndEventUnread = Math.max(0, Number(a.unreadRedCount || 0));
            const invitationUnread = Math.max(0, Number(a.unreadInvitationCount || 0));
            const pendingInvitation = a.pendingInvitation?.status === "pending" ? 1 : 0;
            return sum + chatAndEventUnread + Math.max(invitationUnread, pendingInvitation);
        }, 0),
        upcomingCancellationVoteCount: upcoming.reduce((sum, a) => sum + Math.max(0, Number(a.unreadAmberCount || 0)), 0),
        pastPostActionCount: past.reduce((sum, a) => {
            const hasPostAction =
                a.feedbackStatus === "pending"
                || Number(a.unreadBlueCount || 0) > 0
                || Number(a.unreadGoldCount || 0) > 0
                || !!a.pulseClaimable;
            return sum + (hasPostAction ? 1 : 0);
        }, 0),
        pastNeedsAttention: past.some((a) => a.feedbackStatus === "pending" || Number(a.unreadBlueCount || 0) > 0),
        pastHasGoldClaim: past.some((a) => Number(a.unreadGoldCount || 0) > 0 || !!a.pulseClaimable),
    };
}

export async function refreshActivitiesNotificationState() {
    try {
        const res = await fetch(`/api/activities?filter=my_activities&t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return state;
        const json = await res.json().catch(() => null);
        const activities: MyActivityNotificationPayload[] = Array.isArray(json?.data) ? json.data : [];
        setActivitiesNotificationState(deriveFromActivities(activities));
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
