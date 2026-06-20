"use client"

import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { API_URL } from "@/lib/env";
import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";

interface NavbarProps {
  onStartTour?: () => void;
}

export default function Navbar({ onStartTour }: NavbarProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/health`);
        if (active) setServerOnline(res.ok);
        return res.ok;
      } catch {
        if (active) setServerOnline(false);
        return false;
      }
    };

    const scheduleNext = (wasOk: boolean) => {
      if (!active) return;
      const delay = wasOk ? 10_000 : 2_000;
      timerRef.current = setTimeout(async () => {
        const ok = await check();
        scheduleNext(ok);
      }, delay);
    };

    check().then(scheduleNext);

    return () => {
      active = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <nav className={`relative z-40 border-b flex justify-between items-center shrink-0 h-[44px] select-none transition-all duration-300
      ${isDark ? 'bg-jb-bg border-jb-border/50' : 'bg-[#f7f8fa] border-[#ebecf0]'} font-sans`}>
      
      {/* Left Section: Logo, Menu & Project Info */}
      <div className="flex items-center h-full">
        <Link href="/" className="flex items-center h-full">
          <div className={`h-full px-4 flex items-center justify-center shrink-0 border-r transition-colors duration-300
            ${isDark ? 'border-jb-border/30' : 'border-[#ebecf0]'}`}>
             <Image 
               src={isDark ? "/logo-dark.png" : "/logo-light.png"} 
               alt="Logo" 
               width={20}
               height={20}
               className="h-[20px] w-auto transition-opacity duration-300 opacity-90 hover:opacity-100"
             />
          </div>

          <span className={`h-full px-3 flex items-center gap-1.5 text-[13px] font-semibold tracking-wide transition-colors cursor-pointer
            ${isDark ? 'text-jb-text hover:bg-jb-panel' : 'text-[#080808] hover:bg-[#ebecf0]'}`}>
            Horizon AI
          </span>
        </Link>
        <button aria-label="Refactoring Studio" className={`h-full px-3 flex items-center gap-1.5 text-[13px] font-medium transition-colors cursor-default
          ${isDark ? 'text-jb-text opacity-80 hover:bg-jb-panel hover:opacity-100' : 'text-[#080808] opacity-60 hover:bg-[#ebecf0] hover:opacity-100'}`}>
          Refactoring Studio
        </button>
      </div>

      {/* Center Section */}
      <div className="flex-1" />

      {/* Right Section: Tools & Window Controls */}
      <div className="flex items-center h-full">
        <div className="flex items-center px-4 h-full gap-3">
          {onStartTour && (
            <button
              onClick={onStartTour}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium cursor-pointer transition-all border border-dashed
                ${isDark ? 'border-jb-border/40 text-jb-text-muted hover:text-jb-accent hover:border-jb-accent/50' : 'border-[#ddd] text-[#888] hover:text-[#3574f0] hover:border-[#3574f0]/50'}`}
              title="Take a quick tour"
              aria-label="Take a quick tour"
            >
              <span className="text-[13px] font-bold">?</span>
              New here?
            </button>
          )}
          {/* Orchestrator Connection Status */}
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${
              serverOnline === null ? "bg-gray-400 animate-pulse" :
              serverOnline ? "bg-emerald-500" :
              "bg-red-500"
            }`} />
            <span className={`text-[11px] font-medium transition-colors duration-300 ${
              serverOnline === null ? "text-gray-400" :
              serverOnline ? "text-emerald-500" :
              "text-red-500"
            }`}>
               {serverOnline === null ? "Checking..." :
               serverOnline ? "Connected" :
               "Disconnected"}
            </span>
          </div>
          <ThemeToggle />
        </div>
        
      </div>

    </nav>
  );
}
