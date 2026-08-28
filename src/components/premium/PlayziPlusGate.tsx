"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Crown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayziPlus, type PlayziPlusFeature, type PlayziPlusState } from "@/lib/billing/use-playzi-plus";

type PlayziPlusGateProps = {
    children: ReactNode;
    feature?: PlayziPlusFeature;
    className?: string;
    contentClassName?: string;
    overlayClassName?: string;
    title?: string;
    description?: string;
    ctaLabel?: string;
    ctaHref?: string;
    loadingLabel?: string;
    stateOverride?: PlayziPlusState;
};

export default function PlayziPlusGate({
    children,
    feature,
    className,
    contentClassName,
    overlayClassName,
    title = "Fonctionnalité Playzi+",
    description = "Passe à Playzi+ pour débloquer cette fonctionnalité.",
    ctaLabel = "Découvrir Playzi+",
    ctaHref = "/pricing",
    loadingLabel = "Vérification Playzi+...",
    stateOverride,
}: PlayziPlusGateProps) {
    const playziPlus = usePlayziPlus({ enabled: !stateOverride });
    const state = stateOverride || playziPlus.state;
    const isLoading = state === "loading";
    const isUnlocked = stateOverride
        ? state === "active" || state === "scheduled_cancellation"
        : feature
            ? playziPlus.can(feature)
            : playziPlus.isActive;

    if (isUnlocked) {
        return (
            <div className={cn("relative overflow-hidden rounded-[22px]", className)}>
                <div className={contentClassName}>{children}</div>
            </div>
        );
    }

    return (
        <div className={cn("relative overflow-hidden rounded-[22px]", className)}>
            <div
                className={cn(
                    "pointer-events-none select-none blur-[3px] contrast-75",
                    isLoading && "opacity-70",
                    contentClassName
                )}
                aria-hidden="true"
            >
                {children}
            </div>

            <div
                className={cn(
                    "absolute inset-0 z-20 flex items-center justify-center rounded-[22px] bg-white/72 px-4 backdrop-blur-[4px]",
                    overlayClassName
                )}
            >
                <div className="max-w-[260px] rounded-2xl border border-playzi-green/20 bg-white/95 p-4 text-center shadow-[0_14px_30px_rgba(16,185,129,0.12)]">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-playzi-green">
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crown className="h-5 w-5" />}
                    </div>

                    <p className="mt-3 text-[11px] font-black uppercase tracking-[0.16em] text-playzi-green">
                        {isLoading ? loadingLabel : title}
                    </p>

                    {!isLoading && (
                        <>
                            <p className="mt-1 text-[13px] font-semibold leading-snug text-gray-500">{description}</p>
                            <Link
                                href={ctaHref}
                                className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-playzi-green px-4 text-[13px] font-black text-white shadow-[0_8px_18px_rgba(16,185,129,0.22)] transition hover:bg-emerald-500 active:scale-[0.98]"
                            >
                                {ctaLabel}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
