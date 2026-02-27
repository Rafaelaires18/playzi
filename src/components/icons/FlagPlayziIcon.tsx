// Playzi Events — flag-on-stand
// First flag body (exact) on current mast (base + pole + ball)

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
            {/* Base */}
            <path d="M5 22.5 Q5 21 6.5 21 L9.5 21 Q11 21 11 22.5" />

            {/* Pole */}
            <line x1="8" y1="21" x2="8" y2="4.5" />

            {/* Ball */}
            <circle cx="8" cy="3" r="1.5" />

            {/* Flag body — EXACT first flag, scaled up for visibility */}
            {/* Original: M5.5 3 C10 1.5, 17 4, 19.5 6 C17 8.5, 10 10.5, 5.5 12 */}
            {/* Translated to mast at x=8, y=4.5 + scaled wider */}
            <path d="M 8 4.5
                     C 13 2, 21 5, 23 9
                     C 21 13, 13 14, 8 16
                     Z" />
        </svg>
    );
}
