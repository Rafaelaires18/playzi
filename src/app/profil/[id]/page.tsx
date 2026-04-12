"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, UserRound, Network, Activity as ActivityIcon, Star, Trophy } from "lucide-react";
import Header from "@/components/Header";
import PulseEvolutionCard, { PulseSeries as SharedPulseSeries } from "@/components/profile/PulseEvolutionCard";
import { getSelectableProfileTitles, rarityTone } from "@/lib/titles";
import { normalizeProfileTitleSelection, ProfileTitleSelection } from "@/lib/profile-title-selection";
import { cn } from "@/lib/utils";

type ConnectionState = "self" | "connected" | "outgoing_pending" | "incoming_pending" | "none";
type PublicProfile = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    pseudo: string;
    avatar_url: string | null;
    grade?: string | null;
    total_pulse: number;
    rank_label: string;
};

type PublicStats = {
    connections: number;
    joined_activities: number;
    created_activities: number;
};

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
const PROFILE_DEBUG_ENABLED = process.env.NODE_ENV !== "production";

function profileDebug(...args: unknown[]) {
    if (!PROFILE_DEBUG_ENABLED) return;
    console.log(...args);
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
        };
    }
    if (rankLabel.startsWith("Argent")) {
        return {
            rankText: "text-[#7E8796]",
            rankAccentBorder: "border-[#DCE2EA]",
            progressFrom: "#9CA6B7",
            progressTo: "#C0C8D4",
        };
    }
    if (rankLabel.startsWith("Or")) {
        return {
            rankText: "text-[#B68A34]",
            rankAccentBorder: "border-[#F1E5C3]",
            progressFrom: "#C89A3D",
            progressTo: "#DFC588",
        };
    }
    return {
        rankText: "text-[#4F7EA7]",
        rankAccentBorder: "border-[#D6E8F6]",
        progressFrom: "#6699C8",
        progressTo: "#9FC1DE",
    };
}

function formatIdentity(profile: PublicProfile) {
    const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    return fullName || profile.pseudo;
}

function getIdentityTextClass(identity: string) {
    if (identity.length > 26) return "text-[18px]";
    if (identity.length > 20) return "text-[20px]";
    return "text-[22px]";
}

function normalizePulseSeries(raw: unknown): SharedPulseSeries {
    if (!raw || typeof raw !== "object") return EMPTY_PULSE_SERIES;
    const source = raw as Partial<Record<"1M" | "3M" | "6M" | "1A", unknown>>;
    const normalizeFilter = (filter: "1M" | "3M" | "6M" | "1A") => {
        const rows = source[filter];
        if (!Array.isArray(rows) || rows.length === 0) return EMPTY_PULSE_SERIES[filter];
        return rows.map((row, index) => {
            const item = row as { label?: unknown; value?: unknown; date_ms?: unknown };
            const label = typeof item?.label === "string" && item.label.trim().length > 0
                ? item.label
                : EMPTY_PULSE_SERIES[filter][index]?.label || `${filter}${index + 1}`;
            const value = Number(item?.value);
            const dateMs = Number(item?.date_ms);
            return { label, value: Number.isFinite(value) ? value : 0, date_ms: Number.isFinite(dateMs) ? dateMs : undefined };
        });
    };
    return {
        "1M": normalizeFilter("1M"),
        "3M": normalizeFilter("3M"),
        "6M": normalizeFilter("6M"),
        "1A": normalizeFilter("1A"),
    };
}

