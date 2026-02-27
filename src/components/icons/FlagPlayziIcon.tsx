// Playzi Events — premium flag-on-stand icon
// Style: base + vertical pole + ball knob + waving flag body
// Matches the "quality flag" reference style

interface FlagPlayziIconProps {
    className?: string;
    isActive?: boolean;
}

export default function FlagPlayziIcon({ className = "", isActive = false }: FlagPlayziIconProps) {
    const green = "#10B981";
    const activeFill = "rgba(16,185,129,0.15)";

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {/* ── Base / socle ─────────────────────────────── */}
            <rect
                x="7"
                y="20.5"
                width="8"
                height="2.5"
                rx="1.25"
                fill={isActive ? activeFill : "none"}
            />

            {/* ── Pole / mât ───────────────────────────────── */}
            <line x1="11" y1="20.5" x2="11" y2="4.2" />

            {/* ── Ball / boule au sommet ────────────────────── */}
            <circle
                cx="11"
                cy="3"
                r="1.3"
                fill={isActive ? green : "none"}
                stroke="currentColor"
            />

            {/* ── Waving flag body ─────────────────────────── */}
            {/* Top edge: sweeps right and slightly up */}
            {/* Bottom edge: mirrors back with counter-wave */}
            <path
                d="M 11 5.2 C 15 3, 21 5, 22.5 7.5 C 20.5 10.5, 15 11, 11 13.5 Z"
                fill={isActive ? activeFill : "none"}
                strokeLinejoin="round"
            />

            {/* ── Playzi signature dot inside flag ─────────── */}
            <circle cx="17" cy="8.8" r="1.3" fill={green} stroke="none" />
        </svg>
    );
}
