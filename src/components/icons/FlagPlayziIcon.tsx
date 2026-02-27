// Playzi Events icon:
// - Slightly tilted mast (~5°)
// - Wavy/flowing flag body (cubic bezier)
// - Stroke 1.65 (slightly more presence than standard 1.5)
// - Green #10B981 dot signature

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
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {/* Mast — slightly tilted (~5°): bottom (4,22) → top (5.5,3) */}
            <line x1="4" y1="22" x2="5.5" y2="3" />

            {/* Wavy flag body — bezier curves for flowing, alive feel */}
            {/* Top edge: sweeps outward right with slight upward ripple */}
            {/* Bottom edge: sweeps back with downward ripple, creating wave */}
            <path
                d="M 5.5 3 C 10 1.5, 17 4, 19.5 6 C 17 8.5, 10 10.5, 5.5 12 Z"
                fill={isActive ? "rgba(16,185,129,0.15)" : "none"}
            />

            {/* Playzi signature dot — always #10B981, centered in flag field */}
            <circle cx="13" cy="7" r="1.5" fill="#10B981" stroke="none" />
        </svg>
    );
}
