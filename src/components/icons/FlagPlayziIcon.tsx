// Custom Playzi-branded flag icon:
// Standard flag outline (Lucide-style) + small #10B981 dot signature

interface FlagPlayziIconProps {
    className?: string;
    isActive?: boolean;
}

export default function FlagPlayziIcon({ className = "", isActive = false }: FlagPlayziIconProps) {
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
            {/* Flag body */}
            <path
                d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
                fill={isActive ? "rgba(16,185,129,0.15)" : "none"}
            />
            {/* Flag pole */}
            <line x1="4" y1="22" x2="4" y2="15" />
            {/* Playzi signature dot — always green */}
            <circle cx="12" cy="9" r="1.5" fill="#10B981" stroke="none" />
        </svg>
    );
}
