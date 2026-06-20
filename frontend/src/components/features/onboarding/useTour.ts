"use client";

import { useState, useCallback } from "react";
import { TOUR_STEPS } from "./tourSteps";

const STORAGE_KEY = "horizon_tour_completed";

export function useTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const start = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const next = useCallback(() => {
    if (currentStep >= TOUR_STEPS.length - 1) {
      setIsActive(false);
      try { localStorage.setItem(STORAGE_KEY, "true"); } catch {}
    } else {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const back = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const close = useCallback(() => {
    setIsActive(false);
  }, []);

  return {
    isActive,
    currentStep,
    step: TOUR_STEPS[currentStep],
    isLastStep: currentStep >= TOUR_STEPS.length - 1,
    start,
    next,
    back,
    close,
  };
}
