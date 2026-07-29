export type TitleType = "permanent" | "secret" | "seasonal";
export type TitleRarity = "standard" | "rare" | "mythique" | "legendaire";

export type PlayziTitle = {
    id: string;
    label: string;
    type: TitleType;
    rarity?: TitleRarity;
    seasonLabel?: string;
    unlockHint: string;
    unlocked: boolean;
};

export const PLAYZI_BETA_TITLES_MODE = true;
export const PLAYZIEN_TITLE_ID = "playzien";
export const PLAYZIEN_TITLE_LABEL = "Playzien";
export const PLAYZIEN_TITLE_DESCRIPTION = "Membre de la communauté Playzi.";
export const BETA_TESTER_TITLE_ID = "beta-tester";
export const BETA_TESTER_TITLE_LIMIT = 30;
export const BETA_TESTER_TITLE_LABEL = "Bêta testeur";
export const BETA_TESTER_TITLE_DESCRIPTION = "Fait partie des 30 premiers utilisateurs de Playzi.";
export const BETA_TITLE_PLACEHOLDER_LABEL = "Titre à venir";

export const PLAYZI_COMMUNITY_TITLES: PlayziTitle[] = [
    {
        id: PLAYZIEN_TITLE_ID,
        label: PLAYZIEN_TITLE_LABEL,
        type: "permanent",
        rarity: "standard",
        unlockHint: PLAYZIEN_TITLE_DESCRIPTION,
        unlocked: true,
    },
    {
        id: BETA_TESTER_TITLE_ID,
        label: BETA_TESTER_TITLE_LABEL,
        type: "permanent",
        rarity: "rare",
        unlockHint: BETA_TESTER_TITLE_DESCRIPTION,
        unlocked: true,
    },
];

export const PLAYZI_TITLES: PlayziTitle[] = [
    { id: "runner-regulier", label: "Runner régulier", type: "permanent", rarity: "standard", unlockHint: "12 sessions running", unlocked: true },
    { id: "organisateur-actif", label: "Organisateur actif", type: "permanent", rarity: "rare", unlockHint: "10 activités créées", unlocked: true },
    { id: "pilier", label: "Pilier", type: "permanent", rarity: "mythique", unlockHint: "50 activités rejointes", unlocked: false },
    { id: "invincible", label: "Invincible", type: "permanent", rarity: "legendaire", unlockHint: "10 semaines de streak", unlocked: false },
    { id: "night-runner", label: "Night Runner", type: "secret", rarity: "rare", unlockHint: "Session de nuit débloquée", unlocked: true },
    { id: "social-butterfly", label: "Social Butterfly", type: "secret", rarity: "mythique", unlockHint: "Interactions sociales spéciales", unlocked: false },
    { id: "early-player", label: "Early Player", type: "secret", rarity: "legendaire", unlockHint: "Membre historique", unlocked: false },
    {
        id: "top15-lausanne-s2-spring-2026",
        label: "Top 15% Lausanne — Saison 2 Printemps 2026",
        type: "seasonal",
        seasonLabel: "Saisonnier",
        unlockHint: "Classement saisonnier",
        unlocked: true
    }
];

export const DEFAULT_PROFILE_TITLE_IDS = ["runner-regulier", "organisateur-actif"];

export function getPermanentTitles() {
    if (PLAYZI_BETA_TITLES_MODE) return PLAYZI_COMMUNITY_TITLES;
    return PLAYZI_TITLES.filter((title) => title.type === "permanent");
}

export function getSelectableProfileTitles() {
    if (PLAYZI_BETA_TITLES_MODE) return PLAYZI_COMMUNITY_TITLES;
    return PLAYZI_TITLES.filter((title) => title.unlocked);
}

export function rarityLabel(rarity?: TitleRarity) {
    if (rarity === "rare") return "Rare";
    if (rarity === "mythique") return "Mythique";
    if (rarity === "legendaire") return "Légendaire";
    return "Standard";
}

export function rarityTone(rarity?: TitleRarity) {
    if (rarity === "rare") return "border-blue-200 bg-blue-50 text-blue-700";
    if (rarity === "mythique") return "border-rose-200 bg-rose-50 text-rose-700";
    if (rarity === "legendaire") return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-gray-200 bg-gray-50 text-gray-600";
}
