import type { AgentRole, IntentDetail, MutationItem, RetryInfo, ValidationFinding } from "@/types/glassbox";

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

export function parseIntentDetail(content: string): IntentDetail | undefined {
  const extract = (label: string): string | undefined => {
    const re = new RegExp(`${label}:\\s*\`([^\`]+)\``);
    const m = content.match(re);
    return m ? m[1] : undefined;
  };
  const cat = extract("Category");
  const intent = extract("Intent");
  const unit = extract("Target Unit");
  const cls = extract("Target Class");
  const member = extract("Target Member");
  if (cat || intent || unit || cls || member) {
    return { category: cat, intent, targetUnit: unit, targetClass: cls, targetMember: member };
  }
  return undefined;
}

export function parseMutationPlan(content: string): MutationItem[] | undefined {
  const items: MutationItem[] = [];
  const regex = /-\s+\*\*([^*]+)\*\*\s*on\s+`([^`]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    items.push({ action: match[1].trim(), target: match[2].trim() });
  }
  return items.length > 0 ? items : undefined;
}

export function parseValidationFindings(content: string): ValidationFinding[] | undefined {
  const findings: ValidationFinding[] = [];
  const regex = /\*\*\[([^\]]+)\]\*\*[\s\S]*?>([^<>\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    findings.push({ tier: match[1].trim(), description: match[2].trim() });
  }
  return findings.length > 0 ? findings : undefined;
}

export function parseJudgeIssues(content: string): { issueType: string; description: string }[] | undefined {
  const issues: { issueType: string; description: string }[] = [];
  const regex = /'issue_type':\s*'([^']+)',\s*'description':\s*'([^']+)'/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    issues.push({ issueType: match[1], description: match[2] });
  }
  return issues.length > 0 ? issues : undefined;
}

export function parsePhaseAction(content: string): string | undefined {
  const m = content.match(/Ph\d+:\s*(.+?)(?:\.\.\.|$)/);
  return m ? m[1].trim() : undefined;
}
