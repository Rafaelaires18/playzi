// Playzi Events icon — polished flag on stand
// Active state: matches Compass behavior (fill-playzi-green/20 via className)
// Paths designed for natural, balanced proportions

interface FlagPlayziIconProps {
    className?: string;
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
            {/* ── Background circle (fills with fill-playzi-green/20 when active) */}
            <circle cx="12" cy="10" r="10" stroke="none" />

            {/* ── Base ────────────────────────────────────────── */}
            <rect x="7.5" y="20.5" width="7" height="2" rx="1" />

            {/* ── Pole ─────────────────────────────────────────── */}
            <line x1="11" y1="20.5" x2="11" y2="3.5" />

            {/* ── Flag body — smooth natural wave ──────────────── */}
            {/* Left edge = pole (closed by Z)                      */}
            {/* Top: sweeps out right, slightly arched upward       */}
            {/* Bottom: ripples back in with natural S-curve        */}
            <path
                d="M 11 4
                   C 15 2, 21 4.5, 22 8
                   C 21 10.5, 16 11.5, 11 14
                   Z"
                strokeLinejoin="round"
            />
        </svg>
    );
}
