"use client"

import { useState, useEffect, useCallback, Suspense } from "react";
import { useTheme } from "next-themes";
import { useChatStore } from "@/store/useChatStore";

import LoadingOverlay from "@/components/layout/LoadingOverlay";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const hasInitialLoaded = useChatStore((state) => state.hasInitialLoaded);
  const setHasInitialLoaded = useChatStore((state) => state.setHasInitialLoaded);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  const handleLoadComplete = useCallback(() => setHasInitialLoaded(true), [setHasInitialLoaded]);

  if (!mounted) return null;

  return (
    <>
      {!hasInitialLoaded && <LoadingOverlay onComplete={handleLoadComplete} />}
      
      <div className={`flex h-screen overflow-hidden transition-colors duration-500 relative ${isDark ? 'bg-jb-bg text-jb-text' : 'bg-[#ffffff] text-[#080808]'}`}>
        <Sidebar />

        <div className={`flex-1 flex flex-col min-h-0 overflow-hidden relative z-10 transition-colors duration-500 ${isDark ? 'bg-jb-bg' : 'bg-[#ebecf0]'}`}>
          <Navbar />
          
          {/* Main Content Area */}
          <div className={`flex-1 flex flex-col min-w-0 min-h-0 p-2 pb-0 transition-colors duration-500 ${isDark ? 'bg-jb-bg' : 'bg-[#ebecf0]'}`}>
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-jb-text-muted">Loading session...</div></div>}>
              {children}
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
