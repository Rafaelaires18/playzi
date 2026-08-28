"use client";

const DEFAULT_TTL_MS = 30 * 1000;

type CacheEntry<T> = {
    value: T;
    fetchedAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
let listenersBound = false;

function bindCacheResetListeners() {
    if (listenersBound || typeof window === "undefined") return;
    listenersBound = true;
    window.addEventListener("playzi:auth-state-reset", clearActivitiesPayloadCache);
    window.addEventListener("playzi:notifications-changed", clearActivitiesPayloadCache);
}

export function buildActivitiesCacheKey(url: URL | string) {
    bindCacheResetListeners();
    const parsed = typeof url === "string"
        ? new URL(url, typeof window === "undefined" ? "http://localhost" : window.location.origin)
        : url;
    const params = new URLSearchParams(parsed.searchParams);
    params.delete("t");
    const query = params.toString();
    return query ? `${parsed.pathname}?${query}` : parsed.pathname;
}

export function getCachedActivitiesPayload<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | null {
    bindCacheResetListeners();
    const entry = cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > ttlMs) return null;
    return entry.value;
}

export function clearActivitiesPayloadCache() {
    cache.clear();
    inFlight.clear();
}

export async function fetchActivitiesPayload<T>(url: URL | string, options?: { ttlMs?: number; force?: boolean }) {
    bindCacheResetListeners();
    const key = buildActivitiesCacheKey(url);
    const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    const cached = getCachedActivitiesPayload<T>(key, ttlMs);

    if (!options?.force && cached) {
        return cached;
    }

    if (!options?.force && inFlight.has(key)) {
        return inFlight.get(key) as Promise<T>;
    }

    const request = (async () => {
        const res = await fetch(url.toString(), { cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
            throw new Error(body?.error || "Impossible de charger les activités");
        }
        cache.set(key, { value: body, fetchedAt: Date.now() });
        return body as T;
    })();

    inFlight.set(key, request);
    try {
        return await request;
    } finally {
        inFlight.delete(key);
    }
}
