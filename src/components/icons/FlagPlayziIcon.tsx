// Playzi Events — pro flag icon
// Proportions soignées : drapeau = 55% de la hauteur totale, bien visible à toute taille

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
            {/* Pole — full height */}
            <line x1="5" y1="22" x2="5" y2="2" />

            {/* Flag body
                - Attaches at pole top (5, 2)
                - Top edge arches strongly outward (control point goes up to y=0)
                - Bottom edge waves back in a soft S-curve
                - Flag height: 13px out of 24 = 54% → balanced, clearly visible
                - Flag width: up to x=22 = fills most of the horizontal space      */}
            <path
                d="M 5 2
                   C 11 0, 20 2.5, 22 6.5
                   C 20 10.5, 11 12.5, 5 15
                   Z"
            />
        </svg>
    );
}
