"use client";

import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "playzi_pending_connection_requests_v1";

let pendingCount = 0;
let isHydrated = false;
const listeners = new Set<() => void>();

function emit() {
    for (const listener of listeners) listener();
}

function sanitizeCount(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
}

function persist() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, String(pendingCount));
}

function hydrate() {
    if (isHydrated || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    pendingCount = sanitizeCount(raw);
    isHydrated = true;
}

export function getPendingConnectionRequestsSnapshot() {
    return pendingCount;
}

export function subscribePendingConnectionRequests(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function setPendingConnectionRequests(count: number) {
    const next = sanitizeCount(count);
    if (next === pendingCount) return;
    pendingCount = next;
    persist();
    emit();
}

export function clearPendingConnectionRequests() {
    setPendingConnectionRequests(0);
}

export async function refreshPendingConnectionRequests() {
    try {
        const res = await fetch(`/api/connections/pending-count?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return pendingCount;
        const json = await res.json().catch(() => null);
        const next = sanitizeCount(json?.data?.pending_count);
        setPendingConnectionRequests(next);
        return next;
    } catch {
        return pendingCount;
    }
}

export function usePendingConnectionRequests() {
    const count = useSyncExternalStore(
        subscribePendingConnectionRequests,
        getPendingConnectionRequestsSnapshot,
        () => 0
    );

    useEffect(() => {
        hydrate();
        emit();
    }, []);

    return count;
}
