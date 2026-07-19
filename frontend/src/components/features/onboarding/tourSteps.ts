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
  {
    targetId: "",
    title: "How the 6-Stage Pipeline Works",
    body: "Here's how the 6-stage pipeline works:\n\n• Baseline — saves your original code as a reference.\n• Strategy — plans what to change and how.\n• Execution — writes the new code based on the plan.\n• Validation — checks the new code for syntax and type errors.\n• Adjudication — the Judge compares old vs new code and decides: keep or reject.\n• Finalization — delivers the finished output.\n\nThe pipeline isn't always linear. If a stage fails, Horizon loops back: a syntax error self-heals and retries Execution. A failed validation sends it back to fix the code. A bad strategy restarts from scratch.\n\n🔒 Security & Privacy: Horizon AI is an offline-first application. All processing and multi-agent orchestrations happen entirely on your local machine. Your source code is never uploaded to the cloud or shared with third parties.",
    position: "center",
  },
];
