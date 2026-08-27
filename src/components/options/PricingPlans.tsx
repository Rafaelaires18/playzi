"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { LAUNCH_OFFER, PRICING_PLANS, type PricingPlan } from "./pricing-data";

type SubscriptionRow = {
    status?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean | null;
    ended_at?: string | null;
};

type BillingState = {
    subscription: SubscriptionRow | null;
    playzi_plus?: {
        status?: string;
        is_active?: boolean;
    };
};

type PricingPlansProps = {
    compact?: boolean;
};

function formatPeriodEnd(value?: string | null) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleDateString("fr-CH", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function resolvePlusState(billing: BillingState | null) {
    const subscription = billing?.subscription || null;
    const isActive = billing?.playzi_plus?.is_active === true;
    const isScheduledCancel = isActive && subscription?.cancel_at_period_end === true;

    if (isScheduledCancel) {
        const endLabel = formatPeriodEnd(subscription?.current_period_end);
        return {
            kind: "scheduled" as const,
            label: endLabel ? `Actif jusqu’au ${endLabel}` : "Actif jusqu’à la fin de la période",
            helper: "Ton abonnement ne sera pas renouvelé.",
        };
    }

    if (isActive) {
        return {
            kind: "active" as const,
            label: "Playzi+ actif",
            helper: "",
        };
    }

    const hasEnded = !!subscription?.ended_at || ["canceled", "unpaid", "incomplete_expired"].includes(String(subscription?.status || ""));
    return {
        kind: hasEnded ? "ended" as const : "free" as const,
        label: hasEnded ? "Repasser à Playzi+" : "Passer à Playzi+",
        helper: "",
    };
}

function FeatureRow({ text, highlighted = false }: { text: string; highlighted?: boolean }) {
    return (
        <li className="flex items-start gap-3">
            <span
                className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    highlighted ? "bg-playzi-green text-white" : "bg-emerald-50 text-playzi-green"
                )}
            >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="text-[13px] font-semibold leading-snug text-[#2D2E3B]">{text}</span>
        </li>
    );
}

