"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, CalendarHeart, CalendarX, ChevronDown, ChevronUp, Compass, Trash2, X } from "lucide-react";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import ActivityMiniCard from "@/components/ActivityMiniCard";
import ParticipantsSheet from "@/components/ParticipantsSheet";
import NotificationBadge, { NotificationBadgeTone } from "@/components/NotificationBadge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

import BottomSheetFeedback from "@/components/BottomSheetFeedback";
import { Activity } from "@/components/SwipeCard";

type Tab = "a_venir" | "passees";
type ActivityWithFeedback = Activity & {
    feedbackStatus?: "pending" | "completed" | "expired" | "too_early";
    unreadRedCount?: number;
    unreadAmberCount?: number;
    unreadBlueCount?: number;
    unreadGoldCount?: number;
    activeCancellationVote?: {
        proposal_id: string;
        expires_at: string;
        reason_code: string;
        reason_text?: string | null;
        user_has_voted?: boolean;
    } | null;
    cancellationAcknowledged?: boolean;
    pulseClaimable?: boolean;
    pulseSummaryCreatedAt?: string | null;
    unreadInvitationCount?: number;
    pendingInvitation?: {
        invitation_id: string;
        inviter_user_id: string;
        inviter_pseudo: string;
        status: "pending" | "accepted" | "expired";
        reserved_until: string | null;
    } | null;
    participations?: Array<{
        user_id: string;
        status: string;
    }>;
    lat?: number | null;
    lng?: number | null;
};

type ClaimSummaryLine = {
    reason_code?: string;
    reason_label?: string;
    signed_points?: number;
    claim_state?: "pending" | "applied";
};

type ClaimSummary = {
    total_points: number;
    breakdown: ClaimSummaryLine[];
    claimable?: boolean;
    created_at?: string | null;
};

const NOTIFICATIONS_CHANGED_EVENT = "playzi:notifications-changed";
const INVITE_DEBUG_ENABLED = process.env.NODE_ENV !== "production";
const PENDING_INVITE_KEY = "pending_invite";

