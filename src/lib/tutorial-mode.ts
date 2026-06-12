"use client";

export const PLAYZI_TUTORIAL_MODE_STORAGE_KEY = "playzi_tutorial_mode_v1";
export const PLAYZI_TUTORIAL_MODE_CHANGED_EVENT = "playzi:tutorial-mode-changed";

export type TutorialModeSnapshot = {
    enabled: boolean;
    onboardingStep: number;
    stepId: string | null;
    source: string | null;
};

const DEFAULT_SNAPSHOT: TutorialModeSnapshot = {
    enabled: false,
    onboardingStep: 0,
    stepId: null,
    source: null,
};

function readSnapshot(): TutorialModeSnapshot {
    if (typeof window === "undefined") return DEFAULT_SNAPSHOT;
    try {
        const raw = window.sessionStorage.getItem(PLAYZI_TUTORIAL_MODE_STORAGE_KEY);
        if (!raw) return DEFAULT_SNAPSHOT;
        const parsed = JSON.parse(raw) as Partial<TutorialModeSnapshot>;
        return {
            enabled: !!parsed.enabled,
            onboardingStep: Number.isFinite(Number(parsed.onboardingStep)) ? Number(parsed.onboardingStep) : 0,
            stepId: typeof parsed.stepId === "string" ? parsed.stepId : null,
            source: typeof parsed.source === "string" ? parsed.source : null,
        };
    } catch {
        return DEFAULT_SNAPSHOT;
    }
}

function writeSnapshot(snapshot: TutorialModeSnapshot) {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(PLAYZI_TUTORIAL_MODE_STORAGE_KEY, JSON.stringify(snapshot));
    window.dispatchEvent(new CustomEvent(PLAYZI_TUTORIAL_MODE_CHANGED_EVENT, { detail: snapshot }));
}

export function getTutorialModeSnapshot(): TutorialModeSnapshot {
    return readSnapshot();
}

export function setTutorialModeEnabled(enabled: boolean, source = "onboarding") {
    if (!enabled) {
        writeSnapshot(DEFAULT_SNAPSHOT);
        return;
    }
    const current = readSnapshot();
    writeSnapshot({
        enabled: true,
        onboardingStep: current.onboardingStep,
        stepId: current.stepId,
        source,
    });
}

export function setTutorialStep(stepId: string | null, onboardingStep: number) {
    const current = readSnapshot();
    writeSnapshot({
        enabled: current.enabled,
        onboardingStep,
        stepId,
        source: current.source,
    });
}
