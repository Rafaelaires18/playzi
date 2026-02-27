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

            {/* ── Flag body                                */}
            {/*  Top:    gentle arch from pole up-rightward */}
            {/*  Right:  S-curve (out then in then out)     */}
            {/*  Bottom: scallop sweep back to pole          */}
            {/*  Left:   pole (closed by Z)                  */}
            <path
                d="M 8 5.5
                   C 12 3, 20 4.5, 22 7.5
                   C 22.5 10, 20.5 12.5, 22 15.5
                   C 20.5 18, 14 17.5, 8 16
                   Z"
                strokeLinejoin="round"
            />
        </svg>
    );
}
