import { Activity } from "@/components/SwipeCard";
import { cn } from "@/lib/utils";
import { MapPin, MessageCircle, Clock, CheckCircle2, AlertCircle, Users, Lock, Star } from "lucide-react";
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
    const isRunning = ['running', 'footing'].includes(sportLower);
    const isVelo = ['v\u00e9lo', 'velo', 'cycling'].includes(sportLower);
    const isBeachVolley = ['beach volley', 'beach-volley'].includes(sportLower);
    const isFootball = ['football', 'foot'].includes(sportLower);
    const isAutoConfirmedSport = isRunning || isVelo;
    const sportDisplayName = isBeachVolley ? 'Beach volley' : isFootball ? 'Football' : isVelo ? 'Vélo' : isRunning ? 'Running' : activity.sport;

    // 3. State Machine overrides (Display State overrules DB basic state for UX)
    let isComplet = false;
    let isConfirme = false;
    let isAttente = false;
    let isDiscussion = false;
    // Trust the backend strictly for 'pass\u00e9' to avoid timezone/duration mismatch on the frontend.
    const hasStarted = currentMs >= startMs;
    const hoursSinceStart = hasStarted ? (currentMs - startMs) / (1000 * 60 * 60) : 0;

    // An activity is considered "Ongoing" (En cours) for the first 2 hours after start
    const isEnCours = hasStarted && hoursSinceStart < 2 && !['annulé'].includes(activity.status);

    // It becomes truly "Past" (Passée) and ready for feedback after 2 hours
    const isPassee = ['pass\u00e9', 'annul\u00e9'].includes(activity.status) || (hasStarted && hoursSinceStart >= 2);

    let isChatLocked = true;

    if (!isPassee && !isEnCours) {
        if (isAutoConfirmedSport) {
            isConfirme = true;
            // Running/V\u00e9lo: Chat opens 24h before
            if (hoursUntilStart <= 24) {
                isChatLocked = false;
            }
        } else {
            // Limited sports (Football, Beach Volley)
            if (activity.status === 'complet') {
                isComplet = true;
                isChatLocked = false;
            } else if (activity.status === 'confirm\u00e9') {
                isConfirme = true;
                isChatLocked = false;
            } else if (currentMs >= urgentChatOpenMs) {
                isDiscussion = true;
                isChatLocked = false; // "Urgence: chat ouvert"
            } else {
                isAttente = true;
                isChatLocked = true;
            }
        }
    } else if (isEnCours) {
        // While ongoing, chat remains explicitly open
        isChatLocked = false;
    }

    // Helper to check if string contains coordinates
    const isCoordinates = (str: string) => /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(str || '');

    // Determine status badge label - priority to 'En cours', then status
    let label = "En attente";
    if (isEnCours) label = "En cours";
    else if (activity.status === 'annul\u00e9') label = "Annulée";
    else if (isPassee) label = "Terminée";
    else if (activity.status === 'complet') label = "Complet";
    else if (activity.status === 'confirm\u00e9' || isConfirme) label = "Confirm\u00e9";
    else if (isDiscussion) label = "Discussion";

    let badgeConfig = { bg: "bg-gray-100", text: "text-gray-500", label, icon: AlertCircle };
    if (isEnCours) badgeConfig = { bg: "bg-[#10B981]", text: "text-white", label, icon: CheckCircle2 };
    else if (label === "Annulée") badgeConfig = { bg: "bg-rose-100", text: "text-rose-700", label, icon: null };
    else if (isPassee) badgeConfig = { bg: "bg-gray-200", text: "text-gray-600", label, icon: CheckCircle2 };
    else if (label === "Complet") badgeConfig = { bg: "bg-[#10B981]", text: "text-white", label, icon: CheckCircle2 };
    else if (label === "Confirm\u00e9") badgeConfig = { bg: "bg-[#10B981]", text: "text-white", label, icon: CheckCircle2 };
    else if (isDiscussion) badgeConfig = { bg: "bg-rose-500", text: "text-white", label, icon: AlertCircle };

    const hasGreenGlow = isComplet || isConfirme || isEnCours; // From screenshots, even locked 'Confirmé' has green glow

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
    const displayDateTime = `${dateString}, ${timeString} `;

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
            case 'v\u00e9lo':
            case 'cycling': return '/images/cycling.png';
            default: return null;
        }
    };
    const displayImage = getDisplayImage();

    // Mock generic unread counts to match the lively screenshot feeling, if not explicitly provided
    const unreadFallback = isDiscussion ? 1 : 2;

    return (
        <motion.div
            onClick={(e) => {
                if (isAttente || isChatLocked) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                onClick?.();
            }}
            whileTap={(isAttente || isChatLocked) ? {} : { scale: 0.98 }}
            className={cn(
                "flex flex-col rounded-[26px] overflow-hidden bg-white shadow-sm transition-all",
                hasGreenGlow ? "border-2 border-[#10B981] shadow-[0_8px_30px_rgb(20,185,129,0.15)]" :
                    isDiscussion ? "border-2 border-rose-500 shadow-[0_8px_30px_rgb(244,63,94,0.15)]" :
                        "border border-gray-100/60",
                (isAttente || isChatLocked) ? "cursor-default" : "active:shadow-inner cursor-pointer",
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
                                {(isBeachVolley || isFootball) ? sportDisplayName : (activity.variant ? activity.variant.replace(/[-_]/g, ' ') : sportDisplayName)}
                            </h3>
                            {activity.sport?.toLowerCase() === "running" && activity.distance && (
                                <span className="text-[12px] font-bold text-emerald-700/90 bg-emerald-50/80 self-start px-2 py-0.5 rounded-md border border-emerald-100/50 mt-0.5">
                                    {activity.distance} <span className="lowercase">km</span> {activity.pace && <> · {Math.floor(activity.pace / 60)}:{(activity.pace % 60).toString().padStart(2, '0')}/km</>}
                                </span>
                            )}
                            {(activity.sport?.toLowerCase() === "vélo" || activity.sport?.toLowerCase() === "cycling") && activity.distance && (
                                <span className="text-[12px] font-bold text-emerald-700/90 bg-emerald-50/80 self-start px-2 py-0.5 rounded-md border border-emerald-100/50 mt-0.5">
                                    {activity.distance} <span className="lowercase">km</span> · <span className="capitalize">{activity.level}</span>
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
                                    {isAutoConfirmedSport ? `${activity.attendees || 1} inscrit${(activity.attendees || 1) > 1 ? 's' : ''} ` : `${activity.attendees || 1}/${activity.max_attendees}`}
                                </span >
                            </div >
                        </div >

                        {/* Location */}
                        < div className="flex items-start gap-1.5 text-gray-500 text-[13px] font-medium" >
                            <MapPin className={cn("w-4 h-4 shrink-0", isComplet || (isConfirme && !isChatLocked) ? "text-rose-500 fill-rose-100" : "text-gray-400")} />
                            <span className={cn("truncate", !isChatLocked && "text-gray- dark font-bold")}>
                                {(!isChatLocked && activity.address && !isCoordinates(activity.address)) ? activity.address : activity.location}
                            </span>
                        </div >
                    </div >
                </div >
            </div >

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

            {/* Special Call To Action for 'Confirmé' OR 'En cours' */}
            {
                (isConfirme || isEnCours) && (
                    <div className={cn("px-4 py-3 border-t flex items-center justify-between",
                        isChatLocked ? "bg-gray-50/50 border-gray-100/60" : "bg-[#10B981]/[0.08] border-[#10B981]/20"
                    )}>
                        <span className={cn("text-[13px] font-bold tracking-tight",
                            isChatLocked ? "text-gray-500" : "text-[#10B981]"
                        )}>
                            {isChatLocked ? "En attente du jour J" : isEnCours ? "L'activité est en cours !" : "Le chat est ouvert !"}
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

            {/* Special Call To Action for 'Attente' */}
            {
                isAttente && (
                    <div className="bg-gray-50/50 px-4 py-3 border-t border-gray-100/60 flex items-center justify-between">
                        <span className="text-[13px] font-bold tracking-tight text-gray-500">En attente de plus de participants</span>
                        <button
                            className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl transition-all text-[13px] font-extrabold text-gray-400 opacity-80 cursor-not-allowed shadow-none"
                            onClick={(e) => { e.preventDefault(); }}
                        >
                            <Lock className="w-4 h-4" />
                        </button>
                    </div>
                )
            }

            {/* Special Call To Action for 'Passée' with Feedback Pending */}
            {
                isPassee && activity.feedbackStatus === 'pending' && (
                    <div className="bg-blue-500/[0.08] px-4 py-3 border-t border-blue-500/20 flex items-center justify-between">
                        <span className="text-[13px] font-bold tracking-tight text-blue-500">Donnez votre avis sur l'activité</span>
                        <button
                            className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-blue-500/20 rounded-xl shadow-sm hover:shadow-md transition-shadow text-[13px] font-extrabold text-blue-500"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onFeedbackClick?.();
                            }}
                        >
                            <Star className="w-4 h-4" />
                            Feedback
                        </button>
                    </div>
                )
            }

            {/* Special Call To Action for 'Passée' with Feedback Completed */}
            {
                isPassee && activity.feedbackStatus === 'completed' && (
                    <div className="bg-gray-50/50 px-4 py-3 border-t border-gray-100/60 flex items-center justify-between">
                        <span className="text-[13px] font-bold tracking-tight text-gray-500">Merci pour ton avis !</span>
                        <button
                            disabled
                            className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl transition-all text-[13px] font-extrabold text-gray-400 opacity-80 cursor-not-allowed shadow-none"
                        >
                            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                            Envoyé
                        </button>
                    </div>
                )
            }
        </motion.div >
    );
}
