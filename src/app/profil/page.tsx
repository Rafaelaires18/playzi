"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    User,
    Flame,
    Crown,
    Trophy,
    Activity,
    Users,
    ShieldCheck,
    Lock,
    ChevronRight,
    Pencil,
    ChevronDown,
    Network,
    Star,
    FileText,
    X,
    Camera
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { cn } from "@/lib/utils";
import {
    DEFAULT_PROFILE_TITLE_IDS,
    getSelectableProfileTitles,
    rarityLabel,
    rarityTone
} from "@/lib/titles";

type TimeFilter = "1M" | "3M" | "6M" | "1A";

type RankStep = {
    min: number;
    label: string;
    next: number | null;
};

type RankTheme = {
    rankText: string;
    rankAccentBorder: string;
    progressFrom: string;
    progressTo: string;
    futureIconKey: "bronze" | "silver" | "gold" | "platinum";
};

type PulsePoint = { label: string; value: number };
type PulseSeries = Record<TimeFilter, PulsePoint[]>;

const rankSteps: RankStep[] = [
    { min: 0, label: "Bronze III", next: 100 },
    { min: 100, label: "Bronze II", next: 200 },
    { min: 200, label: "Bronze I", next: 300 },
    { min: 300, label: "Argent III", next: 400 },
    { min: 400, label: "Argent II", next: 500 },
    { min: 500, label: "Argent I", next: 600 },
    { min: 600, label: "Or III", next: 700 },
    { min: 700, label: "Or II", next: 800 },
    { min: 800, label: "Or I", next: 900 },
    { min: 900, label: "Platine", next: null }
];

const EMPTY_PULSE_SERIES: PulseSeries = {
    "1M": [
        { label: "S1", value: 0 },
        { label: "S2", value: 0 },
        { label: "S3", value: 0 },
        { label: "S4", value: 0 }
    ],
    "3M": Array.from({ length: 12 }, (_, i) => ({ label: `S${i + 1}`, value: 0 })),
    "6M": Array.from({ length: 6 }, (_, i) => ({ label: `M${i + 1}`, value: 0 })),
    "1A": Array.from({ length: 12 }, (_, i) => ({ label: `M${i + 1}`, value: 0 })),
};

const TITLES_STORAGE_KEY = "playzi_profile_selected_titles_v3";

function formatDisplayIdentity(firstName: string | null, lastName: string | null, pseudo: string, maxChars = 18) {
    const cleanFirstName = (firstName || "").trim();
    const cleanLastName = (lastName || "").trim();
    if (!cleanFirstName && !cleanLastName) return pseudo;
    if (!cleanFirstName) return cleanLastName;
    if (!cleanLastName) return cleanFirstName;
    const fullName = `${cleanFirstName} ${cleanLastName}`;
    if (fullName.length <= maxChars) return fullName;
    return `${cleanFirstName} ${cleanLastName.charAt(0)}.`;
}

function getRankData(currentPulse: number) {
    const current = [...rankSteps].reverse().find((step) => currentPulse >= step.min) ?? rankSteps[0];
    const nextThreshold = current.next;
    const nextStep = nextThreshold ? rankSteps.find((step) => step.min === nextThreshold) : null;
    const progressPercent = nextThreshold
        ? Math.max(0, Math.min(100, ((currentPulse - current.min) / (nextThreshold - current.min)) * 100))
        : 100;
    return {
        currentPulse,
        rankLabel: current.label,
        nextRankLabel: nextStep?.label ?? null,
        nextThreshold,
        progressPercent: Math.round(progressPercent)
    };
}

