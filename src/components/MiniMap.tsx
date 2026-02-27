"use client";

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useEffect } from "react";

interface MiniMapProps {
    position: [number, number];
}

// Sub-component to fix Leaflet size after mount
function MapResizeFix() {
    const map = useMap();
    useEffect(() => {
        // Trigger a resize manually after the Framer Motion animation has expanded the container
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 100);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
}

export default function MiniMap({ position }: MiniMapProps) {
    const customIcon = L.divIcon({
        className: 'bg-transparent border-none',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        html: `
            <div class="relative w-7 h-7 flex items-center justify-center">
                <div class="absolute w-7 h-7 bg-playzi-green rounded-full shadow-md flex items-center justify-center border-2 border-white">
                    <span class="text-white font-black text-xs tracking-tighter">P</span>
                </div>
            </div>
        `
    });

    return (
        <MapContainer
            center={position}
            zoom={16.5}
            zoomControl={false} // usually keep zoom buttons off for mini maps, but allow pinch/drag
            attributionControl={false}
            dragging={true}
            scrollWheelZoom={true}
            doubleClickZoom={true}
            touchZoom={true}
            className="z-0 opacity-90 contrast-100"
            style={{ width: "100%", height: "160px" }}
        >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <Marker position={position} icon={customIcon} />
            <MapResizeFix />
        </MapContainer>
    );
}
