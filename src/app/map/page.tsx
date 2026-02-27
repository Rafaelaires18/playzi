"use client";

import { useMemo, useEffect, useState } from "react";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { MOCK_ACTIVITIES } from "@/lib/data";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from 'next/dynamic';

// Exact coordinates for our Swiss cities
const CITIES = [
    { name: "Genève", lat: 46.2044, lng: 6.1432 },
    { name: "Lausanne", lat: 46.5197, lng: 6.6323 },
    { name: "Neuchâtel", lat: 46.9896, lng: 6.9293 },
];

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

export default function MapPage() {
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Compute activity counts per city dynamically from the MOCK_ACTIVITIES
    const cityCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        MOCK_ACTIVITIES.forEach((activity) => {
            counts[activity.location] = (counts[activity.location] || 0) + 1;
        });
        return counts;
    }, []);

    const handleCityClick = (cityName: string) => {
        router.push(`/?city=${encodeURIComponent(cityName)}`);
    };

    return (
        <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto relative bg-[#F4F7F6] overflow-hidden">

            {/* Top Gradient for Header Visibility */}
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-white/90 via-white/50 to-transparent z-10 pointer-events-none" />

            {/* Header Component - Positions itself absolutely */}
            <Header />

            {/* Map Implementation */}
            <div className="absolute inset-0 z-0">
                {isMounted && (
                    <MapWithNoSSR
                        cities={CITIES}
                        cityCounts={cityCounts}
                        onCityClick={handleCityClick}
                    />
                )}
            </div>

            {/* Bottom Gradient for Nav Visibility */}
            <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-white/90 via-white/50 to-transparent z-10 pointer-events-none" />

            <div className="relative z-20">
                <BottomNavigation />
            </div>
        </main>
    );
}
