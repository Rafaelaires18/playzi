"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity } from "@/components/SwipeCard"; // Use central type
import { ChatMessage } from "@/lib/data";
import { ArrowLeft, Send, MapPin, AlertTriangle, CheckCircle2, ChevronRight, MoreHorizontal, Smile, ChevronLeft, User, Settings, HelpCircle, UserPlus, Flag, Share } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import BottomSheetChatMenu from "@/components/BottomSheetChatMenu";
import BottomSheetReport from "@/components/BottomSheetReport";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/client";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });

export default function ActivityDetailPage() {
    const params = useParams();
    const router = useRouter();
    const activityId = params.id as string;

    const [activity, setActivity] = useState<(Activity & { participations?: any[] }) | null>(null);
    const [messages, setMessages] = useState<(ChatMessage & {
        seenBy?: { viewer_id: string; pseudo: string; viewed_at: string }[]
    })[]>([]);
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
        existing: (ChatMessage & { seenBy?: { viewer_id: string; pseudo: string; viewed_at: string }[] })[],
        incoming: (ChatMessage & { seenBy?: { viewer_id: string; pseudo: string; viewed_at: string }[] })[]
    ) => {
        const byId = new Map<string, ChatMessage & { seenBy?: { viewer_id: string; pseudo: string; viewed_at: string }[] }>();
        [...existing, ...incoming].forEach((msg) => byId.set(msg.id, msg));
        return Array.from(byId.values());
    };

    const toUiMessage = (msg: any): ChatMessage & { seenBy?: { viewer_id: string; pseudo: string; viewed_at: string }[] } => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderName: msg.sender_name,
        content: msg.content,
        timestamp: new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        type: 'user',
        seenBy: msg.seen_by || []
    });

    const loadMessages = useCallback(async () => {
        try {
            const res = await fetch(`/api/activities/${activityId}/chat`, { cache: "no-store" });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || "Chargement chat impossible");
            const loaded = (body.data || []).map((m: any) => toUiMessage(m));
            setMessages(loaded);
        } catch (error) {
            console.error("Error loading messages:", error);
        }
    }, [activityId]);

    const markAsSeen = useCallback(async () => {
        try {
            await fetch(`/api/activities/${activityId}/chat/view`, { method: "POST" });
        } catch (error) {
            console.error("Error marking messages as seen:", error);
        }
    }, [activityId]);

    useEffect(() => {
        async function fetchActivity() {
            try {
                // Get active user to determine privileges
                const { data: { user } } = await supabase.auth.getUser();

                const { data, error } = await supabase
                    .from('activities')
                    .select(`
                        *,
                        creator:profiles!activities_creator_id_fkey(id, pseudo, grade),
                        participations(id, user_id, status, profiles(pseudo))
                    `)
                    .eq('id', activityId)
                    .single();

                if (error) throw error;

                if (data) {
                    const formattedActivity = {
                        ...data,
                        attendees: 1 + (data.participations?.length || 0),
                    };
                    setCurrentUserId(user?.id);
                    setActivity(formattedActivity);
                    setIsCreator(user?.id === formattedActivity.creator_id);
                }
            } catch (error) {
                console.error("Error fetching activity:", error);
                router.push('/activities');
            } finally {
                setIsLoading(false);
            }
        }

        fetchActivity();
    }, [activityId, router, supabase]);

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

        return () => {
            supabase.removeChannel(msgChannel);
            supabase.removeChannel(viewsChannel);
        };
    }, [activityId, loadMessages, markAsSeen, supabase]);

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
    const isAutoConfirmedSport = ['running', 'vélo', 'cycling', 'footing'].includes(sportLower);
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

    let isComplet = false;
    let isConfirme = false;
    let isAttente = false;
    let isDiscussion = false;
    const isPassee = ['passé', 'annulé'].includes(activity.status) || currentMs > startMs + (2 * 60 * 60 * 1000);
    let isChatLocked = true;

    if (!isPassee) {
        if (isAutoConfirmedSport) {
            isConfirme = true;
            if (hoursUntilStart <= 24) {
                isChatLocked = false;
            }
        } else {
            if (activity.attendees >= activity.max_attendees) {
                isComplet = true;
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
    const showMap = isComplet || (isConfirme && !isChatLocked); // Only show map when chat is open or completed
    const isWait = isChatLocked;

    // Chat Actions
    const sendMessage = async (rawContent: string) => {
        const content = rawContent.trim();
        if (!content) return;

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
        if (!inputText.trim()) return;
        sendMessage(inputText);
    };

    const handleQuickReply = (response: string) => {
        sendMessage(response);
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
                await sendMessage("🎉 Activité confirmée par le créateur — on y va !");
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
                await sendMessage("🛑 Activité annulée pour aujourd'hui. Merci pour votre énergie, on relance une session encore meilleure très vite 💪");
            } catch (error) {
                console.error("Error cancelling activity:", error);
                alert("Impossible d'annuler l'activité.");
            }
        })();
    };

    // Faux coord pour l'exemple
    const fakePosition: [number, number] = [46.5197, 6.6323];

    const formattedTime = new Date(activity.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    return (
        <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto relative bg-[#F4F7F6] overflow-hidden">
            <Header />

            {/* TOP HEADER (Sub-header) */}
            <header className="absolute top-16 inset-x-0 z-40 h-16 bg-white border-b border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center px-4 shrink-0 transition-colors">
                <button
                    onClick={() => router.back()}
                    className="p-3 -ml-2 rounded-full hover:bg-gray-100/80 text-gray-700 transition active:scale-95"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 min-w-0 pr-4 ml-2">
                    <h1 className="font-bold text-[17px] text-gray-dark truncate">
                        <span className="mr-1">{sportEmoji}</span>
                        {activityDisplayName}
                        <span className="text-gray-400 font-semibold text-[14px]"> • {attendeeLabel}</span>
                    </h1>
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-400">
                        <span className="truncate">{formattedTime}</span>
                        {isDiscussion && <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-600 font-bold ml-1">Discussion</span>}
                        {isComplet && <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-600 font-bold ml-1">Complet</span>}
                    </div>
                </div>
                {/* ⋯ MENU BUTTON */}
                <button
                    onClick={() => setIsMenuOpen(true)}
                    className="p-2 text-gray-400 hover:text-gray-dark transition active:scale-95"
                >
                    <MoreHorizontal className="w-6 h-6" />
                </button>
            </header>

            {/* SCROLLABLE AREA (MAP + CHAT LOG) */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto pt-32 flex flex-col bg-[#F8FAF9]">

                {/* CONDITIONAL MAP VIEW (Only when Complet) */}
                <AnimatePresence>
                    {showMap && (
                        <motion.div
                            initial={{ opacity: 0, y: 15, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                            className="w-full shrink-0 relative px-4 pt-4 pb-2"
                        >
                            <div className="h-[160px] w-full relative rounded-3xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-100 bg-[#F8FAF9] transform-gpu">
                                <MiniMap position={fakePosition} />

                                {/* Glass Overlay Top Left */}
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2, duration: 0.3 }}
                                    className="absolute top-3 left-3 bg-white/80 backdrop-blur-xl rounded-2xl px-3 py-2 flex items-center gap-2 z-20 pointer-events-none shadow-[0_4px_12px_rgba(0,0,0,0.04)] border border-white/60"
                                >
                                    <MapPin className="w-4 h-4 text-playzi-red" />
                                    <span className="text-[13px] font-bold text-gray-dark truncate max-w-[150px]">{activity.address || activity.location}</span>
                                </motion.div>

                                {/* Itinerary Button Bottom Right */}
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.3, duration: 0.3 }}
                                    onClick={() => window.open(`https://maps.google.com/?q=${fakePosition[0]},${fakePosition[1]}`, '_blank')}
                                    className="absolute bottom-3 right-3 bg-white text-gray-800 rounded-full px-4 py-2 flex items-center gap-1.5 z-20 cursor-pointer hover:bg-gray-50 transition-all active:scale-[0.96] shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-gray-100/50"
                                >
                                    <span className="text-[12px] font-black uppercase tracking-wide">Itinéraire</span>
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CHAT LOG */}
                <div className="flex-1 flex flex-col p-4 gap-4 min-h-[50vh]">
                    {activity.status === "annulé" && (
                        <div className="w-full flex justify-center my-2">
                            <div className="bg-rose-50 border border-rose-100 px-4 py-2 rounded-2xl max-w-[92%] text-center">
                                <span className="text-[12px] font-bold text-rose-600">
                                    🛑 Activité annulée. Merci pour votre motivation, on remet ça très vite avec un groupe au complet 💪
                                </span>
                            </div>
                        </div>
                    )}
                    {messages.map((msg) => {
                        if (msg.type === 'system') {
                            return (
                                <div key={msg.id} className="w-full flex justify-center my-2">
                                    <div className="bg-gray-200/60 px-4 py-2.rounded-full flex items-center justify-center gap-2 max-w-[85%] text-center rounded-2xl">
                                        {msg.content.includes('discussion') || msg.content.includes('⚠️') ? (
                                            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                                        ) : (
                                            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                                        )}
                                        <span className="text-[12px] font-bold text-gray-500 leading-tight block">{msg.content}</span>
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

            {/* BOTTOM INPUT SECTION */}
            <div className="bg-white border-t border-gray-100 px-4 py-3 shrink-0 pb-8 rounded-t-3xl shadow-[0_-8px_24px_rgba(0,0,0,0.04)] z-30">

                {/* DISCUSSION QUICK ACTIONS */}
                {isDiscussion && (
                    <div className="flex flex-col gap-3 mb-3 border-b border-gray-50 pb-3">
                        {/* CREATOR PRIMARY ACTION */}
                        {isCreator && (
                            <div className="w-full flex flex-col items-center">
                                <button
                                    onClick={handleConfirmActivity}
                                    className="w-full bg-[#1A1A1A] hover:bg-black text-white py-3 rounded-2xl font-black text-[14px] shadow-md shadow-black/10 transition active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                                    Confirmer l'activité
                                </button>
                                <p className="text-center text-[11px] font-semibold text-gray-400 mt-2">
                                    Le lieu sera révélé et le statut finalisé
                                </p>
                                <button
                                    onClick={handleCancelActivity}
                                    className="mt-1 text-[12px] font-bold text-rose-500/90 hover:text-rose-600 underline underline-offset-2"
                                >
                                    Annuler l'activité
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

                {/* TEXT INPUT */}
                <div className="flex items-center justify-center gap-2">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={isWait ? `Ouverture du chat : ${hoursUntilStart > 24 ? "demain" : "bientôt"}` : "Écrire un message..."}
                        disabled={isWait}
                        className={cn(
                            "flex-1 bg-gray-100 rounded-full px-5 py-3.5 text-[15px] focus:outline-none focus:ring-2 transition-all font-medium",
                            isWait ? "opacity-50 cursor-not-allowed" : "focus:bg-white focus:ring-[#10B981]/20 border border-transparent focus:border-gray-200",
                            isDiscussion ? "focus:ring-rose-500/20" : ""
                        )}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputText.trim() || isWait}
                        className={cn(
                            "w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-90 shrink-0",
                            inputText.trim() && !isWait
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
                participants={activity.participations || []}
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
