"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Locate, Search, X, ExternalLink } from "lucide-react";

interface StepMapPinProps {
    coords: { lat: number; lng: number } | null;
    onCoordsChange: (c: { lat: number; lng: number }) => void;
}

async function reverseGeocode(lat: number, lng: number): Promise<{ name: string; city: string }> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`,
            { headers: { "Accept-Language": "fr" } }
        );
        const data = await res.json();
        const addr = data.address || {};
        const name = data.name || addr.amenity || addr.leisure || addr.road || addr.pedestrian || "Lieu sélectionné";
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || "";
        return { name, city };
    } catch {
        return { name: "Lieu sélectionné", city: "" };
    }
}

// No bounded=1 — keeps results in Switzerland but allows nearby results
async function forwardGeocode(query: string): Promise<Array<{ display_name: string; lat: string; lon: string }>> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&countrycodes=ch`,
            { headers: { "Accept-Language": "fr" } }
        );
        return await res.json();
    } catch {
        return [];
    }
}

function parseGpsCoords(query: string): { lat: number; lng: number } | null {
    const match = query.trim().match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    return null;
}

const LAUSANNE_SUGGESTIONS = [
    { label: "Plage de Vidy", category: "Beach-volley · Natation", lat: 46.5169, lng: 6.5983 },
    { label: "Stade de la Pontaise", category: "Football · Athlétisme", lat: 46.5406, lng: 6.6286 },
    { label: "Terrain beach-volley de Dorigny", category: "Beach-volley", lat: 46.5225, lng: 6.5752 },
    { label: "Quai d'Ouchy", category: "Running · Sports de rive", lat: 46.507, lng: 6.634 },
    { label: "Bois de Sauvabelin", category: "Running · Vélo", lat: 46.535, lng: 6.633 },
    { label: "Parc de Beaulieu", category: "Running · Yoga", lat: 46.520, lng: 6.616 },
    { label: "Plage de Préverenges", category: "Beach-volley · Natation", lat: 46.497, lng: 6.520 },
    { label: "Stade de Coubertin (Renens)", category: "Football", lat: 46.538, lng: 6.589 },
];

