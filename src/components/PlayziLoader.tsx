"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type PlayziLoaderProps = {
    compact?: boolean;
    message?: string;
    className?: string;
};

export default function PlayziLoader({
    compact = false,
    message,
    className,
}: PlayziLoaderProps) {
    const letterSize = compact ? "text-[34px]" : "text-[44px]";
    const dotSize = compact ? "h-2.5 w-2.5" : "h-3 w-3";
    const dotOffset = compact ? "mb-1 ml-0.5" : "mb-1.5 ml-1";
    const messageSize = compact ? "text-[11px]" : "text-[12px]";

    return (
        <div className={cn("flex flex-col items-center gap-2 text-center", className)}>
            <div className={cn("flex items-end font-black leading-none text-gray-dark/95", letterSize)}>
                <span>P</span>
                <div className={cn("relative", dotOffset, dotSize)}>
                    <span className="absolute inset-0 inline-block rounded-full bg-playzi-green/95 shadow-[0_0_0_1px_rgba(255,255,255,0.65)]" />
                    <motion.span
                        className="absolute inset-0 inline-block rounded-full bg-playzi-green/40"
                        animate={{ scale: [1, 1.9, 1], opacity: [0.45, 0, 0.45] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    />
                </div>
            </div>
            {message && <p className={cn("font-semibold text-gray-400", messageSize)}>{message}</p>}
        </div>
    );
}