function PlanCard({
    plan,
    compact,
    plusState,
    actionBusy,
    onCheckout,
    onPortal,
}: {
    plan: PricingPlan;
    compact: boolean;
    plusState: ReturnType<typeof resolvePlusState>;
    actionBusy: "checkout" | "portal" | null;
    onCheckout: () => void;
    onPortal: () => void;
}) {
    const isPlus = plan.id === "plus";
    const isCurrentFree = plan.id === "free" && (plusState.kind === "free" || plusState.kind === "ended");
    const isCurrentPlus = isPlus && (plusState.kind === "active" || plusState.kind === "scheduled");
    const ctaLabel = isPlus
        ? plusState.kind === "active" || plusState.kind === "scheduled"
            ? "Gérer mon abonnement"
            : plusState.label
        : isCurrentFree
            ? "Plan actuel"
            : "Inclus dans Playzi+";
    const badgeLabel = isCurrentPlus ? "Actif" : plan.badge;
    const isBusy = (actionBusy === "checkout" && isPlus && !isCurrentPlus) || (actionBusy === "portal" && isCurrentPlus);

    return (
        <article
            className={cn(
                "relative flex h-full flex-col rounded-[24px] border p-5 transition-shadow",
                isPlus
                    ? "border-playzi-green/45 bg-gradient-to-b from-emerald-50/55 to-white shadow-[0_18px_34px_rgba(16,185,129,0.12)]"
                    : "border-gray-100 bg-white shadow-sm",
                compact ? "min-h-0" : "min-h-[420px]"
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-[24px] font-black leading-none tracking-tight text-[#242841]">{plan.name}</h2>
                    <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-[27px] font-black tracking-tight text-[#242841]">{plan.price}</span>
                        {plan.cadence && <span className="text-[13px] font-bold text-gray-400">{plan.cadence}</span>}
                    </div>
                </div>
                {badgeLabel && (
                    <span className="rounded-full border border-playzi-green/20 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-playzi-green shadow-sm">
                        {badgeLabel}
                    </span>
                )}
            </div>

            {isCurrentPlus && (
                <div className="mt-4 rounded-2xl border border-playzi-green/20 bg-white/75 px-3 py-2">
                    <p className="text-[12px] font-black text-playzi-green">{plusState.label}</p>
                    {plusState.helper && <p className="mt-0.5 text-[12px] font-semibold text-gray-500">{plusState.helper}</p>}
                </div>
            )}

            <ul className="mt-5 flex-1 space-y-3">
                {plan.features.map((feature) => (
                    <FeatureRow key={feature} text={feature} highlighted={isPlus} />
                ))}
            </ul>

            <button
                type="button"
                disabled={!isPlus || isBusy}
                onClick={isCurrentPlus ? onPortal : onCheckout}
                className={cn(
                    "mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-black transition active:scale-[0.98] disabled:active:scale-100",
                    isPlus
                        ? "bg-playzi-green text-white shadow-[0_8px_18px_rgba(16,185,129,0.22)] hover:bg-emerald-500 disabled:opacity-70"
                        : "cursor-default border border-gray-100 bg-gray-50 text-gray-400"
                )}
            >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : isPlus && <ArrowRight className="h-4 w-4" />}
                {ctaLabel}
            </button>
        </article>
    );
}

export default function PricingPlans({ compact = false }: PricingPlansProps) {
    const [billing, setBilling] = useState<BillingState | null>(null);
    const [actionBusy, setActionBusy] = useState<"checkout" | "portal" | null>(null);
    const [error, setError] = useState("");
    const plusState = useMemo(() => resolvePlusState(billing), [billing]);

    useEffect(() => {
        let mounted = true;
        const loadSubscription = async () => {
            try {
                const res = await fetch("/api/billing/subscription", { cache: "no-store" });
                if (!res.ok) return;
                const body = await res.json().catch(() => null);
                if (mounted) setBilling(body?.data || null);
            } catch {
                if (mounted) setBilling(null);
            }
        };
        void loadSubscription();
        return () => {
            mounted = false;
        };
    }, []);

    const openBillingUrl = async (endpoint: "/api/billing/checkout" | "/api/billing/portal", action: "checkout" | "portal") => {
        if (actionBusy) return;
        setActionBusy(action);
        setError("");
        try {
            const res = await fetch(endpoint, { method: "POST" });
            const body = await res.json().catch(() => null);
            const url = String(body?.data?.url || "");
            if (!res.ok || !url) throw new Error(body?.error || "Action indisponible pour le moment.");
            window.location.href = url;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Action indisponible pour le moment.");
            setActionBusy(null);
        }
    };

    return (
        <div className={cn("space-y-5", !compact && "mx-auto w-full max-w-5xl")}>
            <section className="rounded-[24px] border border-playzi-green/20 bg-white px-5 py-4 shadow-[0_14px_28px_rgba(16,185,129,0.08)]">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-playzi-green">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-playzi-green">
                            {LAUNCH_OFFER.badge}
                        </span>
                        <h2 className="mt-1 text-[19px] font-black tracking-tight text-[#242841]">{LAUNCH_OFFER.title}</h2>
                        <p className="mt-1 text-[13px] font-semibold leading-relaxed text-gray-500">{LAUNCH_OFFER.text}</p>
                        <p className="mt-2 text-[11px] font-bold text-gray-400">{LAUNCH_OFFER.note}</p>
                    </div>
                </div>
            </section>

            <div className={cn("grid gap-4", compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
                {PRICING_PLANS.map((plan) => (
                    <PlanCard
                        key={plan.id}
                        plan={plan}
                        compact={compact}
                        plusState={plusState}
                        actionBusy={actionBusy}
                        onCheckout={() => void openBillingUrl("/api/billing/checkout", "checkout")}
                        onPortal={() => void openBillingUrl("/api/billing/portal", "portal")}
                    />
                ))}
            </div>

            {error && (
                <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-600">
                    {error}
                </p>
            )}
        </div>
    );
}
