"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import OptionsSheet from "@/components/options/OptionsSheet";

interface HeaderProps {
    devGender?: 'male' | 'female';
    onDevGenderChange?: (g: 'male' | 'female') => void;
    onOpenOptions?: () => void;
}

export default function Header({ devGender, onDevGenderChange, onOpenOptions }: HeaderProps = {}) {
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);

    const handleOpen = () => {
        setIsOptionsOpen(true);
        if (onOpenOptions) onOpenOptions();
    };

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
                    onClick={handleOpen}
                    className="p-2 -mr-2 text-gray-600 hover:text-black hover:bg-gray-100/80 rounded-full transition-colors"
                    aria-label="Ouvrir le menu"
                >
                    <Menu className="w-6 h-6" strokeWidth={2} />
                </motion.button>
            </header>

            <OptionsSheet open={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} />
        </>
    );
}
