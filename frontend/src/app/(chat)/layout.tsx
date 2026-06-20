"use client"

import { useState, useEffect, Suspense } from "react";
import { useTheme } from "next-themes";

import LoadingOverlay from "@/components/layout/LoadingOverlay";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import TourOverlay from "@/components/features/onboarding/TourOverlay";
import { useTour } from "@/components/features/onboarding/useTour";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [overlayDone, setOverlayDone] = useState(false);
  const tour = useTour();

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  if (!mounted) {
    return (
      <div className="flex h-screen overflow-hidden bg-jb-bg">
        <div className="w-12 bg-jb-panel border-r border-jb-border shrink-0" />
        <div className="flex-1 flex flex-col">
          <div className="h-[44px] bg-jb-panel border-b border-jb-border" />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-jb-text-muted text-sm">Loading session...</div>
          </div>
        </div>
      </div>
    );
  }

  const showOverlay = !overlayDone;

  return (
    <>
      {!overlayDone && <LoadingOverlay onComplete={() => setOverlayDone(true)} />}
      
      {tour.isActive && (
        <TourOverlay
          step={tour.step}
          currentStep={tour.currentStep}
          isLastStep={tour.isLastStep}
          onNext={tour.next}
          onBack={tour.back}
          onClose={tour.close}
        />
      )}
      
      <div className={`flex h-screen overflow-hidden transition-colors duration-500 relative ${isDark ? 'bg-jb-bg text-jb-text' : 'bg-[#ffffff] text-[#080808]'}`}>
        <Sidebar />

        <div className={`flex-1 flex flex-col min-h-0 overflow-hidden relative z-10 transition-colors duration-500 ${isDark ? 'bg-jb-bg' : 'bg-[#ebecf0]'}`}>
          <Navbar onStartTour={tour.start} tourOpened={tour.hasBeenOpened} />
          
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
