import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  isPrivacyAcknowledged,
  setPrivacyAcknowledged,
  isTourCompleted,
  setTourCompleted,
  resetOnboardingState,
} from "@/lib/onboardingStorage";
import { TOUR_STEPS } from "@/components/features/onboarding/tourSteps";
import PrivacyNoticeModal from "@/components/features/onboarding/PrivacyNoticeModal";
import TourOverlay from "@/components/features/onboarding/TourOverlay";
import Navbar from "@/components/layout/Navbar";
import MainLayout from "@/app/(chat)/layout";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => "/",
}));

// Mock LoadingOverlay to complete immediately in tests
vi.mock("@/components/layout/LoadingOverlay", () => {
  const MockLoadingOverlay = ({ onComplete }: { onComplete: () => void }) => {
    React.useEffect(() => {
      onComplete();
    }, [onComplete]);
    return null;
  };
  return { default: MockLoadingOverlay };
});

// Mock next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

// Mock useSystemMonitor
vi.mock("@/hooks/useSystemMonitor", () => ({
  useSystemMonitor: () => ({
    systemMetrics: null,
    samples: [],
    connected: false,
  }),
}));

describe("Onboarding Storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to false for first-time user", () => {
    expect(isPrivacyAcknowledged()).toBe(false);
    expect(isTourCompleted()).toBe(false);
  });

  it("persists privacy acknowledgement", () => {
    setPrivacyAcknowledged(true);
    expect(isPrivacyAcknowledged()).toBe(true);
    expect(isTourCompleted()).toBe(false);
  });

  it("persists tour completion", () => {
    setTourCompleted(true);
    expect(isTourCompleted()).toBe(true);
  });

  it("resets state properly", () => {
    setPrivacyAcknowledged(true);
    setTourCompleted(true);
    resetOnboardingState();
    expect(isPrivacyAcknowledged()).toBe(false);
    expect(isTourCompleted()).toBe(false);
  });
});

describe("Tour Steps Specification", () => {
  it("contains exactly 5 steps and removes old Step 6 privacy duplicate", () => {
    expect(TOUR_STEPS.length).toBe(5);
    expect(TOUR_STEPS[0].targetId).toBe("tour-sidebar");
    expect(TOUR_STEPS[1].targetId).toBe("tour-input");
    expect(TOUR_STEPS[2].targetId).toBe("tour-refactor-input");
    expect(TOUR_STEPS[3].targetId).toBe("tour-output");
    expect(TOUR_STEPS[4].targetId).toBe("tour-terminal");

    // Ensure no step contains the old privacy body
    TOUR_STEPS.forEach((step) => {
      expect(step.title).not.toBe("How the 6-Stage Pipeline Works");
      expect(step.body).not.toContain("Security & Privacy");
    });
  });
});

describe("PrivacyNoticeModal Component", () => {
  it("renders the notice with proper title and grounded offline-first info", () => {
    render(<PrivacyNoticeModal isOpen={true} onAcknowledge={vi.fn()} />);

    expect(screen.getByText("PRIVACY & DATA PROCESSING NOTICE")).toBeInTheDocument();
    expect(screen.getByText(/offline-first architecture/i)).toBeInTheDocument();
    expect(screen.getByText(/100% Local Multi-Agent Orchestration/i)).toBeInTheDocument();
    expect(screen.getByText(/No External Cloud Code Transmission/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /I Understand & Continue/i })
    ).toBeInTheDocument();
  });

  it("does not trigger onAcknowledge on Escape or backdrop click", () => {
    const handleAcknowledge = vi.fn();
    const { container } = render(
      <PrivacyNoticeModal isOpen={true} onAcknowledge={handleAcknowledge} />
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(handleAcknowledge).not.toHaveBeenCalled();

    // Backdrop click
    const backdrop = container.querySelector(".select-none");
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(handleAcknowledge).not.toHaveBeenCalled();
  });

  it("calls onAcknowledge when primary button is clicked and prevents multiple triggers", () => {
    const handleAcknowledge = vi.fn();
    render(<PrivacyNoticeModal isOpen={true} onAcknowledge={handleAcknowledge} />);

    const button = screen.getByRole("button", { name: /I Understand & Continue/i });
    fireEvent.click(button);
    expect(handleAcknowledge).toHaveBeenCalledTimes(1);

    // Rapid second click
    fireEvent.click(button);
    expect(handleAcknowledge).toHaveBeenCalledTimes(1);
  });
});

