"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import type { TourStep } from "./tourSteps";
import { TOUR_STEPS } from "./tourSteps";

interface TourOverlayProps {
  step: TourStep;
  currentStep: number;
  isLastStep: boolean;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  onSkip?: () => void;
}

function calculatePosition(
  rect: DOMRect,
  preferredPosition: string,
  tooltipW: number,
  tooltipH: number
): { top: number; left: number } {
  const gap = 12;
  const padding = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let pos = preferredPosition;

  // Auto-flip if overflowing viewport
  if (pos === "bottom" && rect.bottom + gap + tooltipH > vh - padding) {
    pos = "top";
  } else if (pos === "top" && rect.top - gap - tooltipH < padding) {
    pos = "bottom";
  } else if (pos === "right" && rect.right + gap + tooltipW > vw - padding) {
    pos = "left";
  } else if (pos === "left" && rect.left - gap - tooltipW < padding) {
    pos = "right";
  }

  let left: number;
  let top: number;

  switch (pos) {
    case "bottom":
      left = rect.left + rect.width / 2 - tooltipW / 2;
      top = rect.bottom + gap;
      break;
    case "top":
      left = rect.left + rect.width / 2 - tooltipW / 2;
      top = rect.top - gap - tooltipH;
      break;
    case "left":
      left = rect.left - gap - tooltipW;
      top = rect.top + rect.height / 2 - tooltipH / 2;
      break;
    case "right":
      left = rect.right + gap;
      top = rect.top + rect.height / 2 - tooltipH / 2;
      break;
    default:
      left = rect.left + rect.width / 2 - tooltipW / 2;
      top = rect.bottom + gap;
  }

  // Viewport clamp
  left = Math.max(padding, Math.min(left, vw - tooltipW - padding));
  top = Math.max(padding, Math.min(top, vh - tooltipH - padding));

  return { left, top };
}

