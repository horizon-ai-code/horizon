import type { TerminalEntry } from "@/types/session";

export function createMockTerminalEntry(overrides: Partial<TerminalEntry> = {}): TerminalEntry {
  return {
    id: "1",
    type: "log",
    text: "Test message",
    timestamp: "12:00:00",
    icon: "Cpu",
    colorClass: "text-blue-400",
    step: 1,
    role: "Planner",
    detail: null,
    ...overrides,
  };
}
