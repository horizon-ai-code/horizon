"use client"

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import HorizonLogo from "@/components/ui/HorizonLogo";

interface LoadingOverlayProps {
  onComplete: () => void;
}

export default function LoadingOverlay({ onComplete }: LoadingOverlayProps) {
  const [greetingText, setGreetingText] = useState("");
  const { resolvedTheme } = useTheme();
  const fullGreeting = "Welcome to Horizon AI";

  useEffect(() => {
    let i = 0;
    const typingInterval = setInterval(() => {
      setGreetingText(fullGreeting.slice(0, i + 1));
      i++;
      if (i >= fullGreeting.length) {
        clearInterval(typingInterval);
        setTimeout(onComplete, 900);
      }
    }, 30);
    return () => clearInterval(typingInterval);
  }, [onComplete]);

  const isDark = resolvedTheme === "dark" || resolvedTheme === undefined;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-[100] bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className={`w-[600px] h-[600px] rounded-full blur-[120px] transition-colors duration-1000 ${isDark ? 'bg-cyan-500/20' : 'bg-cyan-400/40'}`}></div>
      </div>
      <div className="relative flex flex-col items-center animate-in fade-in duration-1000 z-10">
        <div className="mb-12 scale-[1.5]"><HorizonLogo glowing={true} /></div>
        <h2 className="text-4xl md:text-5xl font-poppins font-extrabold tracking-tight px-6 text-center text-foreground">
          {greetingText}
          <span className="inline-block w-2 h-12 ml-2 bg-cyan-400/80 align-middle animate-pulse shadow-[0_0_15px_rgba(0,229,255,0.5)]"></span>
        </h2>
        <p className="mt-8 text-[11px] uppercase tracking-[0.5em] font-semibold text-muted-foreground/40">Multi-Agent Orchestration</p>
      </div>
    </div>
  );
}