function inviteDebug(...args: unknown[]) {
    if (!INVITE_DEBUG_ENABLED) return;
    console.log(...args);
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type InviteFlowStatus = "pending" | "already_joined" | "already_accepted";

type InviteModalState = {
    activityId: string;
    status: InviteFlowStatus;
};

function parseCoordinates(raw?: string | null): { lat: number; lng: number } | null {
    if (!raw) return null;
    const match = raw.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

function isCoordinateLike(value?: string | null) {
    return !!parseCoordinates(value || null);
}

function getFallbackCityLabel(activity: ActivityWithFeedback) {
    const candidates = [activity.location, activity.address];
    for (const value of candidates) {
        if (!value || isCoordinateLike(value)) continue;
        const firstChunk = value.split(",")[0]?.trim();
        if (firstChunk && firstChunk.length <= 32) return firstChunk;
    }
    return "Suisse romande";
}

async function fetchNearbyCityFromCoordinates(lat: number, lng: number): Promise<string | null> {
    try {
        const res = await fetch(`/api/location/closest-city?lat=${lat}&lng=${lng}&t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return null;
        const body = await res.json().catch(() => null);
        const city = body?.data?.city;
        return typeof city === "string" && city.trim().length > 0 ? city.trim() : null;
    } catch {
        return null;
    }
}

export default function ActivitiesPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>("a_venir");
    const [activities, setActivities] = useState<ActivityWithFeedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [feedbackActivity, setFeedbackActivity] = useState<Activity | null>(null);
    const [participantsActivityId, setParticipantsActivityId] = useState<string | null>(null);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [claimActivity, setClaimActivity] = useState<ActivityWithFeedback | null>(null);
    const [claimSummary, setClaimSummary] = useState<ClaimSummary | null>(null);
    const [claimCityLabel, setClaimCityLabel] = useState("Suisse romande");
    const [isClaimSheetLoading, setIsClaimSheetLoading] = useState(false);
    const [isClaimSubmitting, setIsClaimSubmitting] = useState(false);
    const [claimingRewardActivityId, setClaimingRewardActivityId] = useState<string | null>(null);
    const [refreshTick, setRefreshTick] = useState(0);
    const [acceptingInvitationByActivityId, setAcceptingInvitationByActivityId] = useState<Record<string, boolean>>({});
    const [decliningInvitationByActivityId, setDecliningInvitationByActivityId] = useState<Record<string, boolean>>({});
    const [dismissingExpiredInvitationByActivityId, setDismissingExpiredInvitationByActivityId] = useState<Record<string, boolean>>({});
    const [quickDeleteActivityId, setQuickDeleteActivityId] = useState<string | null>(null);
    const [isDeletingActivityId, setIsDeletingActivityId] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [inviteModal, setInviteModal] = useState<InviteModalState | null>(null);
    const [isClaimingInviteFromLink, setIsClaimingInviteFromLink] = useState(false);
    const supabase = useMemo(() => createClient(), []);
    const longPressTimersRef = useRef<Map<string, number>>(new Map());
    const quickDeleteAutoHideTimerRef = useRef<number | null>(null);

    useEffect(() => {
        const resolveUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id || null);
        };
        void resolveUser();
    }, [supabase]);

    useEffect(() => {
        let mounted = true;
        const fetchMyActivities = async () => {
            try {
                const res = await fetch(`/api/activities?filter=my_activities&t=${Date.now()}`, { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    const rows = Array.isArray(data?.data) ? data.data : [];
                    const debugRows = rows as Array<Record<string, unknown>>;
                    inviteDebug("[INVITE_DEBUG][FRONT][activities] my_activities fetch response", {
                        total_activities: rows.length,
                        pending_invitation_count: debugRows.filter((item) => {
                            const pendingInvitation = item?.pendingInvitation as Record<string, unknown> | undefined;
                            return pendingInvitation?.status === "pending";
                        }).length,
                        rows: debugRows.map((item) => ({
                            activity_id: item.id,
                            status: item.status,
                            start_time: item.start_time,
                            pendingInvitation: item.pendingInvitation || null,
                        })),
                    });
                    if (mounted) setActivities(rows);
                }
            } catch (error) {
                console.error("Failed to fetch activities", error);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        fetchMyActivities();
        return () => { mounted = false; };
    }, [refreshTick]);

    useEffect(() => {
        const refreshNow = () => setRefreshTick((v) => v + 1);
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") refreshNow();
        };
        const intervalId = window.setInterval(refreshNow, 15000);
        window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshNow);
        window.addEventListener("focus", refreshNow);
        window.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshNow);
            window.removeEventListener("focus", refreshNow);
            window.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);

    useEffect(() => {
        const refreshNow = () => setRefreshTick((v) => v + 1);
        const channel = supabase
            .channel("activities-live-refresh")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "activities" },
                refreshNow
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "participations" },
                refreshNow
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "activity_invitations" },
                refreshNow
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [supabase]);

    useEffect(() => {
        return () => {
            for (const timerId of longPressTimersRef.current.values()) {
                window.clearTimeout(timerId);
            }
            longPressTimersRef.current.clear();
            if (quickDeleteAutoHideTimerRef.current) {
                window.clearTimeout(quickDeleteAutoHideTimerRef.current);
                quickDeleteAutoHideTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!quickDeleteActivityId) return;
        const current = activities.find((a) => a.id === quickDeleteActivityId);
        const stillEligible = !!current
            && !!currentUserId
            && current.creator_id === currentUserId
            && Number(current.attendees || 0) === 1
            && new Date(current.start_time).getTime() > Date.now();
        if (!stillEligible) {
            setQuickDeleteActivityId(null);
        }
    }, [activities, quickDeleteActivityId, currentUserId]);

    useEffect(() => {
        if (quickDeleteAutoHideTimerRef.current) {
            window.clearTimeout(quickDeleteAutoHideTimerRef.current);
            quickDeleteAutoHideTimerRef.current = null;
        }
        if (!quickDeleteActivityId) return;
        quickDeleteAutoHideTimerRef.current = window.setTimeout(() => {
            setQuickDeleteActivityId((current) => (current === quickDeleteActivityId ? null : current));
            quickDeleteAutoHideTimerRef.current = null;
        }, 2500);
    }, [quickDeleteActivityId]);

    useEffect(() => {
        if (!quickDeleteActivityId) return;

        const closeQuickDelete = () => setQuickDeleteActivityId(null);
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            if (target.closest("[data-quick-delete-keep='true']")) return;
            closeQuickDelete();
        };
        const onScroll = () => closeQuickDelete();
        const onVisibilityChange = () => {
            if (document.visibilityState !== "visible") closeQuickDelete();
        };

        document.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("scroll", onScroll, true);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            window.removeEventListener("scroll", onScroll, true);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [quickDeleteActivityId]);

    useEffect(() => {
        setQuickDeleteActivityId(null);
    }, [activeTab]);

    useEffect(() => {
        inviteDebug("[INVITE_DEBUG][FRONT][activities] current state snapshot", {
            active_tab: activeTab,
            total_activities: activities.length,
            upcoming_total: activities.filter((a) => {
                const now = Date.now();
                if (a.status === "annulé") return !a.cancellationAcknowledged;
                return ["ouvert", "complet", "confirmé", "en_attente"].includes(a.status) && new Date(a.start_time).getTime() > now;
            }).length,
            upcoming_pending_invitation_total: activities.filter((a) =>
                a.pendingInvitation?.status === "pending"
                && ["ouvert", "complet", "confirmé", "en_attente"].includes(a.status)
                && new Date(a.start_time).getTime() > Date.now()
            ).length,
            activities: activities.map((a) => ({
                activity_id: a.id,
                status: a.status,
                start_time: a.start_time,
                pendingInvitation: a.pendingInvitation || null,
            })),
        });
    }, [activities, activeTab]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const consumePendingInviteId = () => {
            const rawLocal = String(window.localStorage.getItem(PENDING_INVITE_KEY) || "").trim();
            const rawQuery = String(params.get("invite_activity_id") || "").trim();
            const candidate = rawQuery || rawLocal;
            if (!candidate || !isUuid(candidate)) return null;
            return candidate;
        };

        const shouldPrompt = params.get("invite_prompt") === "1";
        const activityId = consumePendingInviteId();
        if (!activityId || !shouldPrompt || isClaimingInviteFromLink) return;
        router.replace("/activities");

        let cancelled = false;
        const claimFromLink = async () => {
            setIsClaimingInviteFromLink(true);
            try {
                const res = await fetch("/api/activity-invitations/from-link", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ activity_id: activityId }),
                });
                const body = await res.json().catch(() => null);

                window.localStorage.removeItem(PENDING_INVITE_KEY);

                if (!res.ok) {
                    const errorCode = String(body?.details?.code || "");
                    if (errorCode === "activity_full") {
                        alert("Cette activité est déjà complète.");
                    } else if (errorCode === "activity_expired") {
                        alert("Cette activité est expirée.");
                    } else {
                        alert(String(body?.error || "Impossible de récupérer l'invitation."));
                    }
                    return;
                }

                const status = String(body?.data?.status || "");
                if (!cancelled && (status === "pending" || status === "already_joined" || status === "already_accepted")) {
                    setInviteModal({
                        activityId,
                        status: status as InviteFlowStatus,
                    });
                }

                setRefreshTick((v) => v + 1);
                window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
            } finally {
                if (!cancelled) {
                    setIsClaimingInviteFromLink(false);
                }
            }
        };

        void claimFromLink();
        return () => {
            cancelled = true;
        };
    }, [isClaimingInviteFromLink, router]);

    // Filter activities
    const now = Date.now();

    // Upcoming: status is non-final AND date is in the future
    const upcomingActivities = activities.filter((a) => {
        if (a.status === "annulé") {
            return !a.cancellationAcknowledged;
        }
        return ["ouvert", "complet", "confirmé", "en_attente"].includes(a.status) && new Date(a.start_time).getTime() > now;
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const getPastPriority = (activity: ActivityWithFeedback) => {
        if (activity.pulseClaimable || Number(activity.unreadGoldCount || 0) > 0) return 0; // Claim action required now
        if (activity.feedbackStatus === "pending") return 1; // Feedback action required
        if (activity.feedbackStatus === "too_early") return 2; // Recently finished
        if (activity.feedbackStatus === "completed" || activity.feedbackStatus === "expired") return 4; // Already handled
        if (activity.status === "annulé") return 5; // Always last
        return 3; // Default middle
    };

    // Past: status is final (passé, annulé) OR date is in the past
    const pastActivities = activities.filter((a) => {
        if (a.status === "annulé") {
            return !!a.cancellationAcknowledged;
        }
        return ["passé"].includes(a.status) || new Date(a.start_time).getTime() <= now;
    }).sort((a, b) => {
        const priorityDiff = getPastPriority(a) - getPastPriority(b);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
    });

    // Conservative archive policy:
    // an activity is moved to "Historique" only when it is explicitly fully archived.
    const canBeArchived = (activity: ActivityWithFeedback) => {
        // Cancelled activities are always archived.
        if (activity.status === "annulé") return true;

        // Never archive when claim/review signals still indicate a possible action.
        if (activity.feedbackStatus === "pending" || activity.feedbackStatus === "too_early") return false;
        if (Number(activity.unreadBlueCount || 0) > 0) return false;
        if (Number(activity.unreadGoldCount || 0) > 0) return false;
        if (!!activity.pulseClaimable) return false;

        // Only archive if feedback lifecycle is explicitly closed AND Pulse final summary exists.
        // Without a final summary, activity stays in main "Passées" as "processing".
        const feedbackClosed = activity.feedbackStatus === "completed" || activity.feedbackStatus === "expired";
        const hasFinalPulseSummary = !!activity.pulseSummaryCreatedAt;
        return feedbackClosed && hasFinalPulseSummary;
    };

    const actionablePastActivities = pastActivities.filter((a) => !canBeArchived(a));
    const archivedPastActivities = pastActivities.filter(canBeArchived);

    const upcomingRedCount = upcomingActivities.reduce((sum, activity) => {
        return sum + Math.max(0, Number(activity.unreadRedCount || 0));
    }, 0);
    const upcomingVoteCount = upcomingActivities.reduce((sum, activity) => {
        return sum + Math.max(0, Number(activity.unreadAmberCount || 0));
    }, 0);
    const upcomingInvitationCount = upcomingActivities.reduce((sum, activity) => {
        const invitationUnread = Math.max(0, Number(activity.unreadInvitationCount || 0));
        const pendingInvitation = activity.pendingInvitation?.status === "pending" ? 1 : 0;
        return sum + Math.max(invitationUnread, pendingInvitation);
    }, 0);

    const upcomingTabBadge: { tone: NotificationBadgeTone; count: number } | null =
        upcomingRedCount > 0
            ? { tone: "red", count: upcomingRedCount }
            : upcomingVoteCount > 0
                ? { tone: "amber", count: upcomingVoteCount }
                : upcomingInvitationCount > 0
                    ? { tone: "blue", count: upcomingInvitationCount }
                    : null;

    const pastPostActionCount = pastActivities.reduce((sum, activity) => {
        const hasPostAction =
            activity.feedbackStatus === "pending"
            || Number(activity.unreadBlueCount || 0) > 0
            || Number(activity.unreadGoldCount || 0) > 0
            || !!activity.pulseClaimable;
        return sum + (hasPostAction ? 1 : 0);
    }, 0);
    const hasPastPostAction = pastPostActionCount > 0;

    // Animation Variants
    const tabVariants = {
        hidden: { opacity: 0, x: 20 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
        exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { stiffness: 300, damping: 24 } }
    };

    const canQuickDeleteFromCard = (activity: ActivityWithFeedback) => {
        const isCreator = !!currentUserId && activity.creator_id === currentUserId;
        const isSolo = Number(activity.attendees || 0) === 1;
        const isUpcoming = new Date(activity.start_time).getTime() > Date.now();
        return !!isCreator && isSolo && isUpcoming;
    };

    const clearLongPressTimer = (activityId: string) => {
        const timerId = longPressTimersRef.current.get(activityId);
        if (timerId) {
            window.clearTimeout(timerId);
            longPressTimersRef.current.delete(activityId);
        }
    };

    const handleCardLongPressStart = (activity: ActivityWithFeedback) => {
        if (!canQuickDeleteFromCard(activity)) return;
        clearLongPressTimer(activity.id);
        const timerId = window.setTimeout(() => {
            setQuickDeleteActivityId(activity.id);
        }, 420);
        longPressTimersRef.current.set(activity.id, timerId);
    };

    const handleCardLongPressEnd = (activityId: string) => {
        clearLongPressTimer(activityId);
    };

    const handleQuickDelete = async (activity: ActivityWithFeedback) => {
        if (isDeletingActivityId) return;
        setIsDeletingActivityId(activity.id);
        try {
            const res = await fetch(`/api/activities/${activity.id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(body?.error?.details || body?.error || "Suppression impossible");
            }
            setActivities((prev) => prev.filter((a) => a.id !== activity.id));
            setQuickDeleteActivityId(null);
            setRefreshTick((v) => v + 1);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Suppression impossible";
            alert(message);
            setRefreshTick((v) => v + 1);
        } finally {
            setIsDeletingActivityId(null);
        }
    };

    const handleCancellationAcknowledge = async (activity: ActivityWithFeedback) => {
        try {
            const res = await fetch(`/api/activities/${activity.id}/cancellation-acknowledge`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(body?.error || "Impossible d'enregistrer la confirmation");
            }
            setActivities((prev) => prev.map((entry) =>
                entry.id === activity.id
                    ? { ...entry, cancellationAcknowledged: true }
                    : entry
            ));
        } catch (error) {
            alert(error instanceof Error ? error.message : "Impossible d'enregistrer la confirmation");
        }
    };

    const handleAcceptInvitation = async (activity: ActivityWithFeedback) => {
        if (acceptingInvitationByActivityId[activity.id]) return;
        const markAccepting = (value: boolean) => {
            setAcceptingInvitationByActivityId((prev) => {
                if (value) return { ...prev, [activity.id]: true };
                const { [activity.id]: removed, ...rest } = prev;
                void removed;
                return rest;
            });
        };
        const applyAcceptedInvitationLocally = () => {
            setActivities((prev) => prev.map((entry) => {
                if (entry.id !== activity.id) return entry;
                const hadPendingInvitation = entry.pendingInvitation?.status === "pending";
                const nextAttendees = hadPendingInvitation
                    ? Math.max(1, Number(entry.attendees || 1)) + 1
                    : Math.max(1, Number(entry.attendees || 1));
                const maxAttendees = Number(entry.max_attendees || 0);
                const nextStatus =
                    maxAttendees > 0 && nextAttendees >= maxAttendees && entry.status !== "annulé" && entry.status !== "passé"
                        ? "complet"
                        : entry.status;
                return {
                    ...entry,
                    status: nextStatus,
                    attendees: nextAttendees,
                    pendingInvitation: null,
                    unreadInvitationCount: 0,
                };
            }));
        };

        markAccepting(true);
        try {
            inviteDebug("[INVITE_DEBUG][FRONT][activities] accept click", {
                activity_id: activity.id,
                pendingInvitation: activity.pendingInvitation || null,
            });
            const res = await fetch("/api/participations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activity_id: activity.id }),
            });
            const body = await res.json().catch(() => null);
            inviteDebug("[INVITE_DEBUG][FRONT][activities] accept response", {
                activity_id: activity.id,
                ok: res.ok,
                status: res.status,
                body,
            });
            if (!res.ok) {
                const apiMessage = String(body?.error || "");
                const isAlreadyParticipant =
                    apiMessage.toLowerCase().includes("déjà")
                    || apiMessage.toLowerCase().includes("deja")
                    || apiMessage.toLowerCase().includes("already");
                if (isAlreadyParticipant) {
                    applyAcceptedInvitationLocally();
                    setRefreshTick((v) => v + 1);
                    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
                    return;
                }
                throw new Error(apiMessage || "Impossible de rejoindre l'activité");
            }
            applyAcceptedInvitationLocally();
            window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
        } catch (error) {
            alert(error instanceof Error ? error.message : "Impossible de rejoindre l'activité");
        } finally {
            markAccepting(false);
            // Sync backend truth in background after optimistic UI.
            setRefreshTick((v) => v + 1);
        }
    };

    const handleDeclineInvitation = async (activity: ActivityWithFeedback) => {
        if (!activity.pendingInvitation?.invitation_id) return;
        if (decliningInvitationByActivityId[activity.id]) return;
        setDecliningInvitationByActivityId((prev) => ({ ...prev, [activity.id]: true }));
        const removeLocalInvitationCard = () => {
            setActivities((prev) => prev.filter((entry) => entry.id !== activity.id));
        };
        try {
            const res = await fetch(`/api/activity-invitations/${activity.pendingInvitation.invitation_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "decline" }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(body?.error || "Impossible de refuser l'invitation");
            }
            removeLocalInvitationCard();
            window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
        } catch (error) {
            alert(error instanceof Error ? error.message : "Impossible de refuser l'invitation");
        } finally {
            setDecliningInvitationByActivityId((prev) => {
                const { [activity.id]: removed, ...rest } = prev;
                void removed;
                return rest;
            });
            setRefreshTick((v) => v + 1);
        }
    };

    const handleInviteModalViewActivity = () => {
        if (!inviteModal?.activityId) return;
        const activityId = inviteModal.activityId;
        setInviteModal(null);
        router.push(`/activities/${activityId}`);
    };

    const handleInviteModalAccept = async () => {
        if (!inviteModal?.activityId) return;
        const target = activities.find((item) =>
            item.id === inviteModal.activityId && item.pendingInvitation?.status === "pending"
        );
        if (!target) {
            if (inviteModal.status === "already_joined" || inviteModal.status === "already_accepted") {
                setInviteModal(null);
                router.push(`/activities/${inviteModal.activityId}`);
                return;
            }
            alert("Invitation en cours de chargement, réessaie dans quelques secondes.");
            setRefreshTick((v) => v + 1);
            return;
        }
        await handleAcceptInvitation(target);
        setInviteModal(null);
        router.push(`/activities/${inviteModal.activityId}`);
    };

    const handleDismissExpiredInvitation = async (activity: ActivityWithFeedback) => {
        if (!activity.pendingInvitation?.invitation_id) return;
        if (dismissingExpiredInvitationByActivityId[activity.id]) return;
        setDismissingExpiredInvitationByActivityId((prev) => ({ ...prev, [activity.id]: true }));
        const removeLocalInvitationCard = () => {
            setActivities((prev) => prev.filter((entry) => entry.id !== activity.id));
        };
        try {
            const res = await fetch(`/api/activity-invitations/${activity.pendingInvitation.invitation_id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "dismiss_expired" }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(body?.error || "Impossible de fermer l'invitation expirée");
            }
            removeLocalInvitationCard();
            window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
        } catch (error) {
            alert(error instanceof Error ? error.message : "Impossible de fermer l'invitation expirée");
        } finally {
            setDismissingExpiredInvitationByActivityId((prev) => {
                const { [activity.id]: removed, ...rest } = prev;
                void removed;
                return rest;
            });
            setRefreshTick((v) => v + 1);
        }
    };

    const formatSignedPoints = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

    const openClaimSheet = async (activity: ActivityWithFeedback) => {
        setClaimActivity(activity);
        setClaimSummary(null);
        setClaimCityLabel(getFallbackCityLabel(activity));
        setIsClaimSheetLoading(true);

        const parsedCoords = parseCoordinates(activity.address || null);
        const lat = typeof activity.lat === "number" ? activity.lat : parsedCoords?.lat;
        const lng = typeof activity.lng === "number" ? activity.lng : parsedCoords?.lng;

        if (typeof lat === "number" && typeof lng === "number") {
            void fetchNearbyCityFromCoordinates(lat, lng).then((city) => {
                if (city) setClaimCityLabel(city);
            });
        }

        try {
            const res = await fetch(`/api/pulse/summary?activity_id=${activity.id}&t=${Date.now()}`, { cache: "no-store" });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(body?.error?.details || body?.error || "Résumé Pulse indisponible");
            }
            const summary = body?.data?.summary;
            setClaimSummary(summary ? {
                total_points: Number(summary.total_points || 0),
                breakdown: Array.isArray(summary.breakdown) ? summary.breakdown : [],
                claimable: !!summary.claimable,
                created_at: summary.created_at || null,
            } : null);
        } catch (e) {
            console.error("Failed to load claim summary", e);
            setClaimSummary(null);
        } finally {
            setIsClaimSheetLoading(false);
        }
    };

    const closeClaimSheet = () => {
        if (isClaimSubmitting) return;
        setClaimActivity(null);
        setClaimSummary(null);
        setClaimCityLabel("Suisse romande");
        setIsClaimSheetLoading(false);
    };

    const handleClaimFromSheet = async () => {
        if (!claimActivity || isClaimSubmitting) return;
        const targetActivityId = claimActivity.id;
        setIsClaimSubmitting(true);
        setClaimingRewardActivityId(targetActivityId);
        setClaimActivity(null);
        setClaimSummary(null);
        setClaimCityLabel("Suisse romande");
        setIsClaimSheetLoading(false);
        try {
            const res = await fetch("/api/pulse/claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activity_id: targetActivityId }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(body?.error?.details || body?.error || "Claim impossible");
            }
            setActivities((prev) => prev.map((entry) => (
                entry.id === targetActivityId
                    ? {
                        ...entry,
                        pulseClaimable: false,
                        unreadGoldCount: 0,
                    }
                    : entry
            )));
            window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
            setRefreshTick((v) => v + 1);
        } catch (e) {
            console.error("Claim failed from sheet", e);
            alert("Impossible de récupérer les Pulse pour le moment.");
            setRefreshTick((v) => v + 1);
        } finally {
            setIsClaimSubmitting(false);
            setClaimingRewardActivityId((current) => (current === targetActivityId ? null : current));
        }
    };

    const renderPastCard = (activity: ActivityWithFeedback) => {
        const isClaimingReward = claimingRewardActivityId === activity.id;
        return (
        <motion.div
            key={activity.id}
            variants={itemVariants}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.18 } }}
        >
            {activity.feedbackStatus === 'pending' ? (
                <div>
                    <ActivityMiniCard
                        activity={activity}
                        onFeedbackClick={() => setFeedbackActivity(activity)}
                        onPulseClaimClick={() => {
                            if (claimingRewardActivityId) return;
                            void openClaimSheet(activity);
                        }}
                        onPendingPulseInfoClick={() => {
                            alert("Attends les avis des autres participants ou la fin du délai pour récupérer ta récompense.");
                        }}
                        onParticipantsClick={setParticipantsActivityId}
                        isPulseClaimSubmitting={isClaimingReward}
                    />
                </div>
            ) : (
                <div className="block">
                    <ActivityMiniCard
                        activity={activity}
                        onClick={() => router.push(`/activities/${activity.id}`)}
                        onPulseClaimClick={() => {
                            if (claimingRewardActivityId) return;
                            void openClaimSheet(activity);
                        }}
                        onPendingPulseInfoClick={() => {
                            alert("Attends les avis des autres participants ou la fin du délai pour récupérer ta récompense.");
                        }}
                        onParticipantsClick={setParticipantsActivityId}
                        isPulseClaimSubmitting={isClaimingReward}
                    />
                </div>
            )}
        </motion.div>
    );
    };

    return (
        <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto relative bg-[#F4F7F6] overflow-hidden">

            {/* GLOBAL HEADER - Trapped in pointer-events-none to prevent blocking scrolling */}
            <div className="absolute inset-0 z-50 pointer-events-none">
                <Header />
            </div>

            {/* STICKY TOP SECTION: Title + Tabs */}
            <div className="z-30 bg-[#F4F7F6]/90 backdrop-blur-xl pt-20 pb-3 px-6 flex flex-col gap-4 border-b border-gray-100 shadow-sm relative shrink-0">

                <h1 className="text-3xl font-black text-gray-dark tracking-tight mt-2">
                    Mes activités
                </h1>

                {/* Tab Switcher */}
                <div className="flex bg-gray-200/50 p-1 rounded-2xl relative">
                    <button
                        onClick={() => setActiveTab("a_venir")}
                        className={cn(
                            "relative flex-1 py-2.5 text-sm font-bold rounded-xl transition-all z-10 border border-transparent",
                            activeTab === "a_venir" ? "text-gray-dark" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <span>À venir</span>
                        {upcomingTabBadge && (
                            <NotificationBadge tone={upcomingTabBadge.tone} count={upcomingTabBadge.count} />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("passees")}
                        className={cn(
                            "relative flex-1 py-2.5 flex items-center justify-center text-sm font-bold rounded-xl transition-all z-10 border border-transparent",
                            activeTab === "passees" ? "text-gray-dark" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <span>Passées</span>
                        {hasPastPostAction && (
                            <NotificationBadge tone="orange" count={pastPostActionCount} />
                        )}
                    </button>

                    {/* Active Indicator Base Background */}
                    <div
                        className={cn(
                            "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-transform duration-300 ease-out",
                            activeTab === "a_venir" ? "translate-x-0" : "translate-x-[calc(100%+4px)]"
                        )}
                    />
                </div>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto pb-28 px-4 pt-6">
                {isLoading ? (
                    <div className="flex flex-col gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse bg-white rounded-[26px] h-[180px] w-full border border-gray-100 shadow-sm" />
                        ))}
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        {/* UPCOMING TAB */}
                        {activeTab === "a_venir" && (
                            <motion.div
                                key="a_venir"
                                variants={tabVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="flex flex-col min-h-full"
                            >
                                {upcomingActivities.length > 0 ? (
                                    <motion.div
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="show"
                                        className="flex flex-col gap-4"
                                    >
                                        {upcomingActivities.map(activity => (
                                            <motion.div
                                                key={activity.id}
                                                variants={itemVariants}
                                                className="relative"
                                                data-quick-delete-keep={quickDeleteActivityId === activity.id ? "true" : undefined}
                                                onPointerDown={() => handleCardLongPressStart(activity)}
                                                onPointerUp={() => handleCardLongPressEnd(activity.id)}
                                                onPointerCancel={() => handleCardLongPressEnd(activity.id)}
                                                onPointerLeave={() => handleCardLongPressEnd(activity.id)}
                                                onContextMenu={(e) => {
                                                    if (canQuickDeleteFromCard(activity)) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                            >
                                                <div className="block">
                                                    <ActivityMiniCard
                                                        activity={activity}
                                                        onClick={() => router.push(`/activities/${activity.id}`)}
                                                        onInvitationAccept={() => void handleAcceptInvitation(activity)}
                                                        isInvitationAccepting={!!acceptingInvitationByActivityId[activity.id]}
                                                        onInvitationDecline={() => void handleDeclineInvitation(activity)}
                                                        isInvitationDeclining={!!decliningInvitationByActivityId[activity.id]}
                                                        onInvitationDismissExpired={() => void handleDismissExpiredInvitation(activity)}
                                                        isInvitationDismissingExpired={!!dismissingExpiredInvitationByActivityId[activity.id]}
                                                        onInviterProfileClick={() => {
                                                            const inviterId = activity.pendingInvitation?.inviter_user_id;
                                                            if (!inviterId) return;
                                                            inviteDebug("[PROFILE_NAV_DEBUG] click inviter profile from invitation card", {
                                                                activity_id: activity.id,
                                                                clicked_user_id: inviterId,
                                                            });
                                                            router.push(`/profil/${inviterId}`);
                                                        }}
                                                        onParticipantsClick={setParticipantsActivityId}
                                                        onCancellationAcknowledge={() => void handleCancellationAcknowledge(activity)}
                                                    />
                                                </div>
                                                {quickDeleteActivityId === activity.id && canQuickDeleteFromCard(activity) && (
                                                    <div className="absolute right-4 bottom-4 z-20">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                void handleQuickDelete(activity);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-white px-3 py-1.5 text-[12px] font-black text-rose-700 shadow-md"
                                                            disabled={isDeletingActivityId === activity.id}
                                                            data-quick-delete-keep="true"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            {isDeletingActivityId === activity.id ? "Suppression..." : "Supprimer"}
                                                        </button>
                                                    </div>
                                                )}
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                ) : (
                                    // Empty State: A Venir
                                    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 -mt-10">
                                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                                            <CalendarHeart className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
                                        </div>
                                        <h2 className="text-xl font-black text-gray-dark mb-2">Prêt à transpirer ?</h2>
                                        <p className="text-gray-500 text-[15px] mb-8 leading-relaxed max-w-xs">
                                            Tu n&apos;as pas encore d&apos;activité prévue. Rejoins une équipe ou crée la tienne !
                                        </p>
                                        <Link href="/" className="flex items-center gap-2 bg-[#10B981] text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                                            <Compass className="w-5 h-5" />
                                            Trouver une activité
                                        </Link>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* PAST TAB */}
                        {activeTab === "passees" && (
                            <motion.div
                                key="passees"
                                variants={tabVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="flex flex-col min-h-full"
                            >
                                {pastActivities.length > 0 ? (
                                    <motion.div
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="show"
                                        className="flex flex-col gap-4"
                                    >
                                        {actionablePastActivities.length > 0 ? (
                                            <AnimatePresence initial={false}>
                                                {actionablePastActivities.map(renderPastCard)}
                                            </AnimatePresence>
                                        ) : (
                                            <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 text-center">
                                                <p className="text-[14px] font-semibold text-gray-600">
                                                    Aucune action en attente.
                                                </p>
                                                <p className="mt-1 text-[12px] text-gray-500">
                                                    Tes activités terminées sont rangées dans l&apos;historique.
                                                </p>
                                            </div>
                                        )}

                                        {archivedPastActivities.length > 0 && (
                                            <section className="rounded-2xl border border-gray-200 bg-white/90 p-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsHistoryOpen((v) => !v)}
                                                    className="w-full flex items-center justify-between rounded-xl px-2 py-2 hover:bg-gray-50 transition-colors"
                                                >
                                                    <span className="flex items-center gap-2 text-[14px] font-black text-gray-800">
                                                        <Archive className="w-4 h-4 text-gray-500" />
                                                        Historique
                                                        <span className="text-[12px] font-bold text-gray-500">({archivedPastActivities.length})</span>
                                                    </span>
                                                    {isHistoryOpen ? (
                                                        <ChevronUp className="w-4 h-4 text-gray-500" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4 text-gray-500" />
                                                    )}
                                                </button>

                                                {isHistoryOpen && (
                                                    <div className="mt-2 flex flex-col gap-3">
                                                        <AnimatePresence initial={false}>
                                                            {archivedPastActivities.map(renderPastCard)}
                                                        </AnimatePresence>
                                                    </div>
                                                )}
                                            </section>
                                        )}
                                    </motion.div>
                                ) : (
                                    // Empty State: Historique
                                    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 -mt-10">
                                        <div className="w-24 h-24 bg-transparent border-2 border-dashed border-gray-200 rounded-full flex items-center justify-center mb-6">
                                            <CalendarX className="w-10 h-10 text-gray-300" strokeWidth={1.5} />
                                        </div>
                                        <p className="text-gray-400 font-medium text-[15px]">
                                            Ton historique est vide pour le moment.
                                        </p>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}
            </div>

            {/* FIXED BOTTOM NAV */}
            <div className="relative z-20">
                <BottomNavigation activeTab="activities" />
            </div>

            {/* FEEDBACK BOTTOM SHEET */}
            <BottomSheetFeedback
                isOpen={!!feedbackActivity}
                onClose={() => setFeedbackActivity(null)}
                activity={feedbackActivity}
            />

            <ParticipantsSheet
                isOpen={!!participantsActivityId}
                onClose={() => setParticipantsActivityId(null)}
                activityId={participantsActivityId}
                currentUserId={currentUserId}
                onSelectParticipant={(participantId) => {
                    inviteDebug("[PROFILE_NAV_DEBUG] click participant profile from participants sheet", {
                        activity_id: participantsActivityId,
                        clicked_user_id: participantId,
                    });
                    setParticipantsActivityId(null);
                    router.push(`/profil/${participantId}`);
                }}
            />

            <AnimatePresence>
                {claimActivity && (
                    <>
                        <motion.button
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeClaimSheet}
                            className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-[2px]"
                            aria-label="Fermer le résumé Pulse"
                        />
                        <motion.section
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", stiffness: 280, damping: 30 }}
                            className="fixed bottom-0 inset-x-0 mx-auto z-[121] w-full max-w-md rounded-t-3xl border border-amber-100 bg-white p-5 shadow-[0_-12px_32px_rgba(0,0,0,0.16)]"
                        >
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-600">Récompense Pulse</p>
                                    <h3 className="mt-1 text-[20px] font-black text-gray-900">Résumé</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeClaimSheet}
                                    className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
                                    aria-label="Fermer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 px-3 py-2.5">
                                <p className="text-[14px] font-black text-gray-800 capitalize">
                                    {claimActivity.variant || claimActivity.sport}
                                </p>
                                <p className="mt-0.5 text-[12px] font-semibold text-gray-600">
                                    {new Date(claimActivity.start_time).toLocaleDateString("fr-FR", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                    }).replace(".", "")}
                                    {" · "}
                                    {new Date(claimActivity.start_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                                <p className="mt-0.5 text-[12px] font-medium text-gray-500">
                                    {claimCityLabel}
                                </p>
                            </div>

                            <div className="mt-3 max-h-[34vh] space-y-1.5 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-3">
                                {isClaimSheetLoading ? (
                                    <p className="text-[12px] font-medium text-gray-500">Chargement du résumé...</p>
                                ) : claimSummary?.breakdown?.length ? (
                                    claimSummary.breakdown.map((line, index) => {
                                        const points = Number(line.signed_points || 0);
                                        return (
                                            <div key={`${line.reason_code || "line"}-${index}`} className="flex items-center justify-between gap-2 text-[12px]">
                                                <span className="truncate font-semibold text-gray-600">{line.reason_label || line.reason_code || "Variation Pulse"}</span>
                                                <span className={cn("font-black", points >= 0 ? "text-emerald-700" : "text-rose-600")}>
                                                    {formatSignedPoints(points)}
                                                </span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-[12px] font-medium text-gray-500">Aucune ligne Pulse disponible pour le moment.</p>
                                )}
                            </div>

                            <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5">
                                <span className="text-[12px] font-bold text-amber-800">Total</span>
                                <span className={cn("text-[18px] font-black", Number(claimSummary?.total_points || 0) >= 0 ? "text-emerald-700" : "text-rose-600")}>
                                    {formatSignedPoints(Number(claimSummary?.total_points || 0))}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={handleClaimFromSheet}
                                disabled={isClaimSheetLoading || isClaimSubmitting || !claimSummary?.claimable}
                                className={cn(
                                    "mt-4 w-full rounded-2xl py-3 text-[14px] font-black transition",
                                    (isClaimSheetLoading || isClaimSubmitting || !claimSummary?.claimable)
                                        ? "cursor-not-allowed bg-amber-200 text-amber-700"
                                        : "bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.99]"
                                )}
                            >
                                {isClaimSubmitting ? "Récupération..." : "Récupérer"}
                            </button>
                        </motion.section>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {inviteModal && (
                    <>
                        <motion.button
                            type="button"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setInviteModal(null)}
                            className="fixed inset-0 z-[130] bg-black/40 backdrop-blur-[2px]"
                            aria-label="Fermer la popup d'invitation"
                        />
                        <motion.section
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", stiffness: 280, damping: 30 }}
                            className="fixed bottom-0 inset-x-0 mx-auto z-[131] w-full max-w-md rounded-t-3xl border border-blue-100 bg-white p-5 shadow-[0_-12px_32px_rgba(0,0,0,0.16)]"
                        >
                            <h3 className="text-[22px] font-black text-gray-900">Invitation reçue 🎉</h3>
                            <p className="mt-2 text-[14px] font-medium text-gray-600">Tu as été invité à une activité</p>

                            {inviteModal.status === "already_joined" && (
                                <p className="mt-2 text-[12px] font-semibold text-emerald-700">
                                    Tu participes déjà à cette activité.
                                </p>
                            )}
                            {inviteModal.status === "already_accepted" && (
                                <p className="mt-2 text-[12px] font-semibold text-emerald-700">
                                    Invitation déjà acceptée.
                                </p>
                            )}

                            <div className="mt-5 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={handleInviteModalViewActivity}
                                    className="rounded-2xl border border-gray-200 bg-white px-3 py-3 text-[13px] font-black text-gray-800"
                                >
                                    Voir l’activité
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleInviteModalAccept()}
                                    disabled={inviteModal.status !== "pending"}
                                    className={cn(
                                        "rounded-2xl px-3 py-3 text-[13px] font-black text-white transition",
                                        inviteModal.status === "pending"
                                            ? "bg-[#10B981] hover:bg-emerald-600"
                                            : "cursor-not-allowed bg-gray-300"
                                    )}
                                >
                                    Accepter l’invitation
                                </button>
                            </div>
                        </motion.section>
                    </>
                )}
            </AnimatePresence>
        </main>
    );
}
