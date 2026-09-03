export type DiscoverMapActivity = {
    location?: unknown;
    lat?: unknown;
    lng?: unknown;
    public_lat?: unknown;
    public_lng?: unknown;
};

export type DiscoverReferenceZone = {
    name: string;
    lat: number;
    lng: number;
};

export type DiscoverMapZone = DiscoverReferenceZone & {
    count: number;
};

export const DISCOVER_REFERENCE_ZONE_RADIUS_KM = 50;

export const DISCOVER_REFERENCE_ZONES: DiscoverReferenceZone[] = [
    { name: "Genève", lat: 46.2044, lng: 6.1432 },
    { name: "Nyon", lat: 46.3833, lng: 6.2333 },
    { name: "Lausanne", lat: 46.5197, lng: 6.6323 },
    { name: "Montreux", lat: 46.4312, lng: 6.9106 },
    { name: "Monthey", lat: 46.2544, lng: 6.9541 },
    { name: "Yverdon-les-Bains", lat: 46.7785, lng: 6.6412 },
    { name: "Neuchâtel", lat: 46.9896, lng: 6.9293 },
    { name: "Fribourg", lat: 46.8065, lng: 7.1619 },
    { name: "Bienne", lat: 47.1368, lng: 7.2472 },
    { name: "Berne", lat: 46.948, lng: 7.4474 },
    { name: "Bâle", lat: 47.5596, lng: 7.5886 },
    { name: "Zurich", lat: 47.3769, lng: 8.5417 },
    { name: "Lucerne", lat: 47.0502, lng: 8.3093 },
    { name: "Zoug", lat: 47.1662, lng: 8.5155 },
    { name: "Thoune", lat: 46.7512, lng: 7.6217 },
    { name: "Sion", lat: 46.2331, lng: 7.3606 },
    { name: "Lugano", lat: 46.0037, lng: 8.9511 },
    { name: "Saint-Gall", lat: 47.4245, lng: 9.3767 },
];

export function normalizeDiscoverZoneKey(value: string) {
    return value
        .trim()
        .toLocaleLowerCase("fr-FR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function formatDiscoverZoneName(value: string) {
    const cleaned = value.trim().replace(/\s+/g, " ");
    if (!cleaned) return "";
    return cleaned
        .split(/([\s'-])/)
        .map((part) => {
            if (/^[\s'-]+$/.test(part) || part.length === 0) return part;
            return `${part.charAt(0).toLocaleUpperCase("fr-FR")}${part.slice(1).toLocaleLowerCase("fr-FR")}`;
        })
        .join("");
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRad = (value: number) => value * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function getReferenceZoneByName(value?: string | null) {
    const key = normalizeDiscoverZoneKey(value || "");
    if (!key) return null;
    return DISCOVER_REFERENCE_ZONES.find((zone) => normalizeDiscoverZoneKey(zone.name) === key) || null;
}

export function getPublicActivityCoordinates(activity: DiscoverMapActivity) {
    const lat = Number(activity.public_lat ?? activity.lat);
    const lng = Number(activity.public_lng ?? activity.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

export function assignActivityToReferenceZone(activity: DiscoverMapActivity, maxDistanceKm = DISCOVER_REFERENCE_ZONE_RADIUS_KM) {
    const coords = getPublicActivityCoordinates(activity);

    if (!coords) {
        const locationKey = normalizeDiscoverZoneKey(String(activity.location || ""));
        return DISCOVER_REFERENCE_ZONES.find((zone) => normalizeDiscoverZoneKey(zone.name) === locationKey) || null;
    }

    let nearest: { zone: DiscoverReferenceZone; distanceKm: number } | null = null;
    for (const zone of DISCOVER_REFERENCE_ZONES) {
        const distanceKm = haversineKm(coords.lat, coords.lng, zone.lat, zone.lng);
        if (!nearest || distanceKm < nearest.distanceKm) {
            nearest = { zone, distanceKm };
        }
    }

    if (!nearest || nearest.distanceKm > maxDistanceKm) return null;
    return nearest.zone;
}

export function isActivityAssignedToReferenceZone(activity: DiscoverMapActivity, zone: DiscoverReferenceZone) {
    return assignActivityToReferenceZone(activity)?.name === zone.name;
}

export function buildDiscoverMapZones(rows: DiscoverMapActivity[]): DiscoverMapZone[] {
    const referenceCounts = new Map<string, DiscoverMapZone>();
    const fallbackGroups = new Map<string, {
        name: string;
        count: number;
        latSum: number;
        lngSum: number;
        coordinateCount: number;
    }>();

    for (const activity of rows) {
        const referenceZone = assignActivityToReferenceZone(activity);
        if (referenceZone) {
            const existing = referenceCounts.get(referenceZone.name);
            if (existing) {
                existing.count += 1;
            } else {
                referenceCounts.set(referenceZone.name, { ...referenceZone, count: 1 });
            }
            continue;
        }

        const rawLocation = String(activity.location || "").trim();
        const key = normalizeDiscoverZoneKey(rawLocation);
        const coords = getPublicActivityCoordinates(activity);
        if (!key || !coords) continue;

        const existing = fallbackGroups.get(key);
        if (existing) {
            existing.count += 1;
            existing.latSum += coords.lat;
            existing.lngSum += coords.lng;
            existing.coordinateCount += 1;
            continue;
        }

        fallbackGroups.set(key, {
            name: formatDiscoverZoneName(rawLocation),
            count: 1,
            latSum: coords.lat,
            lngSum: coords.lng,
            coordinateCount: 1,
        });
    }

    const fallbackZones = Array.from(fallbackGroups.values())
        .filter((zone) => zone.count > 0 && zone.coordinateCount > 0)
        .map((zone) => ({
            name: zone.name,
            count: zone.count,
            lat: zone.latSum / zone.coordinateCount,
            lng: zone.lngSum / zone.coordinateCount,
        }));

    return [...referenceCounts.values(), ...fallbackZones]
        .filter((zone) => zone.count > 0)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
}
