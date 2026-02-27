// Playzi Events — original first flag, scaled up + more realistic
// Straight mast, large waving flag body, same 2-curve S-shape as v1

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
            {/* Pole — straight, from bottom to top */}
            <line x1="5" y1="22" x2="5" y2="2" />

            {/* Flag body — same S-curve shape as very first version, scaled bigger */}
            {/* Attaches to pole at (5, 3), sweeps right, returns at (5, 14) */}
            <path d="M 5 3
                     C 10 1, 19 3.5, 22 7
                     C 19 10.5, 10 11, 5 14
                     Z" />
        </svg>
    );
}
