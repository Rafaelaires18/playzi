import { Activity } from "@/components/SwipeCard";
import { cn } from "@/lib/utils";
import { MapPin, MessageCircle, Clock, CheckCircle2, AlertCircle, Users, Lock, Star } from "lucide-react";
import { motion } from "framer-motion";
import { getUrgentChatOpenMs } from "@/lib/activity-rules";

interface ActivityMiniCardProps {
    activity: Activity & {
        feedbackStatus?: string;
        unreadMessagesCount?: number;
        unreadRedCount?: number;
        unreadAmberCount?: number;
        unreadBlueCount?: number;
        unreadGoldCount?: number;
        pulseClaimable?: boolean;
        pulseSummaryCreatedAt?: string | null;
        activeCancellationVote?: {
            proposal_id: string;
            expires_at: string;
            reason_code: string;
            reason_text?: string | null;
            user_has_voted?: boolean;
        } | null;
        cancellationAcknowledged?: boolean;
    };
    onClick?: () => void;
    onFeedbackClick?: () => void;
    onPulseClaimClick?: () => void;
    onPendingPulseInfoClick?: () => void;
    onParticipantsClick?: (activityId: string) => void;
    onCancellationAcknowledge?: () => void;
    onInvitationAccept?: () => void;
    isInvitationAccepting?: boolean;
    onInvitationDecline?: () => void;
    isInvitationDeclining?: boolean;
    onInvitationDismissExpired?: () => void;
    isInvitationDismissingExpired?: boolean;
    onInviterProfileClick?: () => void;
    isPulseClaimSubmitting?: boolean;
}

