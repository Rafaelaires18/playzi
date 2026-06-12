"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
    PLAYZI_ONBOARDING_ACTION_EVENT,
    PLAYZI_ONBOARDING_CLOSE_TRANSIENT_UI,
    PLAYZI_ONBOARDING_REQUEST_EVENT,
    PLAYZI_ONBOARDING_START_EVENT,
    PLAYZI_ONBOARDING_STEP_EVENT,
    ONBOARDING_STEPS,
    PLAYZI_ONBOARDING_AUTO_SHOWN_KEY,
    PLAYZI_ONBOARDING_STORAGE_KEY,
} from "@/lib/playzi-onboarding";
import { setTutorialModeEnabled, setTutorialStep } from "@/lib/tutorial-mode";

type OnboardingActionPayload = {
    type?: string;
    stepId?: string;
    direction?: "left" | "right";
};

type StepRect = {
    top: number;
    left: number;
    width: number;
    height: number;
};

const CREATE_STEP_BY_ID: Record<string, number> = {
    "create-sport": 1,
    "create-date-time": 2,
    "create-location": 3,
    "create-participants": 4,
    "create-invite": 5,
    "create-description": 6,
    "create-summary": 7,
};

const ACTIVITIES_STATUS_SUBSTEP_BY_ID: Record<string, number> = {
    "activities-status-intro": 0,
    "activities-status-confirmed-closed": 1,
    "activities-status-confirmed-open": 2,
    "activities-status-incomplete": 3,
    "activities-status-urgent": 4,
    "activities-quick-delete": 1,
};

const ACTIVITIES_CHAT_SUBSTEP_BY_ID: Record<string, number> = {
    "activities-chat-location": 0,
    "activities-chat-participants": 1,
    "activities-chat-management": 2,
};

const HIGHLIGHT_DISABLED_STEP_IDS = new Set([
    "discover-swipe",
    "discover-filters-modal",
    "activities-chat-location",
    "activities-status-intro",
    "activities-status-confirmed-closed",
    "activities-status-confirmed-open",
    "activities-status-incomplete",
    "activities-status-urgent",
    "activities-quick-delete",
    "activities-post-feedback",
    "activities-post-pulse",
]);

function routesMatch(currentPathname: string, expectedRoute: string) {
    if (expectedRoute === "/discover") {
        return currentPathname === "/" || currentPathname === "/discover";
    }
    return currentPathname === expectedRoute;
}

function getStepRect(targetId?: string): StepRect | null {
    if (!targetId) return null;
    const element = document.querySelector(`[data-onboarding-id="${targetId}"]`) as HTMLElement | null;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null;
    return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
    };
}


