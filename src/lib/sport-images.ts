import { normalizeSportName } from "@/lib/activity-rules";

const SPORT_IMAGE_POOLS: Record<string, string[]> = {
    running: [
        "/images/running.png",
        "/images/running_1.png",
        "/images/running_mixed.png",
    ],
    cycling: [
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
    fallback: [
        "/images/running.png",
        "/images/running_1.png",
        "/images/running_mixed.png",
        "/images/cycling_1.png",
        "/images/cycling_2.png",
        "/images/cycling_3.png",
        "/images/cycling_solo.png",
        "/images/football_1.png",
        "/images/beachvolley.png",
    ],
};

function pickRandom<T>(values: T[]): T | null {
    if (!values.length) return null;
    const index = Math.floor(Math.random() * values.length);
    return values[index];
}

function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getPoolForNormalizedSport(normalized: string): string[] {
    if (["running", "footing"].includes(normalized)) return SPORT_IMAGE_POOLS.running;
    if (["velo", "cycling", "cyclisme", "bike", "biking"].includes(normalized)) return SPORT_IMAGE_POOLS.cycling;
    if (["football", "foot"].includes(normalized)) return SPORT_IMAGE_POOLS.football;
    if (["beach volley", "beach-volley", "beachvolley"].includes(normalized)) return SPORT_IMAGE_POOLS["beach-volley"];
    return SPORT_IMAGE_POOLS.fallback;
}

export function pickRandomImageForSport(sport?: string | null): string | null {
    const normalized = normalizeSportName(sport);
    return pickRandom(getPoolForNormalizedSport(normalized));
}

export function pickRandomImageForSportExcluding(
    sport?: string | null,
    excludedImageUrl?: string | null
): string | null {
    const normalized = normalizeSportName(sport);
    const pool = getPoolForNormalizedSport(normalized);
    if (!pool.length) return null;
    if (!excludedImageUrl) return pickRandom(pool);

    const filtered = pool.filter((url) => url !== excludedImageUrl);
    if (!filtered.length) return pool[0];
    return pickRandom(filtered);
}

export function pickStableImageForSport(
    sport?: string | null,
    seed?: string | null
): string | null {
    const normalized = normalizeSportName(sport);
    const pool = getPoolForNormalizedSport(normalized);
    if (!pool.length) return null;
    if (!seed) return pool[0];
    const index = hashString(seed) % pool.length;
    return pool[index];
}
