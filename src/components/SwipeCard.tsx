"use client";

import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { MapPin, Users, Calendar, Footprints, Navigation, Activity as ActivityIcon, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface Activity {
    id: string;
    sport: string;
    variant?: string;
    level: string;
    location: string;
    start_time: string;
    attendees: number;
    max_attendees: number;
    image_url?: string;
    image_position?: string;
    gender_filter?: 'mixte' | 'filles';
    gradient?: string;
    coordinates?: { lat: number; lng: number };
    distance?: number;
    pace?: number;
    description?: string;
    status: "ouvert" | "complet" | "confirmé" | "en_attente" | "passé" | "annulé";
    address?: string;
    tags?: string[];
    creator_id?: string;
    // Joined creator payload
    creator?: {
        id: string;
        pseudo: string;
        grade?: string;
    };
}

interface SwipeCardProps {
    activity: Activity;
    index: number;
    onSwipeRight: (activity: Activity) => void;
    onSwipeLeft: (activity: Activity) => void;
}

const SWIPE_THRESHOLD = 120;

/** sec/km → "M:SS" */
function formatPace(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SwipeCard({
    activity,
    index,
    onSwipeRight,
    onSwipeLeft,
}: SwipeCardProps) {
    const [exitX, setExitX] = useState<number>(0);
    const x = useMotionValue(0);

    // Rotation and opacity based on swipe position
    const rotate = useTransform(x, [-200, 200], [-15, 15]);
    const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);

    // Feedbacks "JOIN" or "PASS" opacity based on drag distance
    const joinOpacity = useTransform(x, [50, 150], [0, 1]);
    const passOpacity = useTransform(x, [-50, -150], [0, 1]);

    const handleDragEnd = (
        event: MouseEvent | TouchEvent | PointerEvent,
        info: PanInfo
    ) => {
        if (info.offset.x > SWIPE_THRESHOLD) {
            setExitX(300);
            onSwipeRight(activity);
        } else if (info.offset.x < -SWIPE_THRESHOLD) {
            setExitX(-300);
            onSwipeLeft(activity);
        }
    };

    const handleDrag = (
        event: MouseEvent | TouchEvent | PointerEvent,
        info: PanInfo
    ) => {
        // Haptic feedback when crossing the threshold
        if (
            Math.abs(info.offset.x) > SWIPE_THRESHOLD &&
            Math.abs(info.offset.x) < SWIPE_THRESHOLD + 5
        ) {
            if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate(50);
            }
        }
    };

    const isAlmostFull = activity.max_attendees - activity.attendees <= 2;

    // The fallback gradient needs to be injected if no image
    const fallbackGradient = activity.gradient || "from-gray-100 to-gray-300";

    // Geolocation & Distance Calculation
    const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLoc({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                (error) => console.log("Geolocation error:", error),
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        }
    }, []);

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Earth's radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
    };

    const calculatedDistance =
        userLoc && activity.coordinates
            ? calculateDistance(userLoc.lat, userLoc.lng, activity.coordinates.lat, activity.coordinates.lng)
            : null;

    const dateObj = new Date(activity.start_time);
    const datePart = dateObj.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short"
    });
    const timePart = dateObj.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
    });
    const rawFormatedTime = `${datePart} à ${timePart}`.replace(/\./g, "");
    // Force lowercase except the very first letter (e.g., "mer 4 mars à 13:24" -> "Mer 4 mars à 13:24")
    const formattedTime = rawFormatedTime.charAt(0).toUpperCase() + rawFormatedTime.slice(1);

    // Determine the image to display (database real image OR programmatic fallback)
    const getDisplayImage = () => {
        if (activity.image_url) return activity.image_url;

        switch (activity.sport?.toLowerCase()) {
            case 'running':
                return '/images/running.png';
            case 'beach volley':
            case 'beach-volley':
                return '/images/beachvolley.png';
            case 'football':
            case 'foot':
                return '/images/football_1.png';
            case 'vélo':
            case 'cycling':
                return '/images/cycling.png';
            default:
                return null;
        }
    };

    const displayImage = getDisplayImage();

    return (
        <motion.div
            style={{ x, rotate, opacity }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            onDrag={handleDrag}
            animate={{ x: exitX, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute flex flex-col w-full h-[70vh] max-h-[600px] bg-white rounded-[32px] shadow-[0_6px_16px_rgba(0,0,0,0.06)] overflow-hidden cursor-grab active:cursor-grabbing will-change-transform border border-gray-100/50"
            // Push older cards slightly down and back using z-index inverse to index
            initial={{ scale: 0.95, y: 20 }}
        >
            {/* Feedbacks Layer Overlay */}
            <motion.div
                style={{ opacity: joinOpacity }}
                className="absolute top-12 left-8 z-10 border border-emerald-500/30 bg-white/90 backdrop-blur-md text-emerald-600 rounded-lg px-6 py-2 text-4xl font-black rotate-[-15deg] uppercase shadow-lg"
            >
                Join
            </motion.div>
            <motion.div
                style={{ opacity: passOpacity }}
                className="absolute top-12 right-8 z-10 border border-rose-500/30 bg-white/90 backdrop-blur-md text-rose-600 rounded-lg px-6 py-2 text-4xl font-black rotate-[15deg] uppercase shadow-lg"
            >
                Pass
            </motion.div>

            {/* Visual Header (46%) */}
            <div className={cn("relative h-[48%] w-full bg-gradient-to-br overflow-hidden", !displayImage && fallbackGradient)}>
                {/* Specific Event Badges (Only specific conditions) */}
                <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 items-start">
                    {activity.gender_filter === 'filles' && (
                        <span className="px-3 py-1.5 bg-[#ad8bfa]/80 backdrop-blur-md text-white text-[11px] font-bold tracking-wide rounded-full shadow-sm border border-white/20 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            Entre filles
                        </span>
                    )}
                </div>

                {displayImage ? (
                    <motion.img
                        style={{
                            x: useTransform(x, [-200, 200], [10, -10]),
                            objectPosition: activity.image_position || "center"
                        }}
                        src={displayImage}
                        alt={activity.sport}
                        className="w-full h-full object-cover scale-105"
                        draggable="false"
                    />
                ) : (
                    // Subtle dynamic watermark icon for CSS Gradients
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 -rotate-12 scale-150 pointer-events-none">
                        {activity.sport === "Running" ? (
                            <Footprints className="w-full h-full p-8" />
                        ) : activity.sport === "Vélo" || activity.sport === "Cycling" ? (
                            <Navigation className="w-full h-full p-8" />
                        ) : (
                            <ActivityIcon className="w-full h-full p-8" />
                        )}
                    </div>
                )}
                {/* Stronger shadow overlay at bottom of image for contrast */}
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 via-black/10 to-transparent z-10" />
            </div>

            {/* Content Below (54%) */}
            <div className="h-[52%] bg-white px-6 pt-5 pb-6 flex flex-col justify-between">
                <div className="space-y-3">
                    <div className="flex flex-col gap-1 items-start">
                        <h2 className="text-[28px] font-black text-gray-dark leading-tight flex flex-row items-center justify-between w-full">
                            <span className="capitalize">{activity.sport}</span>

                            {/* Sport-aware badge (Secondary read) ALIGNED RIGHT */}
                            <div className="flex flex-wrap items-center justify-end gap-2 mt-0.5">
                                {activity.sport?.toLowerCase() === "running" ? (
                                    activity.distance ? (
                                        <span className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50/80 text-emerald-700/90 text-[13px] font-bold rounded-lg shrink-0 border border-emerald-100/50">
                                            {activity.distance} <span className="lowercase">km</span>
                                            {activity.pace && <> · {formatPace(activity.pace)}/km</>}
                                        </span>
                                    ) : null
                                ) : (activity.sport?.toLowerCase() === "vélo" || activity.sport?.toLowerCase() === "cycling") ? (
                                    activity.distance ? (
                                        <span className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50/80 text-emerald-700/90 text-[13px] font-bold rounded-lg shrink-0 border border-emerald-100/50">
                                            {activity.distance} <span className="lowercase">km</span> · <span className="capitalize">{activity.level}</span>
                                        </span>
                                    ) : null
                                ) : (
                                    <span className="px-2.5 py-0.5 bg-gray-50/80 text-gray-500/90 text-[13px] font-bold rounded-lg border border-gray-100/80 shrink-0 capitalize">
                                        {activity.level}
                                    </span>
                                )}

                                {/* Variant badge if no specific distance/level badge took place, or just next to it */}
                                {(!activity.tags || activity.tags.length === 0) && activity.variant && !['beach volley', 'beach-volley', 'football', 'foot'].includes(activity.sport?.toLowerCase()) ? (
                                    <span className="px-2.5 py-0.5 bg-gray-50/80 text-gray-500/90 text-[13px] font-bold rounded-lg border border-gray-100/80 shrink-0 capitalize">
                                        {activity.variant.replace(/[-_]/g, ' ')}
                                    </span>
                                ) : null}
                            </div>
                        </h2>

                        {/* Variant OR tags in the same visual slot */}
                        {activity.tags && activity.tags.length > 0 && (
                            <span className="block truncate text-[14px] font-medium text-gray-400 mt-1">
                                {activity.tags.slice(0, 3).join(" · ")}
                            </span>
                        )}

                        {/* Description — smaller, below */}
                        {activity.description && (
                            <p className="text-[12px] text-gray-400 font-medium truncate leading-[1.38] mt-1.5 border-l-[3px] border-gray-100 pl-2">
                                {activity.description}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2.5 text-gray-dark/90 font-medium mb-1 mt-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-playzi-green flex-shrink-0" />
                            <p className="font-bold text-[#2D2E3B]">{formattedTime}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-5 h-5 flex-shrink-0 text-gray-400" />
                            <p className="flex items-center">
                                <span className="font-medium text-gray-500">{activity.location}</span>
                                {calculatedDistance && (
                                    <>
                                        <span className="mx-2 text-gray-200 font-bold">•</span>
                                        <span className="font-medium text-gray-400">{calculatedDistance} km</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 pt-5 mt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm font-bold">
                        <span className="text-gray-dark flex items-center gap-1.5 text-[15px]">
                            <Users className="w-4 h-4 text-gray-400" /> Participants
                        </span>
                        <span className={cn("font-black text-[18px]", activity.attendees >= activity.max_attendees ? "text-playzi-orange" : "text-gray-dark")}>
                            {activity.attendees} <span className="text-gray-300 font-bold text-[14px]">/ {activity.max_attendees}</span>
                        </span>
                    </div>
                    {/* Horizontal Progress Bar */}
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className={cn("h-full rounded-full transition-all duration-500 shadow-sm", activity.attendees >= activity.max_attendees ? "bg-playzi-orange" : "bg-playzi-green")}
                            style={{ width: `${(activity.attendees / activity.max_attendees) * 100}%` }}
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
