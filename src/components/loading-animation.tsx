
import { cn } from "@/lib/utils"
import Image from "next/image"

export function LoadingAnimation({ className }: { className?: string }) {
    return (
        <div className={cn("relative h-20 w-20", className)}>
            <style>
                {`
                @keyframes pulse {
                    0%, 100% { 
                        transform: scale(0.95);
                        opacity: 0.7;
                    }
                    50% { 
                        transform: scale(1.05); 
                        opacity: 1;
                    }
                }
                .pulsing-icon {
                    animation: pulse 2s infinite ease-in-out;
                }
                `}
            </style>
            <Image 
                src="https://firebasestorage.googleapis.com/v0/b/openhouse-dashboard.firebasestorage.app/o/RMOHbug.png?alt=media"
                alt="Loading animation"
                width={80}
                height={80}
                className="pulsing-icon"
                data-ai-hint="app icon"
            />
        </div>
    )
}
