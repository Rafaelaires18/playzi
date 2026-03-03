"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import OptionsSheet from "@/components/options/OptionsSheet";

interface HeaderProps {
    onOpenOptions?: () => void;
}

export default function Header({ onOpenOptions }: HeaderProps = {}) {
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
