import { NextRequest } from "next/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { city: string | null; expiresAt: number }>();

function getCacheKey(lat: number, lng: number) {
    // ~110m precision for cache reuse
    return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function normalizeCity(value: unknown) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export async function GET(req: NextRequest) {
    try {
        const lat = Number(req.nextUrl.searchParams.get("lat"));
        const lng = Number(req.nextUrl.searchParams.get("lng"));

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return createErrorResponse("lat/lng invalides", 400);
        }

        const key = getCacheKey(lat, lng);
        const now = Date.now();
        const cached = cache.get(key);
        if (cached && cached.expiresAt > now) {
            return createSuccessResponse({ city: cached.city }, 200);
        }

        const url = new URL("https://nominatim.openstreetmap.org/reverse");
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("lat", String(lat));
        url.searchParams.set("lon", String(lng));
        url.searchParams.set("zoom", "14");
        url.searchParams.set("addressdetails", "1");

        const res = await fetch(url.toString(), {
            headers: {
                "User-Agent": "Playzi/1.0 (support@playzi.app)",
                "Accept-Language": "fr,en",
            },
            next: { revalidate: 300 },
        });

        if (!res.ok) {
            return createSuccessResponse({ city: null }, 200);
        }

        const data = await res.json().catch(() => null) as {
            address?: {
                city?: string;
                town?: string;
                village?: string;
                municipality?: string;
                hamlet?: string;
                county?: string;
            };
        } | null;

        const city =
            normalizeCity(data?.address?.city)
            || normalizeCity(data?.address?.town)
            || normalizeCity(data?.address?.village)
            || normalizeCity(data?.address?.municipality)
            || normalizeCity(data?.address?.hamlet)
            || normalizeCity(data?.address?.county)
            || null;

        cache.set(key, { city, expiresAt: now + CACHE_TTL_MS });

        return createSuccessResponse({ city }, 200);
    } catch (error) {
        return createErrorResponse(
            "Erreur interne",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}
