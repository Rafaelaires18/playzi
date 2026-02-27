"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { MOCK_ACTIVITIES, Activity, ChatMessage } from "@/lib/data";
import { ArrowLeft, Send, MapPin, AlertTriangle, CheckCircle2, ChevronRight, MoreHorizontal, Smile, ChevronLeft, User, Settings, HelpCircle, UserPlus, Flag, Share } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import BottomSheetChatMenu from "@/components/BottomSheetChatMenu";
import BottomSheetReport from "@/components/BottomSheetReport";
import Header from "@/components/Header";

const MiniMap = dynamic(() => import("@/components/MiniMap"), { ssr: false });

export default function ActivityDetailPage() {
    const params = useParams();
    const router = useRouter();
    const activityId = params.id as string;

    const [activity, setActivity] = useState<Activity | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [reportType, setReportType] = useState<"absence" | "problem" | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const found = MOCK_ACTIVITIES.find(a => a.id === activityId);
        if (found) {
            setActivity(found);
            setMessages(found.chatMessages || []);
            // Marquer comme lu
            if (found.unreadMessagesCount && found.unreadMessagesCount > 0) {
                found.unreadMessagesCount = 0;
            }
        }
    }, [activityId]);

    // Auto-scroll chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    if (!activity) return <div className="min-h-screen bg-[#F4F7F6]" />;

    // Derived State
    const isDiscussion = activity.discussionStatus === 'active';
    const isComplet = activity.status === 'complet';
    const isConfirme = activity.status === 'confirmé';
    const isCreator = activity.isCreator;

    let hoursUntilStart = 999;
    let timeDiff = Number.MAX_SAFE_INTEGER;

    if (activity.isoDate) {
        timeDiff = new Date(activity.isoDate).getTime() - new Date().getTime();
        hoursUntilStart = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60)));
    }
    const isChatLocked = isConfirme && hoursUntilStart > 24;
    const canReportAbsence = timeDiff <= 0;

    const isWait = (activity.status === 'en_attente' && !isDiscussion) || isChatLocked;
    const showMap = isComplet || isConfirme;

    // Chat Actions
    const handleSendMessage = () => {
        if (!inputText.trim()) return;
        const newMsg: ChatMessage = {
            id: Date.now().toString(),
            senderId: "me",
            senderName: "Moi",
            content: inputText.trim(),
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            type: 'user'
        };
        setMessages([...messages, newMsg]);
        setInputText("");
    };

    const handleQuickReply = (response: string) => {
        const newMsg: ChatMessage = {
            id: Date.now().toString(),
            senderId: "me",
            senderName: "Moi",
            content: response,
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            type: 'user'
        };
        setMessages([...messages, newMsg]);
    };

    const handleConfirmActivity = () => {
        // Optimistic UI Update
        setActivity({
            ...activity,
            status: "complet",
            discussionStatus: 'resolved'
        });
        setMessages([...messages, {
            id: Date.now().toString(),
            senderId: "sys",
            senderName: "Système",
            content: "🎉 Activité confirmée par le créateur — on y va !",
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            type: 'system'
        }]);
    };

    // Faux coord pour l'exemple
    const fakePosition: [number, number] = [46.5197, 6.6323];

    return (
        <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto relative bg-[#F4F7F6] overflow-hidden">
            <Header />

            {/* TOP HEADER (Sub-header) */}
            <header className="absolute top-16 inset-x-0 z-40 h-16 bg-white/95 backdrop-blur-md border-b border-gray-100 flex items-center px-4 shrink-0 transition-colors">
                <button
                    onClick={() => router.back()}
                    className="p-3 -ml-2 rounded-full hover:bg-gray-100/80 text-gray-700 transition active:scale-95"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 min-w-0 pr-4 ml-2">
                    <h1 className="font-bold text-[17px] text-gray-dark truncate">{activity.variant || activity.sport}</h1>
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-400">
                        <span className="truncate">{activity.time}</span>
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
            <div className="flex-1 overflow-y-auto pt-32 flex flex-col bg-[#F8FAF9]">

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
                                    <span className="text-[13px] font-bold text-gray-dark truncate max-w-[150px]">{activity.exactAddress || activity.location}</span>
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
                <div className="flex-1 flex flex-col p-4 gap-4 justify-end min-h-[50vh]">
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

                        const isMe = msg.senderId === "me";
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
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* BOTTOM INPUT SECTION */}
            <div className="bg-white border-t border-gray-100 px-4 py-3 shrink-0 pb-8 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-30">

                {/* DISCUSSION QUICK ACTIONS */}
                {isDiscussion && (
                    <div className="flex flex-col gap-3 mb-3 border-b border-gray-50 pb-3">
                        <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => handleQuickReply("👍 Je suis partant !")}
                                className="shrink-0 bg-emerald-50 text-emerald-600 border border-emerald-100 px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap active:scale-95 transition"
                            >
                                👍 Je maintiens
                            </button>
                            <button
                                onClick={() => handleQuickReply("❌ Je ne viens plus")}
                                className="shrink-0 bg-rose-50 text-rose-600 border border-rose-100 px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap active:scale-95 transition"
                            >
                                ❌ Pas dispo
                            </button>
                        </div>

                        {/* CREATOR VALIDATION CTA - Full Width within Discussion container */}
                        {isCreator && (
                            <div className="w-full flex flex-col items-center">
                                <button
                                    onClick={handleConfirmActivity}
                                    className="w-full bg-[#1A1A1A] hover:bg-black text-white py-3.5 rounded-2xl font-black text-[15px] shadow-lg shadow-black/10 transition active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                                    Confirmer l'Activité
                                </button>
                                <p className="text-center text-[10px] uppercase tracking-wider font-extrabold text-gray-400 mt-2">
                                    Dévoile le lieu & finalise le statut
                                </p>
                            </div>
                        )}
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
                onClose={() => {
                    setIsReportOpen(false);
                    setTimeout(() => setReportType(null), 300);
                }}
                onSubmit={(participants) => {
                    // Custom message based on report type
                    let message = "🛡️ Signalement enregistré. Merci de faire de Playzi un lieu sûr.";
                    if (reportType === "absence") {
                        if (participants.length > 1) {
                            message = "📝 Absences signalées avec succès. Nous en tiendrons compte.";
                        } else {
                            message = "📝 Absence signalée avec succès. Nous en tiendrons compte.";
                        }
                    }

                    setMessages([...messages, {
                        id: Date.now().toString(),
                        senderId: "sys",
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
