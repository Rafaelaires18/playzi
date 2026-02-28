import { cn } from "@/lib/utils";
import type { SVGProps } from "react";

interface FlagPlayziIconProps extends SVGProps<SVGSVGElement> {
    isActive?: boolean;
}

export default function FlagPlayziIcon({ className = "", isActive = false, ...props }: FlagPlayziIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className={cn("transition-all duration-300", className)}
            aria-hidden="true"
            {...props}
        >
            <path
                d="M7.25 5V19"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
            />

            <circle
                cx="7.25"
                cy="3.75"
                r="1.15"
                stroke="currentColor"
                strokeWidth="1.7"
            />

            <path
                d="M8.55 6.15
                   C 10.95 4.95, 13.95 5.1, 16.45 6
                   C 17.75 6.46, 18.8 6.63, 19.75 6.48
                   V 13.1
                   C 18.78 13.26, 17.72 13.08, 16.45 12.62
                   C 13.95 11.72, 10.95 11.88, 8.55 13.08
                   V 6.15 Z"
                fill={isActive ? "currentColor" : "none"}
                fillOpacity={isActive ? 0.16 : 0}
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            <path
                d="M4.8 19H9.7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
