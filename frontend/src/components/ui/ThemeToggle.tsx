"use client"

import { useTheme } from "next-themes";

import { useMounted } from "@/hooks/useMounted";
import { useIsDark } from "@/hooks/useIsDark";

export default function ThemeToggle() {
  const { setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = useIsDark();

  if (!mounted) {
    return (
      <div className="w-[52px] h-[28px] rounded-full shrink-0 bg-jb-bg border border-jb-border" />
    );
  }

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className="relative shrink-0 w-[50px] h-[26px] rounded-full border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-jb-accent cursor-pointer transition-all duration-300"
      style={{
        backgroundColor: isDark ? "#393b40" : "#ffffff",
        borderColor:     isDark ? "#4e5157" : "#dfdfdf",
      }}
    >

      {/* ── Moon icon (left side) ── */}
      <span
        className="absolute left-[6px] top-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          opacity: isDark ? 0.35 : 0.8,
          transition: "opacity 300ms ease",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#dfe1e5" : "#818594"} strokeWidth="2.5">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>

      {/* ── Sun icon (right side) ── */}
      <span
        className="absolute right-[6px] top-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          opacity: isDark ? 0.8 : 0.35,
          transition: "opacity 300ms ease",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#dfe1e5" : "#818594"} strokeWidth="2.5">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      </span>

      {/* ── Sliding thumb ── */}
      <span
        className={`absolute top-[2px] left-[2px] w-[20px] h-[20px] rounded-full flex items-center justify-center shadow-md transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isDark ? 'bg-[#548af7]' : 'bg-[#3574f0]'}`}
        style={{
          transform: isDark ? "translateX(24px)" : "translateX(0px)",
        }}
      >
        {isDark ? (
           <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
           </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3">
            <circle cx="12" cy="12" r="5" />
          </svg>
        )}
      </span>

    </button>
  );
}