export default function StepMapPin({ coords, onCoordsChange }: StepMapPinProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const leafletMapRef = useRef<any>(null);
    const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [placeName, setPlaceName] = useState("");
    const [placeCity, setPlaceCity] = useState("");
    const [isLoadingPlace, setIsLoadingPlace] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [geoError, setGeoError] = useState<string | null>(null);

    const defaultCenter = { lat: 46.5197, lng: 6.6323 };

    const updatePlace = useCallback(async (lat: number, lng: number) => {
        if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
        geocodeTimer.current = setTimeout(async () => {
            setIsLoadingPlace(true);
            const result = await reverseGeocode(lat, lng);
            setPlaceName(result.name);
            setPlaceCity(result.city);
            setIsLoadingPlace(false);
        }, 700);
    }, []);

    // FlyTo: moves the Leaflet map center (pin is fixed, so it "moves" to the location)
    const flyTo = useCallback((lat: number, lng: number) => {
        if (leafletMapRef.current) {
            leafletMapRef.current.flyTo([lat, lng], 15, { animate: true, duration: 0.7 });
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined" || leafletMapRef.current) return;

        import("leaflet").then((L) => {
            delete (L.Icon.Default.prototype as any)._getIconUrl;

            const initial = coords || defaultCenter;
            const map = L.map(mapContainerRef.current!, {
                center: [initial.lat, initial.lng],
                zoom: 15,
                zoomControl: false,
                attributionControl: false,
            });

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                keepBuffer: 4,
            }).addTo(map);
            L.control.zoom({ position: "bottomright" }).addTo(map);

            leafletMapRef.current = map;

            // Recalculate tile coverage after mount (rounded container can mislead Leaflet)
            setTimeout(() => map.invalidateSize(), 200);

            // Recalculate after every zoom so no tile gaps appear
            map.on("zoomend", () => map.invalidateSize());

            map.on("moveend", () => {
                const center = map.getCenter();
                const c = { lat: center.lat, lng: center.lng };
                onCoordsChange(c);
                updatePlace(c.lat, c.lng);
            });

            onCoordsChange(initial);
            updatePlace(initial.lat, initial.lng);
        });

        return () => {
            if (leafletMapRef.current) {
                leafletMapRef.current.remove();
                leafletMapRef.current = null;
            }
            if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearchChange = (q: string) => {
        setSearchQuery(q);
        setSearchResults([]);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!q.trim()) return;

        const gps = parseGpsCoords(q);
        if (gps) {
            flyTo(gps.lat, gps.lng);
            setSearchQuery("");
            setIsFocused(false);
            return;
        }

        searchTimer.current = setTimeout(async () => {
            setIsSearching(true);
            const results = await forwardGeocode(q);
            setSearchResults(results);
            setIsSearching(false);
        }, 400);
    };

    const handleSelectResult = (r: { lat: string; lon: string }) => {
        flyTo(parseFloat(r.lat), parseFloat(r.lon));
        setSearchQuery("");
        setSearchResults([]);
        setIsFocused(false);
    };

    const handleSelectSuggestion = (s: { lat: number; lng: number }) => {
        flyTo(s.lat, s.lng);
        setIsFocused(false);
    };

    const handleMyLocation = () => {
        if (!navigator.geolocation) {
            setGeoError("Géolocalisation non supportée");
            setTimeout(() => setGeoError(null), 3000);
            return;
        }
        setIsLocating(true);
        setGeoError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                flyTo(pos.coords.latitude, pos.coords.longitude);
                setIsLocating(false);
            },
            (err) => {
                setIsLocating(false);
                if (err.code === err.PERMISSION_DENIED) {
                    setGeoError("Accès à la position refusé");
                } else if (err.code === err.POSITION_UNAVAILABLE) {
                    setGeoError("Position indisponible");
                } else {
                    setGeoError("Localisation trop lente, réessaie");
                }
                setTimeout(() => setGeoError(null), 3500);
            },
            { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
        );
    };

    const showSuggestions = isFocused && !searchQuery;
    const showResults = (searchResults.length > 0 || isSearching) && searchQuery.length > 0;
    const googleMapsUrl = coords ? `https://maps.google.com/?q=${coords.lat},${coords.lng}` : "#";

    return (
        <div className="flex flex-col gap-3 -mx-6">

            {/* Search Bar */}
            <div className="mx-6">
                <div className="flex items-center gap-2 bg-white rounded-2xl border-2 border-gray-100 px-4 h-12 shadow-sm focus-within:border-playzi-green transition-colors">
                    <Search className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                        placeholder="Adresse, lieu ou coordonnées GPS…"
                        className="flex-1 text-[13px] text-gray-dark bg-transparent focus:outline-none placeholder:text-gray-300"
                    />
                    {searchQuery && (
                        <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}>
                            <X className="w-4 h-4 text-gray-300" />
                        </button>
                    )}
                </div>
            </div>

            {/* Inline Suggestions — shown when focused with empty query */}
            {showSuggestions && (
                <div className="mx-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Lieux populaires — Lausanne
                    </p>
                    {LAUSANNE_SUGGESTIONS.map((s, i) => (
                        <button
                            key={i}
                            onMouseDown={() => handleSelectSuggestion(s)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 active:bg-gray-50 transition-colors border-b last:border-none border-gray-50 text-left"
                        >
                            <MapPin className="w-3.5 h-3.5 text-playzi-green shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[12px] font-semibold text-gray-dark truncate">{s.label}</p>
                                <p className="text-[10px] text-gray-400">{s.category}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Inline API Results */}
            {showResults && (
                <div className="mx-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {isSearching ? (
                        <p className="px-4 py-3 text-[12px] text-gray-400">Recherche…</p>
                    ) : (
                        searchResults.map((r, i) => (
                            <button
                                key={i}
                                onMouseDown={() => handleSelectResult(r)}
                                className="w-full flex items-start gap-2.5 px-4 py-3 hover:bg-gray-50 transition-colors border-b last:border-none border-gray-50 text-left"
                            >
                                <MapPin className="w-3.5 h-3.5 text-playzi-green shrink-0 mt-0.5" />
                                <span className="text-[12px] text-gray-dark line-clamp-2 leading-snug">{r.display_name}</span>
                            </button>
                        ))
                    )}
                </div>
            )}

            {/* Map Card */}
            <div className="mx-6 mb-4 relative rounded-3xl overflow-hidden shadow-md" style={{ height: "calc(42dvh - 40px)" }}>
                <div ref={mapContainerRef} className="w-full h-full" />

                {/* Fixed Center Pin — Playzi teardrop */}
                <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{ zIndex: 1000 }}
                >
                    <div className="flex flex-col items-center" style={{ marginBottom: 28 }}>
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                background: "#10B981",
                                borderRadius: "50% 50% 50% 0",
                                transform: "rotate(-45deg)",
                                boxShadow: "0 6px 20px rgba(16,185,129,0.55)",
                                border: "3px solid white",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <span
                                style={{
                                    transform: "rotate(45deg)",
                                    color: "white",
                                    fontWeight: 800,
                                    fontSize: 18,
                                    lineHeight: 1,
                                    fontFamily: "system-ui",
                                }}
                            >
                                P
                            </span>
                        </div>
                        <div style={{ width: 8, height: 4, background: "rgba(16,185,129,0.35)", borderRadius: "50%", marginTop: 3 }} />
                    </div>
                </div>

                {/* Ma position — top-left floating button */}
                <button
                    onClick={handleMyLocation}
                    disabled={isLocating}
                    style={{ zIndex: 1000 }}
                    className="absolute top-3 left-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-gray-dark shadow-md border border-gray-100 active:bg-gray-50 transition-all pointer-events-auto disabled:opacity-70"
                >
                    {isLocating ? (
                        <svg className="w-3 h-3 text-playzi-green animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                    ) : (
                        <Locate className="w-3 h-3 text-playzi-green" />
                    )}
                    {isLocating ? "Localisation…" : "Ma position"}
                </button>

                {/* Geo error toast */}
                {geoError && (
                    <div
                        style={{ zIndex: 1100 }}
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-gray-dark/90 backdrop-blur-sm text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap pointer-events-none"
                    >
                        {geoError}
                    </div>
                )}
            </div>

            {/* Selected Place */}
            <div className="mx-6 bg-white rounded-2xl border-2 border-gray-100 px-4 py-3">
                {isLoadingPlace ? (
                    <div className="animate-pulse flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-gray-100 shrink-0" />
                        <div className="flex flex-col gap-1.5 flex-1">
                            <div className="h-3 bg-gray-100 rounded-full w-40" />
                            <div className="h-2.5 bg-gray-100/70 rounded-full w-24" />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <MapPin className="w-4 h-4 text-playzi-green shrink-0 mt-0.5" />
                            <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-gray-dark leading-tight truncate">
                                    {placeName || "Déplace la carte pour sélectionner"}
                                </p>
                                {placeCity && <p className="text-[11px] text-gray-400 mt-0.5">{placeCity}</p>}
                            </div>
                        </div>
                        <a
                            href={googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] font-semibold text-playzi-green shrink-0 active:opacity-70"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Maps
                        </a>
                    </div>
                )}
            </div>

            {/* Security note */}
            <div className="mx-6 flex items-center gap-2 px-4 py-2.5 bg-amber-50 rounded-2xl border border-amber-100">
                <span className="text-sm shrink-0">🔒</span>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                    L&apos;adresse exacte sera visible uniquement après confirmation de participation.
                </p>
            </div>
        </div>
    );
}
