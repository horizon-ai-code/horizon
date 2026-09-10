export interface TourStep {
  targetId: string;
  title: string;
  body: string;
  position: "bottom" | "top" | "left" | "right" | "center";
}

export const TOUR_STEPS: TourStep[] = [
  {
    targetId: "tour-sidebar",
    title: "Session History",
    body: "All your refactoring sessions are saved here. Each session tracks your original code, instructions, the full multi-agent pipeline output, and terminal logs. Sessions you halt or that fail are also preserved for review. Click any session to revisit it, double-click to rename, or delete it from the menu. The active session is highlighted in the list.",
    position: "right",
  },
  {
    targetId: "tour-input",
    title: "Code Editor",
    body: "Paste or type your Java source code into this editor. It supports syntax highlighting, bracket matching, and line numbers. When you run a refactoring, the editor shows green/red diff highlights so you can see exactly what changed. After completion, the refactored code with diff markers replaces the original in this pane. The editor now shows sample code so you can see how it looks.",
    position: "right",
  },
  {
    targetId: "tour-refactor-input",
    title: "Refactor Instructions",
    body: "Tell the agents what to do. Be specific: 'Extract these nested conditions into a method called isEligible' works better than 'clean this up.' Choose Multi-Agent mode (Planner → Generator → Validator → Judge pipeline) for complex refactors, or Single-Pass mode for quick fixes. Press Run or Cmd+Enter to start the orchestration. The sample instruction already contains an example.",
    position: "top",
  },
  {
    targetId: "tour-output",
    title: "Output & Pipeline Flow",
    body: "The refactored code appears here with diff highlights showing what changed. Switch to the Flow tab to watch the multi-agent pipeline in a visual diagram as it processes your code through 6 phases: Baseline → Strategy → Execution → Validation → Adjudication → Finalization. Each card lights up green on completion, and the current phase pulses. The Insights tab shows complexity metrics and performance data.",
    position: "left",
  },
  {
    targetId: "tour-terminal",
    title: "Live Terminal",
    body: "The terminal shows every agent decision in real-time during a refactoring. The Planner maps out the strategy, the Generator writes the code, the Validator checks syntax and type safety, and the Judge approves or rejects the final result. After completion, scroll back through the entire decision trail. Each log entry includes a badge, timestamp, and optional inline JSON details.",
    position: "top",
  },
];

