"use client";

import { useState, useEffect, useCallback } from "react";
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
}

function getTooltipPosition(
  rect: DOMRect,
  position: string
): { top: number; left: number } {
  const gap = 12;
  switch (position) {
    case "bottom":
      return { top: rect.bottom + gap, left: rect.left + rect.width / 2 };
    case "top":
      return { top: rect.top - gap, left: rect.left + rect.width / 2 };
    case "left":
      return { top: rect.top + rect.height / 2, left: rect.left - gap };
    case "right":
      return { top: rect.top + rect.height / 2, left: rect.right + gap };
    default:
      return { top: rect.bottom + gap, left: rect.left + rect.width / 2 };
  }
}

export default function TourOverlay({
  step,
  currentStep,
  isLastStep,
  onNext,
  onBack,
  onClose,
}: TourOverlayProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark" || resolvedTheme === undefined;
  const [rect, setRect] = useState<DOMRect | null>(null);

  const updatePosition = useCallback(() => {
    const el = document.getElementById(step.targetId);
    if (el) setRect(el.getBoundingClientRect());
  }, [step.targetId]);

  useEffect(() => {
    updatePosition(); // eslint-disable-line react-hooks/set-state-in-effect
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [updatePosition]);

  if (!rect) return null;

  const pos = getTooltipPosition(rect, step.position);
  const tooltipW = 320;
  const tooltipH = 200;

  let left = pos.left - tooltipW / 2;
  let top = pos.top;

  if (step.position === "left") left = pos.left - tooltipW - 8;
  if (step.position === "right") left = pos.left + 8;
  if (step.position === "top") top = pos.top - tooltipH - 8;
  if (step.position === "bottom") top = pos.top + 8;

  if (step.position === "left" || step.position === "right") {
    top = Math.max(20, Math.min(top, window.innerHeight - tooltipH - 20));
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8));
  } else {
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipH - 8));
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8));
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Light overlay */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundColor: "rgba(0,0,0,0.08)",
        }}
      />

      {/* Highlight ring */}
      <div
        className="absolute pointer-events-none z-10"
        style={{
          left: rect.left - 4,
          top: rect.top - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          borderRadius: "12px",
          boxShadow: `0 0 0 2px ${isDark ? "#5a8cf8" : "#3574f0"}, 0 0 20px rgba(53,116,240,0.3)`,
        }}
      />

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.95, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -5 }}
          transition={{ duration: 0.15 }}
          className={`absolute z-10 rounded-xl shadow-2xl border p-5 ${isDark ? "bg-[#2b2d30] border-[#393b40]" : "bg-white border-[#dfdfdf]"}`}
          style={{ width: tooltipW, left, top }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className={`text-[10px] font-bold tracking-wide ${isDark ? "text-[#8d95a5]" : "text-[#888]"}`}>
            Step {currentStep + 1} / {TOUR_STEPS.length}
          </span>
          <h3 className={`text-[14px] font-bold mt-1 ${isDark ? "text-[#d9dee7]" : "text-[#080808]"}`}>
            {step.title}
          </h3>
          <p className={`text-[12px] leading-relaxed mt-2 ${isDark ? "text-[#a8b0bd]" : "text-[#555]"}`}>
            {step.body}
          </p>
          <div className="flex items-center justify-between mt-4 pt-3 border-t" style={{ borderColor: isDark ? "#393b40" : "#eee" }}>
            <button
              onClick={onClose}
              className={`text-[11px] font-medium px-2 py-1 rounded-md transition-colors cursor-pointer ${isDark ? "text-[#8d95a5] hover:text-[#d9dee7]" : "text-[#888] hover:text-[#080808]"}`}
            >
              Skip
            </button>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={onBack}
                  className={`px-3 py-1.5 text-[11px] font-medium rounded-md border cursor-pointer transition-colors ${isDark ? "border-[#393b40] text-[#d9dee7] hover:bg-[#1e1f22]" : "border-[#ddd] text-[#333] hover:bg-[#f2f2f2]"}`}
                >
                  Back
                </button>
              )}
              <button
                onClick={onNext}
                className="px-4 py-1.5 text-[11px] font-bold rounded-md cursor-pointer transition-all bg-jb-accent text-white hover:opacity-90"
              >
                {isLastStep ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
