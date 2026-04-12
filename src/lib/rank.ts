export type RankStep = {
    min: number;
    label: string;
    next: number | null;
};

export const RANK_STEPS: RankStep[] = [
    { min: 0, label: "Bronze III", next: 100 },
    { min: 100, label: "Bronze II", next: 200 },
    { min: 200, label: "Bronze I", next: 300 },
    { min: 300, label: "Argent III", next: 400 },
    { min: 400, label: "Argent II", next: 500 },
    { min: 500, label: "Argent I", next: 600 },
    { min: 600, label: "Or III", next: 700 },
    { min: 700, label: "Or II", next: 800 },
    { min: 800, label: "Or I", next: 900 },
    { min: 900, label: "Platine", next: null }
];

export function getRankLabelFromPulse(totalPulse: number) {
    const current = [...RANK_STEPS].reverse().find((step) => totalPulse >= step.min) ?? RANK_STEPS[0];
    return current.label;
}

