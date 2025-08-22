
import { cn } from "@/lib/utils"

export function LoadingAnimation({ className }: { className?: string }) {
    return (
        <div className={cn("relative h-20 w-20", className)}>
            <style>
                {`
                @keyframes swing {
                    0%, 100% { transform: rotateY(0); }
                    50% { transform: rotateY(-80deg); }
                }
                .door {
                    animation: swing 2s infinite ease-in-out;
                    transform-origin: left;
                }
                `}
            </style>
            <svg
                className="h-full w-full"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Door Frame */}
                <path d="M 25 10 L 25 90 L 75 90 L 75 10" stroke="hsl(var(--foreground))" strokeWidth="4" fill="none" />
                
                {/* Door */}
                <rect x="25" y="10" width="50" height="80" fill="hsl(var(--primary))" className="door" />

                {/* Doorknob */}
                <circle cx="65" cy="50" r="3" fill="hsl(var(--primary-foreground))" className="door" />
            </svg>
        </div>
    )
}
