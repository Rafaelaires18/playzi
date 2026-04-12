"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, Check, MapPin, CalendarClock, Copy, Link2, MessageCircle } from "lucide-react";
import dynamic from "next/dynamic";
import StepSport, { SportParams } from "@/components/create/StepSport";
import StepDateTime from "@/components/create/StepDateTime";
import StepParticipants from "@/components/create/StepParticipants";
import StepInvite from "@/components/create/StepInvite";
import StepDescription from "@/components/create/StepDescription";
import StepSummary from "@/components/create/StepSummary";
import { cn } from "@/lib/utils";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { createClient } from "@/lib/supabase/client";

// Map step must be client-only (Leaflet)
const StepMapPin = dynamic(() => import("@/components/create/StepMapPin"), { ssr: false });

const STEPS = [
    { id: 1, title: "Sport" },
    { id: 2, title: "Date & Heure" },
    { id: 3, title: "Lieu" },
    { id: 4, title: "Participants" },
    { id: 5, title: "Inviter" },
    { id: 6, title: "Description" },
    { id: 7, title: "Résumé" },
];


export default function CreatePage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [published, setPublished] = useState(false);
    const [isStaffBlocked, setIsStaffBlocked] = useState(false);

    // Read real gender from Supabase
    const [isFemale, setIsFemale] = useState(false);
    useEffect(() => {
        const fetchGender = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('gender').eq('id', user.id).single();
                if (data?.gender === 'female') {
                    setIsFemale(true);
                } else if (data?.gender === 'male') {
                    setIsFemale(false);
                    setGroupType("mixte"); // Force mixte if male
                }
            } else {
                // Fallback for extreme local dev scenarios without login (not recommended)
                const saved = sessionStorage.getItem("playzi_mockGender");
                if (saved === "female") setIsFemale(true);
            }
        };
        fetchGender();
    }, []);

    useEffect(() => {
        let mounted = true;
        const checkStaffAccess = async () => {
            try {
                const res = await fetch(`/api/admin/moderation/whoami?t=${Date.now()}`, { cache: "no-store" });
                const body = await res.json().catch(() => null);
                if (!mounted) return;
                setIsStaffBlocked(!!body?.data?.moderator_access?.allowed);
            } catch {
                if (!mounted) return;
                setIsStaffBlocked(false);
            }
        };
        void checkStaffAccess();
        return () => { mounted = false; };
    }, []);

    // Form state
    const [sport, setSport] = useState<string | null>(null);
    const [level, setLevel] = useState<string | null>(null);
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [locationCity, setLocationCity] = useState("");
    const [maxParticipants, setMaxParticipants] = useState(8);
    const [isUnlimited, setIsUnlimited] = useState(false);
    const [groupType, setGroupType] = useState<"mixte" | "filles" | null>(isFemale ? "mixte" : null);
    const [sportParams, setSportParams] = useState<SportParams>({ distance: 10, pace: 330 });
    const [invitedFriends, setInvitedFriends] = useState<string[]>([]);
    const [inviteShareToken] = useState<string>(() => {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
        return template.replace(/[xy]/g, (char) => {
            const random = Math.floor(Math.random() * 16);
            const value = char === "x" ? random : (random & 0x3) | 0x8;
            return value.toString(16);
        });
    });
    const [tags, setTags] = useState<string[]>([]);
    const [description, setDescription] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [createdActivityId, setCreatedActivityId] = useState<string | null>(null);
    const [shareOrigin, setShareOrigin] = useState("");
    const [copiedShareLink, setCopiedShareLink] = useState(false);
    const stepScrollRef = useRef<HTMLDivElement>(null);

    const totalSteps = STEPS.length;

    const isStepValid = () => {
        switch (step) {
            case 1: return !!sport && (sport === "running" || !!level);
            case 2: return !!date && !!time;
            case 3: return !!coords;
            case 4: {
                const participantsValid = isUnlimited || maxParticipants >= 2;
                const groupTypeValid = !isFemale || groupType !== null;
                return participantsValid && groupTypeValid;
            }
            case 5: return true; // inviting is optional
            case 6: return true; // description is optional
            case 7: return true; // summary confirmation
            default: return false;
        }
    };

    const handleNext = async () => {
        if (!isStepValid()) return;
        if (step < totalSteps) {
            setStep(step + 1);
        } else {
            setIsLoading(true);
            setError("");
            try {
                if (isStaffBlocked) {
                    throw new Error("Impossible de créer une activité pour ce compte.");
                }

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
                    location: locationCity.trim() || "Lausanne",
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
                    distance: (sport === "running" || sport === "vélo" || sport === "velo") ? sportParams.distance : undefined,
                    pace: (sport === "running" && sportParams.pace > 0) ? sportParams.pace : undefined,
                    invited_user_ids: invitedFriends,
                    invite_share_token: inviteShareToken,
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
                const responseBody = await res.json().catch(() => null);

                if (!res.ok) {
                    throw new Error(responseBody?.error || "Failed to create activity");
                }

                // Publish success
                const createdId = String(responseBody?.data?.activity?.id || "").trim();
                setCreatedActivityId(createdId || null);
                setPublished(true);
            } catch (err: unknown) {
                console.error(err);
                setError(err instanceof Error ? err.message : "Une erreur est survenue.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
        else if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push("/");
    };

    const progress = (step / totalSteps) * 100;
    const successDateTimeLabel = (() => {
        if (!date || !time) return "Date à confirmer";
        const [y, m, d] = date.split("-");
        const [hr, min] = time.split(":");
        const parsed = new Date(Number(y), Number(m) - 1, Number(d), Number(hr), Number(min));
        if (!Number.isFinite(parsed.getTime())) return "Date à confirmer";
        return parsed.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
        });
    })();
    const successSportLabel = sport ? `${sport.charAt(0).toUpperCase()}${sport.slice(1)}` : "Activité";
    const successLocationLabel = locationCity?.trim() ? locationCity.trim() : "Lausanne";
    const createdInviteShareUrl = createdActivityId && shareOrigin
        ? `${shareOrigin}/invite?activity_id=${encodeURIComponent(createdActivityId)}`
        : "";

    const TransitionOverlay = ({
        title,
        subtitle,
        icon,
        children,
    }: {
        title: string;
        subtitle: React.ReactNode;
        icon: React.ReactNode;
        children?: React.ReactNode;
    }) => (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#F5F7F6]/92 px-4 backdrop-blur-[2px]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_44%),radial-gradient(circle_at_bottom_left,_rgba(36,40,65,0.06),_transparent_48%)]" />
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="relative z-10 w-full max-w-[420px] rounded-[30px] border border-gray-100 bg-white px-6 py-7 text-center shadow-[0_20px_38px_rgba(31,41,55,0.10)]"
            >
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-100/70 shadow-[0_8px_20px_rgba(16,185,129,0.12)]">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white">
                        {icon}
                    </div>
                </div>
                <h1 className="text-[27px] font-black tracking-tight text-[#242841]">{title}</h1>
                <p className="mx-auto mt-2 max-w-[310px] text-[14px] font-medium leading-relaxed text-gray-500">{subtitle}</p>
                {children}
            </motion.div>
        </div>
    );

    useEffect(() => {
        const container = stepScrollRef.current;
        if (!container) return;
        container.scrollTo({ top: 0, behavior: "auto" });
    }, [step]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        setShareOrigin(window.location.origin);
    }, []);

    const copyCreatedInviteLink = async () => {
        if (!createdInviteShareUrl) return;
        try {
            await navigator.clipboard.writeText(createdInviteShareUrl);
            setCopiedShareLink(true);
            window.setTimeout(() => setCopiedShareLink(false), 1600);
        } catch {
            setCopiedShareLink(false);
        }
    };

    const shareCreatedInviteOnWhatsApp = () => {
        if (!createdInviteShareUrl) return;
        const message = `Rejoins mon activité sur Playzi 👇\n${createdInviteShareUrl}`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(waUrl, "_blank", "noopener,noreferrer");
    };

    if (published) {
        return (
            <main className="h-[100dvh] w-full bg-[#F5F7F6]">
                <TransitionOverlay
                    title="Activité publiée"
                    subtitle={
                        <>
                            Ton activité est maintenant visible dans Découvrir.
                            <br />
                            Retrouve-la dans Mes activités.
                        </>
                    }
                    icon={
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0.85 }}
                            animate={{ scale: [0.94, 1.03, 1], opacity: [0.9, 1, 1] }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="flex h-full w-full items-center justify-center"
                        >
                            <Check className="h-5 w-5 text-emerald-600 stroke-[2.8px]" />
                        </motion.div>
                    }
                >
                    <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50/80 px-3.5 py-3 text-left">
                        <div className="grid grid-cols-[78px_1fr] items-center gap-2 text-[12px]">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-300">Sport</span>
                            <span className="truncate text-right font-black text-[#242841]">{successSportLabel}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-[78px_1fr] items-center gap-2 text-[12px]">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-300">
                                <MapPin className="h-3.5 w-3.5" />
                                Lieu
                            </span>
                            <span className="truncate text-right font-black text-[#242841]">{successLocationLabel}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-[78px_1fr] items-center gap-2 text-[12px]">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-300">
                                <CalendarClock className="h-3.5 w-3.5" />
                                Date
                            </span>
                            <span className="truncate text-right font-black text-[#242841]">{successDateTimeLabel}</span>
                        </div>
                    </div>
                    <div className="mt-5 rounded-2xl border border-gray-100 bg-white px-3.5 py-3 text-left">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400">Inviter via lien</p>
                        <div className="relative">
                            <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                readOnly
                                value={createdInviteShareUrl}
                                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-[12px] text-gray-600"
                            />
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={copyCreatedInviteLink}
                                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-[12px] font-semibold text-gray-dark transition hover:bg-gray-50"
                            >
                                {copiedShareLink ? <Check className="h-3.5 w-3.5 text-playzi-green" /> : <Copy className="h-3.5 w-3.5" />}
                                {copiedShareLink ? "Lien copié" : "Copier le lien"}
                            </button>
                            <button
                                type="button"
                                onClick={shareCreatedInviteOnWhatsApp}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-[#25D366] transition hover:bg-gray-50"
                                aria-label="Partager sur WhatsApp"
                            >
                                <MessageCircle className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.push("/activities")}
                        className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#242841] px-4 text-[13px] font-semibold text-white"
                    >
                        Aller à Mes activités
                    </button>
                </TransitionOverlay>
            </main>
        );
    }

    return (
        <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background relative overflow-hidden touch-manipulation">
            <Header />

            {/* Fixed Step Header (under global fixed Header) */}
            <div className="fixed top-16 left-0 right-0 w-full max-w-md mx-auto z-40 px-5 py-3 bg-background/95 backdrop-blur-md border-b border-gray-100/50">
                <div className="mb-2 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-600 transition hover:text-gray-800"
                        aria-label="Retour"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Retour
                    </button>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
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
                <div className="mt-3">
                    <AnimatePresence mode="wait">
                        <motion.h1
                            key={step}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="text-[20px] font-black text-gray-dark tracking-tight"
                        >
                            {STEPS[step - 1].title}
                        </motion.h1>
                    </AnimatePresence>
                </div>
            </div>

            {/* Scrollable Step Content */}
            <div ref={stepScrollRef} className="flex-1 w-full overflow-y-auto relative px-5 pt-[178px] pb-[190px] z-0">
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
                                onCityChange={setLocationCity}
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
                                groupType={groupType}
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
                        {step === 7 && (
                            <StepSummary
                                sport={sport}
                                level={level}
                                date={date}
                                time={time}
                                locationText={coords ? (locationCity.trim() || "Lausanne") : null}
                                maxParticipants={maxParticipants}
                                isUnlimited={isUnlimited}
                                groupType={groupType}
                                sportParams={sportParams}
                                tags={tags}
                                description={description}
                                isFemale={isFemale}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Fixed Bottom CTA */}
            <div className="absolute bottom-[102px] inset-x-0 z-30 w-full max-w-md mx-auto px-6 pt-8 pb-3 bg-gradient-to-t from-background via-background/95 to-transparent flex flex-col items-center pointer-events-none safe-area-bottom">
                <div className="pointer-events-auto w-full">
                    {error && <p className="text-red-500 text-[12px] font-semibold mb-3 text-center">{error}</p>}
                    <motion.button
                        onClick={handleNext}
                        disabled={!isStepValid() || isLoading}
                        whileTap={{ scale: (isStepValid() && !isLoading) ? 0.97 : 1 }}
                        className={cn(
                            "w-full h-14 rounded-2xl flex items-center justify-center gap-2 text-[15px] font-bold transition-all shadow-lg",
                            isStepValid() && !isLoading
                                ? "bg-playzi-green text-white shadow-playzi-green/25 hover:shadow-playzi-green/40 hover:-translate-y-0.5 active:shadow-none active:translate-y-1"
                                : "bg-gray-100 text-gray-300 shadow-transparent cursor-not-allowed"
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
            </div>

            <div className="shrink-0 z-40 relative">
                <BottomNavigation />
            </div>
        </main>
    );
}
