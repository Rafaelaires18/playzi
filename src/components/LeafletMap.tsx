import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";

interface City {
    name: string;
    lat: number;
    lng: number;
}

interface LeafletMapProps {
    cities: City[];
    cityCounts: Record<string, number>;
    onCityClick: (cityName: string) => void;
}

// Ensure Leaflet marker default icons are configured correctly
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png").default,
    iconUrl: require("leaflet/dist/images/marker-icon.png").default,
    shadowUrl: require("leaflet/dist/images/marker-shadow.png").default,
});

// A component to automatically fit the map bounds to the cities
function MapBounds({ cities, cityCounts }: { cities: City[], cityCounts: Record<string, number> }) {
    const map = useMap();

    // Calculate bounds only for active cities
    const activeCities = cities.filter(city => (cityCounts[city.name] || 0) > 0);

    if (activeCities.length > 0) {
        const bounds = L.latLngBounds(activeCities.map(c => [c.lat, c.lng]));
        // Add padding so markers don't hit the edge of the screen
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }

    return null;
}

export default function LeafletMap({ cities, cityCounts, onCityClick }: LeafletMapProps) {

    // Create Custom HTML DivIcon for Playzi Pins
    const createCustomIcon = (cityName: string, count: number) => {
        // We use renderToStaticMarkup to convert our Tailwind React component into raw HTML string for Leaflet
        const htmlString = renderToStaticMarkup(
            <div className="relative group cursor-pointer transform hover:scale-105 transition-transform animate-marker-in flex justify-center items-center h-full">
                {/* Pin Bubble */}
                <div className="pointer-events-auto relative flex items-center gap-2 pl-2 pr-5 py-2 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-white/95 backdrop-blur-md border border-white/60 w-max">
                    {/* Mini logo 'P' */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-black text-sm text-white bg-[#10B981] shadow-sm">
                        P
                    </div>

                    <span className="font-bold text-[15px] pr-1 text-[#1A1A1A] whitespace-nowrap tracking-tight">
                        {cityName}
                    </span>

                    {/* Floating Counter */}
                    <div className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 bg-[#F59E0B] text-white text-[11px] font-black rounded-full flex items-center justify-center shadow-sm border-[2.5px] border-white z-10 transition-transform group-hover:scale-110">
                        +{count}
                    </div>
                </div>
            </div>
        );

        return new L.DivIcon({
            html: htmlString,
            className: "bg-transparent border-none", // Remove default leaflet styles
            iconSize: [200, 60], // Increased width so long names fit perfectly
            iconAnchor: [100, 30], // Centered relative to the new width
        });
    };

    return (
        <MapContainer
            center={[46.6, 6.5]} // Center of Swiss Romande
            zoom={9}
            zoomControl={false} // Clean minimalist UI
            attributionControl={true} // Small legal mention at the bottom
            className="w-full h-full"
        >
            {/* CartoDB Positron - Light and clean map style */}
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                maxZoom={19}
            />

            <MapBounds cities={cities} cityCounts={cityCounts} />

            {cities.map((city) => {
                const count = cityCounts[city.name] || 0;
                const isActive = count > 0;

                if (!isActive) return null;

                return (
                    <Marker
                        key={city.name}
                        position={[city.lat, city.lng]}
                        icon={createCustomIcon(city.name, count)}
                        eventHandlers={{
                            click: () => onCityClick(city.name),
                        }}
                    />
                );
            })}
        </MapContainer>
    );
}
