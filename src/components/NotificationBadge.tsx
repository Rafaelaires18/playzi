"use client";

import { cn } from "@/lib/utils";

export type NotificationBadgeTone = "red" | "amber" | "blue" | "orange";

type NotificationBadgeProps = {
    tone: NotificationBadgeTone;
    count?: number;
    className?: string;
};

const TONE_CLASS: Record<NotificationBadgeTone, string> = {
    red: "bg-rose-500",
    amber: "bg-[#E25822]",
    blue: "bg-blue-500",
    orange: "bg-amber-500",
};

export default function NotificationBadge({ tone, count, className }: NotificationBadgeProps) {
    const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Math.floor(Number(count))) : 0;
    const hasCount = safeCount > 0;
    const label = hasCount ? (safeCount > 9 ? "9+" : String(safeCount)) : "";

    return (
        <span
            className={cn(
                "absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1.5 rounded-full border-2 border-white shadow-sm pointer-events-none flex items-center justify-center text-[10px] font-black text-white leading-none",
                TONE_CLASS[tone],
                className
            )}
        >
            {label}
        </span>
    );
}