function getRankTheme(rankLabel: string): RankTheme {
    if (rankLabel.startsWith("Bronze")) {
        return {
            rankText: "text-[#9A6A4B]",
            rankAccentBorder: "border-[#E8D5C8]",
            progressFrom: "#B8815F",
            progressTo: "#CFA084",
            futureIconKey: "bronze"
        };
    }
    if (rankLabel.startsWith("Argent")) {
        return {
            rankText: "text-[#7E8796]",
            rankAccentBorder: "border-[#DCE2EA]",
            progressFrom: "#9CA6B7",
            progressTo: "#C0C8D4",
            futureIconKey: "silver"
        };
    }
    if (rankLabel.startsWith("Or")) {
        return {
            rankText: "text-[#B68A34]",
            rankAccentBorder: "border-[#F1E5C3]",
            progressFrom: "#C89A3D",
            progressTo: "#DFC588",
            futureIconKey: "gold"
        };
    }
    return {
        rankText: "text-[#4F7EA7]",
        rankAccentBorder: "border-[#D6E8F6]",
        progressFrom: "#6699C8",
        progressTo: "#9FC1DE",
        futureIconKey: "platinum"
    };
}

function LockedOverlay() {
    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[20px] bg-white/72 backdrop-blur-[4px]">
            <div className="flex items-center gap-2 rounded-full border border-amber-300 bg-white/95 px-3 py-1.5 shadow-sm">
                <Crown className="h-4 w-4 text-amber-500" />
                <span className="text-[11px] font-black text-gray-700">Disponible avec Playzi+</span>
            </div>
        </div>
    );
}

function PulsePeIcon() {
    return (
        <svg viewBox="0 0 32 32" aria-hidden="true" className="h-6 w-6">
            <text
                x="4.5"
                y="22.2"
                fontSize="20"
                fontWeight="800"
                fontFamily="Outfit, ui-sans-serif, system-ui"
                fill="#242841"
                letterSpacing="-0.8"
            >
                P
            </text>
            <text
                x="15.8"
                y="22.2"
                fontSize="20"
                fontWeight="700"
                fontFamily="Outfit, ui-sans-serif, system-ui"
                fill="#16A34A"
                letterSpacing="-0.8"
            >
                e
            </text>
        </svg>
    );
}