export default function ActivityMiniCard({
    activity,
    onClick,
    onFeedbackClick,
    onPulseClaimClick,
    onPendingPulseInfoClick,
    onParticipantsClick,
    onCancellationAcknowledge,
    onInvitationAccept,
    isInvitationAccepting = false,
    onInvitationDecline,
    isInvitationDeclining = false,
    onInvitationDismissExpired,
    isInvitationDismissingExpired = false,
    onInviterProfileClick,
    isPulseClaimSubmitting = false,
}: ActivityMiniCardProps) {
    // 1. Time Calculations
    const currentMs = new Date().getTime();
    const startDate = new Date(activity.start_time);
    const startMs = startDate.getTime();

    const hoursUntilStart = Math.max(0, Math.floor((startMs - currentMs) / (1000 * 60 * 60)));
    const autoChatOpenMs = startMs - (24 * 60 * 60 * 1000);
    const msUntilAutoChatOpen = Math.max(0, autoChatOpenMs - currentMs);
    const hoursUntilAutoChatOpen = Math.floor(msUntilAutoChatOpen / (1000 * 60 * 60));
    const minsUntilAutoChatOpen = Math.floor(msUntilAutoChatOpen / (1000 * 60));
    const autoChatTimerLabel =
        hoursUntilAutoChatOpen >= 48
            ? `${Math.floor(hoursUntilAutoChatOpen / 24)}j`
            : hoursUntilAutoChatOpen >= 1
                ? `${hoursUntilAutoChatOpen}h`
                : `${Math.max(1, minsUntilAutoChatOpen)}min`;

    const urgentChatOpenMs = getUrgentChatOpenMs({
        start_time: activity.start_time,
        max_attendees: activity.max_attendees,
    });

    // 2. Sport categorization
    const sportLower = (activity.sport || '').toLowerCase();
    const isRunning = ['running', 'footing'].includes(sportLower);
    const isVelo = ['v\u00e9lo', 'velo', 'cycling'].includes(sportLower);
    const isBeachVolley = ['beach volley', 'beach-volley'].includes(sportLower);
    const isFootball = ['football', 'foot'].includes(sportLower);
    const isAutoConfirmedSport = isRunning || isVelo;
    const hasAttendeeLimit = typeof activity.max_attendees === "number" && activity.max_attendees > 0;
    const isAtCapacity = hasAttendeeLimit && Number(activity.attendees || 0) >= Number(activity.max_attendees || 0);
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
            if (activity.status === 'complet' || isAtCapacity) {
                isComplet = true;
                isChatLocked = false;
            } else if (activity.status === 'confirm\u00e9') {
                isConfirme = true;
                isChatLocked = false;
            } else if (hasAttendeeLimit && urgentChatOpenMs !== null && currentMs >= urgentChatOpenMs) {
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
    const isPulseClaimable = isPassee && !!activity.pulseClaimable;
    const invitationStatus = activity.pendingInvitation?.status;
    const isPendingInvitation = invitationStatus === "pending";
    const isExpiredInvitation = invitationStatus === "expired";
    const hasInvitationState = isPendingInvitation || isExpiredInvitation;
    const isCancelledPendingAcknowledge = activity.status === "annulé" && !activity.cancellationAcknowledged;
    const hasActiveCancellationVote = !!activity.activeCancellationVote && !isPassee && activity.status !== "annulé";
    const activeVoteRemainingMs = hasActiveCancellationVote
        ? Math.max(0, new Date(activity.activeCancellationVote!.expires_at).getTime() - currentMs)
        : 0;
    const activeVoteRemainingMin = hasActiveCancellationVote ? Math.max(1, Math.ceil(activeVoteRemainingMs / 60000)) : 0;

    // Determine status badge label - priority to 'En cours', then status
    let label = "En attente";
    if (isPendingInvitation) label = "Invitation";
    else if (isExpiredInvitation) label = "Invitation expirée";
    else if (hasActiveCancellationVote) label = "Vote";
    else if (isEnCours) label = "En cours";
    else if (isPulseClaimable) label = "Récompense";
    else if (activity.status === 'annul\u00e9') label = "Annulée";
    else if (isPassee) label = "Terminée";
    else if (activity.status === 'complet' || isComplet || isAtCapacity) label = "Complet";
    else if (activity.status === 'confirm\u00e9' || isConfirme) label = "Confirm\u00e9";
    else if (isDiscussion) label = "Discussion";

    let badgeConfig = { bg: "bg-gray-100", text: "text-gray-500", label, icon: AlertCircle };
    if (isPendingInvitation) badgeConfig = { bg: "bg-[#2563EB]", text: "text-white", label, icon: MessageCircle };
    else if (isExpiredInvitation) badgeConfig = { bg: "bg-gray-200", text: "text-gray-600", label, icon: Clock };
    else if (hasActiveCancellationVote) badgeConfig = { bg: "bg-[#E25822]", text: "text-white", label, icon: AlertCircle };
    else if (isEnCours) badgeConfig = { bg: "bg-[#10B981]", text: "text-white", label, icon: CheckCircle2 };
    else if (isPulseClaimable) badgeConfig = { bg: "bg-amber-500", text: "text-white", label, icon: Star };
    else if (label === "Annulée") badgeConfig = { bg: "bg-rose-100", text: "text-rose-700", label, icon: AlertCircle };
    else if (isPassee) badgeConfig = { bg: "bg-gray-200", text: "text-gray-600", label, icon: CheckCircle2 };
    else if (label === "Complet") badgeConfig = { bg: "bg-[#10B981]", text: "text-white", label, icon: CheckCircle2 };
    else if (label === "Confirm\u00e9") badgeConfig = { bg: "bg-[#10B981]", text: "text-white", label, icon: CheckCircle2 };
    else if (isDiscussion) badgeConfig = { bg: "bg-rose-500", text: "text-white", label, icon: AlertCircle };

    const hasGreenGlow = !hasActiveCancellationVote && !isCancelledPendingAcknowledge && (isComplet || isConfirme || isEnCours); // From screenshots, even locked 'Confirmé' has green glow

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

    const redUnreadCount = Math.max(0, Number(activity.unreadRedCount || 0));
    const amberUnreadCount = Math.max(0, Number(activity.unreadAmberCount || 0));
    const blueUnreadCount = Math.max(0, Number(activity.unreadBlueCount || 0));
    const goldUnreadCount = Math.max(0, Number(activity.unreadGoldCount || 0));
    const isWaitingOtherFeedback =
        isPassee
        && activity.feedbackStatus === "completed"
        && !isPulseClaimable
        && !activity.pulseSummaryCreatedAt;
    const shouldBlockCardClick = isPulseClaimSubmitting || (!hasInvitationState && (isAttente || (isChatLocked && !isPassee)));

    return (
        <motion.div
            onClick={(e) => {
                if (shouldBlockCardClick) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                onClick?.();
            }}
            whileTap={shouldBlockCardClick ? {} : { scale: 0.98 }}
            className={cn(
                "relative flex flex-col rounded-[26px] overflow-hidden bg-white shadow-sm transition-all",
                isCancelledPendingAcknowledge ? "border border-gray-300 bg-gray-50 shadow-none" :
                isPendingInvitation ? "border-2 border-[#2563EB] shadow-[0_10px_30px_rgba(37,99,235,0.15)]" :
                isExpiredInvitation ? "border border-gray-300 bg-gray-50 shadow-none" :
                hasActiveCancellationVote ? "border-2 border-[#E25822] shadow-[0_10px_30px_rgba(226,88,34,0.20)]" :
                isPulseClaimable ? "border-2 border-amber-400 shadow-[0_10px_30px_rgba(245,158,11,0.20)]" :
                    hasGreenGlow ? "border-2 border-[#10B981] shadow-[0_8px_30px_rgb(20,185,129,0.15)]" :
                    isDiscussion ? "border-2 border-rose-500 shadow-[0_8px_30px_rgb(244,63,94,0.15)]" :
                        "border border-gray-100/60",
                shouldBlockCardClick ? "cursor-default" : "active:shadow-inner cursor-pointer",
                isPulseClaimSubmitting && "pointer-events-none",
                isPassee && !isPulseClaimable && !isCancelledPendingAcknowledge && "opacity-80 border-gray-100/60 shadow-none border"
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
                            <h3 className={cn("font-bold text-[17px] truncate capitalize", (isPassee || isCancelledPendingAcknowledge) ? "text-gray-600" : "text-gray-dark")}>
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
                            <button
                                type="button"
                                onClick={(e) => {
                                    if (hasInvitationState) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onParticipantsClick?.(activity.id);
                                }}
                                disabled={hasInvitationState}
                                className={cn(
                                    "flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold border border-gray-100/60",
                                    hasInvitationState
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                        : "bg-gray-50 text-gray-700 hover:bg-white"
                                )}
                            >
                                <Users className="w-3.5 h-3.5 text-gray-400" />
                                <span>
                                    {isAutoConfirmedSport ? `${activity.attendees || 1} inscrit${(activity.attendees || 1) > 1 ? 's' : ''} ` : `${activity.attendees || 1}/${activity.max_attendees}`}
                                </span >
                            </button>
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

            {isPassee && (goldUnreadCount > 0 || isPulseClaimable) && (
                <div className="absolute top-3 right-3 z-20">
                    <span className="block w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white shadow-sm" />
                </div>
            )}

            {isPassee && !isPulseClaimable && goldUnreadCount === 0 && blueUnreadCount > 0 && (
                <div className="absolute top-3 right-3 z-20">
                    <span className="block w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
                </div>
            )}

            {!isPassee && !hasInvitationState && amberUnreadCount > 0 && (
                <div className="absolute top-3 right-3 z-20">
                    <span className="block w-2.5 h-2.5 bg-[#E25822] rounded-full border-2 border-white shadow-sm" />
                </div>
            )}
            {!isPassee && isPendingInvitation && (
                <div className="absolute top-3 right-3 z-20">
                    <span className="block w-2.5 h-2.5 bg-[#2563EB] rounded-full border-2 border-white shadow-sm" />
                </div>
            )}

            {isCancelledPendingAcknowledge && (
                <div className="bg-gray-100 px-4 py-3 border-t border-gray-300 flex items-center justify-between">
                    <span className="text-[13px] font-bold tracking-tight text-gray-600">Activité annulée</span>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onCancellationAcknowledge?.();
                        }}
                        className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-700 border border-gray-700 rounded-xl shadow-sm text-[13px] font-extrabold text-white hover:bg-gray-800 transition-colors"
                    >
                        Compris
                    </button>
                </div>
            )}

            {isPendingInvitation && (
                <div className="bg-[#2563EB]/[0.08] px-4 py-3 border-t border-[#2563EB]/20 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <span className="text-[13px] font-bold tracking-tight text-[#2563EB] block truncate">
                            @{activity.pendingInvitation?.inviter_pseudo || "utilisateur"} vous invite à rejoindre cette activité
                        </span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onInviterProfileClick?.();
                            }}
                            className="mt-0.5 text-[12px] font-semibold text-[#1D4ED8] underline underline-offset-2"
                        >
                            Voir le profil
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={isInvitationAccepting || isInvitationDeclining}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isInvitationAccepting || isInvitationDeclining) return;
                                onInvitationDecline?.();
                            }}
                            className={cn(
                                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-bold",
                                (isInvitationAccepting || isInvitationDeclining)
                                    ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-white border-gray-200 text-gray-500"
                            )}
                        >
                            {isInvitationDeclining ? "Refus..." : "Refuser"}
                        </button>
                        <button
                            type="button"
                            disabled={isInvitationAccepting || isInvitationDeclining}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isInvitationAccepting || isInvitationDeclining) return;
                                onInvitationAccept?.();
                            }}
                            className={cn(
                                "relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl shadow-sm transition-shadow text-[13px] font-extrabold",
                                (isInvitationAccepting || isInvitationDeclining)
                                    ? "bg-blue-50 border border-blue-200 text-blue-500 cursor-not-allowed"
                                    : "bg-white border border-[#2563EB]/20 text-[#2563EB]"
                            )}
                        >
                            {isInvitationAccepting ? "Acceptation..." : "Accepter"}
                        </button>
                    </div>
                </div>
            )}

            {isExpiredInvitation && (
                <div className="bg-gray-100 px-4 py-3 border-t border-gray-300 flex items-center justify-between">
                    <span className="text-[13px] font-bold tracking-tight text-gray-600">Invitation expirée</span>
                    <button
                        type="button"
                        disabled={isInvitationDismissingExpired}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (isInvitationDismissingExpired) return;
                            onInvitationDismissExpired?.();
                        }}
                        className={cn(
                            "relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl shadow-sm text-[13px] font-extrabold",
                            isInvitationDismissingExpired
                                ? "bg-gray-200 border border-gray-300 text-gray-500 cursor-not-allowed"
                                : "bg-gray-700 border border-gray-700 text-white"
                        )}
                    >
                        {isInvitationDismissingExpired ? "..." : "Compris"}
                    </button>
                </div>
            )}

            {/* Special Call To Action for active cancellation vote (priority state) */}
            {hasActiveCancellationVote && !isCancelledPendingAcknowledge && (
                <div className="bg-[rgba(230,88,34,0.08)] px-4 py-3 border-t border-[#E25822]/25 flex items-center justify-between">
                    <span className="text-[13px] font-bold tracking-tight text-[#E25822]">Vote en cours · Donnez votre avis</span>
                    <div className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#E25822]/40 rounded-xl shadow-sm text-[12px] font-extrabold text-[#B84A1C]">
                        <MessageCircle className="w-4 h-4" />
                        {activeVoteRemainingMin} min
                    </div>
                </div>
            )}

            {/* Special Call To Action for 'Complet' */}
            {
                !hasInvitationState && !hasActiveCancellationVote && !isCancelledPendingAcknowledge && isComplet && (
                    <div className="bg-[#10B981]/[0.08] px-4 py-3 border-t border-[#10B981]/20 flex items-center justify-between">
                        <span className="text-[13px] font-bold tracking-tight text-[#10B981]">Prêt à organiser : ouvre le chat</span>
                        <div className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#10B981]/20 rounded-xl shadow-sm transition-shadow text-[13px] font-extrabold text-[#10B981]">
                            <MessageCircle className="w-4 h-4" />
                            Chat
                            {redUnreadCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm">
                                    {redUnreadCount}
                                </span>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Special Call To Action for 'Confirmé' OR 'En cours' */}
            {
                !hasInvitationState && !hasActiveCancellationVote && !isCancelledPendingAcknowledge && (isConfirme || isEnCours) && (
                    <div className={cn("px-4 py-3 border-t flex items-center justify-between",
                        isChatLocked ? "bg-gray-50/50 border-gray-100/60" : "bg-[#10B981]/[0.08] border-[#10B981]/20"
                    )}>
                        <span className={cn("text-[13px] font-bold tracking-tight",
                            isChatLocked ? "text-gray-500" : "text-[#10B981]"
                        )}>
                            {isChatLocked ? "En attente du jour J" : isEnCours ? "L'activité est en cours !" : "Le chat est ouvert !"}
                        </span>
                        <div
                            className={cn(
                                "relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl shadow-sm transition-all text-[13px] font-extrabold",
                                isChatLocked
                                    ? "bg-gray-50 border border-gray-200 text-gray-400 opacity-80 cursor-not-allowed shadow-none"
                                    : "bg-white border-[#10B981]/20 text-[#10B981] border"
                            )}
                        >
                            {isChatLocked ? (
                                <>
                                    <Clock className="w-3.5 h-3.5" />
                                    {isAutoConfirmedSport ? autoChatTimerLabel : (hoursUntilStart > 48 ? `${Math.floor(hoursUntilStart / 24)}j` : `${hoursUntilStart}h`)}
                                </>
                            ) : (
                                <>
                                    <MessageCircle className="w-4 h-4" />
                                    Chat
                                    {redUnreadCount > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm">
                                            {redUnreadCount}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Special Call To Action for 'Discussion' (formerly Urgent) */}
            {
                !hasInvitationState && !hasActiveCancellationVote && !isCancelledPendingAcknowledge && isDiscussion && (
                    <div className="bg-rose-500/10 px-4 py-3 border-t border-rose-500/20 flex items-center justify-between">
                        <span className="text-[13px] font-bold tracking-tight text-rose-500">Discutez pour maintenir l&apos;activité</span>
                        <div className="relative flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-rose-500/20 rounded-xl shadow-sm transition-shadow text-[13px] font-extrabold text-rose-500">
                            <MessageCircle className="w-4 h-4" />
                            Chat
                            {redUnreadCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm">
                                    {redUnreadCount}
                                </span>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Special Call To Action for 'Attente' */}
            {
                !hasInvitationState && isAttente && (
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
                        <span className="text-[13px] font-bold tracking-tight text-blue-500">Donnez votre avis sur l&apos;activité</span>
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

            {/* Special Call To Action for 'Passée' with Pulse Claim Available */}
            {
                isPulseClaimable && (
                    <div className="bg-amber-500/[0.10] px-4 py-3 border-t border-amber-500/25 flex items-center justify-between">
                        <span className="text-[13px] font-bold tracking-tight text-amber-700">Récompense disponible</span>
                        <button
                            type="button"
                            disabled={isPulseClaimSubmitting}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isPulseClaimSubmitting) return;
                                onPulseClaimClick?.();
                            }}
                            className={cn(
                                "relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[13px] font-extrabold transition-colors",
                                isPulseClaimSubmitting
                                    ? "bg-amber-100 border border-amber-200 text-amber-600 cursor-not-allowed shadow-none"
                                    : "bg-white border border-amber-300/60 shadow-sm text-amber-700 hover:bg-amber-50/70"
                            )}
                        >
                            <Star className="w-4 h-4" />
                            {isPulseClaimSubmitting ? "Récupération..." : "Récupérer mes Pulse"}
                        </button>
                    </div>
                )
            }

            {/* Special Call To Action for 'Passée' with pulse summary pending finalization */}
            {
                isWaitingOtherFeedback && (
                    <div className="bg-amber-50/70 px-4 py-2 border-t border-amber-200/80 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[12px] font-black tracking-tight text-amber-800">Avis envoyé</p>
                            <p className="text-[11px] font-semibold text-amber-700 truncate">Récompense en préparation 🔒</p>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onPendingPulseInfoClick?.();
                            }}
                            className="relative shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-white border border-amber-300 rounded-xl shadow-sm text-[11px] font-black text-amber-700 hover:bg-amber-50/70 transition-colors"
                        >
                            <Lock className="w-3.5 h-3.5 text-amber-600" />
                            En attente
                        </button>
                    </div>
                )
            }

            {/* Special Call To Action for 'Passée' with Feedback Completed */}
            {
                isPassee && !isPulseClaimable && !isWaitingOtherFeedback && activity.feedbackStatus === 'completed' && (
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

            {isPulseClaimSubmitting && (
                <div className="absolute inset-0 z-30 bg-white/70 backdrop-blur-[1.5px] flex items-center justify-center">
                    <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-white/90 px-3 py-1.5 shadow-sm">
                        <span className="block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-[12px] font-black text-amber-700 tracking-tight">Récupération en cours...</span>
                    </div>
                </div>
            )}
        </motion.div >
    );
}
