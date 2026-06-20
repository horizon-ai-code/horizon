export interface TourStep {
  targetId: string;
  title: string;
  body: string;
  position: "bottom" | "top" | "left" | "right";
}

export const TOUR_STEPS: TourStep[] = [
  {
    targetId: "tour-sidebar",
    title: "Session History",
    body: "Your refactoring sessions are saved here. Click any session to revisit, rename it, or delete it.",
    position: "right",
  },
  {
    targetId: "tour-input",
    title: "Code Editor",
    body: "Paste your Java source code here. The editor supports syntax highlighting, diff views, and clipboard detection.",
    position: "bottom",
  },
  {
    targetId: "tour-refactor-input",
    title: "Refactor Instructions",
    body: "Tell the AI what to do — extract a method, flatten conditionals, rename symbols, or choose multi-agent vs single-pass mode.",
    position: "top",
  },
  {
    targetId: "tour-output",
    title: "Refactored Output",
    body: "The refactored code appears here with diff highlights showing what changed. Switch between Output, Replay, and Insights tabs.",
    position: "bottom",
  },
  {
    targetId: "tour-terminal",
    title: "Live Terminal",
    body: "Watch the multi-agent pipeline in real-time — Planner, Generator, Validator, and Judge each show their reasoning and progress.",
    position: "top",
  },
];
