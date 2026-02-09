"use client";

import { useEffect, useState } from "react";
import Image from "next/image";




const WORDS = ["il Futuro", "un Lavoro", "fare Soldi", "un Business"];
const AGENT_DURATION_MS = 3000;
const WORD_DURATION_MS = 800; // Fast switching

export default function TvHookPage() {
    const [showAgents, setShowAgents] = useState(true);
    const [wordIndex, setWordIndex] = useState(0);

    // Main Cycle Controller
    useEffect(() => {
        let timeout: NodeJS.Timeout;

        if (showAgents) {
            // Show Agents for AGENT_DURATION_MS, then switch to text
            timeout = setTimeout(() => {
                setShowAgents(false);
                setWordIndex(0); // Reset word index when entering text mode
            }, AGENT_DURATION_MS);
        } else {
            // Text Mode: Cycle through words
            // Total duration = WORD_DURATION_MS * WORDS.length
            // After that, switch back to Agents
            const totalTextDuration = WORD_DURATION_MS * WORDS.length;

            // We need a separate interval for the words
            const wordInterval = setInterval(() => {
                setWordIndex((prev) => {
                    const next = prev + 1;
                    if (next >= WORDS.length) {
                        // End of text cycle, handled by the main timeout usually, 
                        // but we can just let it loop if the timeout is slightly off.
                        return 0;
                    }
                    return next;
                });
            }, WORD_DURATION_MS);

            // Timeout to switch back to agents
            timeout = setTimeout(() => {
                clearInterval(wordInterval);
                setShowAgents(true);
            }, totalTextDuration);

            return () => clearInterval(wordInterval);
        }

        return () => clearTimeout(timeout);
    }, [showAgents]);

    const [hasInteracted, setHasInteracted] = useState(false);

    return (
        <div
            onClick={() => setHasInteracted(true)}
            className={`w-full h-screen bg-black overflow-hidden relative selection:bg-none cursor-pointer`}
        >
            {/* Interaction Overlay for Audio Policies */}
            {!hasInteracted && (
                <div className="absolute inset-x-0 bottom-10 z-50 flex justify-center animate-bounce">
                    <span className="bg-white/10 backdrop-blur text-white px-4 py-2 rounded-full text-sm uppercase tracking-widest border border-white/20">
                        Click to Enable Sound
                    </span>
                </div>
            )}

            {/* Background Music - Plays only after interaction or if policy allows */}
            {hasInteracted && (
                <audio autoPlay loop>
                    {/* User to replace src with actual file */}
                    <source src="/assets/futuristic_music.mp3" type="audio/mpeg" />
                </audio>
            )}

            {/* VIEW 1: AGENTS WALKING */}
            <div
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${showAgents ? "opacity-100 z-20" : "opacity-0 z-0"
                    }`}
            >
                <div className="relative w-full h-full">
                    {/* Image with Zoom Animation */}
                    <div className={`w-full h-full ${showAgents ? "animate-slow-zoom" : ""}`}>
                        <Image
                            src="/assets/ai_team_walking.png"
                            alt="AI Team Agents"
                            fill
                            className="object-cover"
                            priority
                        />
                    </div>
                    {/* Overlay for cinematic feel */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
            </div>

            {/* VIEW 2: DYNAMIC TEXT */}
            <div
                className={`absolute inset-0 bg-black flex flex-col items-center justify-center transition-opacity duration-300 ${!showAgents ? "opacity-100 z-30" : "opacity-0 z-0"
                    }`}
            >
                {/* Dynamic Background */}
                <div className="absolute inset-0 opacity-40">
                    <Image
                        src="/assets/futuristic_bg_texture.png"
                        alt="Texture"
                        fill
                        className="object-cover animate-pulse-slow"
                    />
                </div>

                <div className="relative z-10 text-center flex flex-col items-center gap-4">
                    <h1 className="text-6xl md:text-8xl font-bold text-white tracking-widest uppercase mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                        Regala
                    </h1>

                    <div className="h-32 md:h-48 flex items-center justify-center overflow-visible">
                        {WORDS.map((word, i) => (
                            <span
                                key={word}
                                className={`absolute text-6xl md:text-7xl lg:text-9xl font-extrabold uppercase transition-all duration-300 transform
                    ${i === wordIndex
                                        ? "opacity-100 scale-100 translate-y-0 filter blur-0"
                                        : "opacity-0 scale-90 translate-y-8 filter blur-sm"
                                    }
                    bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(255,215,0,0.6)]
                    `}
                            >
                                {word}
                            </span>
                        ))}
                    </div>

                    <h1 className="text-6xl md:text-8xl font-bold text-white tracking-widest uppercase mt-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                        nell&apos; AI
                    </h1>
                </div>
            </div>

            <style jsx global>{`
        @keyframes slow-zoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.15); }
        }
        .animate-slow-zoom {
          animation: slow-zoom 4s linear forwards;
        }
        .animate-pulse-slow {
            animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
        </div>
    );
}