export default function PlayziOnboarding() {
    const pathname = usePathname();
    const router = useRouter();

    const [active, setActive] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [autoStartChecked, setAutoStartChecked] = useState(false);
    const [swipeSimDoneByStepId, setSwipeSimDoneByStepId] = useState<Record<string, boolean>>({});
    const [actionDoneByStepId, setActionDoneByStepId] = useState<Record<string, boolean>>({});
    const [swipeHint, setSwipeHint] = useState<string | null>(null);
    const [isLogoRefreshing, setIsLogoRefreshing] = useState(false);
    const [isLogoRefreshed, setIsLogoRefreshed] = useState(false);
    const [stepRect, setStepRect] = useState<StepRect | null>(null);

    const currentStep = ONBOARDING_STEPS[stepIndex] || null;

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (autoStartChecked) return;

        const eligibleAutoStart = ["/", "/discover", "/activities", "/create", "/profil", "/support"].includes(pathname);
        if (!eligibleAutoStart) return;

        const alreadyCompleted = window.localStorage.getItem(PLAYZI_ONBOARDING_STORAGE_KEY) === "1";
        const alreadyAutoShown = window.localStorage.getItem(PLAYZI_ONBOARDING_AUTO_SHOWN_KEY) === "1";
        if (alreadyAutoShown) {
            const markCheckedId = window.setTimeout(() => setAutoStartChecked(true), 0);
            return () => window.clearTimeout(markCheckedId);
        }
        if (alreadyCompleted) {
            const markCheckedId = window.setTimeout(() => setAutoStartChecked(true), 0);
            return () => window.clearTimeout(markCheckedId);
        }

        const timeoutId = window.setTimeout(() => {
            window.localStorage.setItem(PLAYZI_ONBOARDING_AUTO_SHOWN_KEY, "1");
            setSwipeSimDoneByStepId({});
            setActionDoneByStepId({});
            setIsLogoRefreshing(false);
            setIsLogoRefreshed(false);
            setStepIndex(0);
            setActive(true);
            setTutorialModeEnabled(true, "auto");
            setAutoStartChecked(true);
        }, 900);

        return () => window.clearTimeout(timeoutId);
    }, [autoStartChecked, pathname]);

    useEffect(() => {
        if (!active || !currentStep) return;
        if (!routesMatch(pathname, currentStep.route)) {
            router.push(currentStep.route);
        }
    }, [active, currentStep, pathname, router]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const onStartRequested = (event: Event) => {
            const customEvent = event as CustomEvent<{ force?: boolean; source?: string }>;
            if (!customEvent.detail?.force) return;
            window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_REQUEST_EVENT, {
                detail: { type: PLAYZI_ONBOARDING_CLOSE_TRANSIENT_UI },
            }));
            setSwipeSimDoneByStepId({});
            setActionDoneByStepId({});
            setSwipeHint(null);
            setIsLogoRefreshing(false);
            setIsLogoRefreshed(false);
            setStepIndex(0);
            setActive(true);
            setTutorialModeEnabled(true, customEvent.detail?.source || "manual");
            setAutoStartChecked(true);
        };

        window.addEventListener(PLAYZI_ONBOARDING_START_EVENT, onStartRequested);
        return () => {
            window.removeEventListener(PLAYZI_ONBOARDING_START_EVENT, onStartRequested);
        };
    }, []);

    useEffect(() => {
        if (!active || !currentStep) return;
        setTutorialStep(currentStep.id, currentStep.step);
        window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_STEP_EVENT, {
            detail: {
                step: currentStep.step,
                stepId: currentStep.id,
                route: currentStep.route,
                target: currentStep.target,
                targetId: currentStep.targetId || null,
                type: currentStep.type,
                action: currentStep.action || null,
                index: stepIndex,
            },
        }));

        if (currentStep.id === "discover-refresh") {
            window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_REQUEST_EVENT, {
                detail: { type: "close-filters-sheet" },
            }));
        }
        if (currentStep.id in ACTIVITIES_STATUS_SUBSTEP_BY_ID) {
            window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_REQUEST_EVENT, {
                detail: { type: "set-activities-tutorial-substep", substep: ACTIVITIES_STATUS_SUBSTEP_BY_ID[currentStep.id] },
            }));
        }
        if (currentStep.id in ACTIVITIES_CHAT_SUBSTEP_BY_ID) {
            window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_REQUEST_EVENT, {
                detail: { type: "set-activities-chat-tutorial-substep", substep: ACTIVITIES_CHAT_SUBSTEP_BY_ID[currentStep.id] },
            }));
        }
        if (currentStep.id in CREATE_STEP_BY_ID) {
            window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_REQUEST_EVENT, {
                detail: { type: "set-create-step", step: CREATE_STEP_BY_ID[currentStep.id] },
            }));
        }
        if (currentStep.id !== "discover-refresh") {
            const resetLogoStateId = window.setTimeout(() => {
                setIsLogoRefreshing(false);
                setIsLogoRefreshed(false);
            }, 0);
            return () => window.clearTimeout(resetLogoStateId);
        }
    }, [active, currentStep, stepIndex]);

    useEffect(() => {
        if (!active || !currentStep) {
            const clearRectId = window.setTimeout(() => setStepRect(null), 0);
            return () => window.clearTimeout(clearRectId);
        }

        const measure = () => setStepRect(getStepRect(currentStep.targetId));

        // Stable highlight: measure on step render only (no scroll tracking).
        const rafId = window.requestAnimationFrame(measure);
        const timeoutId = window.setTimeout(measure, 220);
        const onResize = () => measure();
        window.addEventListener("resize", onResize);
        return () => {
            window.cancelAnimationFrame(rafId);
            window.clearTimeout(timeoutId);
            window.removeEventListener("resize", onResize);
        };
    }, [active, currentStep, pathname]);

    useEffect(() => {
        const onAction = (event: Event) => {
            const customEvent = event as CustomEvent<OnboardingActionPayload>;
            const payload = customEvent.detail;
            if (!payload || payload.type !== "swipe") return;
            if (!currentStep || payload.stepId !== currentStep.id) return;

            setSwipeSimDoneByStepId((prev) => ({ ...prev, [currentStep.id]: true }));
            setSwipeHint(payload.direction === "right"
                ? "Parfait. À droite, tu demandes à rejoindre l’activité."
                : "Parfait. À gauche, tu passes cette activité.");

            window.setTimeout(() => setSwipeHint(null), 2200);
        };

        const onFilterPress = (event: Event) => {
            const customEvent = event as CustomEvent<OnboardingActionPayload>;
            const payload = customEvent.detail;
            if (!payload || payload.type !== "filter_press") return;
            if (currentStep?.id !== "discover-filters-cta") return;
            setActionDoneByStepId((prev) => ({ ...prev, [currentStep.id]: true }));
            setStepIndex((prev) => Math.min(ONBOARDING_STEPS.length - 1, prev + 1));
        };

        const onLogoPress = (event: Event) => {
            const customEvent = event as CustomEvent<OnboardingActionPayload>;
            const payload = customEvent.detail;
            if (!payload || (payload.type !== "logo_refreshing" && payload.type !== "logo_refreshed")) return;
            if (currentStep?.id !== "discover-refresh") return;
            if (payload.type === "logo_refreshing") {
                setIsLogoRefreshing(true);
                setIsLogoRefreshed(false);
                return;
            }
            setIsLogoRefreshing(false);
            setIsLogoRefreshed(true);
            setActionDoneByStepId((prev) => ({ ...prev, [currentStep.id]: true }));
        };

        const onPlusPress = (event: Event) => {
            const customEvent = event as CustomEvent<OnboardingActionPayload>;
            const payload = customEvent.detail;
            if (!payload || payload.type !== "plus_press") return;
            if (currentStep?.id !== "create-entry") return;
            setActionDoneByStepId((prev) => ({ ...prev, [currentStep.id]: true }));
        };

        window.addEventListener(PLAYZI_ONBOARDING_ACTION_EVENT, onAction);
        window.addEventListener(PLAYZI_ONBOARDING_ACTION_EVENT, onFilterPress);
        window.addEventListener(PLAYZI_ONBOARDING_ACTION_EVENT, onLogoPress);
        window.addEventListener(PLAYZI_ONBOARDING_ACTION_EVENT, onPlusPress);
        return () => {
            window.removeEventListener(PLAYZI_ONBOARDING_ACTION_EVENT, onAction);
            window.removeEventListener(PLAYZI_ONBOARDING_ACTION_EVENT, onFilterPress);
            window.removeEventListener(PLAYZI_ONBOARDING_ACTION_EVENT, onLogoPress);
            window.removeEventListener(PLAYZI_ONBOARDING_ACTION_EVENT, onPlusPress);
        };
    }, [currentStep]);

    const isSwipeActionStep = currentStep?.action === "swipe_simulation";
    const isSwipeActionDone = !!(currentStep && swipeSimDoneByStepId[currentStep.id]);
    const isFilterCtaStep = currentStep?.id === "discover-filters-cta";
    const isFilterCtaDone = !!(currentStep && actionDoneByStepId[currentStep.id]);
    const isLogoRefreshStep = currentStep?.id === "discover-refresh";
    const isLogoRefreshDone = !!(currentStep && actionDoneByStepId[currentStep.id]) && isLogoRefreshed;
    const isEventsStep = currentStep?.id === "events-playzi";
    const isPlusStep = currentStep?.id === "create-entry";
    const isFeedbackCardStep = currentStep?.id === "activities-post-feedback";
    const isPlusDone = !!(currentStep && actionDoneByStepId[currentStep.id]);
    const canGoNext = (
        (!isSwipeActionStep || isSwipeActionDone)
        && (!isFilterCtaStep || isFilterCtaDone)
        && (!isLogoRefreshStep || isLogoRefreshDone)
        && (!isPlusStep || isPlusDone)
    );

    const displayedStepNumber = stepIndex + 1;
    const totalSteps = ONBOARDING_STEPS.length;

    const highlightStyle = useMemo(() => {
        if (!stepRect) return null;
        if (!currentStep || HIGHLIGHT_DISABLED_STEP_IDS.has(currentStep.id)) return null;
        if (isLogoRefreshStep) {
            const padding = 10;
            return {
                top: stepRect.top - padding,
                left: stepRect.left - padding,
                width: stepRect.width + (padding * 2),
                height: stepRect.height + (padding * 2),
            };
        }
        if (isEventsStep) {
            return {
                top: stepRect.top - 8,
                left: stepRect.left - 8,
                width: stepRect.width + 16,
                height: stepRect.height + 16,
            };
        }
        if (isPlusStep) {
            const padding = 12;
            return {
                top: stepRect.top - padding,
                left: stepRect.left - padding,
                width: stepRect.width + (padding * 2),
                height: stepRect.height + (padding * 2),
            };
        }
        if (isFeedbackCardStep) {
            const padding = 1;
            return {
                top: stepRect.top - padding,
                left: stepRect.left - padding,
                width: stepRect.width + (padding * 2),
                height: stepRect.height + (padding * 2),
            };
        }
        return {
            top: stepRect.top - 4,
            left: stepRect.left - 4,
            width: stepRect.width + 8,
            height: stepRect.height + 8,
        };
    }, [currentStep, isEventsStep, isFeedbackCardStep, isLogoRefreshStep, isPlusStep, stepRect]);

    if (!active || !currentStep) return null;

    const completeAndClose = () => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(PLAYZI_ONBOARDING_STORAGE_KEY, "1");
            window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_STEP_EVENT, { detail: { stepId: null } }));
        }
        setTutorialStep(null, 0);
        setTutorialModeEnabled(false);
        setActive(false);
        setAutoStartChecked(true);
    };

    const handleSkip = () => completeAndClose();

    const handleBack = () => setStepIndex((prev) => Math.max(0, prev - 1));

    const handleNext = () => {
        if (!canGoNext) return;

        if (stepIndex >= ONBOARDING_STEPS.length - 1) {
            completeAndClose();
            return;
        }
        setSwipeHint(null);
        setStepIndex((prev) => Math.min(ONBOARDING_STEPS.length - 1, prev + 1));
    };

    return (
        <AnimatePresence>
            <motion.div
                key="playzi-onboarding-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[180] pointer-events-none"
            >
                <div className="absolute inset-0 bg-[#0B1020]/34" />

                {highlightStyle && (
                    <div
                        className={isLogoRefreshStep
                            ? "fixed rounded-2xl border-2 border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.16),0_0_10px_rgba(16,185,129,0.12)]"
                            : isPlusStep
                                ? "fixed rounded-[20px] border-2 border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]"
                                : "fixed rounded-2xl border-2 border-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]"}
                        style={{
                            top: `${highlightStyle.top}px`,
                            left: `${highlightStyle.left}px`,
                            width: `${highlightStyle.width}px`,
                            height: `${highlightStyle.height}px`,
                        }}
                    />
                )}

                <motion.div
                    layout
                    transition={{ type: "spring", damping: 28, stiffness: 260 }}
                    className="pointer-events-auto fixed left-1/2 w-[calc(100vw-32px)] max-w-[420px] -translate-x-1/2 rounded-2xl border border-gray-200 bg-white px-3.5 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.20)]"
                    style={{
                        top: currentStep?.id === "discover-filters-modal"
                            || currentStep?.id === "activities-chat-management"
                            ? "max(80px, calc(env(safe-area-inset-top) + 18px))"
                            : undefined,
                        bottom: currentStep?.id === "discover-filters-modal"
                            || currentStep?.id === "activities-chat-management"
                            ? undefined
                            : isEventsStep
                            ? "max(102px, calc(env(safe-area-inset-bottom) + 92px))"
                            : isPlusStep
                                ? "40dvh"
                            : "max(14px, calc(env(safe-area-inset-bottom) + 10px))",
                    }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">
                                {displayedStepNumber}/{totalSteps}
                            </p>
                            <h3 className="mt-0.5 text-[15px] font-black tracking-tight text-[#1F2937]">
                                {currentStep.title}
                            </h3>
                            <p className="mt-1 text-[12px] font-medium leading-relaxed text-gray-600">
                                {currentStep.body}
                            </p>
                        </div>
                    </div>

                    {swipeHint && (
                        <p className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-[11px] font-semibold text-emerald-700">
                            {swipeHint}
                        </p>
                    )}
                    {isLogoRefreshStep && isLogoRefreshing && (
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-2 text-[11px] font-semibold text-gray-600">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-500" />
                            Mise à jour des activités...
                        </p>
                    )}
                    {isLogoRefreshStep && !isLogoRefreshing && isLogoRefreshed && (
                        <p className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-[11px] font-semibold text-emerald-700">
                            Activités à jour
                        </p>
                    )}
                    <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={stepIndex <= 0}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 px-2.5 text-[11px] font-semibold text-gray-600 disabled:pointer-events-none disabled:opacity-45"
                        >
                            Retour
                        </button>
                        <button
                            type="button"
                            onClick={handleSkip}
                            className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-[11px] font-semibold text-gray-500"
                        >
                            Passer
                        </button>
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={!canGoNext}
                            className="inline-flex h-8 items-center justify-center rounded-lg bg-[#111827] px-3 text-[11px] font-black text-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {stepIndex === ONBOARDING_STEPS.length - 1 ? "Terminer" : "Suivant"}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
