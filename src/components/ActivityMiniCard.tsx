import { Activity } from "@/components/SwipeCard";
import { cn } from "@/lib/utils";
import { MapPin, MessageCircle, Clock, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { motion } from "framer-motion";

interface ActivityMiniCardProps {
    activity: Activity & { feedbackStatus?: string; unreadMessagesCount?: number };
    onClick?: () => void;
    onFeedbackClick?: () => void;
}

export default function ActivityMiniCard({ activity, onClick, onFeedbackClick }: ActivityMiniCardProps) {
    // Determine the derived view status from the real DB status
    const isComplet = activity.status === "complet";
    const isAttente = activity.status === "en_attente";
    const isConfirme = activity.status === "confirmé";
    const isPassee = activity.status === "passé" || activity.status === "annulé";
    const isDiscussion = false; // To be implemented with real chat logic

    // Calculate time remaining for Confirmé state
    let hoursUntilStart = 999;
    if (activity.start_time) {
        const timeDiff = new Date(activity.start_time).getTime() - new Date().getTime();
        hoursUntilStart = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60)));
    }
    const isChatLocked = isConfirme && hoursUntilStart > 24;

    // Format time (e.g., "13:24")
    const formattedTime = new Date(activity.start_time).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
    });

    // Determine the image to display
    const getDisplayImage = () => {
        if (activity.image_url) return activity.image_url;
        switch (activity.sport?.toLowerCase()) {
            case 'running': return '/images/running.png';
            case 'beach volley':
            case 'beach-volley': return '/images/beachvolley.png';
            case 'football':
            case 'foot': return '/images/football_1.png';
            case 'vélo':
            case 'cycling': return '/images/cycling.png';
            default: return null;
        }
    };
    const displayImage = getDisplayImage();

    // Determine Status Badge config
    let badgeConfig = { bg: "bg-gray-100", text: "text-gray-500", label: "Inconnu", icon: null as any };
    if (isComplet) badgeConfig = { bg: "bg-[#10B981]", text: "text-white", label: "Complet", icon: CheckCircle2 }; // Playzi Green
    else if (isConfirme) badgeConfig = { bg: "bg-[#10B981]", text: "text-white", label: "Confirmé", icon: CheckCircle2 }; // Green validated
    else if (isDiscussion) badgeConfig = { bg: "bg-rose-500", text: "text-white", label: "Discussion", icon: AlertCircle }; // Rose discussion
    else if (isAttente) badgeConfig = { bg: "bg-[#F59E0B]", text: "text-white", label: "En attente", icon: AlertCircle }; // Orange passive
    else if (isPassee) badgeConfig = { bg: "bg-gray-200", text: "text-gray-600", label: "Terminée", icon: CheckCircle2 };

    const hasGreenGlow = isComplet || (isConfirme && !isChatLocked);

    return (
        <motion.div
            onClick={onClick}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "flex flex-col rounded-3xl overflow-hidden bg-white shadow-sm transition-all",
                hasGreenGlow ? "border-2 border-[#10B981] shadow-[0_8px_30px_rgb(20,185,129,0.15)]" :
                    isDiscussion ? "border-2 border-rose-500 shadow-[0_8px_30px_rgb(244,63,94,0.15)]" :
                        "border border-gray-100/60",
                "active:shadow-inner cursor-pointer",
                isPassee && "opacity-80 border-gray-100/60 shadow-none"
            )}
        >
            <div className="flex p-3 gap-3">
                {/* Left: Thumbnail */}
                <div className="w-20 h-20 shrink-0 rounded-2xl overflow-hidden bg-gray-100 relative">
                    {displayImage ? (
                        <div
                            className="absolute inset-0 bg-cover"
                            style={{
                                backgroundImage: `url(${displayImage})`,
                                backgroundPosition: activity.image_position || 'center'
                            }}
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#10B981] to-[#059669] opacity-80" />
                    )}
                </div>

                {/* Right: Content */}
                <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                        <h3 className={cn("font-bold text-[17px] truncate", isPassee ? "text-gray-600" : "text-[#1A1A1A]")}>
                            {activity.variant || activity.sport}
                        </h3>

                        {/* Status Badge */}
                        <div className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0",
                            badgeConfig.bg, badgeConfig.text
                        )}>
                            {badgeConfig.icon && <badgeConfig.icon className="w-3 h-3" />}
                            <span>{badgeConfig.label}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 mt-auto">
                        <div className="flex items-center justify-between text-gray-500 text-[13px] font-medium">
                            <div className="flex items-center gap-1.5 truncate">
                                <Clock className="w-4 h-4 shrink-0 text-gray-400" />
                                <span className="truncate">{formattedTime}</span>
                            </div>

                            {/* Attendees */}
                            <div className="flex items-center gap-1.5 shrink-0 bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full text-[11px] font-bold border border-gray-100/50">
                                <Users className="w-3 h-3 text-gray-400" />
                                <span>
                                    {activity.attendees || 1}/{activity.max_attendees}
                                </span>
                            </div>
                        </div>

                        {/* Location */}
                        <div className="flex items-start gap-1.5 text-gray-500 text-[13px] font-medium">
                            <MapPin className={cn("w-4 h-4 shrink-0", isComplet ? "text-rose-500 fill-rose-100" : "text-gray-400")} />
                            <span className={cn("truncate", isComplet && "text-gray-800 font-bold")}>
                                {isComplet && activity.address ? activity.address : activity.location}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Special Call To Action for 'Complet' */}
            {isComplet && (
                <div className="bg-[#10B981]/10 px-4 py-3 border-t border-[#10B981]/20 flex items-center justify-between">
                    <span className="text-[13px] font-bold tracking-tight text-[#10B981]">Prêt à organiser : ouvre le chat</span>
                    <button className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#10B981]/10 rounded-xl shadow-sm hover:shadow-md transition-shadow text-[13px] font-extrabold text-[#10B981]">
                        <MessageCircle className="w-4 h-4" />
                        Chat
                    </button>
                </div>
            )}

            {/* Special Call To Action for 'Confirmé' */}
            {isConfirme && (
                <div className="bg-gray-50/50 px-4 py-3 border-t border-gray-100/60 flex items-center justify-between">
                    <span className="text-[13px] font-bold tracking-tight text-gray-500">
                        {isChatLocked ? "En attente du jour J" : "Le chat est ouvert !"}
                    </span>
                    <button
                        className={cn(
                            "relative flex items-center gap-1.5 px-3.5 py-1.5 border rounded-xl shadow-sm transition-all text-[13px] font-extrabold",
                            isChatLocked
                                ? "bg-gray-100 border-gray-200 text-gray-400 opacity-80 cursor-not-allowed"
                                : "bg-white border-[#10B981]/20 text-[#10B981] hover:shadow-md"
                        )}
                        onClick={(e) => {
                            if (isChatLocked) e.preventDefault();
                        }}
                    >
                        {isChatLocked ? (
                            <>
                                <Clock className="w-3.5 h-3.5" />
                                {hoursUntilStart}h
                            </>
                        ) : (
                            <>
                                <MessageCircle className="w-4 h-4" />
                                Chat
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Special Call To Action for 'Discussion' (formerly Urgent) */}
            {isDiscussion && (
                <div className="bg-rose-500/10 px-4 py-3 border-t border-rose-500/20 flex items-center justify-between">
                    <span className="text-[13px] font-bold tracking-tight text-rose-500">Discutez pour maintenir l'activité</span>
                    <button className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-rose-500/10 rounded-xl shadow-sm hover:shadow-md transition-shadow text-[13px] font-extrabold text-rose-500">
                        <MessageCircle className="w-4 h-4" />
                        Chat
                    </button>
                </div>
            )}

            {/* Special Call To Action for 'Passée' with Feedback Pending */}
            {isPassee && activity.feedbackStatus === 'pending' && (
                <div className="bg-indigo-500/10 px-4 py-3 border-t border-indigo-500/20 flex items-center justify-between">
                    <span className="text-[13px] font-bold tracking-tight text-indigo-500">Votre avis compte</span>
                    <button
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-indigo-500/10 rounded-xl shadow-sm hover:shadow-md transition-shadow text-[13px] font-extrabold text-indigo-500"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onFeedbackClick?.();
                        }}
                    >
                        Donner mon avis
                    </button>
                </div>
            )}

            {/* Special Call To Action for 'Passée' with Feedback Completed */}
            {isPassee && activity.feedbackStatus === 'completed' && (
                <div className="bg-gray-50/50 px-4 py-3 border-t border-gray-100/60 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-gray-500">Feedback envoyé</span>
                    <span className="text-gray-400 font-bold">✓</span>
                </div>
            )}
        </motion.div>
    );
}
