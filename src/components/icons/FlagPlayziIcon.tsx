// Playzi Events icon — outline flag on stand, wavy body
// No ball, no fill, currentColor only (gray inactive / green active)
// strokeWidth matches other bottom nav icons

interface FlagPlayziIconProps {
    className?: string;
    isActive?: boolean;
}

export default function FlagPlayziIcon({ className = "" }: FlagPlayziIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {/* ── Base / socle arrondi ──────────────────────── */}
            <path d="M8 21.5 Q8 20.5 9 20.5 L13 20.5 Q14 20.5 14 21.5 L14 22.5 Q14 23 13.5 23 L8.5 23 Q8 23 8 22.5 Z" />

            {/* ── Mât vertical ─────────────────────────────── */}
            <line x1="11" y1="20.5" x2="11" y2="3" />

            {/* ── Flag body — outline ondulé ────────────────── */}
            {/* Top edge: billows outward to the right         */}
            {/* Bottom: S-curve back toward pole               */}
            <path d="
                M 11 4
                C 16 2, 22 5, 22.5 8
                C 22.5 10.5, 19.5 11.5, 21.5 14.5
                C 19 16.5, 13 15.5, 11 14
                Z
            " />
        </svg>
    );
}
