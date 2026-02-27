"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Menu,
    Settings,
    HelpCircle,
    AlertTriangle,
    LogOut,
    X,
    ChevronRight,
    Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
    devGender?: 'male' | 'female';
    onDevGenderChange?: (g: 'male' | 'female') => void;
}

export default function Header({ devGender, onDevGenderChange }: HeaderProps = {}) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const menuItems = [
        { icon: Sparkles, label: "Plans & tarifs", sublabel: "Accès prioritaire et illimité", color: "text-playzi-orange", bg: "bg-orange-50" },
        { icon: Settings, label: "Paramètres", color: "text-gray-dark", bg: "bg-gray-50" },
        { icon: HelpCircle, label: "Aide & Support", color: "text-gray-dark", bg: "bg-gray-50" },
        { icon: AlertTriangle, label: "Signaler un problème", color: "text-gray-dark", bg: "bg-gray-50" },
    ];

    return (
        <>
            {/* Header (Absolute within the max-w-md relative container) */}
            <header className="pointer-events-auto absolute top-0 inset-x-0 h-16 z-40 bg-white/70 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.03)] border-b border-gray-100/50 flex items-center justify-between px-6 transition-all">
                <div className="flex items-center">
                    <h1 className="text-2xl font-black text-gray-dark tracking-tight">
                        Playzi<span className="text-playzi-green">.</span>
                    </h1>
                </div>

                {/* Dev gender toggle — centered absolutely in header */}
                {devGender && onDevGenderChange && (
                    <div className="absolute left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-full shadow-sm border border-gray-100 flex items-center p-0.5 gap-0.5">
                        <button
                            onClick={() => onDevGenderChange('male')}
                            className={`px-2 py-1 rounded-full text-[11px] font-bold transition-colors ${devGender === 'male' ? 'bg-blue-500 text-white' : 'text-gray-400'
                                }`}
                        >
                            👨
                        </button>
                        <button
                            onClick={() => onDevGenderChange('female')}
                            className={`px-2 py-1 rounded-full text-[11px] font-bold transition-colors ${devGender === 'female' ? 'bg-purple-500 text-white' : 'text-gray-400'
                                }`}
                        >
                            👩
                        </button>
                    </div>
                )}

                <motion.button
                    whileTap={{ scale: 0.9, rotate: -5 }}
                    onClick={() => setIsMenuOpen(true)}
                    className="p-2 -mr-2 text-gray-600 hover:text-black hover:bg-gray-100/80 rounded-full transition-colors"
                    aria-label="Ouvrir le menu"
                >
                    <Menu className="w-6 h-6" strokeWidth={2} />
                </motion.button>
            </header>

            {/* Menu Drawer */}
            <AnimatePresence>
                {isMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMenuOpen(false)}
                            className="pointer-events-auto absolute inset-0 z-50 bg-black/40 backdrop-blur-sm"
                        />

                        {/* Drawer Panel */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                            drag="x"
                            dragConstraints={{ left: 0 }}
                            dragElastic={0.05}
                            onDragEnd={(e, info) => {
                                if (info.offset.x > 80 || info.velocity.x > 500) {
                                    setIsMenuOpen(false);
                                }
                            }}
                            className="pointer-events-auto absolute top-0 bottom-0 right-0 w-[85%] z-50 bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.15)] flex flex-col rounded-l-3xl overflow-hidden"
                        >
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between px-6 pt-10 pb-6 border-b border-gray-50">
                                <h2 className="text-2xl font-black text-gray-dark tracking-tight">Options</h2>
                                <button
                                    onClick={() => setIsMenuOpen(false)}
                                    className="p-2 -mr-2 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-500 transition-colors active:scale-95"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Drawer Items */}
                            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
                                {menuItems.map((item, i) => (
                                    <button
                                        key={item.label}
                                        className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 active:scale-[0.98] transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn("p-2.5 rounded-[14px] shadow-sm border border-gray-100/50 justify-center shrink-0", item.bg)}>
                                                <item.icon className={cn("w-5 h-5", item.color)} strokeWidth={2.2} />
                                            </div>
                                            <div className="flex flex-col text-left">
                                                <span className="font-bold text-gray-dark/90">{item.label}</span>
                                                {item.sublabel && (
                                                    <span className="text-xs text-gray-400 font-medium mt-0.5">{item.sublabel}</span>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-playzi-green transition-colors shrink-0" strokeWidth={2} />
                                    </button>
                                ))}
                            </div>

                            {/* Separated Logout */}
                            <div className="p-6 pb-12">
                                <button
                                    className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-transparent hover:bg-gray-50 text-gray-400 hover:text-rose-500 font-bold active:scale-[0.98] transition-all"
                                >
                                    <LogOut className="w-5 h-5" strokeWidth={2} />
                                    <span>Se déconnecter</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
