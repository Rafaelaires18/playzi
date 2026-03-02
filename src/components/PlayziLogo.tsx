"use client";

import { motion } from "framer-motion";

export default function PlayziLogo({ className = "" }: { className?: string }) {
    const letters = "Playz".split("");

    return (
        <div className={`flex items-baseline font-black tracking-tight text-[56px] text-gray-dark ${className}`}>
            {letters.map((letter, i) => (
                <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        delay: i * 0.08,
                        duration: 0.5,
                        type: "spring",
                        stiffness: 150,
                        damping: 12
                    }}
                >
                    {letter}
                </motion.span>
            ))}

            {/* The 'i' without a dot (Turkish dotless i : ı), plus our animated custom green dot */}
            <div className="relative flex flex-col items-center justify-end h-full">
                {/* Custom Green Dot */}
                <motion.div
                    className="absolute top-[14px] w-[13px] h-[13px] bg-playzi-green rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                    initial={{ scale: 0, opacity: 0, y: -40 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{
                        delay: 6 * 0.08 + 0.3, // Wait for all letters to appear, then drop the dot
                        type: "spring",
                        stiffness: 400,
                        damping: 10
                    }}
                />
                <motion.span
                    className="relative"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        delay: 5 * 0.08,
                        duration: 0.5,
                        type: "spring",
                        stiffness: 150,
                        damping: 12
                    }}
                >
                    ı
                </motion.span>
            </div>
        </div>
    );
}
