"use client";

import { useState } from "react";
import { Search, UserPlus, QrCode, Link2, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const MOCK_FRIENDS = [
    { id: "1", pseudo: "clara_run", name: "Clara Moreau", sport: "Running 🏃" },
    { id: "2", pseudo: "leo_velo", name: "Léo Bernard", sport: "Vélo 🚴" },
    { id: "3", pseudo: "sarah_bv", name: "Sarah Petit", sport: "Beach-volley 🏐" },
    { id: "4", pseudo: "maxim_foot", name: "Maxime Durand", sport: "Football ⚽" },
    { id: "5", pseudo: "julie_yoga", name: "Julie Martin", sport: "Yoga 🧘" },
];

interface StepInviteProps {
    maxParticipants: number;
    invitedFriends: string[];
    onInviteChange: (friends: string[]) => void;
}

export default function StepInvite({ maxParticipants, invitedFriends, onInviteChange }: StepInviteProps) {
    const [search, setSearch] = useState("");
    const [showQr, setShowQr] = useState(false);
    const [copied, setCopied] = useState(false);

    const totalOccupied = 1 + invitedFriends.length; // creator + invited
    const filteredFriends = MOCK_FRIENDS.filter(
        (f) =>
            (f.pseudo.includes(search.toLowerCase()) || f.name.toLowerCase().includes(search.toLowerCase())) &&
            search.length > 0
    );

    const toggle = (id: string) => {
        if (invitedFriends.includes(id)) {
            onInviteChange(invitedFriends.filter((f) => f !== id));
        } else if (totalOccupied < maxParticipants) {
            onInviteChange([...invitedFriends, id]);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText("https://playzi.app/join/abc123");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Spots indicator */}
            <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-gray-100 px-5 py-4">
                <div>
                    <p className="text-[13px] font-bold text-gray-dark">Places réservées</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">1 créateur + {invitedFriends.length} invité{invitedFriends.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-playzi-green">{totalOccupied}</span>
                    <span className="text-[13px] text-gray-400 font-medium">/ {maxParticipants}</span>
                </div>
            </div>

            {/* Search by pseudo */}
            <div>
                <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-3">Ajouter par pseudo</h2>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher un ami..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-12 pl-10 pr-4 rounded-2xl border-2 border-gray-100 bg-white text-[14px] text-gray-dark focus:outline-none focus:border-playzi-green transition-colors"
                    />
                </div>

                <AnimatePresence>
                    {filteredFriends.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="mt-2 flex flex-col gap-2"
                        >
                            {filteredFriends.map((friend) => {
                                const invited = invitedFriends.includes(friend.id);
                                return (
                                    <div
                                        key={friend.id}
                                        className="flex items-center justify-between bg-white rounded-2xl border-2 border-gray-100 px-4 py-3"
                                    >
                                        <div>
                                            <p className="text-[13px] font-semibold text-gray-dark">@{friend.pseudo}</p>
                                            <p className="text-[11px] text-gray-400">{friend.sport}</p>
                                        </div>
                                        <button
                                            onClick={() => toggle(friend.id)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all",
                                                invited
                                                    ? "bg-playzi-green/10 text-playzi-green"
                                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                            )}
                                        >
                                            {invited ? <><CheckCircle2 className="w-3.5 h-3.5" /> Invité</> : <><UserPlus className="w-3.5 h-3.5" /> Inviter</>}
                                        </button>
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* QR Code */}
            <div>
                <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-3">QR Code</h2>
                <button
                    onClick={() => setShowQr(!showQr)}
                    className="w-full flex items-center justify-center gap-2.5 h-12 rounded-2xl border-2 border-gray-100 bg-white text-[13px] font-semibold text-gray-dark active:bg-gray-50 transition-colors"
                >
                    <QrCode className="w-4 h-4" />
                    {showQr ? "Masquer le QR Code" : "Générer un QR Code"}
                </button>

                <AnimatePresence>
                    {showQr && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="mt-3 flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border-2 border-gray-100"
                        >
                            {/* Simulated QR code */}
                            <div className="w-40 h-40 bg-gray-dark rounded-xl grid grid-cols-10 gap-0.5 p-2">
                                {Array.from({ length: 100 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn("rounded-sm", Math.random() > 0.5 ? "bg-white" : "bg-gray-dark")}
                                    />
                                ))}
                            </div>
                            <p className="text-[11px] text-gray-400 text-center">
                                Fais scanner ce QR code pour rejoindre directement l&apos;activité
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Share link */}
            <div>
                <h2 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-3">Partager un lien</h2>
                <div className="flex gap-2">
                    <button
                        onClick={handleCopy}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl border-2 text-[13px] font-semibold transition-all",
                            copied
                                ? "border-playzi-green bg-playzi-green/10 text-playzi-green"
                                : "border-gray-100 bg-white text-gray-dark hover:border-gray-200"
                        )}
                    >
                        {copied ? <><CheckCircle2 className="w-4 h-4" /> Copié !</> : <><Link2 className="w-4 h-4" /> Copier le lien</>}
                    </button>
                    <a
                        href="https://wa.me/?text=Rejoins+mon+activité+sur+Playzi+%F0%9F%8E%BE+https://playzi.app/join/abc123"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-12 h-12 rounded-2xl border-2 border-gray-100 bg-white active:bg-gray-50 transition-colors"
                        aria-label="Partager sur WhatsApp"
                    >
                        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.413A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"
                                fill="#25D366"
                            />
                            <path
                                d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.570-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
                                fill="white"
                            />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    );
}
