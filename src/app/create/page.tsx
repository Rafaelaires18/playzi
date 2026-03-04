"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, Check } from "lucide-react";
import dynamic from "next/dynamic";
import { MOCK_CURRENT_USER } from "@/lib/data";
import StepSport, { SportParams } from "@/components/create/StepSport";
import StepDateTime from "@/components/create/StepDateTime";
import StepParticipants from "@/components/create/StepParticipants";
import StepInvite from "@/components/create/StepInvite";
import StepDescription from "@/components/create/StepDescription";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";

// Map step must be client-only (Leaflet)
const StepMapPin = dynamic(() => import("@/components/create/StepMapPin"), { ssr: false });

const STEPS = [
    { id: 1, title: "Sport & Niveau" },
    { id: 2, title: "Date & Heure" },
    { id: 3, title: "Lieu" },
    { id: 4, title: "Participants" },
    { id: 5, title: "Inviter" },
    { id: 6, title: "Description" },
];


export default function CreatePage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [published, setPublished] = useState(false);

    // Read gender from sessionStorage (set by Discover dev toggle)
    const [isFemale, setIsFemale] = useState(MOCK_CURRENT_USER.gender === "female");
    useEffect(() => {
        const saved = sessionStorage.getItem("playzi_mockGender");
        if (saved) setIsFemale(saved === "female");
    }, []);

    // Form state
    const [sport, setSport] = useState<string | null>(null);
    const [level, setLevel] = useState<string | null>(null);
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [maxParticipants, setMaxParticipants] = useState(8);
    const [isUnlimited, setIsUnlimited] = useState(false);
    const [groupType, setGroupType] = useState<"mixte" | "filles" | null>(isFemale ? "mixte" : null);
    const [sportParams, setSportParams] = useState<SportParams>({ distance: 10, pace: 330 });
    const [invitedFriends, setInvitedFriends] = useState<string[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [description, setDescription] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const totalSteps = STEPS.length;

    const isStepValid = () => {
        switch (step) {
            case 1: return !!sport && (sport === "running" || !!level);
            case 2: return !!date && !!time;
            case 3: return !!coords;
            case 4: return isUnlimited || (isFemale ? !!groupType : true);
            case 5: return true; // inviting is optional
            case 6: return true; // description is optional
            default: return false;
        }
    };

    const handleNext = async () => {
        if (step < totalSteps) {
            setStep(step + 1);
        } else {
            setIsLoading(true);
            setError("");
            try {
                // Determine `variant` and `sessionType` based on `tags` for Beach Volley and Football
                let variantClass = undefined;
                let sessionTypeClass = undefined;
                let finalTags = tags;

                if (sport === "beach-volley" || sport === "football") {
                    const formatTags = ["2v2", "3v3", "4v4", "5v5", "6v6", "7v7", "8v8", "9v9", "10v10", "11v11"];
                    const sessionTags = ["Match", "Entraînement", "Technique"];

                    variantClass = tags.find((t) => formatTags.includes(t));
                    sessionTypeClass = tags.find((t) => sessionTags.includes(t));
                    finalTags = tags.filter((t) => !formatTags.includes(t) && !sessionTags.includes(t));
                }

                // If running, we don't have level inside StepSport
                const finalLevel = sport === "running" ? "tout_niveau" : (level || "tout_niveau");

                const payload = {
                    title: sport ? `${sport.charAt(0).toUpperCase() + sport.slice(1)} Session` : "Sport Session",
                    sport,
                    location: "Lausanne", // Default fixed for MVP
                    address: coords ? `${coords.lat},${coords.lng}` : undefined,
                    level: finalLevel,
                    max_attendees: maxParticipants,
                    gender_filter: groupType || "mixte",
                    is_unlimited: isUnlimited,
                    start_time: (() => {
                        const [y, m, d] = date.split('-');
                        const [hr, min] = time.split(':');
                        return new Date(Number(y), Number(m) - 1, Number(d), Number(hr), Number(min)).toISOString();
                    })(),
                    distance: sportParams.distance,
                    pace: sportParams.pace,
                    lat: coords?.lat,
                    lng: coords?.lng,
                    description,
                    variant: variantClass,
                    session_type: sessionTypeClass,
                    tags: finalTags
                };

                const res = await fetch("/api/activities", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "Failed to create activity");
                }

                // Publish success
                setPublished(true);
                setTimeout(() => router.push("/"), 2200);
            } catch (err: any) {
                console.error(err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
        else router.push("/");
    };

    const progress = (step / totalSteps) * 100;

    if (published) {
        return (
            <main className="flex flex-col items-center justify-center h-[100dvh] w-full max-w-md mx-auto bg-background px-6">
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 14, stiffness: 180 }}
                    className="flex flex-col items-center gap-5 text-center"
                >
                    <div className="w-20 h-20 rounded-full bg-playzi-green/10 flex items-center justify-center">
                        <Check className="w-10 h-10 text-playzi-green stroke-[3px]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-dark">Activité publiée !</h1>
                        <p className="text-[14px] text-gray-400 mt-2 leading-relaxed">
                            Ton activité est maintenant visible. Les participants peuvent te rejoindre 🎉
                        </p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mt-2">
                        <motion.div
                            className="h-full bg-playzi-green rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2, ease: "linear" }}
                        />
                    </div>
                    <p className="text-[12px] text-gray-400">Redirection vers Discover…</p>
                </motion.div>
            </main>
        );
    }

    return (
        <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background relative overflow-hidden">
            <Header />

            {/* Step Header */}
            <div className="shrink-0 px-6 pt-[76px] pb-4 bg-background z-10">
                {/* Nav row */}
                <div className="flex items-center justify-between mb-5">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-1 text-[13px] font-semibold text-gray-400 hover:text-gray-dark transition-colors active:scale-95"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour
                    </button>
                    <span className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">
                        {step} / {totalSteps}
                    </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                        className="h-full bg-playzi-green rounded-full"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                </div>

                {/* Step title */}
                <div className="mt-5">
                    <AnimatePresence mode="wait">
                        <motion.h1
                            key={step}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="text-2xl font-bold text-gray-dark"
                        >
                            {STEPS[step - 1].title}
                        </motion.h1>
                    </AnimatePresence>
                </div>
            </div>

            {/* Step Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-52">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="pt-2"
                    >
                        {step === 1 && (
                            <StepSport
                                sport={sport}
                                level={level}
                                sportParams={sportParams}
                                onSportChange={setSport}
                                onLevelChange={setLevel}
                                onSportParamsChange={setSportParams}
                            />
                        )}
                        {step === 2 && (
                            <StepDateTime
                                date={date}
                                time={time}
                                onDateChange={setDate}
                                onTimeChange={setTime}
                            />
                        )}
                        {step === 3 && (
                            <StepMapPin
                                coords={coords}
                                onCoordsChange={setCoords}
                            />
                        )}
                        {step === 4 && (
                            <StepParticipants
                                sport={sport}
                                maxParticipants={maxParticipants}
                                isUnlimited={isUnlimited}
                                groupType={groupType}
                                isFemale={isFemale}
                                onMaxChange={setMaxParticipants}
                                onUnlimitedChange={setIsUnlimited}
                                onGroupTypeChange={setGroupType}
                            />
                        )}
                        {step === 5 && (
                            <StepInvite
                                maxParticipants={maxParticipants}
                                invitedFriends={invitedFriends}
                                onInviteChange={setInvitedFriends}
                            />
                        )}
                        {step === 6 && (
                            <StepDescription
                                sport={sport}
                                level={level}
                                distance={sportParams.distance}
                                pace={sportParams.pace}
                                tags={tags}
                                onTagsChange={setTags}
                                description={description}
                                onDescriptionChange={setDescription}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom CTA */}
            <div className="fixed bottom-0 inset-x-0 z-20 max-w-md mx-auto px-6 pb-24 pt-10 bg-gradient-to-t from-background via-background/95 to-transparent flex flex-col items-center">
                {error && <p className="text-red-500 text-[12px] font-semibold mb-3">{error}</p>}
                <motion.button
                    onClick={handleNext}
                    disabled={!isStepValid() || isLoading}
                    whileTap={{ scale: (isStepValid() && !isLoading) ? 0.97 : 1 }}
                    className={cn(
                        "w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-bold transition-all",
                        isStepValid() && !isLoading
                            ? "bg-playzi-green text-white shadow-[0_6px_0_rgb(4,120,87)] hover:shadow-[0_3px_0_rgb(4,120,87)] hover:translate-y-0.5 active:shadow-none active:translate-y-1.5"
                            : "bg-gray-100 text-gray-300 cursor-not-allowed"
                    )}
                >
                    {isLoading ? (
                        <>Création en cours...</>
                    ) : step === totalSteps ? (
                        <><Check className="w-5 h-5 stroke-[3px]" /> Publier l&apos;activité</>
                    ) : (
                        <>Suivant <ChevronRight className="w-5 h-5 stroke-[2.5px]" /></>
                    )}
                </motion.button>
            </div>
            <BottomNavigation />
        </main>
    );
}
