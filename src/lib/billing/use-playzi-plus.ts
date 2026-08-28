"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlayziPlusAccessSource, PlayziPlusFeature, PlayziPlusGrantType } from "@/lib/billing/entitlements";

export type PlayziPlusSubscription = {
    status?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean | null;
    ended_at?: string | null;
};

export type PlayziPlusState =
    | "loading"
    | "free"
    | "active"
    | "scheduled_cancellation"
    | "ended"
    | "error";

export type PlayziPlusEntitlements = {
    has_playzi_plus: boolean;
    access_source: PlayziPlusAccessSource;
    launch_free_access: boolean;
    stripe_active: boolean;
    manual_grant_active: boolean;
    manual_grant_type: PlayziPlusGrantType | null;
    expires_at: string | null;
    subscription: PlayziPlusSubscription | null;
    features: Record<PlayziPlusFeature, boolean>;
};

type ApiResponse = {
    data?: PlayziPlusEntitlements;
    error?: string;
};

const ENTITLEMENTS_CACHE_TTL_MS = 30 * 1000;

let cachedEntitlements: {
    value: PlayziPlusEntitlements;
    fetchedAt: number;
} | null = null;
let inFlightEntitlements: Promise<PlayziPlusEntitlements> | null = null;
const listeners = new Set<() => void>();

function notifyEntitlementsListeners() {
    for (const listener of listeners) listener();
}

async function fetchEntitlements(options?: { force?: boolean }) {
    const now = Date.now();
    if (
        !options?.force
        && cachedEntitlements
        && now - cachedEntitlements.fetchedAt < ENTITLEMENTS_CACHE_TTL_MS
    ) {
        return cachedEntitlements.value;
    }

    if (!options?.force && inFlightEntitlements) {
        return inFlightEntitlements;
    }

    inFlightEntitlements = (async () => {
        const res = await fetch("/api/billing/entitlements", { cache: "no-store" });
        const body = (await res.json().catch(() => null)) as ApiResponse | null;

        if (!res.ok) {
            throw new Error(body?.error || "Impossible de charger les droits Playzi+.");
        }

        const nextEntitlements = body?.data || null;
        if (!nextEntitlements) {
            throw new Error("Impossible de charger les droits Playzi+.");
        }

        cachedEntitlements = {
            value: nextEntitlements,
            fetchedAt: Date.now(),
        };
        notifyEntitlementsListeners();
        return nextEntitlements;
    })();

    try {
        return await inFlightEntitlements;
    } finally {
        inFlightEntitlements = null;
    }
}

function getCachedEntitlements() {
    if (
        cachedEntitlements
        && Date.now() - cachedEntitlements.fetchedAt < ENTITLEMENTS_CACHE_TTL_MS
    ) {
        return cachedEntitlements.value;
    }
    return null;
}

function isEndedStatus(status: string | null | undefined) {
    return ["canceled", "unpaid", "incomplete_expired"].includes(String(status || "").toLowerCase());
}

function createEmptyFeatures() {
    return {
        unlimited_activity_creation: false,
        advanced_filters: false,
        advanced_stats: false,
        pulse_evolution: false,
        participant_profiles: false,
        ad_free: false,
        premium_customization: false,
    } satisfies Record<PlayziPlusFeature, boolean>;
}

function resolvePlayziPlusState(entitlements: PlayziPlusEntitlements | null): Exclude<PlayziPlusState, "loading" | "error"> {
    const subscription = entitlements?.subscription || null;

    if (entitlements?.has_playzi_plus) {
        if (entitlements.stripe_active && subscription?.cancel_at_period_end === true) {
            return "scheduled_cancellation";
        }

        return "active";
    }

    if (subscription?.ended_at || isEndedStatus(subscription?.status)) {
        return "ended";
    }

    return "free";
}

export function formatPlayziPlusPeriodEnd(value?: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";

    return date.toLocaleDateString("fr-CH", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export function usePlayziPlus(options?: { enabled?: boolean }) {
    const enabled = options?.enabled !== false;
    const [entitlements, setEntitlements] = useState<PlayziPlusEntitlements | null>(() => getCachedEntitlements());
    const [state, setState] = useState<PlayziPlusState>(() => {
        if (!enabled) return "free";
        const cached = getCachedEntitlements();
        return cached ? resolvePlayziPlusState(cached) : "loading";
    });
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setState("loading");
        setError(null);

        try {
            const nextEntitlements = await fetchEntitlements({ force: true });
            setEntitlements(nextEntitlements);
            setState(resolvePlayziPlusState(nextEntitlements));
        } catch (err) {
            setEntitlements(null);
            setState("error");
            setError(err instanceof Error ? err.message : "Impossible de charger les droits Playzi+.");
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let mounted = true;

        const load = async () => {
            const cached = getCachedEntitlements();
            if (cached) {
                setEntitlements(cached);
                setState(resolvePlayziPlusState(cached));
                setError(null);
                return;
            }

            try {
                if (!mounted) return;
                const nextEntitlements = await fetchEntitlements();
                if (!mounted) return;
                setEntitlements(nextEntitlements);
                setState(resolvePlayziPlusState(nextEntitlements));
                setError(null);
            } catch (err) {
                if (!mounted) return;
                setEntitlements(null);
                setState("error");
                setError(err instanceof Error ? err.message : "Impossible de charger les droits Playzi+.");
            }
        };

        void load();
        const onCacheUpdate = () => {
            const cached = getCachedEntitlements();
            if (!mounted || !cached) return;
            setEntitlements(cached);
            setState(resolvePlayziPlusState(cached));
            setError(null);
        };
        listeners.add(onCacheUpdate);

        return () => {
            mounted = false;
            listeners.delete(onCacheUpdate);
        };
    }, [enabled]);

    return useMemo(() => {
        const subscription = entitlements?.subscription || null;
        const features = entitlements?.features || createEmptyFeatures();
        const currentPeriodEndLabel = formatPlayziPlusPeriodEnd(subscription?.current_period_end);
        const isActive = state === "active" || state === "scheduled_cancellation";
        const can = (feature: PlayziPlusFeature) => features[feature] === true;

        return {
            state,
            error,
            entitlements,
            subscription,
            features,
            can,
            isLoading: state === "loading",
            isActive,
            isFree: state === "free" || state === "ended",
            isScheduledCancellation: state === "scheduled_cancellation",
            isEnded: state === "ended",
            hasPlayziPlus: entitlements?.has_playzi_plus === true,
            accessSource: entitlements?.access_source || "none",
            launchFreeAccess: entitlements?.launch_free_access === true,
            stripeActive: entitlements?.stripe_active === true,
            manualGrantActive: entitlements?.manual_grant_active === true,
            manualGrantType: entitlements?.manual_grant_type || null,
            currentPeriodEndLabel,
            refresh,
        };
    }, [entitlements, error, refresh, state]);
}

export type { PlayziPlusFeature };
