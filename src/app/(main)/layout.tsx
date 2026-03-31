"use client"

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAppContext } from "@/context/AppContext";

import LoadingOverlay from "@/components/feature/LoadingOverlay";
import Navbar from "@/components/custom/Navbar";
import Sidebar from "@/components/custom/Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { hasInitialLoaded, setHasInitialLoaded } = useAppContext();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  if (!mounted) return null;

  return (
    <>
      {!hasInitialLoaded && <LoadingOverlay onComplete={() => setHasInitialLoaded(true)} />}
      
      <div className={`flex h-screen overflow-hidden transition-colors duration-500 relative ${isDark ? 'bg-jb-bg text-jb-text' : 'bg-[#ffffff] text-[#080808]'}`}>
        <Sidebar />

        <div className={`flex-1 flex flex-col min-h-0 overflow-hidden relative z-10 transition-colors duration-500 ${isDark ? 'bg-jb-bg' : 'bg-[#ebecf0]'}`}>
          <Navbar />
          
          {/* Main Content Area */}
          <div className={`flex-1 flex flex-col min-w-0 min-h-0 p-2 pb-0 transition-colors duration-500 ${isDark ? 'bg-jb-bg' : 'bg-[#ebecf0]'}`}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
