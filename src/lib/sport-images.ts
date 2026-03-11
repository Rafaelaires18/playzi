import { normalizeSportName } from "@/lib/activity-rules";

const SPORT_IMAGE_POOLS: Record<string, string[]> = {
    running: [
        "/images/running.png",
        "/images/running_1.png",
        "/images/running_mixed.png",
    ],
    cycling: [
        "/images/cycling.png",
        "/images/cycling_1.png",
        "/images/cycling_2.png",
        "/images/cycling_3.png",
        "/images/cycling_solo.png",
    ],
    football: [
        "/images/football_1.png",
    ],
    "beach-volley": [
        "/images/beachvolley.png",
        "/images/beachvolley_silhouette.jpg",
    ],
};

function pickRandom<T>(values: T[]): T | null {
    if (!values.length) return null;
    const index = Math.floor(Math.random() * values.length);
    return values[index];
}

export function pickRandomImageForSport(sport?: string | null): string | null {
    const normalized = normalizeSportName(sport);

    if (["running", "footing"].includes(normalized)) {
        return pickRandom(SPORT_IMAGE_POOLS.running);
    }
    if (["velo", "cycling"].includes(normalized)) {
        return pickRandom(SPORT_IMAGE_POOLS.cycling);
    }
    if (["football", "foot"].includes(normalized)) {
        return pickRandom(SPORT_IMAGE_POOLS.football);
    }
    if (["beach volley", "beach-volley", "beachvolley"].includes(normalized)) {
        return pickRandom(SPORT_IMAGE_POOLS["beach-volley"]);
    }

    return null;
}
