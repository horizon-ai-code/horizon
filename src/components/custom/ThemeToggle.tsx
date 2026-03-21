"use client"

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Skeleton loader to prevent hydration mismatch
  if (!mounted) {
    return <div className="w-[50px] h-[26px] rounded-[13px] bg-slate-100 dark:bg-[#1a1a1a] border-[1.5px] border-slate-200 dark:border-[#3f3f3f] shrink-0" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div 
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative w-[50px] h-[26px] rounded-[13px] cursor-pointer shrink-0 border-[1.5px]`}
      style={{
        // Using Horizon's cyan for active, slate for inactive
        backgroundColor: isDark ? '#06b6d4' : '#f8fafc', 
        borderColor: isDark ? '#06b6d4' : '#e2e8f0',
        transition: 'background-color 700ms cubic-bezier(0.4,0,0.2,1), border-color 650ms cubic-bezier(0.4,0,0.2,1)'
      }}
    >
      {/* The Sliding Thumb */}
      <div 
        className="absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white flex items-center justify-center shadow-sm"
        style={{
          transform: isDark ? 'translateX(24px)' : 'translateX(0)',
          transition: 'transform 480ms cubic-bezier(0.34,1.56,0.64,1)' // The Spring Bounce
        }}
      >
        {/* Sun Icon */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{
            opacity: isDark ? 0 : 1,
            transform: isDark ? 'rotate(80deg) scale(0.5)' : 'rotate(0deg) scale(1)',
            transition: 'opacity 260ms ease, transform 380ms cubic-bezier(0.34,1.4,0.64,1)'
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        </div>
        
        {/* Moon Icon */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{
            opacity: isDark ? 1 : 0,
            transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(-80deg) scale(0.5)',
            transition: 'opacity 260ms ease, transform 380ms cubic-bezier(0.34,1.4,0.64,1)'
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </div>
      </div>
    </div>
  );
}