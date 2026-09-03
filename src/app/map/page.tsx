"use client";

import { useEffect, useState, Suspense } from "react";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from 'next/dynamic';
import { ArrowLeft } from "lucide-react";
import { buildDiscoverMapZones, type DiscoverMapZone } from "@/lib/discover-map-zones";

// Dynamically import to prevent SSR issues with Leaflet 'window' object
const MapWithNoSSR = dynamic(
    () => import('@/components/LeafletMap').then((mod) => mod.default),
    {
        ssr: false,
        loading: () => (
            <div className="absolute inset-0 bg-[#F4F7F6] flex items-center justify-center">
                <div className="animate-pulse w-12 h-12 bg-gray-200 rounded-full"></div>
            </div>
        )
    }
);

function MapContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const searchKey = searchParams.toString();
    const [zones, setZones] = useState<DiscoverMapZone[]>([]);
    const [isLoadingZones, setIsLoadingZones] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const loadActivityZones = async () => {
            setIsLoadingZones(true);
            try {
                const url = new URL("/api/activities", window.location.origin);
                const gender = searchParams.get("gender");
                if (gender && gender !== "tout") {
                    url.searchParams.set("genderFilter", gender);
                }
                url.searchParams.set("t", String(Date.now()));
                const res = await fetch(url.toString(), { cache: "no-store" });
                const body = await res.json().catch(() => null);
                const rows = Array.isArray(body?.data) ? body.data : [];
                if (!cancelled) setZones(buildDiscoverMapZones(rows));
            } catch {
                if (!cancelled) setZones([]);
            } finally {
                if (!cancelled) setIsLoadingZones(false);
            }
        };

        void loadActivityZones();
        return () => {
            cancelled = true;
        };
    }, [searchKey, searchParams]);

    const handleZoneClick = (zoneName: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("city", zoneName);
        router.push(`/?${params.toString()}`);
    };

    return (
        <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto relative bg-[#F4F7F6] overflow-hidden">

            {/* Top Gradient for Header Visibility */}
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-white/90 via-white/50 to-transparent z-10 pointer-events-none" />

            {/* Header Component - Positions itself absolutely */}
            <Header />

            <div className="absolute left-4 top-[84px] z-20">
                <button
                    type="button"
                    onClick={() => {
                        const q = searchParams.toString();
                        router.push(q ? `/?${q}` : "/");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/95 px-3 py-1.5 text-[12px] font-bold text-gray-700 shadow-sm backdrop-blur"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Retour
                </button>
            </div>

            {/* Map Implementation */}
            <div className="absolute inset-0 z-0">
                <MapWithNoSSR
                    zones={zones}
                    onZoneClick={handleZoneClick}
                />
            </div>

            {!isLoadingZones && zones.length === 0 && (
                <div className="pointer-events-none absolute left-1/2 top-[45%] z-20 w-[min(82%,320px)] -translate-x-1/2 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 text-center text-[12px] font-semibold leading-snug text-gray-500 shadow-sm backdrop-blur">
                    Aucune activité disponible dans cette zone pour le moment
                </div>
            )}

            {/* Bottom Gradient for Nav Visibility */}
            <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-white/90 via-white/50 to-transparent z-10 pointer-events-none" />

            <div className="relative z-20">
                <BottomNavigation />
            </div>
        </main>
    );
}

export default function MapPage() {
    return (
        <Suspense fallback={<div className="h-[100dvh] bg-[#F4F7F6] w-full" />}>
            <MapContent />
        </Suspense>
    );
}