function PulsePeIcon() {
    return (
        <svg viewBox="0 0 32 32" aria-hidden="true" className="h-5 w-5">
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

export default function PublicProfilePage() {
    const params = useParams();
    const router = useRouter();
    const rawProfileId = params.id;
    const profileId = Array.isArray(rawProfileId) ? rawProfileId[0] : rawProfileId;
    const selectableTitles = getSelectableProfileTitles();

    const [profile, setProfile] = useState<PublicProfile | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>("none");
    const [stats, setStats] = useState<PublicStats>({ connections: 0, joined_activities: 0, created_activities: 0 });
    const [favoriteSport, setFavoriteSport] = useState<string>("—");
    const [pulseSeries, setPulseSeries] = useState<SharedPulseSeries>(EMPTY_PULSE_SERIES);
    const [titleSelection, setTitleSelection] = useState<ProfileTitleSelection>(() => normalizeProfileTitleSelection(null));
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);
    const [isUnblocking, setIsUnblocking] = useState(false);
    const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
    const [isBlockedByMe, setIsBlockedByMe] = useState(false);
    const [isMasked, setIsMasked] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!profileId || typeof profileId !== "string") {
            setError("Profil introuvable");
            setIsLoading(false);
            profileDebug("[PROFILE_NAV_DEBUG] invalid profileId param", {
                received_profile_id: profileId || null,
            });
            return;
        }
        let isCancelled = false;
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                profileDebug("[PROFILE_NAV_DEBUG] profile page opened", {
                    received_profile_id: profileId,
                });
                const blocksRes = await fetch("/api/blocks", { cache: "no-store" });
                const blocksBody = await blocksRes.json().catch(() => null);
                const blockedUsers = Array.isArray(blocksBody?.data?.blocked_users) ? blocksBody.data.blocked_users : [];
                const alreadyBlocked = blockedUsers.some((row: { id?: string }) => row?.id === profileId);

                if (!isCancelled) {
                    setIsBlockedByMe(alreadyBlocked);
                    setIsMasked(alreadyBlocked);
                }

                if (alreadyBlocked) {
                    if (!isCancelled) setIsLoading(false);
                    return;
                }

                profileDebug("[PROFILE_NAV_DEBUG] profile fetch start", {
                    fetch_profile_user_id: profileId,
                    graph_user_id: profileId,
                    pulse_total_user_id: profileId,
                    stats_user_id: profileId,
                    connections_user_id: profileId,
                    favorite_sport_user_id: profileId,
                });
                const res = await fetch(`/api/profiles/${profileId}`, { cache: "no-store" });
                const body = await res.json().catch(() => null);
                if (!res.ok) throw new Error(body?.error || "Impossible de charger le profil");

                if (!isCancelled) {
                    const nextTitleSelection = normalizeProfileTitleSelection(body?.data?.title_selection || null);
                    profileDebug("[PROFILE_NAV_DEBUG] visited profile payload", {
                        requested_profile_id: profileId,
                        response_profile_id: body?.data?.profile?.id || null,
                        title_selection: nextTitleSelection,
                        pulse_series_sizes: {
                            "1M": Array.isArray(body?.data?.pulse_series?.["1M"]) ? body.data.pulse_series["1M"].length : 0,
                            "3M": Array.isArray(body?.data?.pulse_series?.["3M"]) ? body.data.pulse_series["3M"].length : 0,
                            "6M": Array.isArray(body?.data?.pulse_series?.["6M"]) ? body.data.pulse_series["6M"].length : 0,
                            "1A": Array.isArray(body?.data?.pulse_series?.["1A"]) ? body.data.pulse_series["1A"].length : 0,
                        },
                    });
                    profileDebug("[PROFILE_NAV_DEBUG] profile fetch success", {
                        requested_profile_id: profileId,
                        response_profile_id: body?.data?.profile?.id || null,
                    });
                    setProfile(body?.data?.profile || null);
                    setConnectionState((body?.data?.connection_state || "none") as ConnectionState);
                    setStats(body?.data?.stats || { connections: 0, joined_activities: 0, created_activities: 0 });
                    setPulseSeries(normalizePulseSeries(body?.data?.pulse_series));
                    setTitleSelection(nextTitleSelection);
                    setFavoriteSport(typeof body?.data?.favorite_sport === "string" ? body.data.favorite_sport : "—");
                }
            } catch (e) {
                if (!isCancelled) setError(e instanceof Error ? e.message : "Erreur inconnue");
            } finally {
                if (!isCancelled) setIsLoading(false);
            }
        };
        void load();
        return () => { isCancelled = true; };
    }, [profileId]);

    const buttonLabel = useMemo(() => {
        if (connectionState === "connected") return "Connecté";
        if (connectionState === "outgoing_pending") return "Demande envoyée";
        if (connectionState === "incoming_pending") return "Voir la demande";
        return "Demander la connexion";
    }, [connectionState]);

    const isPrimaryDisabled = connectionState === "connected" || connectionState === "outgoing_pending" || connectionState === "self";
    const rankData = getRankData(profile?.total_pulse || 0);
    const rankTheme = getRankTheme(rankData.rankLabel);
    const displayIdentity = profile ? formatIdentity(profile) : "";
    const identityTextClass = getIdentityTextClass(displayIdentity);
    const titleById = new Map(selectableTitles.map((title) => [title.id, title]));
    const primaryTitle = titleById.get(titleSelection.primaryId);
    const subtitleTitles = titleSelection.secondaryIds
        .map((id) => titleById.get(id))
        .filter((title): title is NonNullable<typeof title> => Boolean(title));
    const seasonalTitle = titleSelection.seasonalId ? titleById.get(titleSelection.seasonalId) : undefined;

    const handleCreateConnection = async () => {
        if (!profile || isSending) return;
        if (connectionState === "incoming_pending") {
            router.push("/profil/connexions");
            return;
        }

        setIsSending(true);
        setError(null);
        try {
            const res = await fetch("/api/connections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ receiver_id: profile.id }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Impossible d'envoyer la demande");

            const status = body?.data?.status as string | undefined;
            if (status === "request_sent" || status === "already_requested") {
                setConnectionState("outgoing_pending");
            } else if (status === "already_connected") {
                setConnectionState("connected");
            } else if (status === "incoming_request_exists") {
                setConnectionState("incoming_pending");
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur inconnue");
        } finally {
            setIsSending(false);
        }
    };

    const handleBlockUser = async () => {
        if (!profile || isBlocking) return;
        setIsBlocking(true);
        try {
            const res = await fetch("/api/blocks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target_user_id: profile.id }),
            });
            if (!res.ok) {
                throw new Error("Impossible d'appliquer ce blocage");
            }
            setIsMasked(true);
            setIsBlockedByMe(true);
            setFeedback("Utilisateur masqué");
            window.setTimeout(() => router.replace("/discover"), 260);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur inconnue");
        } finally {
            setIsBlocking(false);
            setIsBlockConfirmOpen(false);
        }
    };

    const handleUnblockUser = async () => {
        if (!profileId || isUnblocking) return;
        setIsUnblocking(true);
        try {
            const res = await fetch(`/api/blocks/${profileId}`, { method: "DELETE" });
            if (!res.ok) {
                throw new Error("Impossible de débloquer cet utilisateur");
            }
            setIsBlockedByMe(false);
            setIsMasked(false);
            setFeedback("Utilisateur débloqué");
            window.setTimeout(() => setFeedback(null), 1200);
            window.setTimeout(() => {
                router.refresh();
            }, 220);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur inconnue");
        } finally {
            setIsUnblocking(false);
        }
    };

    useEffect(() => {
        if (!profileId || typeof profileId !== "string") return;
        let cancelled = false;
        const resolveSelfProfile = async () => {
            try {
                const res = await fetch(`/api/auth/me?t=${Date.now()}`, { cache: "no-store" });
                const body = await res.json().catch(() => null);
                const sessionUserId = typeof body?.data?.user?.id === "string" ? body.data.user.id : null;
                profileDebug("[PROFILE_NAV_DEBUG] self-profile check", {
                    session_user_id: sessionUserId,
                    received_profile_id: profileId,
                });
                if (!cancelled && sessionUserId && sessionUserId === profileId) {
                    router.replace("/profil");
                }
            } catch {
                // Keep current screen if auth bootstrap fails.
            }
        };
        void resolveSelfProfile();
        return () => { cancelled = true; };
    }, [profileId, router]);

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F5F7F6]">
            <Header />

            <div className="flex-1 overflow-y-auto px-4 pb-8 pt-20">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-600"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                </button>

                {isLoading && (
                    <div className="animate-pulse space-y-3">
                        <div className="h-36 rounded-[22px] bg-white" />
                        <div className="h-24 rounded-[22px] bg-white" />
                    </div>
                )}

                {!isLoading && error && (
                    <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-[12px] font-semibold text-rose-600">{error}</p>
                )}

                {!isLoading && !error && isBlockedByMe && (
                    <div className="space-y-3">
                        <section className="rounded-[22px] border border-gray-100 bg-white p-5 shadow-sm">
                            <p className="text-[16px] font-black text-[#242841]">Utilisateur masqué</p>
                            <p className="mt-1 text-[12px] font-semibold text-gray-500">
                                Cet utilisateur est masqué et ne voit plus tes activités.
                            </p>
                            <div className="mt-4 flex gap-2">
                                <button
                                    type="button"
                                    className="h-10 flex-1 rounded-xl border border-gray-200 bg-gray-100 text-[13px] font-bold text-gray-500"
                                    disabled
                                >
                                    Utilisateur masqué
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleUnblockUser()}
                                    className="h-10 flex-1 rounded-xl border border-gray-200 bg-white text-[13px] font-bold text-gray-700 disabled:opacity-60"
                                    disabled={isUnblocking}
                                >
                                    {isUnblocking ? "..." : "Débloquer"}
                                </button>
                            </div>
                        </section>
                    </div>
                )}

                {!isLoading && !error && profile && !isBlockedByMe && (
                    <div className="space-y-3">
                        <section className={cn("relative flex min-h-[220px] flex-col rounded-[26px] border bg-white p-5 shadow-sm", rankTheme.rankAccentBorder)}>
                            <div className="flex flex-1 items-start gap-3.5">
                                <div className="flex flex-1 items-start gap-3.5 min-w-0">
                                    <div className="relative">
                                        <div className="relative h-16 w-16">
                                            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gray-100">
                                                {profile.avatar_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={profile.avatar_url} alt={profile.pseudo} className="h-full w-full object-cover" />
                                                ) : (
                                                    <UserRound className="h-8 w-8 text-gray-400" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <h1 className={cn("min-w-0 max-w-full flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[22px] font-black leading-tight text-[#242841]", identityTextClass)} title={displayIdentity}>
                                                {displayIdentity}
                                            </h1>
                                        </div>
                                        <div className="mt-0 min-h-[14px]">
                                            <p className="truncate text-[10px] font-medium leading-none text-gray-500">@{profile.pseudo}</p>
                                        </div>
                                        <div className="mt-2 min-h-[38px]">
                                            {primaryTitle ? (
                                                <div className={cn("inline-flex w-full items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-bold", primaryTitle.type === "seasonal" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : rarityTone(primaryTitle.rarity))}>
                                                    <Trophy className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">{primaryTitle.label}</span>
                                                </div>
                                            ) : (
                                                <span className="inline-flex h-[38px] w-full rounded-full border border-gray-100 bg-gray-50/70" />
                                            )}
                                        </div>
                                        <div className="min-h-[18px]">
                                            {subtitleTitles.length > 0 ? (
                                                <p className="truncate text-[11px] font-semibold text-gray-500">
                                                    {subtitleTitles.map((title) => title.label).join(" • ")}
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
                                <div className="shrink-0 pt-0.5">
                                    <span className={cn("inline-flex h-[18px] items-center justify-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide leading-none bg-white", rankTheme.rankText, rankTheme.rankAccentBorder)}>
                                        {rankData.rankLabel}
                                    </span>
                                </div>
                            </div>

                            {connectionState !== "self" && (
                                <button
                                    type="button"
                                    disabled={isPrimaryDisabled || isSending}
                                    onClick={handleCreateConnection}
                                    className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/40 px-4 text-[12px] font-bold text-[#242841] disabled:cursor-not-allowed disabled:opacity-75"
                                >
                                    <Network className="h-4 w-4 text-gray-500" />
                                    {isSending ? "Envoi..." : buttonLabel}
                                </button>
                            )}
                            <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Saison 2 - Printemps 2026</p>
                        </section>

                        <PulseEvolutionCard title="Évolution Pulse" seriesByFilter={pulseSeries} initialFilter="1M" />

                        <section className="grid grid-cols-2 gap-3">
                            <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                                    <PulsePeIcon />
                                </div>
                                <p className="text-[19px] font-black text-[#242841]">{rankData.currentPulse}</p>
                                <p className="mt-1 text-[11px] font-semibold text-gray-500">Pulse total</p>
                            </article>
                            <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                                    <ActivityIcon className="h-4 w-4 text-gray-500" />
                                </div>
                                <p className="text-[12px] font-semibold text-gray-600">Rejointes: <span className="font-black text-[#242841]">{stats.joined_activities}</span></p>
                                <p className="mt-1 text-[12px] font-semibold text-gray-600">Créées: <span className="font-black text-[#242841]">{stats.created_activities}</span></p>
                            </article>
                            <article className="rounded-[20px] border border-emerald-100 bg-white p-4 shadow-sm text-left">
                                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                                    <Network className="h-4 w-4 text-gray-500" />
                                </div>
                                <p className="text-[19px] font-black text-[#242841]">{stats.connections}</p>
                                <p className="mt-1 text-[11px] font-semibold text-gray-500">Connexions</p>
                            </article>
                            <article className="rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                                    <Star className="h-4 w-4 text-gray-500" />
                                </div>
                                <p className="text-[19px] font-black text-[#242841]">{favoriteSport}</p>
                                <p className="mt-1 text-[11px] font-semibold text-gray-500">Sport préféré</p>
                            </article>
                        </section>

                        {connectionState !== "self" && (
                            <section className="pt-1">
                                <button
                                    type="button"
                                    onClick={() => setIsBlockConfirmOpen(true)}
                                    className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-bold text-rose-700 disabled:opacity-70"
                                    disabled={isMasked}
                                >
                                    {isMasked ? "Utilisateur masqué" : "Ne plus voir cet utilisateur"}
                                </button>
                            </section>
                        )}
                    </div>
                )}
            </div>

            {feedback && (
                <div className="pointer-events-none fixed bottom-24 left-1/2 z-[130] -translate-x-1/2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 shadow-sm">
                    {feedback}
                </div>
            )}

            {isBlockConfirmOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4">
                    <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
                        <h2 className="text-[17px] font-black text-[#242841]">Confirmer le blocage</h2>
                        <p className="mt-2 text-[13px] font-medium leading-relaxed text-gray-500">
                            Tu ne verras plus cet utilisateur et il ne verra plus tes activités.
                        </p>
                        <div className="mt-4 flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsBlockConfirmOpen(false)}
                                className="h-10 flex-1 rounded-xl border border-gray-200 bg-white text-[13px] font-bold text-gray-600"
                                disabled={isBlocking}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleBlockUser()}
                                className="h-10 flex-1 rounded-xl bg-rose-600 text-[13px] font-bold text-white disabled:opacity-60"
                                disabled={isBlocking}
                            >
                                {isBlocking ? "..." : "Confirmer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
