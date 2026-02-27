// Playzi Events — flag-on-stand icon matching the reference image
// Outline style, same stroke as other nav icons, fill via className when active

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
            {/* ── Base / socle pill ─────────────────────── */}
            <rect x="4.5" y="20.5" width="7" height="2.5" rx="1.25" />

            {/* ── Mât vertical ─────────────────────────── */}
            <line x1="8" y1="20.5" x2="8" y2="5.5" />

            {/* ── Boule au sommet ──────────────────────── */}
            <circle cx="8" cy="4" r="1.5" />

            {/* ── Flag body — simple 2-curve (original style) ─ */}
            {/* Top: sweeps out and right                        */}
            {/* Bottom: natural return wave toward pole          */}
            <path
                d="M 8 5.5
                   C 13 3, 20.5 5, 22 8
                   C 20 10.5, 13.5 11.5, 8 14
                   Z"
                strokeLinejoin="round"
            />
        </svg>
    );
}
