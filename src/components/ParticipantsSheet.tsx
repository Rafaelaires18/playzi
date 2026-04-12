"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Users, X, ChevronRight, Network } from "lucide-react";
import { cn } from "@/lib/utils";

type ParticipantItem = {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    pseudo: string;
    rank_label: string;
    is_creator: boolean;
};

type ParticipantsSheetProps = {
    isOpen: boolean;
    onClose: () => void;
    activityId: string | null;
    currentUserId?: string | null;
    onSelectParticipant?: (participantId: string) => void;
};

function formatParticipantName(firstName: string | null, lastName: string | null, pseudo: string) {
    const full = `${firstName || ""} ${lastName || ""}`.trim();
    return full || pseudo;
}

export default function ParticipantsSheet({
    isOpen,
    onClose,
    activityId,
    currentUserId,
    onSelectParticipant,
}: ParticipantsSheetProps) {
    const [participants, setParticipants] = useState<ParticipantItem[]>([]);
    const [connectedUserIds, setConnectedUserIds] = useState<string[]>([]);
    const [requestedUserIds, setRequestedUserIds] = useState<string[]>([]);
    const [requestingUserIds, setRequestingUserIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !activityId) return;
        let isCancelled = false;

        const loadParticipants = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [participantsRes, connectionsRes] = await Promise.all([
                    fetch(`/api/activities/${activityId}/participants`, { cache: "no-store" }),
                    fetch(`/api/connections?t=${Date.now()}`, { cache: "no-store" }),
                ]);

                const body = await participantsRes.json().catch(() => null);
                if (!participantsRes.ok) {
                    throw new Error(body?.error || "Impossible de charger la liste des participants");
                }

                const connectionsBody = await connectionsRes.json().catch(() => null);
                const connections = Array.isArray(connectionsBody?.data?.connections) ? connectionsBody.data.connections : [];
                const connectionIds = connections
                    .map((row: { user_id?: string }) => String(row?.user_id || ""))
                    .filter(Boolean);

                if (!isCancelled) {
                    setParticipants(Array.isArray(body?.data?.participants) ? body.data.participants : []);
                    setConnectedUserIds(Array.from(new Set(connectionIds)));
                }
            } catch (e) {
                if (!isCancelled) {
                    setError(e instanceof Error ? e.message : "Erreur inconnue");
                    setParticipants([]);
                    setConnectedUserIds([]);
                }
            } finally {
                if (!isCancelled) setIsLoading(false);
            }
        };

        void loadParticipants();
        return () => { isCancelled = true; };
    }, [isOpen, activityId]);

    const title = useMemo(() => {
        if (participants.length <= 1) return "1 participant";
        return `${participants.length} participants`;
    }, [participants.length]);

    const handleConnectionRequest = async (participantId: string) => {
        if (!participantId) return;
        if (connectedUserIds.includes(participantId) || requestedUserIds.includes(participantId)) return;
        if (requestingUserIds.includes(participantId)) return;

        setRequestingUserIds((prev) => [...prev, participantId]);
        try {
            const res = await fetch("/api/connections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ receiver_id: participantId }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(body?.error || "Impossible d'envoyer la demande");
            }

            const status = String(body?.data?.status || "");
            if (status === "already_connected") {
                setConnectedUserIds((prev) => Array.from(new Set([...prev, participantId])));
            } else if (["request_sent", "already_requested", "incoming_request_exists"].includes(status)) {
                setRequestedUserIds((prev) => Array.from(new Set([...prev, participantId])));
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Impossible d'envoyer la demande");
        } finally {
            setRequestingUserIds((prev) => prev.filter((id) => id !== participantId));
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 z-[120] bg-black/35 backdrop-blur-[1.5px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.div
                        className="fixed bottom-0 left-0 right-0 z-[130] mx-auto w-full max-w-md rounded-t-[24px] border border-gray-100 bg-white shadow-[0_-12px_30px_rgba(0,0,0,0.12)]"
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", stiffness: 280, damping: 28 }}
                    >
                        <div className="mx-auto mt-2.5 h-1 w-12 rounded-full bg-gray-200" />
                        <div className="flex items-center justify-between px-4 pt-3 pb-2">
                            <div className="flex items-center gap-2">
                                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                    <Users className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-[15px] font-black text-[#242841]">Participants</p>
                                    <p className="text-[12px] font-semibold text-gray-500">{title}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                                aria-label="Fermer la liste des participants"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="max-h-[58vh] overflow-y-auto px-4 pb-6">
                            {isLoading && (
                                <div className="space-y-2 pt-2">
                                    {[1, 2, 3].map((item) => (
                                        <div key={item} className="h-14 animate-pulse rounded-xl bg-gray-100" />
                                    ))}
                                </div>
                            )}

                            {!isLoading && error && (
                                <p className="py-4 text-center text-[12px] font-semibold text-rose-600">{error}</p>
                            )}

                            {!isLoading && !error && participants.length === 0 && (
                                <p className="py-4 text-center text-[12px] font-semibold text-gray-500">Aucun participant pour le moment.</p>
                            )}

                            {!isLoading && !error && participants.length > 0 && (
                                <div className="space-y-2 pt-1">
                                    {participants.map((participant) => {
                                        const isConnected = connectedUserIds.includes(participant.user_id);
                                        const isRequested = requestedUserIds.includes(participant.user_id);
                                        const isRequesting = requestingUserIds.includes(participant.user_id);
                                        const isCurrentUser = !!currentUserId && participant.user_id === currentUserId;
                                        return (
                                        <button
                                            key={participant.user_id}
                                            type="button"
                                            onClick={() => onSelectParticipant?.(participant.user_id)}
                                            className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-left hover:bg-white"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="truncate text-[13px] font-bold text-[#242841]">
                                                        {isCurrentUser
                                                            ? "Moi"
                                                            : (
                                                                <>
                                                                    {formatParticipantName(participant.first_name, participant.last_name, participant.pseudo)}
                                                                    <span className="ml-1 text-[12px] font-semibold text-gray-500">(@{participant.pseudo})</span>
                                                                </>
                                                            )}
                                                    </p>
                                                    {isCurrentUser ? (
                                                        <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                                    ) : (
                                                        <span
                                                            role="button"
                                                            aria-label={isConnected || isRequested ? "Connexion active" : "Envoyer une demande de connexion"}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                void handleConnectionRequest(participant.user_id);
                                                            }}
                                                            className={cn(
                                                                "inline-flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                                                                isConnected || isRequested
                                                                    ? "bg-blue-50"
                                                                    : "bg-gray-100 hover:bg-gray-200"
                                                            )}
                                                        >
                                                            <Network
                                                                className={cn(
                                                                    "h-3.5 w-3.5 shrink-0 transition-opacity",
                                                                    isConnected || isRequested ? "text-blue-500 opacity-100" : "text-gray-300 opacity-90",
                                                                    isRequesting ? "animate-pulse" : ""
                                                                )}
                                                            />
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="truncate text-[11px] font-semibold text-gray-400">
                                                    {participant.rank_label}
                                                    {participant.is_creator ? " · Créateur" : ""}
                                                </p>
                                            </div>
                                            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                                        </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