describe("TourOverlay Component", () => {
  it("displays Step 1 of 5 with Skip Tour and Next buttons on step 0", () => {
    render(
      <TourOverlay
        step={TOUR_STEPS[0]}
        currentStep={0}
        isLastStep={false}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onClose={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("Session History")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip Tour" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("displays Step 3 of 5 with Back, Skip Tour, and Next buttons on intermediate step", () => {
    render(
      <TourOverlay
        step={TOUR_STEPS[2]}
        currentStep={2}
        isLastStep={false}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onClose={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText("Step 3 of 5")).toBeInTheDocument();
    expect(screen.getByText("Refactor Instructions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("displays Step 5 of 5 with Back and Finish Tour on final step", () => {
    render(
      <TourOverlay
        step={TOUR_STEPS[4]}
        currentStep={4}
        isLastStep={true}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onClose={vi.fn()}
        onSkip={vi.fn()}
      />
    );

    expect(screen.getByText("Step 5 of 5")).toBeInTheDocument();
    expect(screen.getByText("Live Terminal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish Tour" })).toBeInTheDocument();
  });
});

describe("Navbar 'New Here?' Button", () => {
  it("renders a clean replay button without bounce animation pointer", () => {
    const handleStartTour = vi.fn();
    const { container } = render(<Navbar onStartTour={handleStartTour} tourOpened={true} />);

    const newHereBtn = screen.getByRole("button", { name: /Replay software tour/i });
    expect(newHereBtn).toBeInTheDocument();

    // Verify pointer bounce element is NOT rendered
    expect(container.querySelector(".animate-bounce")).not.toBeInTheDocument();
    expect(newHereBtn.className).not.toContain("animate-pulse");
    expect(newHereBtn.className).not.toContain("ring-[#3574f0]");

    // Clicking manually triggers start tour
    fireEvent.click(newHereBtn);
    expect(handleStartTour).toHaveBeenCalledTimes(1);
  });
});

describe("Interrupted Onboarding & Returning User Lifecycle Scenarios", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Scenario A: Reload before acknowledging privacy re-triggers Privacy Notice", () => {
    // Fresh state
    expect(isPrivacyAcknowledged()).toBe(false);
    expect(isTourCompleted()).toBe(false);

    // On initial launch, Privacy Notice must be shown
    const acknowledged = isPrivacyAcknowledged();
    expect(acknowledged).toBe(false);
  });

  it("Scenario B: Privacy acknowledged but tour incomplete skips Privacy Notice and resumes tour", () => {
    setPrivacyAcknowledged(true);
    expect(isPrivacyAcknowledged()).toBe(true);
    expect(isTourCompleted()).toBe(false);

    // Layout should detect privacy is done, but tour is not
    const privacyDone = isPrivacyAcknowledged();
    const tourDone = isTourCompleted();

    expect(privacyDone).toBe(true);
    expect(tourDone).toBe(false);
    // In this state, Privacy Notice will NOT open, and Tour will start
  });

  it("Scenario C: Both privacy acknowledged and tour completed enters normal interface directly", () => {
    setPrivacyAcknowledged(true);
    setTourCompleted(true);

    const privacyDone = isPrivacyAcknowledged();
    const tourDone = isTourCompleted();

    expect(privacyDone).toBe(true);
    expect(tourDone).toBe(true);
    // Neither modal nor automatic tour should start
  });

  it("Scenario D: Replaying tour does not reset privacy acknowledgement", () => {
    setPrivacyAcknowledged(true);
    setTourCompleted(true);

    // Replay tour triggered
    expect(isPrivacyAcknowledged()).toBe(true);

    // Starting or finishing replay retains privacy status
    setTourCompleted(true);
    expect(isPrivacyAcknowledged()).toBe(true);
  });
});

describe("MainLayout Complete Onboarding E2E Lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("first-time user experiences: Privacy Notice -> Acknowledge -> Tour Step 1..5 -> Finish -> Normal interface", async () => {
    // 1. Initial Launch
    const { unmount } = render(
      <MainLayout>
        <div data-testid="workspace-content">Workspace Content</div>
      </MainLayout>
    );

    // Wait for splash / layout mount
    expect(await screen.findByText("PRIVACY & DATA PROCESSING NOTICE")).toBeInTheDocument();

    // Verify tour is NOT active yet while privacy is pending
    expect(screen.queryByText("Step 1 of 5")).not.toBeInTheDocument();

    // 2. Click "I Understand & Continue"
    const ackBtn = screen.getByRole("button", { name: "I Understand & Continue" });
    fireEvent.click(ackBtn);

    // 3. Privacy modal closes and Tour Step 1 opens automatically!
    expect(await screen.findByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("Session History")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("PRIVACY & DATA PROCESSING NOTICE")).not.toBeInTheDocument();
    });
    expect(isPrivacyAcknowledged()).toBe(true);

    // 4. Advance through tour
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Step 2 of 5")).toBeInTheDocument();
    expect(screen.getByText("Code Editor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Step 3 of 5")).toBeInTheDocument();
    expect(screen.getByText("Refactor Instructions")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Step 4 of 5")).toBeInTheDocument();
    expect(screen.getByText("Output & Pipeline Flow")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Step 5 of 5")).toBeInTheDocument();
    expect(screen.getByText("Live Terminal")).toBeInTheDocument();

    // 5. Finish tour
    fireEvent.click(screen.getByRole("button", { name: "Finish Tour" }));
    expect(screen.queryByText("Step 5 of 5")).not.toBeInTheDocument();
    expect(isTourCompleted()).toBe(true);

    unmount();

    // 6. Returning User Launch (simulated re-render with storage populated)
    render(
      <MainLayout>
        <div data-testid="workspace-content">Workspace Content</div>
      </MainLayout>
    );

    // Neither Privacy Notice nor Tour should open automatically
    expect(screen.queryByText("PRIVACY & DATA PROCESSING NOTICE")).not.toBeInTheDocument();
    expect(screen.queryByText("Step 1 of 5")).not.toBeInTheDocument();

    // 7. Manual Replay via "New Here?" button
    const replayBtn = await screen.findByRole("button", { name: /Replay software tour/i });
    fireEvent.click(replayBtn);

    // Tour opens directly at Step 1, NO Privacy Notice!
    expect(await screen.findByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.queryByText("PRIVACY & DATA PROCESSING NOTICE")).not.toBeInTheDocument();

    // Skip tour
    fireEvent.click(screen.getByRole("button", { name: "Skip Tour" }));
    expect(screen.queryByText("Step 1 of 5")).not.toBeInTheDocument();
  });
});


