"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useTheme } from "next-themes";

import LoadingOverlay from "@/components/layout/LoadingOverlay";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import TourOverlay from "@/components/features/onboarding/TourOverlay";
import PrivacyNoticeModal from "@/components/features/onboarding/PrivacyNoticeModal";
import { useTour } from "@/components/features/onboarding/useTour";
import {
  isPrivacyAcknowledged,
  setPrivacyAcknowledged,
  isTourCompleted,
} from "@/lib/onboardingStorage";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [overlayDone, setOverlayDone] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const tour = useTour();
  const hasInitializedOnboarding = useRef(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // Handle first-run onboarding state once the loading overlay completes
  useEffect(() => {
    if (!overlayDone || hasInitializedOnboarding.current) return;
    hasInitializedOnboarding.current = true;

    const acknowledged = isPrivacyAcknowledged();
    const completed = isTourCompleted();

    if (!acknowledged) {
      // First-time user: Show Privacy Notice
      setShowPrivacyModal(true);
    } else if (!completed) {
      // Interrupted onboarding: Privacy acknowledged, but tour incomplete -> resume tour from step 1
      tour.start();
    }
  }, [overlayDone, tour]);

  const handlePrivacyAcknowledge = useCallback(() => {
    setPrivacyAcknowledged(true);
    setShowPrivacyModal(false);
    // Automatically start Software Tour Step 1
    tour.start();
  }, [tour]);

  const handleManualStartTour = useCallback(() => {
    // Returning user clicking "New Here?": start tour directly without showing privacy notice
    tour.start();
  }, [tour]);

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

  return (
    <>
      {!overlayDone && <LoadingOverlay onComplete={() => setOverlayDone(true)} />}

      {/* Privacy Notice Modal */}
      <PrivacyNoticeModal
        isOpen={showPrivacyModal}
        onAcknowledge={handlePrivacyAcknowledge}
      />

      {/* Software Tour Overlay */}
      {tour.isActive && (
        <TourOverlay
          step={tour.step}
          currentStep={tour.currentStep}
          isLastStep={tour.isLastStep}
          onNext={tour.next}
          onBack={tour.back}
          onClose={tour.close}
          onSkip={tour.skip}
        />
      )}

      <div
        className={`flex h-screen overflow-hidden transition-colors duration-500 relative ${
          isDark ? "bg-jb-bg text-jb-text" : "bg-[#ffffff] text-[#080808]"
        }`}
      >
        <Sidebar />

        <div
          className={`flex-1 flex flex-col min-h-0 overflow-hidden relative z-10 transition-colors duration-500 ${
            isDark ? "bg-jb-bg" : "bg-[#ebecf0]"
          }`}
        >
          <Navbar onStartTour={handleManualStartTour} tourOpened={tour.hasBeenOpened} />

          {/* Main Content Area */}
          <div
            className={`flex-1 flex flex-col min-w-0 min-h-0 p-2 pb-0 transition-colors duration-500 ${
              isDark ? "bg-jb-bg" : "bg-[#ebecf0]"
            }`}
          >
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center">
                  <div className="animate-pulse text-jb-text-muted">Loading session...</div>
                </div>
              }
            >
              {children}
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
