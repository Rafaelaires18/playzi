"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    User,
    Flame,
    Trophy,
    Activity,
    Users,
    CalendarCheck2,
    ChevronRight,
    Pencil,
    ChevronDown,
    Network,
    Star,
    FileText,
    X,
    Camera,
    RefreshCw
} from "lucide-react";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { cn } from "@/lib/utils";
import { refreshPendingConnectionRequests, usePendingConnectionRequests } from "@/lib/connection-notification-store";
import PulseEvolutionCard, { PulseSeries as SharedPulseSeries } from "@/components/profile/PulseEvolutionCard";
import {
    DEFAULT_PROFILE_TITLE_IDS,
    getSelectableProfileTitles,
    rarityLabel,
    rarityTone
} from "@/lib/titles";
import {
    ProfileTitleSelection,
    isSameProfileTitleSelection,
    normalizeProfileTitleSelection,
} from "@/lib/profile-title-selection";
import { getTutorialModeSnapshot, PLAYZI_TUTORIAL_MODE_CHANGED_EVENT } from "@/lib/tutorial-mode";

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

type SportMetric = {
    key: string;
    label: string;
    value: number;
    unit?: string;
    type?: "count" | "distance" | string;
};
type SportBreakdownItem = {
    sport_key: string;
    sport_label: string;
    metrics: SportMetric[];
};
type RawSportMetric = {
    key?: unknown;
    label?: unknown;
    value?: unknown;
    unit?: unknown;
    type?: unknown;
};
type RawSportBreakdownItem = {
    sport_key?: unknown;
    sport_label?: unknown;
    metrics?: unknown;
};
type StreakNotification = {
    available: boolean;
    type: string;
    title: string;
    body: string;
    metadata?: {
        week_start?: string;
        week_end?: string;
        streak_weeks?: number;
    };
};

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

const EMPTY_PULSE_SERIES: SharedPulseSeries = {
    "1M": Array.from({ length: 30 }, (_, i) => ({ label: `J${i + 1}`, value: 0 })),
    "3M": Array.from({ length: 13 }, (_, i) => ({ label: `S${i + 1}`, value: 0 })),
    "6M": Array.from({ length: 6 }, (_, i) => ({ label: `M${i + 1}`, value: 0 })),
    "1A": Array.from({ length: 12 }, (_, i) => ({ label: `M${i + 1}`, value: 0 })),
};

const TITLES_STORAGE_KEY = "playzi_profile_selected_titles_v3";
const NOTIFICATIONS_CHANGED_EVENT = "playzi:notifications-changed";
const PROFILE_DEBUG_ENABLED = process.env.NODE_ENV !== "production";

function profileDebug(...args: unknown[]) {
    if (!PROFILE_DEBUG_ENABLED) return;
    console.log(...args);
}

function parseSportBreakdown(raw: unknown): SportBreakdownItem[] {
    if (!Array.isArray(raw)) return [];
    const items = raw as RawSportBreakdownItem[];
    return items
        .map((item) => {
            const key = typeof item?.sport_key === "string" ? item.sport_key : "";
            const label = typeof item?.sport_label === "string" && item.sport_label.trim() ? item.sport_label.trim() : "";
            if (!key || !label) return null;
            const metricsRaw = Array.isArray(item?.metrics) ? (item.metrics as RawSportMetric[]) : [];
            const metrics = metricsRaw
                .map((metric) => {
                    const metricKey = typeof metric?.key === "string" ? metric.key : "";
                    const metricLabel = typeof metric?.label === "string" ? metric.label : "";
                    const metricValue = Number(metric?.value);
                    const metricUnit = typeof metric?.unit === "string" ? metric.unit : undefined;
                    const metricType = typeof metric?.type === "string" ? metric.type : undefined;
                    if (!metricKey || !metricLabel || !Number.isFinite(metricValue)) return null;
                    return {
                        key: metricKey,
                        label: metricLabel,
                        value: metricValue,
                        unit: metricUnit,
                        type: metricType,
                    } as SportMetric;
                })
                .filter((metric): metric is SportMetric => Boolean(metric));
            return { sport_key: key, sport_label: label, metrics };
        })
        .filter((item): item is SportBreakdownItem => Boolean(item));
}


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

