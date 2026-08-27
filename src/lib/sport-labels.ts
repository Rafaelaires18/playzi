const SPORT_LABELS: Record<string, string> = {
    running: "Running",
    footing: "Running",
    velo: "Vélo",
    vélo: "Vélo",
    cycling: "Vélo",
    cyclisme: "Vélo",
    bike: "Vélo",
    biking: "Vélo",
    "beach volley": "Beach-volley",
    "beach-volley": "Beach-volley",
    beachvolley: "Beach-volley",
    volleyball: "Beach-volley",
    volley: "Beach-volley",
    football: "Football",
    foot: "Football",
};

export function normalizeSportLabelKey(value?: string | null) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function formatUnknownSportLabel(value: string) {
    return value
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toLocaleUpperCase("fr-FR")}${part.slice(1).toLocaleLowerCase("fr-FR")}`)
        .join(" ");
}

export function formatActivitySportLabel(value?: string | null) {
    const raw = String(value || "").trim();
    if (!raw) return "Activité";
    const normalized = normalizeSportLabelKey(raw);
    return SPORT_LABELS[normalized] || SPORT_LABELS[raw.toLowerCase().trim()] || formatUnknownSportLabel(raw);
}
