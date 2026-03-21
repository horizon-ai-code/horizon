"use client"

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="w-[52px] h-[28px] rounded-full shrink-0 bg-muted border border-border" />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className="relative shrink-0 w-[52px] h-[28px] rounded-full border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
      style={{
        backgroundColor: isDark ? "#06b6d4" : "var(--muted)",
        borderColor:     isDark ? "#06b6d4" : "var(--border)",
        transition:
          "background-color 250ms cubic-bezier(0.4,0,0.2,1), border-color 220ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >

      {/* ── Faint moon on left side of track — shown in light mode ── */}
      <span
        className="absolute left-[5px] top-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          opacity:    isDark ? 0 : 0.35,
          transition: "opacity 250ms ease",
        }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>

      {/* ── Faint sun on right side of track — shown in dark mode ── */}
      <span
        className="absolute right-[5px] top-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          opacity:    isDark ? 0.5 : 0,
          transition: "opacity 250ms ease",
        }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1"  x2="12" y2="3"  />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"  />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1"  y1="12" x2="3"  y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" />
          <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
        </svg>
      </span>

      {/* ── Sliding thumb ── */}
      <span
        className="absolute top-[3px] left-[3px] w-[20px] h-[20px] rounded-full bg-white flex items-center justify-center shadow-sm"
        style={{
          transform:  isDark ? "translateX(24px)" : "translateX(0px)",
          transition: "transform 460ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          willChange: "transform",
        }}
      >
        {/* Sun — visible when light mode */}
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{
            opacity:    isDark ? 0 : 1,
            transform:  isDark ? "rotate(90deg) scale(0.4)" : "rotate(0deg) scale(1)",
            transition: "opacity 200ms ease, transform 300ms cubic-bezier(0.34,1.4,0.64,1)",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1"  x2="12" y2="3"  />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"  />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1"  y1="12" x2="3"  y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" />
            <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
          </svg>
        </span>

        {/* Moon — visible when dark mode */}
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{
            opacity:    isDark ? 1 : 0,
            transform:  isDark ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0.4)",
            transition: "opacity 200ms ease, transform 300ms cubic-bezier(0.34,1.4,0.64,1)",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </span>
      </span>

    </button>
  );
}