export default function ProfilePage() {
    const selectableTitles = getSelectableProfileTitles();
    const titleById = new Map(selectableTitles.map((title) => [title.id, title]));
    const regularUnlockedTitles = selectableTitles.filter((title) => title.type !== "seasonal");
    const seasonalUnlockedTitles = selectableTitles.filter((title) => title.type === "seasonal");
    const regularIdSet = new Set(regularUnlockedTitles.map((title) => title.id));
    const seasonalIdSet = new Set(seasonalUnlockedTitles.map((title) => title.id));
    const fallbackPrimaryId = regularUnlockedTitles[0]?.id ?? DEFAULT_PROFILE_TITLE_IDS[0];

    const normalizeSelection = (selection: { primaryId: string; secondaryIds: string[]; seasonalId: string | null }) => {
        const primaryId = regularIdSet.has(selection.primaryId) ? selection.primaryId : fallbackPrimaryId;
        const secondaryIds = selection.secondaryIds
            .filter((id) => regularIdSet.has(id))
            .filter((id) => id !== primaryId)
            .filter((id, index, arr) => arr.indexOf(id) === index)
            .slice(0, 2);
        const seasonalId = selection.seasonalId && seasonalIdSet.has(selection.seasonalId) ? selection.seasonalId : null;
        return { primaryId, secondaryIds, seasonalId };
    };

    const [timeFilter, setTimeFilter] = useState<TimeFilter>("3M");
    const [titleSelection, setTitleSelection] = useState<{ primaryId: string; secondaryIds: string[]; seasonalId: string | null }>(() => {
        const fallbackSelection = normalizeSelection({
            primaryId: fallbackPrimaryId,
            secondaryIds: DEFAULT_PROFILE_TITLE_IDS.slice(1, 3),
            seasonalId: null
        });
        if (typeof window === "undefined") return fallbackSelection;
        const stored = window.localStorage.getItem(TITLES_STORAGE_KEY);
        if (!stored) return fallbackSelection;
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                const ids = parsed.filter((item): item is string => typeof item === "string");
                const regularIds = ids.filter((id) => regularIdSet.has(id));
                const seasonalId = ids.find((id) => seasonalIdSet.has(id)) ?? null;
                return normalizeSelection({
                    primaryId: regularIds[0] ?? fallbackPrimaryId,
                    secondaryIds: regularIds.slice(1, 3),
                    seasonalId
                });
            }
            if (parsed && typeof parsed === "object") {
                return normalizeSelection({
                    primaryId: typeof parsed.primaryId === "string" ? parsed.primaryId : fallbackPrimaryId,
                    secondaryIds: Array.isArray(parsed.secondaryIds)
                        ? parsed.secondaryIds.filter((id: unknown): id is string => typeof id === "string")
                        : [],
                    seasonalId: typeof parsed.seasonalId === "string" ? parsed.seasonalId : null
                });
            }
            return fallbackSelection;
        } catch {
            return fallbackSelection;
        }
    });
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
    const [profilePseudo, setProfilePseudo] = useState("rafael");
    const [profileFirstName, setProfileFirstName] = useState<string | null>("Rafael");
    const [profileLastName, setProfileLastName] = useState<string | null>("Detierre");
    const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [pulseTotal, setPulseTotal] = useState(0);
    const [pulseSeriesByFilter, setPulseSeriesByFilter] = useState<PulseSeries>(EMPTY_PULSE_SERIES);
    const [showPrimaryTitleInfo, setShowPrimaryTitleInfo] = useState(false);
    const [isPseudoCopied, setIsPseudoCopied] = useState(false);
    const galleryInputRef = useRef<HTMLInputElement | null>(null);
    const cameraInputRef = useRef<HTMLInputElement | null>(null);
    const avatarMenuRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);

    const isPlayziPlus = false;
    const streakWeeks = 4;
    const rankData = getRankData(pulseTotal);
    const rankTheme = getRankTheme(rankData.rankLabel);
    const primaryTitle = titleById.get(titleSelection.primaryId);
    const secondaryTitles = titleSelection.secondaryIds
        .map((id) => titleById.get(id))
        .filter((title): title is NonNullable<typeof title> => Boolean(title));
    const seasonalTitle = titleSelection.seasonalId ? titleById.get(titleSelection.seasonalId) : undefined;
    const secondarySlotValues = [titleSelection.secondaryIds[0] ?? "", titleSelection.secondaryIds[1] ?? ""];
    const displayIdentity = formatDisplayIdentity(profileFirstName, profileLastName, profilePseudo);

    const handlePrimaryChange = (primaryId: string) => {
        setTitleSelection((prev) =>
            normalizeSelection({
                ...prev,
                primaryId,
                secondaryIds: prev.secondaryIds.filter((id) => id !== primaryId)
            })
        );
    };

    const handleSecondaryChange = (slotIndex: number, value: string) => {
        setTitleSelection((prev) => {
            const slots = [prev.secondaryIds[0] ?? "", prev.secondaryIds[1] ?? ""];
            slots[slotIndex] = value;
            return normalizeSelection({
                ...prev,
                secondaryIds: slots.filter(Boolean)
            });
        });
    };

    const handleSeasonalChange = (seasonalId: string) => {
        setTitleSelection((prev) =>
            normalizeSelection({
                ...prev,
                seasonalId: seasonalId || null
            })
        );
    };

    useEffect(() => {
        window.localStorage.setItem(TITLES_STORAGE_KEY, JSON.stringify(titleSelection));
    }, [titleSelection]);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const res = await fetch("/api/auth/me");
                if (!res.ok) return;
                const json = await res.json();
                const pseudo = json?.data?.user?.pseudo;
                const firstName = json?.data?.user?.first_name;
                const lastName = json?.data?.user?.last_name;
                const avatar = json?.data?.user?.avatar_url;
                if (typeof pseudo === "string" && pseudo.length > 0) setProfilePseudo(pseudo);
                if (typeof firstName === "string") setProfileFirstName(firstName);
                if (typeof lastName === "string") setProfileLastName(lastName);
                if (typeof avatar === "string" && avatar.length > 0) setAvatarUrl(avatar);
            } catch {
                // Ignore profile loading errors and keep local defaults.
            }
        };
        void loadProfile();
    }, []);

    useEffect(() => {
        const loadPulse = async () => {
            try {
                const res = await fetch("/api/pulse/me", { cache: "no-store" });
                if (!res.ok) return;
                const json = await res.json();
                const data = json?.data;
                if (typeof data?.total_pulse === "number") {
                    setPulseTotal(data.total_pulse);
                }
                const series = data?.series;
                if (series?.["1M"] && series?.["3M"] && series?.["6M"] && series?.["1A"]) {
                    setPulseSeriesByFilter(series as PulseSeries);
                }
            } catch {
                // Ignore pulse loading errors and keep fallback values.
            }
        };
        void loadPulse();
    }, []);

    useEffect(() => {
        if (!isAvatarMenuOpen) return;
        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (!avatarMenuRef.current?.contains(target)) {
                setIsAvatarMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
        };
    }, [isAvatarMenuOpen]);

    useEffect(() => {
        return () => {
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
        };
    }, [avatarPreviewUrl]);

    const stopCameraStream = () => {
        if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach((track) => track.stop());
            cameraStreamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    useEffect(() => {
        return () => stopCameraStream();
    }, []);

    useEffect(() => {
        if (!isCameraOpen || !videoRef.current || !cameraStreamRef.current) return;
        videoRef.current.srcObject = cameraStreamRef.current;
        void videoRef.current.play();
    }, [isCameraOpen]);

    const uploadAvatar = async (file: File) => {
        try {
            setIsUploadingAvatar(true);
            setAvatarError(null);
            const localPreview = URL.createObjectURL(file);
            setAvatarPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return localPreview;
            });
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/profile/avatar", {
                method: "POST",
                body: formData
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                setAvatarError(err?.details || err?.error || "Upload photo impossible pour le moment.");
                return;
            }
            const json = await res.json();
            const nextUrl = json?.data?.avatar_url;
            if (typeof nextUrl === "string" && nextUrl.length > 0) {
                setAvatarUrl(nextUrl);
                setAvatarPreviewUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                });
            }
            setIsAvatarMenuOpen(false);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const deleteAvatar = async () => {
        try {
            setIsUploadingAvatar(true);
            setAvatarError(null);
            const res = await fetch("/api/profile/avatar", { method: "DELETE" });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                setAvatarError(err?.details || err?.error || "Suppression photo impossible pour le moment.");
                return;
            }
            setAvatarUrl(null);
            setAvatarPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
            setIsAvatarMenuOpen(false);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const openCameraCapture = async () => {
        setCameraError(null);
        if (!navigator.mediaDevices?.getUserMedia) {
            cameraInputRef.current?.click();
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" }
                },
                audio: false
            });
            cameraStreamRef.current = stream;
            setIsAvatarMenuOpen(false);
            setIsCameraOpen(true);
        } catch {
            setCameraError("Accès caméra refusé. Utilise la galerie ou autorise la caméra.");
            cameraInputRef.current?.click();
        }
    };

    const captureFromCamera = async () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) return;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, width, height);

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
        if (!blob) return;

        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
        stopCameraStream();
        setIsCameraOpen(false);
        await uploadAvatar(file);
    };

    const copyPseudoToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(`@${profilePseudo}`);
            setIsPseudoCopied(true);
            window.setTimeout(() => setIsPseudoCopied(false), 1600);
        } catch {
            setAvatarError("Impossible de copier le pseudo pour le moment.");
        }
    };

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-x-hidden overflow-y-hidden bg-[#F5F7F6]">
            <Header />

            <div className="flex-1 overflow-x-hidden overflow-y-auto px-4 pt-20 pb-28 space-y-5">
                <section className={cn("relative flex min-h-[220px] flex-col rounded-[26px] border bg-white p-5 shadow-sm", rankTheme.rankAccentBorder)}>
                    <div className="flex flex-1 items-start">
                        <div className="flex flex-1 items-start gap-3.5">
                            <div ref={avatarMenuRef} className="relative">
                                <div className="relative h-16 w-16">
                                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gray-100">
                                        {(avatarPreviewUrl || avatarUrl) ? (
                                            <img src={avatarPreviewUrl || avatarUrl || ""} alt="Photo de profil" className="h-full w-full object-cover" />
                                        ) : (
                                            <User className="h-8 w-8 text-gray-500" />
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsAvatarMenuOpen((open) => !open)}
                                        className="absolute -right-1 -bottom-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-gray-100/90 opacity-90 shadow-sm"
                                        aria-label="Changer photo de profil"
                                    >
                                        <Camera className="h-3.5 w-3.5 text-gray-500" />
                                    </button>
                                </div>
                                <button
                                    onClick={() => setIsEditOpen(true)}
                                    className="mt-2 inline-flex h-6 w-16 items-center justify-center gap-1 rounded-full border border-gray-200 bg-white/90 text-[9px] font-semibold text-gray-500 hover:bg-gray-50"
                                    aria-label="Modifier profil"
                                >
                                    <Pencil className="h-2.5 w-2.5" />
                                    Modifier
                                </button>
                                {isAvatarMenuOpen && (
                                    <div className="absolute left-0 z-30 mt-2 w-[186px] rounded-xl border border-gray-100 bg-white p-1 shadow-lg">
                                        <button
                                            type="button"
                                            onClick={() => galleryInputRef.current?.click()}
                                            className="block w-full rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                                            disabled={isUploadingAvatar}
                                        >
                                            Choisir depuis la galerie
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void openCameraCapture()}
                                            className="block w-full rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
                                            disabled={isUploadingAvatar}
                                        >
                                            Prendre une photo
                                        </button>
                                        {(avatarPreviewUrl || avatarUrl) && (
                                            <button
                                                type="button"
                                                onClick={() => void deleteAvatar()}
                                                className="block w-full rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-rose-600 hover:bg-rose-50"
                                                disabled={isUploadingAvatar}
                                            >
                                                Supprimer la photo
                                            </button>
                                        )}
                                        <input
                                            ref={galleryInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) void uploadAvatar(file);
                                                e.currentTarget.value = "";
                                            }}
                                        />
                                        <input
                                            ref={cameraInputRef}
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) void uploadAvatar(file);
                                                e.currentTarget.value = "";
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <h1 className="min-w-0 flex-1 truncate text-[22px] font-black leading-tight text-[#242841]">{displayIdentity}</h1>
                                    <span className={cn("shrink-0 inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide", rankTheme.rankText, rankTheme.rankAccentBorder, "bg-white")}>
                                        {rankData.rankLabel}
                                    </span>
                                </div>
                                <div className="mt-0 min-h-[14px]">
                                    <button
                                        type="button"
                                        onClick={() => void copyPseudoToClipboard()}
                                        className="truncate text-[10px] font-medium leading-none text-gray-500 transition hover:text-gray-600 active:opacity-80"
                                        aria-label="Copier le pseudo"
                                    >
                                        @{profilePseudo}
                                    </button>
                                    {isPseudoCopied && (
                                        <span className="ml-2 text-[10px] font-semibold text-emerald-600">Copié</span>
                                    )}
                                </div>
                                <div className="mt-2 min-h-[38px]">
                                    {primaryTitle ? (
                                        <motion.button
                                            type="button"
                                            onClick={() => setShowPrimaryTitleInfo((open) => !open)}
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.99 }}
                                            className={cn("inline-flex w-full items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-bold", primaryTitle.type === "seasonal" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : rarityTone(primaryTitle.rarity))}
                                        >
                                            <Trophy className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">{primaryTitle.label}</span>
                                        </motion.button>
                                    ) : (
                                        <span className="inline-flex h-[38px] w-full rounded-full border border-gray-100 bg-gray-50/70" />
                                    )}
                                </div>
                                {showPrimaryTitleInfo && primaryTitle && (
                                    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2 text-[11px] shadow-sm">
                                        <p className="font-black text-[#242841]">{primaryTitle.label}</p>
                                        <p className="mt-0.5 font-semibold text-gray-500">{primaryTitle.unlockHint}</p>
                                    </div>
                                )}
                                <div className="min-h-[18px]">
                                    {secondaryTitles.length > 0 ? (
                                        <p className="truncate text-[11px] font-semibold text-gray-500">
                                            {secondaryTitles.map((title) => title.label).join(" • ")}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-transparent">placeholder</p>
                                    )}
                                </div>
                                <div className="min-h-[30px]">
                                    {seasonalTitle ? (
                                        <span className="inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                                            <span className="truncate">{seasonalTitle.label}</span>
                                        </span>
                                    ) : (
                                        <span className="inline-flex h-[30px] w-full rounded-full border border-transparent" />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Saison 2 - Printemps 2026</p>
                </section>
                {cameraError && (
                    <p className="px-1 text-[11px] font-semibold text-rose-600">{cameraError}</p>
                )}
                {avatarError && (
                    <p className="px-1 text-[11px] font-semibold text-rose-600">{avatarError}</p>
                )}

                <div className="px-1">
                    <div className="h-px w-full bg-gray-200/70" />
                </div>

                <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Niveau actuel</p>
                            <h2 className={cn("mt-1 text-[26px] leading-none font-black", rankTheme.rankText)}>{rankData.rankLabel}</h2>
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2">
                            <Flame className="h-5 w-5 text-rose-500" />
                            <span className="text-[15px] font-black text-rose-600">{streakWeeks} semaines</span>
                        </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/80 p-3.5">
                        <div className="mb-2.5 flex items-center justify-between">
                            <p className="text-[12px] font-semibold text-gray-600">
                                {rankData.nextRankLabel ? `Vers ${rankData.nextRankLabel}` : "Palier maximum"}
                            </p>
                            <p className="text-[12px] font-bold text-gray-500">{rankData.progressPercent}%</p>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${rankData.progressPercent}%` }}
                                transition={{ duration: 0.7, ease: "easeOut" }}
                                className="h-full rounded-full"
                                style={{ backgroundImage: `linear-gradient(to right, ${rankTheme.progressFrom}, ${rankTheme.progressTo})` }}
                            />
                        </div>
                        <p className="mt-2.5 text-center leading-none">
                            {rankData.nextThreshold
                                ? (
                                    <>
                                        <span className="text-[19px] font-black text-[#242841]">{rankData.currentPulse}</span>
                                        <span className="ml-1 text-[12px] font-semibold text-gray-500">/ {rankData.nextThreshold} Pulse</span>
                                    </>
                                )
                                : <span className="text-[12px] font-semibold text-gray-600">{rankData.currentPulse} Pulse · palier maximum</span>}
                        </p>
                    </div>
                </section>

                <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-[18px] font-black text-[#242841]">Évolution Pulse</h3>
                        <div className="flex rounded-full border border-gray-100 bg-gray-50 p-1">
                            {(Object.keys(pulseSeriesByFilter) as TimeFilter[]).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setTimeFilter(filter)}
                                    className={cn(
                                        "rounded-full px-2.5 py-1 text-[11px] font-black transition",
                                        timeFilter === filter ? "bg-white text-[#242841] shadow-sm" : "text-gray-400"
                                    )}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="relative">
                        <div className={cn("h-40", !isPlayziPlus && "blur-[4px] contrast-75")}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={pulseSeriesByFilter[timeFilter]} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="pulseGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.22} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }} />
                                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }} width={40} />
                                    <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2.5} fill="url(#pulseGradient)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        {!isPlayziPlus && <LockedOverlay />}
                    </div>
                </section>

                <section>
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-[18px] font-black text-[#242841]">Titres</h3>
                        <Link href="/profil/titres" className="flex items-center text-[12px] font-black text-gray-500">
                            Tout voir <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                        </Link>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {selectableTitles.map((title) => (
                            <article key={title.id} className="relative w-[172px] shrink-0 rounded-[20px] border border-gray-100 bg-gradient-to-b from-white to-gray-50/40 p-4 shadow-sm">
                                <div className={cn("inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide", title.type === "seasonal" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : rarityTone(title.rarity))}>
                                    {title.type === "seasonal" ? "Saisonnier" : rarityLabel(title.rarity)}
                                </div>
                                <h4 className="mt-3 text-[13px] font-black text-[#242841]">{title.label}</h4>
                                <p className="mt-1 text-[11px] leading-snug font-semibold text-gray-500">{title.unlockHint}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="grid grid-cols-2 gap-3">
                    <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                            <PulsePeIcon />
                        </div>
                        <p className="text-[19px] font-black text-[#242841]">{rankData.currentPulse}</p>
                        <p className="mt-1 text-[11px] font-semibold text-gray-500">Pulse</p>
                    </article>

                    <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <Activity className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="space-y-1.5 text-[11px] font-semibold text-gray-500">
                            <div className="flex items-center justify-between">
                                <span>Activités rejointes</span>
                                <span className="text-[17px] font-black leading-none text-[#242841]">38</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Activités créées</span>
                                <span className="text-[17px] font-black leading-none text-[#242841]">11</span>
                            </div>
                        </div>
                    </article>

                    <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <Users className="h-4 w-4 text-gray-500" />
                        </div>
                        <p className="text-[19px] font-black text-[#242841]">57</p>
                        <p className="mt-1 text-[11px] font-semibold text-gray-500">Personnes rencontrées</p>
                    </article>

                    <Link
                        href="/profil/connexions"
                        className="rounded-[20px] border border-emerald-100 bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <Network className="h-4 w-4 text-gray-500" />
                        </div>
                        <p className="text-[19px] font-black text-[#242841]">63</p>
                        <div className="mt-1 flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-gray-500">Connexions</p>
                            <ChevronRight className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                    </Link>

                    <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <Star className="h-4 w-4 text-gray-500" />
                        </div>
                        <p className="text-[19px] font-black text-[#242841]">Beach-volley</p>
                        <p className="mt-1 text-[11px] font-semibold text-gray-500">Sport préféré</p>
                    </article>

                    <Link
                        href="/profil/resume-mensuel"
                        className="rounded-[20px] border border-[#CFEFE6] bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <FileText className="h-4 w-4 text-gray-500" />
                        </div>
                        <p className="text-[16px] font-black text-[#242841]">Résumé mensuel</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Mars 2026 · 7 activités</p>
                        <div className="mt-1 flex items-center justify-end">
                            <ChevronRight className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                    </Link>
                </section>

                <section className="relative rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className={cn(!isPlayziPlus && "blur-[4px] contrast-75")}>
                        <div className="mb-3 flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-amber-500" />
                            <h3 className="text-[16px] font-black text-[#242841]">Statistiques Playzi+</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-gray-50 p-3">
                                <p className="text-[16px] font-black text-[#242841]">96%</p>
                                <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Taux de présence</p>
                            </div>
                            <div className="rounded-xl bg-gray-50 p-3">
                                <p className="text-[16px] font-black text-[#242841]">214 km</p>
                                <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Running/Vélo</p>
                            </div>
                            <div className="rounded-xl bg-gray-50 p-3">
                                <p className="text-[16px] font-black text-[#242841]">29</p>
                                <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Sessions collectives</p>
                            </div>
                            <div className="rounded-xl bg-gray-50 p-3">
                                <p className="text-[16px] font-black text-[#242841]">8</p>
                                <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Événements Playzi</p>
                            </div>
                        </div>
                    </div>
                    {!isPlayziPlus && <LockedOverlay />}
                </section>

                <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <h3 className="text-[16px] font-black text-[#242841]">Sports pratiqués</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-[12px] font-bold text-gray-700">🏐 Beach-volley</span>
                        <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-[12px] font-bold text-gray-700">🏃 Running</span>
                        <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-[12px] font-bold text-gray-700">🚴 Vélo</span>
                    </div>
                    <div className="relative mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                        <div className={cn("space-y-2", !isPlayziPlus && "blur-[4px] contrast-75")}>
                            <p className="text-[12px] font-bold text-gray-700">Par sport (Playzi+)</p>
                            <div className="flex items-center justify-between text-[12px] font-semibold text-gray-500">
                                <span>Running</span>
                                <span>126 km</span>
                            </div>
                            <div className="flex items-center justify-between text-[12px] font-semibold text-gray-500">
                                <span>Vélo</span>
                                <span>88 km</span>
                            </div>
                            <div className="flex items-center justify-between text-[12px] font-semibold text-gray-500">
                                <span>Collectif</span>
                                <span>29 sessions</span>
                            </div>
                        </div>
                        {!isPlayziPlus && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/75 backdrop-blur-[3px]">
                                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white/95 px-3 py-1.5 text-[11px] font-black text-gray-700">
                                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                                    Disponible avec Playzi+
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {isEditOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4">
                    <div className="w-full max-w-md rounded-[24px] border border-gray-100 bg-white p-4 shadow-xl">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-[15px] font-black text-[#242841]">Modifier le profil</h3>
                            <button
                                onClick={() => setIsEditOpen(false)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
                                aria-label="Fermer"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Titre principal</p>
                                <div className="relative">
                                    <select
                                        value={titleSelection.primaryId}
                                        onChange={(e) => handlePrimaryChange(e.target.value)}
                                        className="h-10 w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 pr-9 text-[12px] font-semibold text-gray-700 outline-none"
                                    >
                                        {regularUnlockedTitles.map((title) => (
                                            <option key={title.id} value={title.id}>
                                                {title.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                </div>
                            </div>

                            <div>
                                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Titres secondaires</p>
                                <div className="grid grid-cols-1 gap-2">
                                    {[0, 1].map((slotIndex) => (
                                        <div key={slotIndex} className="relative">
                                            <select
                                                value={secondarySlotValues[slotIndex]}
                                                onChange={(e) => handleSecondaryChange(slotIndex, e.target.value)}
                                                className="h-10 w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 pr-9 text-[12px] font-semibold text-gray-700 outline-none"
                                            >
                                                <option value="">Aucun</option>
                                                {regularUnlockedTitles
                                                    .filter((title) => title.id !== titleSelection.primaryId)
                                                    .filter((title) => title.id === secondarySlotValues[slotIndex] || !secondarySlotValues.includes(title.id))
                                                    .map((title) => (
                                                        <option key={title.id} value={title.id}>
                                                            {title.label}
                                                        </option>
                                                    ))}
                                            </select>
                                            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">Titre saisonnier</p>
                                <div className="relative">
                                    <select
                                        value={titleSelection.seasonalId ?? ""}
                                        onChange={(e) => handleSeasonalChange(e.target.value)}
                                        className="h-10 w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 pr-9 text-[12px] font-semibold text-gray-700 outline-none"
                                    >
                                        <option value="">Aucun</option>
                                        {seasonalUnlockedTitles.map((title) => (
                                            <option key={title.id} value={title.id}>
                                                {title.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => setIsEditOpen(false)}
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700"
                            >
                                Terminé
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCameraOpen && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-[24px] border border-gray-200 bg-white p-3 shadow-xl">
                        <div className="overflow-hidden rounded-2xl bg-black">
                            <video ref={videoRef} autoPlay playsInline muted className="h-[360px] w-full object-cover" />
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => {
                                    stopCameraStream();
                                    setIsCameraOpen(false);
                                }}
                                className="rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-600"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={() => void captureFromCamera()}
                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700"
                            >
                                Prendre la photo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BottomNavigation activeTab="profile" />
        </main>
    );
}
