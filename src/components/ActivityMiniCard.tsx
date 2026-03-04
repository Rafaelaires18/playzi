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
    // 1. Time Calculations
    const currentMs = new Date().getTime();
    const startDate = new Date(activity.start_time);
    const startMs = startDate.getTime();

    const hoursUntilStart = Math.max(0, Math.floor((startMs - currentMs) / (1000 * 60 * 60)));

    const startHour = startDate.getHours();
    const isMorningActivity = startHour >= 7 && startHour < 12;

    let urgentChatOpenMs = startMs - (2 * 60 * 60 * 1000); // 2 hours before
    if (isMorningActivity) {
        // Exception: Day before at 20:00
        const dayBefore = new Date(startDate);
        dayBefore.setDate(dayBefore.getDate() - 1);
        dayBefore.setHours(20, 0, 0, 0);
        urgentChatOpenMs = dayBefore.getTime();
    }

    // 2. Sport categorization
    const sportLower = (activity.sport || '').toLowerCase();
    const isAutoConfirmedSport = ['running', 'vélo', 'cycling', 'footing'].includes(sportLower);

    // 3. State Machine overrides (Display State overrules DB basic state for UX)
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
            // Limited sports (Football, Beach Volley)
            if (activity.attendees >= activity.max_attendees) {
                isComplet = true;
                isChatLocked = false;
            } else {
                if (currentMs >= urgentChatOpenMs) {
                    isDiscussion = true;
                    isChatLocked = false; // "Urgence: chat ouvert"
                } else {
                    isAttente = true;
                    isChatLocked = true;
                }
            }
        }
    }

    // Determine Status Badge config based on computed state
    let badgeConfig = { bg: "bg-gray-100", text: "text-gray-500", label: "En attente", icon: AlertCircle };
    if (isPassee) badgeConfig = { bg: "bg-gray-200", text: "text-gray-600", label: "Terminée", icon: CheckCircle2 };
    else if (isComplet) badgeConfig = { bg: "bg-[#10B981]", text: "text-white", label: "Complet", icon: CheckCircle2 };
    else if (isConfirme) badgeConfig = { bg: "bg-[#10B981]", text: "text-white", label: "Confirmé", icon: CheckCircle2 };
    else if (isDiscussion) badgeConfig = { bg: "bg-rose-500", text: "text-white", label: "Discussion", icon: AlertCircle };

    const hasGreenGlow = isComplet || isConfirme; // From screenshots, even locked 'Confirmé' has green glow

    // 4. Formatting output date (e.g. "Ven 26 Fév, 19h00" or "Aujourd'hui, 17h30")
    const isToday = startDate.toDateString() === new Date().toDateString();
    const isTomorrow = new Date(currentMs + 86400000).toDateString() === startDate.toDateString();

    let dateString = "";
    if (isToday) dateString = "Aujourd'hui";
    else if (isTomorrow) dateString = "Demain";
    else {
        dateString = startDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        dateString = dateString.charAt(0).toUpperCase() + dateString.slice(1).replace('.', '');
    }
    const timeString = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
    const displayDateTime = `${dateString}, ${timeString}`;

    // 5. Image logic
    const getDisplayImage = () => {
        if (activity.image_url) return activity.image_url;
        switch (sportLower) {
            case 'running':
            case 'footing': return '/images/running.png';
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

    // Mock generic unread counts to match the lively screenshot feeling, if not explicitly provided
    const unreadFallback = isDiscussion ? 1 : 2;

    return (
        <motion.div
            onClick={onClick}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "flex flex-col rounded-[26px] overflow-hidden bg-white shadow-sm transition-all",
                hasGreenGlow ? "border-2 border-[#10B981] shadow-[0_8px_30px_rgb(20,185,129,0.15)]" :
                    isDiscussion ? "border-2 border-rose-500 shadow-[0_8px_30px_rgb(244,63,94,0.15)]" :
                        "border border-gray-100/60",
                "active:shadow-inner cursor-pointer",
                isPassee && "opacity-80 border-gray-100/60 shadow-none border"
            )}
        >
            <div className="flex p-3 gap-3">
                {/* Left: Thumbnail */}
                <div className="w-[84px] h-[84px] shrink-0 rounded-[20px] overflow-hidden bg-gray-100 relative shadow-inner">
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
                <div className="flex-1 flex flex-col justify-between py-1 min-w-0 pr-1">
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col gap-1">
                            <h3 className={cn("font-bold text-[17px] truncate capitalize", isPassee ? "text-gray-600" : "text-gray-dark")}>
                                {activity.variant ? activity.variant.replace(/[-_]/g, ' ') : activity.sport}
                            </h3>
                            {activity.sport?.toLowerCase() === "running" && activity.distance && (
                                <span className="text-[12px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 self-start px-2 py-0.5 rounded-md border border-emerald-100 mt-1">
                                    {activity.distance} km {activity.pace && <> · {Math.floor(activity.pace / 60)}:{(activity.pace % 60).toString().padStart(2, '0')}/km</>}
                                </span>
                            )}
                        </div>

                        {/* Status Badge */}
                        <div className={cn(
                            "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 shadow-sm",
                            badgeConfig.bg, badgeConfig.text
                        )}>
                            {badgeConfig.icon && <badgeConfig.icon className="w-[11px] h-[11px]" strokeWidth={2.5} />}
                            <span>{badgeConfig.label}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-auto">
                        <div className="flex items-center justify-between text-gray-500 text-[13px] font-medium">
                            <div className="flex items-center gap-1.5 truncate">
                                <Clock className="w-4 h-4 shrink-0 text-gray-400" />
                                <span className="truncate">{displayDateTime}</span>
                            </div>

                            {/* Attendees */}
                            <div className="flex items-center gap-1.5 shrink-0 bg-gray-50 text-gray-700 px-2 py-0.5 rounded-full text-[11px] font-bold border border-gray-100/60">
                                <Users className="w-3.5 h-3.5 text-gray-400" />
                                <span>
                                    {isAutoConfirmedSport ? `${activity.attendees || 1} inscrit${(activity.attendees || 1) > 1 ? 's' : ''}` : `${activity.attendees || 1}/${activity.max_attendees}`}
                                </span>
                            </div>
                        </div>

                        {/* Location */}
                        <div className="flex items-start gap-1.5 text-gray-500 text-[13px] font-medium">
                            <MapPin className={cn("w-4 h-4 shrink-0", isComplet || (isConfirme && !isChatLocked) ? "text-rose-500 fill-rose-100" : "text-gray-400")} />
                            <span className={cn("truncate", (isComplet || (isConfirme && !isChatLocked)) && "text-gray-800 font-bold")}>
                                {(isComplet || (!isChatLocked && isConfirme)) && activity.address ? activity.address : activity.location}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Special Call To Action for 'Complet' */}
            {
                isComplet && (
                    <div className="bg-[#10B981]/[0.08] px-4 py-3 border-t border-[#10B981]/20 flex items-center justify-between">
                        <span className="text-[13px] font-bold tracking-tight text-[#10B981]">Prêt à organiser : ouvre le chat</span>
                        <button className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#10B981]/20 rounded-xl shadow-sm hover:shadow-md transition-shadow text-[13px] font-extrabold text-[#10B981]">
                            <MessageCircle className="w-4 h-4" />
                            Chat
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm">
                                {activity.unreadMessagesCount || unreadFallback}
                            </span>
                        </button>
                    </div>
                )
            }

            {/* Special Call To Action for 'Confirmé' */}
            {
                isConfirme && (
                    <div className={cn("px-4 py-3 border-t flex items-center justify-between",
                        isChatLocked ? "bg-gray-50/50 border-gray-100/60" : "bg-[#10B981]/[0.08] border-[#10B981]/20"
                    )}>
                        <span className={cn("text-[13px] font-bold tracking-tight",
                            isChatLocked ? "text-gray-500" : "text-[#10B981]"
                        )}>
                            {isChatLocked ? "En attente du jour J" : "Le chat est ouvert !"}
                        </span>
                        <button
                            className={cn(
                                "relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl shadow-sm transition-all text-[13px] font-extrabold",
                                isChatLocked
                                    ? "bg-gray-50 border border-gray-200 text-gray-400 opacity-80 cursor-not-allowed shadow-none"
                                    : "bg-white border-[#10B981]/20 text-[#10B981] hover:shadow-md border"
                            )}
                            onClick={(e) => {
                                if (isChatLocked) e.preventDefault();
                            }}
                        >
                            {isChatLocked ? (
                                <>
                                    <Clock className="w-3.5 h-3.5" />
                                    {hoursUntilStart > 48 ? `${Math.floor(hoursUntilStart / 24)}j` : `${hoursUntilStart}h`}
                                </>
                            ) : (
                                <>
                                    <MessageCircle className="w-4 h-4" />
                                    Chat
                                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm">
                                        {activity.unreadMessagesCount || unreadFallback}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                )
            }

            {/* Special Call To Action for 'Discussion' (formerly Urgent) */}
            {
                isDiscussion && (
                    <div className="bg-rose-500/10 px-4 py-3 border-t border-rose-500/20 flex items-center justify-between">
                        <span className="text-[13px] font-bold tracking-tight text-rose-500">Discutez pour maintenir l'activité</span>
                        <button className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-rose-500/20 rounded-xl shadow-sm hover:shadow-md transition-shadow text-[13px] font-extrabold text-rose-500">
                            <MessageCircle className="w-4 h-4" />
                            Chat
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm">
                                {activity.unreadMessagesCount || unreadFallback}
                            </span>
                        </button>
                    </div>
                )
            }

            {/* Special Call To Action for 'Passée' with Feedback Pending */}
            {
                isPassee && activity.feedbackStatus === 'pending' && (
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
                )
            }

            {/* Special Call To Action for 'Passée' with Feedback Completed */}
            {
                isPassee && activity.feedbackStatus === 'completed' && (
                    <div className="bg-gray-50/50 px-4 py-3 border-t border-gray-100/60 flex items-center justify-between">
                        <span className="text-[13px] font-medium text-gray-500">Feedback envoyé</span>
                        <span className="text-gray-400 font-bold">✓</span>
                    </div>
                )
            }
        </motion.div >
    );
}
