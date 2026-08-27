"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type PlayziPlusSubscription = {
    status?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean | null;
    canceled_at?: string | null;
    ended_at?: string | null;
    updated_at?: string | null;
};

export type PlayziPlusState =
    | "loading"
    | "free"
    | "active"
    | "scheduled_cancellation"
    | "ended"
    | "error";

type BillingSubscriptionResponse = {
    subscription: PlayziPlusSubscription | null;
    playzi_plus?: {
        status?: string | null;
        is_active?: boolean | null;
    } | null;
};

type ApiResponse = {
    data?: BillingSubscriptionResponse;
    error?: string;
};

function isEndedStatus(status: string | null | undefined) {
    return ["canceled", "unpaid", "incomplete_expired"].includes(String(status || "").toLowerCase());
}

function resolvePlayziPlusState(data: BillingSubscriptionResponse | null): Exclude<PlayziPlusState, "loading" | "error"> {
    const subscription = data?.subscription || null;
    const isActive = data?.playzi_plus?.is_active === true;

    if (isActive && subscription?.cancel_at_period_end === true) {
        return "scheduled_cancellation";
    }

    if (isActive) {
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

export function usePlayziPlus() {
    const [billing, setBilling] = useState<BillingSubscriptionResponse | null>(null);
    const [state, setState] = useState<PlayziPlusState>("loading");
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setState((current) => (current === "loading" ? current : "loading"));
        setError(null);

        try {
            const res = await fetch("/api/billing/subscription", { cache: "no-store" });
            const body = (await res.json().catch(() => null)) as ApiResponse | null;

            if (!res.ok) {
                throw new Error(body?.error || "Impossible de charger l'abonnement Playzi+.");
            }

            const nextBilling = body?.data || null;
            setBilling(nextBilling);
            setState(resolvePlayziPlusState(nextBilling));
        } catch (err) {
            setBilling(null);
            setState("error");
            setError(err instanceof Error ? err.message : "Impossible de charger l'abonnement Playzi+.");
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            try {
                const res = await fetch("/api/billing/subscription", { cache: "no-store" });
                const body = (await res.json().catch(() => null)) as ApiResponse | null;

                if (!res.ok) {
                    throw new Error(body?.error || "Impossible de charger l'abonnement Playzi+.");
                }

                if (!mounted) return;
                const nextBilling = body?.data || null;
                setBilling(nextBilling);
                setState(resolvePlayziPlusState(nextBilling));
                setError(null);
            } catch (err) {
                if (!mounted) return;
                setBilling(null);
                setState("error");
                setError(err instanceof Error ? err.message : "Impossible de charger l'abonnement Playzi+.");
            }
        };

        void load();

        return () => {
            mounted = false;
        };
    }, []);

    return useMemo(() => {
        const subscription = billing?.subscription || null;
        const currentPeriodEndLabel = formatPlayziPlusPeriodEnd(subscription?.current_period_end);
        const isActive = state === "active" || state === "scheduled_cancellation";

        return {
            state,
            error,
            subscription,
            isLoading: state === "loading",
            isActive,
            isFree: state === "free" || state === "ended",
            isScheduledCancellation: state === "scheduled_cancellation",
            isEnded: state === "ended",
            currentPeriodEndLabel,
            refresh,
        };
    }, [billing, error, refresh, state]);
}
