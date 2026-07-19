"use client";

import { useState, useCallback } from "react";
import { TOUR_STEPS } from "./tourSteps";
import { useChatStore } from "@/store/useChatStore";

const STORAGE_KEY = "horizon_tour_completed";

export function useTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasBeenOpened, setHasBeenOpened] = useState(false);

  const start = useCallback(() => {
    setCurrentStep(0);
    useChatStore.getState().setCurrentTourStep(0);
    setIsActive(true);
    setHasBeenOpened(true);
    useChatStore.getState().setTourMode(true);
  }, []);

  const next = useCallback(() => {
    if (currentStep >= TOUR_STEPS.length - 1) {
      setIsActive(false);
      try { localStorage.setItem(STORAGE_KEY, "true"); } catch {}
      useChatStore.getState().setTourMode(false);
    } else {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      useChatStore.getState().setCurrentTourStep(nextStep);
    }
  }, [currentStep]);

  const back = useCallback(() => {
    setCurrentStep((s) => {
      const prevStep = Math.max(0, s - 1);
      useChatStore.getState().setCurrentTourStep(prevStep);
      return prevStep;
    });
  }, []);

  const close = useCallback(() => {
    setIsActive(false);
    useChatStore.getState().setTourMode(false);
  }, []);

  return {
    isActive,
    hasBeenOpened,
    currentStep,
    step: TOUR_STEPS[currentStep],
    isLastStep: currentStep >= TOUR_STEPS.length - 1,
    start,
    next,
    back,
    close,
  };
}
