// Playzi Events — exact replica of reference flag icon, outline style
// Base + pole + ball + large waving flag body
// stroke="currentColor", fill="none" → active fill via className (fill-playzi-green/20)

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
            {/* ── Base / socle ─────────────────────────── */}
            {/* Pill shape at bottom, centered on pole x=8 */}
            <path d="M5 21.5 Q5 23 6.5 23 L9.5 23 Q11 23 11 21.5 L11 21 L5 21 Z" />

            {/* ── Mât / pole  ──────────────────────────── */}
            <line x1="8" y1="21" x2="8" y2="5" />

            {/* ── Boule au sommet ──────────────────────── */}
            <circle cx="8" cy="3.8" r="1.4" />

            {/* ── Flag body ─────────────────────────────  */}
            {/*  Reference shape:                           */}
            {/*   - top edge: gentle arch up and rightward  */}
            {/*   - right side: S-curve (out → in → out)   */}
            {/*   - bottom: scallop sweep back to pole      */}
            {/*   - left = pole (closed by Z)               */}
            <path
                d="
                    M 8 5.2
                    C 12 2.8, 19.5 4.5, 22 7.5
                    C 22.5 10, 20 12.5, 22 15.5
                    C 20.5 18, 14 17.5, 8 16
                    Z
                "
            />
        </svg>
    );
}
