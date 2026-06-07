import type { AgentRole, RetryInfo } from "@/types/glassbox";

const PHASE_PATTERNS: Record<string, number> = {
  "Ph1": 1,
  "Ph2": 2,
  "Ph3": 3,
  "Ph4": 4,
  "Ph5": 5,
  "Ph6": 6,
};

export function parsePhaseNumber(content: string): number | null {
  for (const [prefix, num] of Object.entries(PHASE_PATTERNS)) {
    if (content.includes(prefix)) return num;
  }
  if (content.toLowerCase().includes("baseline")) return 1;
  if (content.toLowerCase().includes("audit") || content.toLowerCase().includes("adjudication")) return 5;
  if (content.toLowerCase().includes("finalizing") || content.toLowerCase().includes("result")) return 6;
  return null;
}

export function parseStrategyIteration(content: string): number | null {
  const match = content.match(/Strategy\s+Iter\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

export function parseRetryInfo(content: string): RetryInfo | null {
  const syntaxMatch = content.match(/attempt\s+(\d+)\s*\/\s*(\d+)/i);
  if (syntaxMatch) {
    return { current: parseInt(syntaxMatch[1], 10), max: parseInt(syntaxMatch[2], 10), type: "syntax_heal" };
  }
  const seqMatch = content.match(/retrying\s+(\d+)\s*\/\s*(\d+)/i);
  if (seqMatch) {
    return { current: parseInt(seqMatch[1], 10), max: parseInt(seqMatch[2], 10), type: "sequential_mutation" };
  }
  return null;
}

export function parseValidationFaults(content: string): number | null {
  const match = content.match(/Total\s+Faults?[:\s]+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

export function parseJudgeDecision(content: string): "ACCEPT" | "REVISE" | null {
  if (content.includes("ACCEPT")) return "ACCEPT";
  if (content.includes("REVISE")) return "REVISE";
  return null;
}
