"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity } from "@/components/SwipeCard"; // Use central type
import { ArrowLeft, Send, MapPin, CheckCircle2, ChevronRight, MoreHorizontal, MessageCircle, Heart, Share2, Info, Map as MapIcon, Lock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import BottomSheetChatMenu from "@/components/BottomSheetChatMenu";
import BottomSheetReport from "@/components/BottomSheetReport";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/client";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });
const SYSTEM_CONFIRM_MESSAGE = "🎉 Activité confirmée par le créateur — on y va !";
const SYSTEM_CANCEL_MESSAGE = "🛑 Activité annulée pour aujourd'hui. On remet ça très vite.";

// Define ChatMessage type more precisely
type ChatMessage = {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: string;
    type: 'user' | 'system';
    seenBy?: { viewer_id: string; pseudo: string; viewed_at: string }[];
};

export default function ActivityDetailPage() {
    const params = useParams();
    const router = useRouter();
    const activityId = params.id as string;

    const [activity, setActivity] = useState<(Activity & {
        participations?: { user_id: string, status: string, profiles: { pseudo: string, avatar_url?: string } }[];
        lat?: number;
        lng?: number;
        creator?: { pseudo: string; avatar_url?: string };
    }) | null>(null);
    const [participants, setParticipants] = useState<{ user_id: string, status: string, profiles: { pseudo: string, avatar_url?: string } }[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [reportType, setReportType] = useState<"absence" | "problem" | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreator, setIsCreator] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | undefined>();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const supabaseRef = useRef(createClient());
    const supabase = supabaseRef.current;

    const mergeUniqueMessages = (
        existing: ChatMessage[],
        incoming: ChatMessage[]
    ): ChatMessage[] => {
        const byId = new Map<string, ChatMessage>();
        [...existing, ...incoming].forEach((msg) => byId.set(msg.id, msg));
        return Array.from(byId.values());
    };

    const toUiMessage = (msg: Record<string, unknown>): ChatMessage => ({
        id: (msg as { id: string }).id,
        senderId: (msg as { user_id: string }).user_id,
        senderName: ((msg as { profiles?: { pseudo: string } }).profiles?.pseudo) || 'Inconnu',
        content: (msg as { content: string }).content,
        timestamp: new Date((msg as { created_at: string }).created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        type: 'user' as const,
        seenBy: (msg as { seen_by?: any[] }).seen_by || []
    });

    const loadActivity = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const res = await fetch(`/api/activities/${activityId}`, { cache: "no-store" });

            if (!res.ok) {
                const body = await res.json().catch(() => null);
                console.error("API error fetching activity:", res.status, body);
                if (res.status === 404) {
                    router.push('/activities');
                    return;
                }
                throw new Error(body?.error || `HTTP ${res.status}`);
            }

            const body = await res.json();
            const data = body?.data;
            if (!data) throw new Error("Activité vide ou mal formatée");

            const formattedActivity = {
                ...data,
                attendees: 1 + (data.participations?.length || 0),
            };
            setCurrentUserId(user?.id);
            setActivity(formattedActivity);
            setIsCreator(user?.id === formattedActivity.creator_id);
            const typedParticipations = formattedActivity.participations as { user_id: string, status: string, profiles: { pseudo: string, avatar_url?: string } }[];
            setParticipants(typedParticipations || []);
        } catch (error) {
            console.error("Error fetching activity:", error);
        } finally {
            setIsLoading(false);
        }
    }, [activityId, router, supabase]);

    const loadMessages = useCallback(async () => {
        try {
            const res = await supabase
                .from('activity_chat_messages')
                .select(`
                    id, content, created_at, user_id,
                    profiles(pseudo, avatar_url),
                    activity_chat_message_views(viewer_id, profiles(pseudo))
                `)
                .eq('activity_id', activityId)
                .order('created_at', { ascending: true });

            if (res.error) throw res.error;

            // NOTE: `profiles` is a single object from a FK join (not an array).
            // Supabase may return it as an object or an array depending on the relation
            // direction. We handle both cases safely.
            const getProfilePseudo = (profiles: any): string => {
                if (!profiles) return 'Inconnu';
                if (Array.isArray(profiles)) return profiles[0]?.pseudo || 'Inconnu';
                return profiles.pseudo || 'Inconnu';
            };

            const loaded = (res.data || []).map((m: any) => ({
                id: m.id,
                senderId: m.user_id,
                senderName: getProfilePseudo(m.profiles),
                content: m.content,
                timestamp: new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                type: 'user' as const,
                seenBy: (m.activity_chat_message_views || []).map((v: any) => ({
                    viewer_id: v.viewer_id,
                    pseudo: getProfilePseudo(v.profiles),
                    viewed_at: ''
                }))
            }));
            setMessages(loaded);
        } catch (error) {
            console.error("Error loading messages:", error);
        }
    }, [activityId, supabase]);

    const markAsSeen = useCallback(async () => {
        try {
            await fetch(`/api/activities/${activityId}/chat/view`, { method: "POST" });
        } catch (error) {
            console.error("Error marking messages as seen:", error);
        }
    }, [activityId]);

    useEffect(() => {
        loadActivity();
    }, [loadActivity]);

    useEffect(() => {
        loadMessages().then(() => markAsSeen());
    }, [loadMessages, markAsSeen]);

    useEffect(() => {
        const msgChannel = supabase
            .channel(`chat-messages-${activityId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "activity_chat_messages",
                    filter: `activity_id=eq.${activityId}`
                },
                async () => {
                    await loadMessages();
                    await markAsSeen();
                }
            )
            .subscribe();

        const viewsChannel = supabase
            .channel(`chat-views-${activityId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "activity_chat_message_views"
                },
                async () => {
                    await loadMessages();
                }
            )
            .subscribe();

        const activityChannel = supabase
            .channel(`activity-updates-${activityId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "activities",
                    filter: `id=eq.${activityId}`
                },
                async () => {
                    await loadActivity();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(msgChannel);
            supabase.removeChannel(viewsChannel);
            supabase.removeChannel(activityChannel);
        };
    }, [activityId, loadActivity, loadMessages, markAsSeen, supabase]);

    // Auto-scroll chat only if user is already near the bottom (avoid fighting manual scroll)
    useEffect(() => {
        const container = chatScrollRef.current;
        if (!container) return;
        const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        const shouldStickToBottom = distanceToBottom < 140;
        if (shouldStickToBottom) {
            messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        }
    }, [messages]);

    if (isLoading) return <div className="min-h-screen bg-[#F4F7F6] flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-[#10B981] border-t-transparent rounded-full" /></div>;
    if (!activity) return <div className="min-h-screen bg-[#F4F7F6]" />;

    // 1. Time Calculations exactly mirroring the MiniCard logic
    const currentMs = new Date().getTime();
    const startDate = new Date(activity.start_time);
    const startMs = startDate.getTime();

    const hoursUntilStart = Math.max(0, Math.floor((startMs - currentMs) / (1000 * 60 * 60)));
    const startHour = startDate.getHours();
    const isMorningActivity = startHour >= 7 && startHour < 12;

    let urgentChatOpenMs = startMs - (2 * 60 * 60 * 1000); // 2 hours before
    if (isMorningActivity) {
        const dayBefore = new Date(startDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        dayBefore.setHours(20, 0, 0, 0);
        urgentChatOpenMs = dayBefore.getTime();
    }

    const sportLower = (activity.sport || '').toLowerCase();
    const normalizedSport = sportLower
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const isRunningOrVelo = ['running', 'vélo', 'velo', 'cycling', 'footing'].includes(sportLower);
    const isBeachVolley = ['beach volley', 'beach-volley'].includes(sportLower);
    const isFootball = ['football', 'foot'].includes(sportLower);
    const activityDisplayName = isBeachVolley ? 'Beach volley' : isFootball ? 'Football' : (activity.variant || activity.sport);
    const sportEmoji =
        normalizedSport.includes("football") || normalizedSport === "foot" ? "⚽"
            : normalizedSport.includes("beach volley") || normalizedSport.includes("beach-volley") || normalizedSport.includes("volley") ? "🏐"
                : normalizedSport.includes("running") || normalizedSport.includes("footing") ? "🏃"
                    : normalizedSport.includes("velo") || normalizedSport.includes("cycling") ? "🚴"
                        : normalizedSport.includes("yoga") ? "🧘"
                            : "🏅";
    const hasAttendeeLimit = typeof activity.max_attendees === "number" && activity.max_attendees > 0;
    const attendeeLabel = hasAttendeeLimit
        ? `${activity.attendees}/${activity.max_attendees}`
        : `${activity.attendees} ${activity.attendees > 1 ? "participants" : "participant"}`;

    const isComplet = activity.status === "complet" || (typeof activity.max_attendees === "number" && activity.attendees >= activity.max_attendees);
    const isConfirme = activity.status === "confirmé";
    let isAttente = false;
    let isDiscussion = false;
    const isEffectivelyPast = currentMs > startMs + (2 * 60 * 60 * 1000);
    const isPassee = ['passé', 'annulé'].includes(activity.status) || isEffectivelyPast;
    let isChatLocked = true;

    // Emergency mode: < 2h before start, group not full, not cancelled/past/full
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const isUrgent = !isPassee && !isComplet
        && activity.status !== 'annulé'
        && Number.isFinite(startMs) && (startMs - twoHoursMs) <= currentMs && startMs > currentMs;

    if (!isPassee) {
        if (isRunningOrVelo) {
            const openAtMs = startMs - (24 * 60 * 60 * 1000);
            isChatLocked = currentMs < openAtMs;
            if (isChatLocked) {
                isAttente = true;
            }
        } else {
            // Urgent mode auto-opens the chat for discussion
            if (isComplet || isConfirme || isUrgent) {
                isChatLocked = false;
            } else {
                if (currentMs >= urgentChatOpenMs) {
                    isDiscussion = true;
                    isChatLocked = false;
                } else {
                    isAttente = true;
                    isChatLocked = true;
                }
            }
        }
    }

    const canReportAbsence = currentMs >= startMs;
    const showInlineMap = activity.location_visibility === "exact";
    const isExactLocationVisible = activity.location_visibility === "exact";
    const isCancelled = activity.status === "annulé";
    const isWait = isChatLocked;
    const isInputDisabled = isWait || isCancelled;

    const mapPosition: [number, number] = (() => {
        if (typeof activity.lat === "number" && typeof activity.lng === "number") {
            return [activity.lat, activity.lng];
        }
        const rawAddress = (activity.address || "").trim();
        const coordsMatch = rawAddress.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (coordsMatch) {
            return [parseFloat(coordsMatch[1]), parseFloat(coordsMatch[2])];
        }
        return [46.5197, 6.6323];
    })();

    const isSystemContent = (content: string) => {
        const normalized = content.toLowerCase();
        return normalized.includes("activité confirmée") || normalized.includes("activite confirmee") || normalized.includes("activité annulée") || normalized.includes("activite annulee");
    };
    const isConfirmSystemMessage = (content: string) => content.toLowerCase().includes("activité confirmée") || content.toLowerCase().includes("activite confirmee");
    const isCancelSystemMessage = (content: string) => content.toLowerCase().includes("activité annulée") || content.toLowerCase().includes("activite annulee");

    // Chat Actions
    const sendMessage = async (rawContent: string) => {
        const content = rawContent.trim();
        if (!content || isCancelled) return;

        try {
            const res = await fetch(`/api/activities/${activityId}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content })
            });

            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || "Envoi impossible");

            const sent = toUiMessage(body.data);
            setMessages((prev) => mergeUniqueMessages(prev, [sent]));
            setInputText("");
            await markAsSeen();
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Impossible d'envoyer le message.");
        }
    };

    const handleSendMessage = () => {
        if (!inputText.trim() || isInputDisabled) return;
        sendMessage(inputText);
    };

    const handleQuickReply = (response: string) => {
        sendMessage(response);
    };

    const handleBack = () => {
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
        }
        router.push("/activities");
    };

    const handleConfirmActivity = () => {
        (async () => {
            try {
                const res = await fetch(`/api/activities/${activityId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "confirmé" })
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body?.error || "Confirmation impossible");

                setActivity((prev) => prev ? { ...prev, status: "confirmé" } : prev);
                await loadActivity();
                await sendMessage(SYSTEM_CONFIRM_MESSAGE);
            } catch (error) {
                console.error("Error confirming activity:", error);
                alert("Impossible de confirmer l'activité.");
            }
        })();
    };

    const handleCancelActivity = () => {
        (async () => {
            try {
                const res = await fetch(`/api/activities/${activityId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "annulé" })
                });
                const body = await res.json();
                if (!res.ok) throw new Error(body?.error || "Annulation impossible");

                setActivity((prev) => prev ? { ...prev, status: "annulé" } : prev);
                await loadActivity();
                await sendMessage(SYSTEM_CANCEL_MESSAGE);
            } catch (error) {
                console.error("Error cancelling activity:", error);
                alert("Impossible d'annuler l'activité.");
            }
        })();
    };

    const formattedTime = new Date(activity.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const headerStatusLabel = isCancelled ? "Annulée" : isConfirme ? "Confirmé" : isDiscussion ? "Discussion" : isComplet ? "Complet" : null;
    const visibleMessages = messages.filter((m) => !isConfirmSystemMessage(m.content) && !isCancelSystemMessage(m.content));

    return (
        <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto relative bg-[#F4F7F6] overflow-hidden pb-0" style={{ paddingBottom: 0 }}>
            <Header />

            {/* CONTENT AREA */}
            <div className="flex-1 min-h-0 flex flex-col bg-[#F4F7F6] overflow-hidden pt-16">
                <div className="shrink-0 px-4 pt-3 pb-2">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-600 transition hover:text-gray-800"
                        aria-label="Retour"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Retour
                    </button>
                </div>

                <section className="shrink-0 mx-4 mb-2 rounded-[24px] border border-gray-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                        <h1 className="font-bold text-[18px] text-gray-dark truncate min-w-0">
                            <span className="mr-1">{sportEmoji}</span>
                            {activityDisplayName}
                            <span className="text-gray-400 font-semibold text-[15px]"> • {attendeeLabel}</span>
                        </h1>
                        <button
                            onClick={() => setIsMenuOpen(true)}
                            className="p-1 text-gray-400 hover:text-gray-dark transition active:scale-95 shrink-0 -mr-0.5"
                            aria-label="Ouvrir le menu du chat"
                        >
                            <MoreHorizontal className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-gray-400">
                        {headerStatusLabel ? (
                            <span className={cn(
                                "px-1.5 py-0.5 rounded-md font-bold",
                                isCancelled
                                    ? "bg-rose-100 text-rose-700"
                                    : isConfirme
                                    ? "bg-emerald-100 text-emerald-700"
                                    : isDiscussion
                                        ? "bg-rose-100 text-rose-600"
                                        : "bg-emerald-100 text-emerald-600"
                            )}>
                                {headerStatusLabel}
                            </span>
                        ) : (
                            <span className="truncate">{formattedTime}</span>
                        )}
                    </div>
                </section>

                {showInlineMap && (
                    <div className="w-full shrink-0 px-4 pb-2">
                        <div className="h-[164px] w-full relative rounded-[26px] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-gray-100 bg-[#F8FAF9]">
                            <MiniMap position={mapPosition} />
                            <div className="absolute top-3 left-3 bg-white rounded-2xl px-3 py-2 flex items-center gap-2 z-20 pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-gray-100/70">
                                <MapPin className="w-4 h-4 text-playzi-red" />
                                <span className="text-[13px] font-bold text-gray-dark truncate max-w-[170px]">
                                    {isExactLocationVisible ? (activity.address || activity.location) : `${activity.location} (approx.)`}
                                </span>
                            </div>
                            <button
                                onClick={() => window.open(`https://maps.google.com/?q=${mapPosition[0]},${mapPosition[1]}`, '_blank')}
                                className={cn(
                                    "absolute bottom-3 right-3 rounded-full px-4 py-2 flex items-center gap-1.5 z-20 transition-all shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-gray-100/60",
                                    isExactLocationVisible
                                        ? "bg-white text-gray-800 cursor-pointer hover:bg-gray-50 active:scale-[0.96]"
                                        : "bg-white/90 text-gray-400 cursor-not-allowed"
                                )}
                                disabled={!isExactLocationVisible}
                            >
                                <span className="text-[12px] font-black uppercase tracking-wide">Ouvrir dans Maps</span>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                    </div>
                )}

                {/* CHAT LOG */}
                <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4">
                    <div className="flex flex-col py-4 gap-4 min-h-full">

                    {/* ===== STATE 1: URGENT INCOMPLETE — not yet confirmed or cancelled ===== */}
                    {isUrgent && !isConfirme && !isCancelled && (
                        <div className="w-full flex justify-center my-2">
                            <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-2xl max-w-[96%] text-center w-full">
                                <p className="text-[13px] font-black text-red-600 mb-1">🔥 Départ bientôt — groupe incomplet</p>
                                <p className="text-[11px] font-medium text-red-500">
                                    L&apos;activité commence dans moins de 2h et le groupe n&apos;est pas encore complet.
                                    Les inscriptions last-minute restent possibles.
                                </p>
                                {isCreator && (
                                    <div className="mt-3 flex items-center justify-center gap-2">
                                        <button
                                            onClick={handleConfirmActivity}
                                            className="flex-1 bg-[#1A1A1A] text-white py-2 rounded-xl font-bold text-[12px] shadow transition active:scale-[0.97] flex items-center justify-center gap-1.5"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                            Maintenir
                                        </button>
                                        <button
                                            onClick={handleCancelActivity}
                                            className="flex-1 bg-red-500 text-white py-2 rounded-xl font-bold text-[12px] shadow transition active:scale-[0.97] flex items-center justify-center gap-1.5"
                                        >
                                            🔴 Annuler
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ===== STATE 2: CONFIRMED (maintained or normally confirmed) ===== */}
                    {isConfirme && (
                        <div className="w-full flex justify-center my-2">
                            <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-2xl max-w-[92%] text-center">
                                <span className="text-[12px] font-bold text-emerald-700">{SYSTEM_CONFIRM_MESSAGE}</span>
                            </div>
                        </div>
                    )}

                    {/* ===== STATE 3: CANCELLED — chat frozen ===== */}
                    {isCancelled && (
                        <div className="w-full flex justify-center my-2">
                            <div className="bg-rose-50 border border-rose-100 px-4 py-3 rounded-2xl max-w-[92%] text-center">
                                <p className="text-[13px] font-black text-rose-600 mb-0.5">🛑 Activité annulée</p>
                                <span className="text-[11px] font-medium text-rose-500">Cette activité a été annulée par le créateur.</span>
                            </div>
                        </div>
                    )}



                    {visibleMessages.map((msg) => {
                        if (msg.type === 'system' || isSystemContent(msg.content)) {
                            const isCancel = msg.content.toLowerCase().includes("annul");
                            const isConfirm = msg.content.toLowerCase().includes("confirm");
                            const badgeStyle = isCancel
                                ? "bg-rose-50 border-rose-100 text-rose-600"
                                : isConfirm
                                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                    : "bg-gray-100 border-gray-200 text-gray-500";
                            return (
                                <div key={msg.id} className="w-full">
                                    <div className="w-full flex justify-center my-2">
                                        <div className={cn("px-4 py-2 flex items-center justify-center gap-2 max-w-[92%] text-center rounded-2xl border", badgeStyle)}>
                                            {!isCancel && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                                            <span className="text-[12px] font-bold leading-tight block">{msg.content}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        const isMe = msg.senderId === currentUserId;
                        const seenByOthers = (msg.seenBy || []).filter(v => v.viewer_id !== currentUserId);
                        const seenByText = seenByOthers.map(v => v.pseudo).join(", ");
                        return (
                            <div key={msg.id} className={cn("flex flex-col w-full", isMe ? "items-end" : "items-start")}>
                                {!isMe && <span className="text-[11px] font-medium text-gray-400 ml-3 mb-1">{msg.senderName}</span>}
                                <div className={cn(
                                    "px-4 py-2.5 rounded-2xl max-w-[80%] break-words relative",
                                    isMe
                                        ? "bg-[#10B981] text-white rounded-br-sm shadow-md shadow-emerald-500/10"
                                        : "bg-white text-gray-dark shadow-sm border border-gray-100 rounded-bl-sm"
                                )}>
                                    <span className="text-[15px] font-medium leading-snug block">{msg.content}</span>
                                </div>
                                {isMe && seenByOthers.length > 0 && (
                                    <span className="text-[11px] text-gray-400 mt-1 mr-1">
                                        Vu par {seenByText}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>

            {/* BOTTOM INPUT SECTION */}
            <div className="bg-white border-t border-gray-100 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shrink-0 rounded-t-3xl shadow-[0_-8px_24px_rgba(0,0,0,0.04)] z-30">

                {/* DISCUSSION QUICK ACTIONS (classic pre-2h window) */}
                {isDiscussion && !isUrgent && (
                    <div className="flex flex-col gap-3 mb-3 border-b border-gray-50 pb-3">
                        {/* CREATOR PRIMARY ACTION */}
                        {isCreator && (
                            <div className="w-full flex flex-col items-center">
                                <button
                                    onClick={handleConfirmActivity}
                                    className="w-full bg-[#1A1A1A] hover:bg-black text-white py-3 rounded-2xl font-black text-[14px] shadow-md shadow-black/10 transition active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                                    Confirmer l&apos;activité
                                </button>
                                <p className="text-center text-[11px] font-semibold text-gray-400 mt-2">
                                    Le lieu sera révélé et le statut finalisé
                                </p>
                                <button
                                    onClick={handleCancelActivity}
                                    className="mt-1 text-[12px] font-bold text-rose-500/90 hover:text-rose-600 underline underline-offset-2"
                                >
                                    Annuler l&apos;activité
                                </button>
                            </div>
                        )}

                        <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => handleQuickReply("👍 Je suis partant !")}
                                className="shrink-0 bg-emerald-50 text-emerald-600 border border-emerald-100 px-3.5 py-1.5 rounded-xl text-[12px] font-bold whitespace-nowrap active:scale-95 transition"
                            >
                                👍 Je maintiens
                            </button>
                            <button
                                onClick={() => handleQuickReply("❌ Je ne viens plus")}
                                className="shrink-0 bg-rose-50 text-rose-600 border border-rose-100 px-3.5 py-1.5 rounded-xl text-[12px] font-bold whitespace-nowrap active:scale-95 transition"
                            >
                                ❌ Pas dispo
                            </button>
                        </div>
                    </div>
                )}

                {/* URGENT QUICK ACTIONS — visible to everyone when in emergency mode and creator hasn't decided yet */}
                {isUrgent && !isCancelled && !isConfirme && (
                    <div className="mb-3 px-0.5">
                        <div className="bg-red-50 border border-red-100 rounded-2xl px-3 py-2.5 flex flex-col gap-2">
                            <p className="text-[11px] font-bold text-red-500 text-center tracking-wide uppercase">
                                🔥 Toujours partant ?
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleQuickReply("✅ Je viens — je serai là !")}
                                    className="flex-1 bg-white border border-emerald-200 text-emerald-700 py-2 rounded-xl text-[13px] font-black transition active:scale-[0.97] shadow-sm"
                                >
                                    ✅ Je viens
                                </button>
                                <button
                                    onClick={() => handleQuickReply("❌ Je ne peux plus venir")}
                                    className="flex-1 bg-white border border-red-200 text-red-600 py-2 rounded-xl text-[13px] font-black transition active:scale-[0.97] shadow-sm"
                                >
                                    ❌ Je ne viens plus
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TEXT INPUT */}
                <div className="flex items-center justify-center gap-2">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={isCancelled ? "Chat fermé" : isWait ? `Ouverture du chat : ${hoursUntilStart > 24 ? "demain" : "bientôt"}` : "Écrire un message..."}
                        disabled={isInputDisabled}
                        className={cn(
                            "flex-1 bg-gray-100 rounded-full px-5 py-3.5 text-[15px] focus:outline-none focus:ring-2 transition-all font-medium",
                            isInputDisabled ? "opacity-50 cursor-not-allowed" : "focus:bg-white focus:ring-[#10B981]/20 border border-transparent focus:border-gray-200",
                            isDiscussion ? "focus:ring-rose-500/20" : ""
                        )}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputText.trim() || isInputDisabled}
                        className={cn(
                            "w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-90 shrink-0",
                            inputText.trim() && !isInputDisabled
                                ? isDiscussion ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" : "bg-[#10B981] text-white shadow-md shadow-emerald-500/20"
                                : "bg-gray-100 text-gray-400"
                        )}
                    >
                        <Send className="w-5 h-5 ml-1" />
                    </button>
                </div>
            </div>

            {/* BOTTOM SHEETS */}
            <BottomSheetChatMenu
                isOpen={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                canReportAbsence={canReportAbsence}
                onReportIssue={(type) => {
                    setReportType(type);
                    setIsReportOpen(true);
                }}
            />

            <BottomSheetReport
                isOpen={isReportOpen}
                initialReportType={reportType}
                activityId={activity.id}
                participants={participants as unknown as { id: string; user_id: string; status: string; profiles?: { pseudo: string } }[]}
                creator={activity.creator || null}
                currentUserId={currentUserId}
                onClose={() => {
                    setIsReportOpen(false);
                    setTimeout(() => setReportType(null), 300);
                }}
                onSubmit={() => {
                    // Custom message based on user audio
                    const message = "🛡️ Signalement enregistré. Merci de faire de Playzi un lieu sûr.";
                    setMessages((prev) => [...prev, {
                        id: Date.now().toString(),
                        senderId: "system",
                        senderName: "Système",
                        content: message,
                        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                        type: 'system'
                    }]);
                }}
            />
        </main >
    );
}