function PlayziEventsIcon() {
    return (
        <svg viewBox="0 0 32 32" aria-hidden="true" className="h-6 w-6">
            <text
                x="5"
                y="22"
                fontSize="20"
                fontWeight="800"
                fontFamily="Outfit, ui-sans-serif, system-ui"
                fill="#242841"
                letterSpacing="-0.8"
            >
                P
            </text>
            <circle cx="20.9" cy="23.5" r="2.7" fill="#10B981" />
        </svg>
    );
}

function ProfileSkeleton() {
    return (
        <main data-onboarding-id="profile-root" className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-x-hidden overflow-y-hidden bg-[#F5F7F6]">
            <Header />
            <div className="flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-4 pt-20 pb-28">
                <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-start gap-3.5">
                        <div className="h-16 w-16 animate-pulse rounded-2xl bg-gray-100" />
                        <div className="flex-1 space-y-2.5">
                            <div className="h-6 w-40 animate-pulse rounded-lg bg-gray-100" />
                            <div className="h-3 w-28 animate-pulse rounded-md bg-gray-100" />
                            <div className="h-8 w-44 animate-pulse rounded-full bg-gray-100" />
                        </div>
                    </div>
                </section>
                <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="h-5 w-32 animate-pulse rounded-md bg-gray-100" />
                    <div className="mt-4 h-40 animate-pulse rounded-2xl bg-gray-100" />
                </section>
                <section className="grid grid-cols-2 gap-3">
                    <div className="h-24 animate-pulse rounded-[20px] bg-white" />
                    <div className="h-24 animate-pulse rounded-[20px] bg-white" />
                    <div className="h-24 animate-pulse rounded-[20px] bg-white" />
                    <div className="h-24 animate-pulse rounded-[20px] bg-white" />
                </section>
            </div>
            <BottomNavigation />
        </main>
    );
}

export default function ProfilePage() {
    const selectableTitles = getSelectableProfileTitles();
    const titleById = new Map(selectableTitles.map((title) => [title.id, title]));
    const regularUnlockedTitles = selectableTitles.filter((title) => title.type !== "seasonal");
    const seasonalUnlockedTitles = selectableTitles.filter((title) => title.type === "seasonal");
    const fallbackPrimaryId = regularUnlockedTitles[0]?.id ?? DEFAULT_PROFILE_TITLE_IDS[0];
    const normalizeSelection = (selection: ProfileTitleSelection) => normalizeProfileTitleSelection(selection);

    const [titleSelection, setTitleSelection] = useState<ProfileTitleSelection>(() => {
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
                return normalizeSelection({
                    primaryId: ids[0] ?? fallbackPrimaryId,
                    secondaryIds: ids.slice(1, 3),
                    seasonalId: ids.length > 0 ? ids[ids.length - 1] : null,
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
    const [profilePseudo, setProfilePseudo] = useState("");
    const [profileFirstName, setProfileFirstName] = useState<string | null>(null);
    const [profileLastName, setProfileLastName] = useState<string | null>(null);
    const [sessionUserId, setSessionUserId] = useState<string | null>(null);
    const [profileUserId, setProfileUserId] = useState<string | null>(null);
    const [isProfileBootLoading, setIsProfileBootLoading] = useState(true);
    const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
    const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [pulseTotal, setPulseTotal] = useState(0);
    const pendingConnectionRequests = usePendingConnectionRequests();
    const [activitiesJoinedCount, setActivitiesJoinedCount] = useState(0);
    const [activitiesCreatedCount, setActivitiesCreatedCount] = useState(0);
    const [peopleMetCount, setPeopleMetCount] = useState(0);
    const [connectionsTotalCount, setConnectionsTotalCount] = useState(0);
    const [streakWeeks, setStreakWeeks] = useState(0);
    const [favoriteSport, setFavoriteSport] = useState("—");
    const [previousMonthlySummary, setPreviousMonthlySummary] = useState<{
        month_key: string;
        activities_count: number;
        streak_weeks: number;
        main_sport: string;
        pulse_gained: number;
        playzi_events?: number;
    } | null>(null);
    const [attendanceRate, setAttendanceRate] = useState(100);
    const [sportsBreakdown, setSportsBreakdown] = useState<SportBreakdownItem[]>([]);
    const [selectedSportKey, setSelectedSportKey] = useState<string | null>(null);
    const [playziEventsCount, setPlayziEventsCount] = useState(0);
    const [monthlyNotification, setMonthlyNotification] = useState<{ available: boolean; month_key: string; title: string; body: string } | null>(null);
    const [streakNotification, setStreakNotification] = useState<StreakNotification | null>(null);
    const [showMonthlyNotification, setShowMonthlyNotification] = useState(false);
    const [pulseSeriesByFilter, setPulseSeriesByFilter] = useState<SharedPulseSeries>(EMPTY_PULSE_SERIES);
    const [isTitleSelectionSyncReady, setIsTitleSelectionSyncReady] = useState(false);
    const [showPrimaryTitleInfo, setShowPrimaryTitleInfo] = useState(false);
    const [isModeratorPanelAllowed, setIsModeratorPanelAllowed] = useState(false);
    const [isModeratorResolved, setIsModeratorResolved] = useState(false);
    const [isPseudoCopied, setIsPseudoCopied] = useState(false);
    const [isProfileOnboardingStep, setIsProfileOnboardingStep] = useState(false);
    const galleryInputRef = useRef<HTMLInputElement | null>(null);
    const cameraInputRef = useRef<HTMLInputElement | null>(null);
    const avatarMenuRef = useRef<HTMLDivElement | null>(null);
    const titleServerSyncTimeoutRef = useRef<number | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const profileBootstrapRunRef = useRef(0);
    const localTitleSelectionRef = useRef<ProfileTitleSelection>(titleSelection);

    const isAdminStaffProfile = isModeratorResolved && isModeratorPanelAllowed;
    const rankData = getRankData(pulseTotal);
    const rankTheme = getRankTheme(rankData.rankLabel);
    const primaryTitle = titleById.get(titleSelection.primaryId);
    const secondaryTitles = titleSelection.secondaryIds
        .map((id) => titleById.get(id))
        .filter((title): title is NonNullable<typeof title> => Boolean(title));
    const seasonalTitle = titleSelection.seasonalId ? titleById.get(titleSelection.seasonalId) : undefined;
    const secondarySlotValues = [titleSelection.secondaryIds[0] ?? "", titleSelection.secondaryIds[1] ?? ""];
    const displayIdentity = formatDisplayIdentity(profileFirstName, profileLastName, profilePseudo || "");
    const onboardingDisplayIdentity = isProfileOnboardingStep ? "Guide Playzi" : displayIdentity;
    const onboardingPseudo = isProfileOnboardingStep ? "guideplayzi" : profilePseudo;
    const isProfileForCurrentSession = !!sessionUserId && profileUserId === sessionUserId;
    const canRenderProfileContent = !isProfileBootLoading && isModeratorResolved && isProfileForCurrentSession && profilePseudo.length > 0;
    const monthlyCardSummary = previousMonthlySummary || null;
    const selectedSportStats = useMemo(() => {
        if (!sportsBreakdown.length) return null;
        if (!selectedSportKey) return sportsBreakdown[0];
        return sportsBreakdown.find((item) => item.sport_key === selectedSportKey) || sportsBreakdown[0];
    }, [sportsBreakdown, selectedSportKey]);

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
        localTitleSelectionRef.current = titleSelection;
    }, [titleSelection]);

    useEffect(() => {
        if (!isProfileForCurrentSession) return;
        let cancelled = false;

        const loadServerTitleSelection = async () => {
            try {
                const res = await fetch(`/api/profile/titles?t=${Date.now()}`, { cache: "no-store" });
                if (!res.ok) {
                    if (!cancelled) setIsTitleSelectionSyncReady(true);
                    return;
                }
                const body = await res.json().catch(() => null);
                const serverSelection = normalizeSelection(body?.data?.selection as ProfileTitleSelection);
                const hasLocalSelection = typeof window !== "undefined" && !!window.localStorage.getItem(TITLES_STORAGE_KEY);
                const localSelection = normalizeSelection(localTitleSelectionRef.current);
                profileDebug("[PROFILE_DEBUG] profile page title selection reconcile", {
                    has_local_selection: hasLocalSelection,
                    local_selection: localSelection,
                    server_selection: serverSelection,
                });
                // Source of truth: always render the server selection first.
                if (!cancelled) {
                    setTitleSelection((prev) => (isSameProfileTitleSelection(prev, serverSelection) ? prev : serverSelection));
                }

                if (hasLocalSelection && !isSameProfileTitleSelection(localSelection, serverSelection)) {
                    const patchRes = await fetch("/api/profile/titles", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ selection: localSelection }),
                    }).catch(() => null);

                    const patchOk = !!patchRes?.ok;
                    profileDebug("[PROFILE_DEBUG] profile page title selection sync patch", {
                        attempted_selection: localSelection,
                        patch_ok: patchOk,
                        patch_status: patchRes?.status || null,
                    });

                    if (!cancelled && patchOk) {
                        setTitleSelection((prev) => (isSameProfileTitleSelection(prev, localSelection) ? prev : localSelection));
                    }
                }
            } finally {
                if (!cancelled) setIsTitleSelectionSyncReady(true);
            }
        };

        void loadServerTitleSelection();
        return () => { cancelled = true; };
    }, [isProfileForCurrentSession]);

    useEffect(() => {
        if (!isTitleSelectionSyncReady || !isProfileForCurrentSession) return;
        if (titleServerSyncTimeoutRef.current) {
            window.clearTimeout(titleServerSyncTimeoutRef.current);
        }
        titleServerSyncTimeoutRef.current = window.setTimeout(() => {
            void fetch("/api/profile/titles", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ selection: titleSelection }),
            }).catch(() => null);
        }, 250);
        return () => {
            if (titleServerSyncTimeoutRef.current) {
                window.clearTimeout(titleServerSyncTimeoutRef.current);
            }
        };
    }, [titleSelection, isTitleSelectionSyncReady, isProfileForCurrentSession]);

    useEffect(() => {
        let mounted = true;
        const bootstrapProfile = async () => {
            const runId = Date.now();
            profileBootstrapRunRef.current = runId;
            setIsProfileBootLoading(true);
            setIsModeratorResolved(false);
            // Prevent stale account data flash when switching sessions.
            setSessionUserId(null);
            setProfileUserId(null);
            setProfilePseudo("");
            setProfileFirstName(null);
            setProfileLastName(null);
            setAvatarUrl(null);
            setIsModeratorPanelAllowed(false);
            setPulseTotal(0);
            setActivitiesJoinedCount(0);
            setActivitiesCreatedCount(0);
            setPeopleMetCount(0);
            setConnectionsTotalCount(0);
            setStreakWeeks(0);
            setFavoriteSport("—");
            setPreviousMonthlySummary(null);
            setAttendanceRate(100);
            setSportsBreakdown([]);
            setSelectedSportKey(null);
            setPlayziEventsCount(0);
            setMonthlyNotification(null);
            setStreakNotification(null);
            setShowMonthlyNotification(false);
            setPulseSeriesByFilter(EMPTY_PULSE_SERIES);

            try {
                const [profileRes, moderatorRes] = await Promise.all([
                    fetch(`/api/auth/me?t=${Date.now()}`, { cache: "no-store" }),
                    fetch(`/api/admin/moderation/whoami?t=${Date.now()}`, { cache: "no-store" })
                ]);
                if (!mounted || profileBootstrapRunRef.current !== runId) return;

                if (profileRes.ok) {
                    const json = await profileRes.json().catch(() => null);
                    const user = json?.data?.user;
                    const userId = typeof user?.id === "string" ? user.id : null;
                    const pseudo = typeof user?.pseudo === "string" ? user.pseudo : "";
                    const firstName = typeof user?.first_name === "string" ? user.first_name : null;
                    const lastName = typeof user?.last_name === "string" ? user.last_name : null;
                    const avatar = typeof user?.avatar_url === "string" && user.avatar_url.length > 0 ? user.avatar_url : null;
                    setSessionUserId(userId);
                    setProfileUserId(userId);
                    setProfilePseudo(pseudo);
                    setProfileFirstName(firstName);
                    setProfileLastName(lastName);
                    setAvatarUrl(avatar);
                }

                if (moderatorRes.ok) {
                    const body = await moderatorRes.json().catch(() => null);
                    setIsModeratorPanelAllowed(!!body?.data?.moderator_access?.allowed);
                }
            } catch {
                // Keep safe fallback states.
            } finally {
                if (!mounted || profileBootstrapRunRef.current !== runId) return;
                setIsModeratorResolved(true);
                setIsProfileBootLoading(false);
            }
        };

        void bootstrapProfile();
        const onFocus = () => { void bootstrapProfile(); };
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void bootstrapProfile();
            }
        };
        window.addEventListener("focus", onFocus);
        window.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            mounted = false;
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);

    useEffect(() => {
        const loadPulse = async () => {
            try {
                const res = await fetch(`/api/pulse/me?t=${Date.now()}`, { cache: "no-store" });
                if (!res.ok) return;
                const json = await res.json();
                const data = json?.data;
                if (typeof data?.total_pulse === "number") {
                    setPulseTotal(data.total_pulse);
                }
                const series = data?.series;
                if (series?.["1M"] && series?.["3M"] && series?.["6M"] && series?.["1A"]) {
                    setPulseSeriesByFilter(series as SharedPulseSeries);
                }
            } catch {
                // Ignore pulse loading errors and keep fallback values.
            }
        };
        void loadPulse();
        const onFocus = () => { void loadPulse(); };
        const onNotificationsChanged = () => { void loadPulse(); };
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void loadPulse();
            }
        };
        const intervalId = window.setInterval(() => { void loadPulse(); }, 15000);
        window.addEventListener("focus", onFocus);
        window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
        window.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
            window.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);

    useEffect(() => {
        const loadProfileStats = async () => {
            try {
                const res = await fetch(`/api/profile/stats?t=${Date.now()}`, { cache: "no-store" });
                if (!res.ok) return;
                const json = await res.json();
                const stats = json?.data;
                setActivitiesJoinedCount(Math.max(0, Number(stats?.activities_joined || 0)));
                setActivitiesCreatedCount(Math.max(0, Number(stats?.activities_created || 0)));
                setPeopleMetCount(Math.max(0, Number(stats?.people_met || 0)));
                setConnectionsTotalCount(Math.max(0, Number(stats?.connections_total || 0)));
                setStreakWeeks(Math.max(0, Number(stats?.streak_weeks || 0)));
                setFavoriteSport(typeof stats?.favorite_sport === "string" && stats.favorite_sport.trim() ? stats.favorite_sport : "—");
                setPreviousMonthlySummary(stats?.previous_month_summary || null);
                setAttendanceRate(Math.max(0, Math.min(100, Number(stats?.stats?.attendance_rate ?? 100))));
                setSportsBreakdown(parseSportBreakdown(stats?.sports_breakdown));
                setPlayziEventsCount(Math.max(0, Number(stats?.stats?.playzi_events ?? 0)));
                setMonthlyNotification(stats?.monthly_notification || null);
                setStreakNotification(stats?.streak_notification || null);
            } catch {
                // Keep current values
            }
        };

        void loadProfileStats();
        const onFocus = () => { void loadProfileStats(); };
        const onNotificationsChanged = () => { void loadProfileStats(); };
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void loadProfileStats();
            }
        };
        const intervalId = window.setInterval(() => { void loadProfileStats(); }, 15000);
        window.addEventListener("focus", onFocus);
        window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
        window.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
            window.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);

    useEffect(() => {
        if (sportsBreakdown.length === 0) {
            setSelectedSportKey(null);
            return;
        }
        if (!selectedSportKey || !sportsBreakdown.some((item) => item.sport_key === selectedSportKey)) {
            setSelectedSportKey(sportsBreakdown[0].sport_key);
        }
    }, [sportsBreakdown, selectedSportKey]);

    useEffect(() => {
        setShowMonthlyNotification(!!monthlyNotification?.available && !!monthlyNotification?.month_key);
    }, [monthlyNotification]);

    const acknowledgeMonthlySummary = async (monthKey: string) => {
        await fetch("/api/profile/monthly-summary/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ month_key: monthKey }),
        }).catch(() => null);
    };

    useEffect(() => {
        const loadPendingRequests = async () => {
            await refreshPendingConnectionRequests();
        };

        void loadPendingRequests();
        const onFocus = () => { void loadPendingRequests(); };
        const onNotificationsChanged = () => { void loadPendingRequests(); };
        window.addEventListener("focus", onFocus);
        window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
        return () => {
            window.removeEventListener("focus", onFocus);
            window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onNotificationsChanged);
        };
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
                    facingMode: { ideal: cameraFacingMode }
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

    const switchCameraFacing = async () => {
        if (!navigator.mediaDevices?.getUserMedia || isSwitchingCamera) return;
        setIsSwitchingCamera(true);
        setCameraError(null);
        const nextMode: "environment" | "user" = cameraFacingMode === "environment" ? "user" : "environment";
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: nextMode },
                },
                audio: false,
            });
            stopCameraStream();
            cameraStreamRef.current = stream;
            setCameraFacingMode(nextMode);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(() => undefined);
            }
        } catch {
            setCameraError("Impossible de basculer la caméra.");
        } finally {
            setIsSwitchingCamera(false);
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
        if (!onboardingPseudo) return;
        try {
            await navigator.clipboard.writeText(`@${onboardingPseudo}`);
            setIsPseudoCopied(true);
            window.setTimeout(() => setIsPseudoCopied(false), 1600);
        } catch {
            setAvatarError("Impossible de copier le pseudo pour le moment.");
        }
    };

    useEffect(() => {
        const syncTutorialProfileStep = () => {
            const snapshot = getTutorialModeSnapshot();
            setIsProfileOnboardingStep(Boolean(snapshot.enabled && snapshot.stepId === "profile-overview"));
        };
        syncTutorialProfileStep();
        window.addEventListener(PLAYZI_TUTORIAL_MODE_CHANGED_EVENT, syncTutorialProfileStep);
        return () => window.removeEventListener(PLAYZI_TUTORIAL_MODE_CHANGED_EVENT, syncTutorialProfileStep);
    }, []);

    if (!canRenderProfileContent) {
        return <ProfileSkeleton />;
    }

    return (
        <main data-onboarding-id="profile-root" className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-x-hidden overflow-y-hidden bg-[#F5F7F6]">
            <Header />

            <div className="flex-1 overflow-x-hidden overflow-y-auto px-4 pt-20 pb-28 space-y-5">
                <section data-onboarding-id="profile-onboarding-focus" className={cn("relative flex min-h-[220px] flex-col rounded-[26px] border bg-white p-5 shadow-sm", isAdminStaffProfile ? "border-amber-200" : rankTheme.rankAccentBorder)}>
                    <div className="flex flex-1 items-start gap-3.5">
                        <div ref={avatarMenuRef} className="relative">
                            <div className="relative h-16 w-16">
                                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gray-100">
                                    {isProfileOnboardingStep ? (
                                        <span className="inline-flex items-end text-[34px] font-black leading-none tracking-[-0.03em] text-[#0F172A]">
                                            P<span className="ml-0.5 text-[#10B981]">.</span>
                                        </span>
                                    ) : (avatarPreviewUrl || avatarUrl) ? (
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
                            <div className="flex min-w-0 items-center gap-2">
                                <h1 className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[22px] font-black leading-tight text-[#242841]">{onboardingDisplayIdentity}{isAdminStaffProfile ? " 🛡️" : ""}</h1>
                            </div>
                            <div className="mt-0 min-h-[14px]">
                                <button
                                    type="button"
                                    onClick={() => void copyPseudoToClipboard()}
                                    className="truncate text-[10px] font-medium leading-none text-gray-500 transition hover:text-gray-600 active:opacity-80"
                                    aria-label="Copier le pseudo"
                                >
                                    @{onboardingPseudo}
                                </button>
                                {isPseudoCopied && (
                                    <span className="ml-2 text-[10px] font-semibold text-emerald-600">Copié</span>
                                )}
                            </div>
                            {isAdminStaffProfile ? (
                                <div className="mt-3">
                                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-black text-amber-800">
                                        🛡️ Playzi Staff
                                        <span className="rounded-full border border-amber-400 bg-white px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
                                            LEGENDARY
                                        </span>
                                    </span>
                                </div>
                            ) : (
                                <>
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
                                </>
                            )}
                        </div>
                        {!isAdminStaffProfile && (
                            <div className="shrink-0 pt-0.5">
                                <span className={cn("inline-flex h-[18px] items-center justify-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide leading-none", rankTheme.rankText, rankTheme.rankAccentBorder, "bg-white")}>
                                    {rankData.rankLabel}
                                </span>
                            </div>
                        )}
                    </div>
                    {!isAdminStaffProfile && (
                        <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Saison 2 - Printemps 2026</p>
                    )}
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

                {!isAdminStaffProfile && showMonthlyNotification && monthlyNotification && (
                    <Link
                        href={`/profil/resume-mensuel?month=${encodeURIComponent(monthlyNotification.month_key)}`}
                        onClick={() => {
                            setShowMonthlyNotification(false);
                            void acknowledgeMonthlySummary(monthlyNotification.month_key);
                        }}
                        className="flex items-center justify-between rounded-[20px] border border-emerald-200 bg-emerald-50/70 px-4 py-3 shadow-sm"
                    >
                        <div>
                            <p className="text-[13px] font-black text-[#242841]">{monthlyNotification.title}</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-gray-600">{monthlyNotification.body}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-emerald-600" />
                    </Link>
                )}
                {!isAdminStaffProfile && streakNotification?.available && (
                    <div className="flex items-center justify-between rounded-[20px] border border-rose-200 bg-rose-50/70 px-4 py-3 shadow-sm">
                        <div>
                            <p className="text-[13px] font-black text-[#242841]">{streakNotification.title}</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-gray-600">{streakNotification.body}</p>
                        </div>
                        <Flame className="h-5 w-5 text-rose-500" />
                    </div>
                )}

                {isAdminStaffProfile && (
                    <section className="rounded-[26px] border border-amber-200 bg-white p-5 shadow-sm">
                        <h3 className="text-[16px] font-black text-[#242841]">Administration</h3>
                        <p className="mt-1 text-[12px] font-medium text-gray-500">
                            Accès rapide au panel de modération.
                        </p>
                        <Link
                            href="/admin/moderation"
                            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-[13px] font-black text-amber-700 hover:bg-amber-100"
                        >
                            🛡️ Moderation
                        </Link>
                    </section>
                )}

                {!isAdminStaffProfile && (
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
                )}

                <PulseEvolutionCard
                    title={isAdminStaffProfile ? "Pulse" : "Évolution Pulse"}
                    seriesByFilter={pulseSeriesByFilter}
                    initialFilter="1M"
                />

                {!isAdminStaffProfile && (
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
                )}

                <section className="grid grid-cols-2 gap-3">
                    {isAdminStaffProfile && (
                        <div className="col-span-2">
                            <h3 className="text-[18px] font-black text-[#242841]">Statistiques</h3>
                        </div>
                    )}
                    {!isAdminStaffProfile && (
                    <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                            <PulsePeIcon />
                        </div>
                        <p className="text-[19px] font-black text-[#242841]">{rankData.currentPulse}</p>
                        <p className="mt-1 text-[11px] font-semibold text-gray-500">Pulse</p>
                    </article>
                    )}

                    <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <Activity className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="space-y-1.5 text-[11px] font-semibold text-gray-500">
                            <div className="flex items-center justify-between">
                                <span>Activités rejointes</span>
                                <span className="text-[17px] font-black leading-none text-[#242841]">{activitiesJoinedCount}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Activités créées</span>
                                <span className="text-[17px] font-black leading-none text-[#242841]">{activitiesCreatedCount}</span>
                            </div>
                        </div>
                    </article>

                    <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <Users className="h-4 w-4 text-gray-500" />
                        </div>
                        <p className="text-[19px] font-black text-[#242841]">{peopleMetCount}</p>
                        <p className="mt-1 text-[11px] font-semibold text-gray-500">Personnes rencontrées</p>
                    </article>

                    <Link
                        href="/profil/connexions"
                        className="relative rounded-[20px] border border-emerald-100 bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <Network className="h-4 w-4 text-gray-500" />
                        </div>
                        <p className="text-[19px] font-black text-[#242841]">{connectionsTotalCount}</p>
                        <div className="mt-1 flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-gray-500">Connexions</p>
                            <ChevronRight className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        {pendingConnectionRequests > 0 && (
                            <span className="absolute top-4 right-4 inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-blue-400/90 text-white text-[10px] font-black border border-white shadow-[0_1px_3px_rgba(59,130,246,0.16)]">
                                {pendingConnectionRequests > 1 ? (pendingConnectionRequests > 9 ? "9+" : pendingConnectionRequests) : null}
                            </span>
                        )}
                    </Link>
                </section>

                {!isAdminStaffProfile && (
                <section className="grid grid-cols-2 gap-3">
                    <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <Star className="h-4 w-4 text-gray-500" />
                        </div>
                        <p className="text-[19px] font-black text-[#242841]">{favoriteSport}</p>
                        <p className="mt-1 text-[11px] font-semibold text-gray-500">Sport préféré</p>
                    </article>

                    <Link
                        href={monthlyCardSummary?.month_key ? `/profil/resume-mensuel?month=${encodeURIComponent(monthlyCardSummary.month_key)}` : "/profil/resume-mensuel"}
                        className="rounded-[20px] border border-[#CFEFE6] bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <FileText className="h-4 w-4 text-gray-500" />
                        </div>
                        <p className="text-[16px] font-black text-[#242841]">Résumé mensuel</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-gray-500">
                            {monthlyCardSummary?.month_key
                                ? `${new Date(`${monthlyCardSummary.month_key}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} · ${monthlyCardSummary.activities_count} activités`
                                : "Mois précédent"}
                        </p>
                        <div className="mt-1 flex items-center justify-end">
                            <ChevronRight className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                    </Link>

                    <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <CalendarCheck2 className="h-4 w-4 text-gray-500" />
                        </div>
                        <p className="text-[19px] font-black text-[#242841]">{attendanceRate}%</p>
                        <p className="mt-1 text-[11px] font-semibold text-gray-500">Taux de présence</p>
                    </article>

                    <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <PlayziEventsIcon />
                        </div>
                        <p className="text-[19px] font-black text-[#242841]">{playziEventsCount}</p>
                        <p className="mt-1 text-[11px] font-semibold text-gray-500">Événements Playzi</p>
                    </article>
                </section>
                )}

                {!isAdminStaffProfile && (
                <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <h3 className="text-[16px] font-black text-[#242841]">Sports pratiqués</h3>
                    <div className="mt-3 overflow-x-auto no-scrollbar">
                        <div className="flex w-max min-w-full gap-2 pb-1">
                            {sportsBreakdown.length === 0 && (
                                <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-[12px] font-bold text-gray-500">Aucun sport</span>
                            )}
                            {sportsBreakdown.map((sport) => {
                                const isActive = selectedSportStats?.sport_key === sport.sport_key;
                                return (
                                    <button
                                        key={sport.sport_key}
                                        type="button"
                                        onClick={() => setSelectedSportKey(sport.sport_key)}
                                        className={cn(
                                            "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-bold transition",
                                            isActive
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                : "border-gray-100 bg-gray-50 text-gray-700"
                                        )}
                                    >
                                        {sport.sport_label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="relative mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                        <div className="space-y-2">
                            <p className="text-[12px] font-bold text-gray-700">
                                {selectedSportStats ? selectedSportStats.sport_label : "Par sport"}
                            </p>
                            {selectedSportStats?.metrics?.length ? selectedSportStats.metrics.map((metric) => (
                                <div key={`${selectedSportStats.sport_key}-${metric.key}`} className="flex items-center justify-between text-[12px] font-semibold text-gray-500">
                                    <span className="capitalize">{metric.label}</span>
                                    <span>
                                        {Math.round(Number(metric.value || 0)).toLocaleString("fr-FR")}
                                        {metric.unit ? ` ${metric.unit}` : ""}
                                    </span>
                                </div>
                            )) : (
                                <p className="text-[12px] font-semibold text-gray-500">Aucune statistique disponible.</p>
                            )}
                        </div>
                    </div>
                </section>
                )}
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
                                onClick={() => void switchCameraFacing()}
                                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-600 disabled:opacity-50"
                                disabled={isSwitchingCamera}
                                aria-label="Basculer caméra avant/arrière"
                            >
                                <RefreshCw className={cn("h-3.5 w-3.5", isSwitchingCamera && "animate-spin")} />
                                {cameraFacingMode === "environment" ? "Selfie" : "Arrière"}
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