export default function TourOverlay({
  step,
  currentStep,
  isLastStep,
  onNext,
  onBack,
  onClose,
  onSkip,
}: TourOverlayProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = mounted ? (resolvedTheme === "dark" || resolvedTheme === undefined) : true;


  const handleSkip = useCallback(() => {
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  }, [onSkip, onClose]);

  const updatePosition = useCallback(() => {
    if (!step.targetId) {
      setRect(null);
      return;
    }
    const el = document.getElementById(step.targetId);
    if (el) {
      const bounds = el.getBoundingClientRect();
      // Wait for the sidebar transition if needed
      if (step.targetId === "tour-sidebar" && bounds.width < 180 && window.innerWidth > 640) {
        setRect(null);
        return;
      }
      setRect(bounds);
    } else {
      setRect(null);
    }
  }, [step.targetId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    let observer: ResizeObserver | null = null;
    if (step.targetId) {
      const el = document.getElementById(step.targetId);
      if (el) {
        observer = new ResizeObserver(() => {
          updatePosition();
        });
        observer.observe(el);
      }
    }

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      if (observer) observer.disconnect();
    };
  }, [updatePosition, step.targetId]);

  // Focus primary button on step change & handle keyboard navigation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTransitioning(false);
    const timer = setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, [currentStep]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleSkip();
        return;
      }

      if (e.key === "Tab") {
        if (!tooltipRef.current) return;
        const focusable = tooltipRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [handleSkip]
  );

  const handleNextClick = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    onNext();
  }, [isTransitioning, onNext]);

  const handleBackClick = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    onBack();
  }, [isTransitioning, onBack]);

  const isCenter = step.position === "center" || !step.targetId || !rect;

  const tooltipW = isCenter ? Math.min(480, (typeof window !== "undefined" ? window.innerWidth : 800) - 32) : Math.min(340, (typeof window !== "undefined" ? window.innerWidth : 800) - 32);
  const tooltipH = isCenter ? 320 : 220;

  let left: number;
  let top: number;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  if (isCenter || !rect) {
    left = Math.max(16, (vw - tooltipW) / 2);
    top = Math.max(16, (vh - tooltipH) / 3);
  } else {
    const coords = calculatePosition(rect, step.position, tooltipW, tooltipH);
    left = coords.left;
    top = coords.top;
  }

  const totalSteps = TOUR_STEPS.length;
  const isFirstStep = currentStep === 0;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Software Tour Step ${currentStep + 1} of ${totalSteps}: ${step.title}`}
      onKeyDown={handleKeyDown}
    >
      {/* Overlay Background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none transition-colors duration-300"
        style={{
          backgroundColor: isCenter || !rect ? "rgba(0,0,0,0.7)" : "transparent",
        }}
      />

      {/* Target Highlight Ring */}
      {rect && (
        <div
          className="absolute pointer-events-none z-10 transition-all duration-300 ease-out"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            borderRadius: "12px",
            boxShadow: `0 0 0 2px ${
              isDark ? "#5a8cf8" : "#3574f0"
            }, 0 0 0 9999px rgba(0,0,0,0.65), 0 0 24px rgba(53,116,240,0.35)`,
          }}
        />
      )}

      {/* Tour Tooltip Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={`absolute z-20 rounded-xl shadow-2xl border flex flex-col ${
            isCenter ? "p-7" : "p-5"
          } ${
            isDark
              ? "bg-[#2b2d30] border-[#393b40] text-jb-text shadow-black/60"
              : "bg-white border-[#dfdfdf] text-[#080808] shadow-2xl shadow-black/15"
          }`}
          style={{ width: tooltipW, left, top }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress Indicator */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[11px] font-bold tracking-wider uppercase ${
                isDark ? "text-jb-accent" : "text-[#3574f0]"
              }`}
            >
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>

          {/* Title */}
          <h3
            className={`${
              isCenter ? "text-[18px] mt-2" : "text-[14px] mt-1.5"
            } font-bold leading-tight ${isDark ? "text-[#d9dee7]" : "text-[#080808]"}`}
          >
            {step.title}
          </h3>

          {/* Body */}
          <p
            className={`${
              isCenter
                ? "text-[13px] mt-3 leading-relaxed whitespace-pre-line"
                : "text-[12px] mt-2 leading-relaxed"
            } ${isDark ? "text-[#a8b0bd]" : "text-[#555]"}`}
          >
            {step.body}
          </p>

          {/* Action Navigation Footer */}
          <div
            className={`flex items-center justify-between gap-2 mt-4 pt-3 border-t ${
              isDark ? "border-[#393b40]" : "border-[#eee]"
            }`}
          >
            {/* Left Action: Skip Tour or Back */}
            <div>
              {isFirstStep ? (
                <button
                  type="button"
                  onClick={handleSkip}
                  className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jb-accent ${
                    isDark
                      ? "text-[#8d95a5] hover:text-[#d9dee7] hover:bg-white/5"
                      : "text-[#777] hover:text-[#080808] hover:bg-black/5"
                  }`}
                  aria-label="Skip Tour"
                >
                  Skip Tour
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBackClick}
                  disabled={isTransitioning}
                  className={`px-3.5 py-1.5 text-[12px] font-medium rounded-md border cursor-pointer transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jb-accent ${
                    isDark
                      ? "border-[#393b40] text-[#d9dee7] hover:bg-[#1e1f22]"
                      : "border-[#ddd] text-[#333] hover:bg-[#f2f2f2]"
                  }`}
                >
                  Back
                </button>
              )}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {!isFirstStep && !isLastStep && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className={`text-[11px] font-semibold px-2 py-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jb-accent ${
                    isDark
                      ? "text-[#8d95a5] hover:text-[#d9dee7] hover:bg-white/5"
                      : "text-[#777] hover:text-[#080808] hover:bg-black/5"
                  }`}
                >
                  Skip Tour
                </button>
              )}

              <button
                ref={primaryButtonRef}
                type="button"
                onClick={handleNextClick}
                disabled={isTransitioning}
                className={`px-4 py-1.5 text-[12px] font-bold rounded-md cursor-pointer transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jb-accent shadow-sm ${
                  isDark
                    ? "bg-jb-accent hover:bg-jb-accent/90 text-white shadow-jb-accent/20"
                    : "bg-[#3574f0] hover:bg-[#3574f0]/90 text-white shadow-[#3574f0]/20"
                }`}
              >
                {isLastStep ? "Finish Tour" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
