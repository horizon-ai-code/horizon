"use client";

export const PRIVACY_STORAGE_KEY = "horizon_privacy_acknowledged";
export const TOUR_STORAGE_KEY = "horizon_tour_completed";

function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const testKey = "__horizon_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function isPrivacyAcknowledged(): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    return window.localStorage.getItem(PRIVACY_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setPrivacyAcknowledged(value: boolean): void {
  if (!isLocalStorageAvailable()) return;
  try {
    if (value) {
      window.localStorage.setItem(PRIVACY_STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(PRIVACY_STORAGE_KEY);
    }
  } catch {
    // Fail silently in restricted environments
  }
}

export function isTourCompleted(): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setTourCompleted(value: boolean): void {
  if (!isLocalStorageAvailable()) return;
  try {
    if (value) {
      window.localStorage.setItem(TOUR_STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(TOUR_STORAGE_KEY);
    }
  } catch {
    // Fail silently in restricted environments
  }
}

export function getOnboardingStatus(): { privacyAcknowledged: boolean; tourCompleted: boolean } {
  return {
    privacyAcknowledged: isPrivacyAcknowledged(),
    tourCompleted: isTourCompleted(),
  };
}

export function resetOnboardingState(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    window.localStorage.removeItem(PRIVACY_STORAGE_KEY);
    window.localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    // Fail silently
  }
}
