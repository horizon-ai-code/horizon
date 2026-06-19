import type { AgentRole, IntentDetail, MutationItem, RetryInfo, ValidationFinding } from "@/types/glassbox";

const PHASE_PATTERNS: Record<string, number> = {
  "Ph1": 1,
  "Baseline": 1,
  "Ph2": 2,
  "Strategy": 2,
  "Ph3": 3,
  "Execution": 3,
  "Ph4": 4,
  "Validation": 4,
  "Ph5": 5,
  "Adjudication": 5,
  "Ph6": 6,
  "Finalization": 6,
};

export function parsePhaseNumber(content: string): number | null {
  for (const [prefix, num] of Object.entries(PHASE_PATTERNS)) {
    if (content.includes(prefix)) return num;
  }
  if (content.toLowerCase().includes("baseline")) return 1;
  if (content.toLowerCase().includes("audit")) return 5;
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
  const upper = content.toUpperCase();
  if (upper.includes("REVISE")) return "REVISE";
  if (upper.includes("ACCEPT")) return "ACCEPT";
  return null;
}

export function parseIntentDetail(content: string): IntentDetail | undefined {
  // Try JSON-first: content = "message\n\n{...}"
  const jsonObj = tryExtractJson(content);
  if (jsonObj && typeof jsonObj === "object" && "specific_intent" in jsonObj) {
    const d = jsonObj as Record<string, unknown>;
    const anchor = (d.scope_anchor as Record<string, string> | undefined) ?? {};
    return {
      category: d.refactor_category as string | undefined,
      intent: d.specific_intent as string | undefined,
      targetUnit: anchor.unit_type as string | undefined,
      targetClass: anchor.class as string | undefined,
      targetMember: anchor.member as string | undefined,
    };
  }

  // Fallback: regex on markdown
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
  // Try JSON-first
  const jsonObj = tryExtractJson(content);
  if (jsonObj && typeof jsonObj === "object") {
    const d = jsonObj as Record<string, unknown>;
    const mutations = d.ast_mutations;
    if (Array.isArray(mutations) && mutations.length > 0) {
      return mutations.map((m: Record<string, unknown>) => ({
        action: String(m.action ?? ""),
        target: String(m.target ?? ""),
      }));
    }
  }

  // Fallback: regex on markdown
  const items: MutationItem[] = [];
  const regex = /-\s+\*\*([^*]+)\*\*\s*on\s+`([^`]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    items.push({ action: match[1].trim(), target: match[2].trim() });
  }
  return items.length > 0 ? items : undefined;
}

export function parseValidationFindings(content: string): ValidationFinding[] | undefined {
  // Try JSON-first
  const jsonObj = tryExtractJson(content);
  if (Array.isArray(jsonObj) && jsonObj.length > 0) {
    return jsonObj.map((f: Record<string, unknown>) => ({
      tier: String(f.failure_tier ?? ""),
      description: String((f.error_report as Record<string, string> | undefined)?.message ?? ""),
    }));
  }
  if (jsonObj && typeof jsonObj === "object") {
    const d = jsonObj as Record<string, unknown>;
    const findings = d.findings;
    if (Array.isArray(findings) && findings.length > 0) {
      return findings.map((f: Record<string, unknown>) => ({
        tier: String(f.failure_tier ?? ""),
        description: String((f.error_report as Record<string, string> | undefined)?.message ?? ""),
      }));
    }
  }

  // Fallback: regex on markdown
  const findings: ValidationFinding[] = [];
  const regex = /\*\*\[([^\]]+)\]\*\*[\s\S]*?>([^<>\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    findings.push({ tier: match[1].trim(), description: match[2].trim() });
  }
  return findings.length > 0 ? findings : undefined;
}

// Shared: extract JSON from "message\n\n{...}" or raw JSON string
function tryExtractJson(content: string): unknown {
  const trimmed = content.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try { return JSON.parse(trimmed); } catch { /* fall through */ }
  }
  const m = trimmed.match(/^(?:.*?)\n\n(\{[\s\S]*\})$/s);
  if (m) {
    try { return JSON.parse(m[1]); } catch { /* fall through */ }
  }
  return undefined;
}

export function parseJudgeIssues(content: string): { issueType: string; description: string }[] | undefined {
  // Try JSON-first
  const jsonObj = tryExtractJson(content);
  if (jsonObj && typeof jsonObj === "object") {
    const d = jsonObj as Record<string, unknown>;
    const issues = d.issues;
    if (Array.isArray(issues)) {
      return issues.map((issue: unknown) => {
        if (typeof issue === "string") {
          return { issueType: "Issue", description: issue };
        }
        const i = issue as Record<string, unknown>;
        return { issueType: String(i.issue_type ?? i.issueType ?? ""), description: String(i.description ?? "") };
      });
    }
    if (d.verdict) {
      // Judge verdict object — issues might be inline
      const rawIssues = d.issues;
      if (Array.isArray(rawIssues)) {
        return rawIssues.map((issue: unknown) => {
          if (typeof issue === "string") {
            return { issueType: "Issue", description: issue };
          }
          const i = issue as Record<string, unknown>;
          return { issueType: String(i.issue_type ?? i.issueType ?? ""), description: String(i.description ?? "") };
        });
      }
    }
  }

  // Fallback: regex on old format
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
