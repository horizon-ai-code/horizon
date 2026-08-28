import type { AgentRole, CurrentStatusDetail, IntentDetail, MutationItem, RetryInfo, ValidationFinding } from "@/types/glassbox";

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
  const syntaxMatch = content.match(/attempt\s+(\d+)(?:\s*\/\s*(\d+))?/i);
  if (syntaxMatch) {
    const current = parseInt(syntaxMatch[1], 10);
    const max = syntaxMatch[2] ? parseInt(syntaxMatch[2], 10) : 3;
    return { current, max, type: "syntax_heal" };
  }
  const seqMatch = content.match(/retrying\s+(\d+)(?:\s*\/\s*(\d+))?/i);
  if (seqMatch) {
    const current = parseInt(seqMatch[1], 10);
    const max = seqMatch[2] ? parseInt(seqMatch[2], 10) : 3;
    return { current, max, type: "sequential_mutation" };
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
  const jsonObj = tryExtractJson(content);
  if (jsonObj && typeof jsonObj === "object") {
    const d = jsonObj as Record<string, unknown>;
    const packet = (d.intent_packet as Record<string, unknown> | undefined) ?? d;
    if ("specific_intent" in packet || "refactor_category" in packet) {
      const anchor = (packet.scope_anchor as Record<string, string> | undefined) ?? {};
      return {
        category: packet.refactor_category as string | undefined,
        intent: packet.specific_intent as string | undefined,
        targetUnit: anchor.unit_type as string | undefined,
        targetClass: (anchor as Record<string, string>).class ?? anchor.target_class,
        targetMember: anchor.member as string | undefined,
      };
    }
  }

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
  const jsonObj = tryExtractJson(content);
  if (jsonObj && typeof jsonObj === "object") {
    const d = jsonObj as Record<string, unknown>;
    const plan = (d.ast_modification_plan as Record<string, unknown> | undefined) ?? d;
    const mutations = plan.ast_mutations ?? d.ast_mutations;
    if (Array.isArray(mutations) && mutations.length > 0) {
      return mutations.map((m: Record<string, unknown>) => {
        const details = m.details as Record<string, unknown> | undefined;
        let desc = "";
        if (details) {
          desc = String(details.body_abstract ?? details.value ?? (Array.isArray(details.logic_changes) ? details.logic_changes.join(', ') : ''));
        }
        return {
          action: String(m.action ?? ""),
          target: String(m.target ?? ""),
          description: desc || String(m.description ?? ""),
        };
      });
    }
  }

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

export function parseValidationChecks(content: string): import("@/types/glassbox").ValidationCheck[] | undefined {
  const jsonObj = tryExtractJson(content);
  if (jsonObj && typeof jsonObj === "object" && "checks" in jsonObj) {
    const checks = (jsonObj as Record<string, unknown>).checks;
    if (Array.isArray(checks)) {
      return checks.map((c: Record<string, unknown>) => ({
        tier: String(c.tier ?? "tier1_deterministic"),
        name: String(c.name ?? ""),
        passed: Boolean(c.passed),
        details: c.details && c.details !== "None" ? String(c.details) : undefined,
        before_value: c.before !== undefined && c.before !== null ? Number(c.before) : undefined,
        after_value: c.after !== undefined && c.after !== null ? Number(c.after) : undefined,
      }));
    }
  }

  const checks: import("@/types/glassbox").ValidationCheck[] = [];
  const rawBlocks = content.split(/name:\s*/g).slice(1);
  for (const block of rawBlocks) {
    const nameMatch = block.match(/^"?([^"\n\r]+?)"?\s*(?:passed:|details:|before:|$)/i) || block.match(/^"?([^"\n\r]+?)"?/);
    const passedMatch = block.match(/passed:\s*(true|false)/i);
    const beforeMatch = block.match(/before:\s*(\d+)/i);
    const afterMatch = block.match(/after:\s*(\d+)/i);
    const detailsMatch = block.match(/details:\s*"?([^"\n\r]+)"?/i);

    if (nameMatch) {
      const detailsVal = detailsMatch ? detailsMatch[1].trim() : undefined;
      checks.push({
        tier: "tier1_deterministic",
        name: nameMatch[1].trim(),
        passed: passedMatch ? passedMatch[1].toLowerCase() === "true" : true,
        before_value: beforeMatch ? parseInt(beforeMatch[1], 10) : undefined,
        after_value: afterMatch ? parseInt(afterMatch[1], 10) : undefined,
        details: (detailsVal && detailsVal !== "None") ? detailsVal : undefined,
      });
    }
  }
  return checks.length > 0 ? checks : undefined;
}

export function parseLogicComparison(content: string): string | undefined {
  const jsonObj = tryExtractJson(content);
  if (jsonObj && typeof jsonObj === "object") {
    const d = jsonObj as Record<string, unknown>;
    const scratchpad = (d.audit_scratchpad as Record<string, unknown> | undefined) ?? d;
    if (scratchpad.logic_comparison && String(scratchpad.logic_comparison).trim() !== "None") {
      return String(scratchpad.logic_comparison);
    }
  }
  const m = content.match(/logic comparison:\s*"([^"]+)"/i) || content.match(/logic comparison:\s*(.+?)(?=\n\s*verdict:|\n\s*issues:|$)/is);
  if (m) {
    const val = m[1].trim();
    return (val && val !== "None") ? val : undefined;
  }
  return undefined;
}

export function parseVariableTrace(content: string): { original?: string; refactored?: string; mapping?: string } | undefined {
  const jsonObj = tryExtractJson(content);
  if (jsonObj && typeof jsonObj === "object") {
    const d = jsonObj as Record<string, unknown>;
    const scratchpad = (d.audit_scratchpad as Record<string, unknown> | undefined) ?? d;
    const traceList = (scratchpad.variable_trace ?? d.variable_trace) as Record<string, unknown>[] | undefined;
    if (Array.isArray(traceList) && traceList.length > 0) {
      const first = traceList[0];
      return {
        original: first.original ? String(first.original) : undefined,
        refactored: first.refactored ? String(first.refactored) : undefined,
        mapping: (first.mapping && String(first.mapping) !== "null" && String(first.mapping) !== "None") ? String(first.mapping) : undefined,
      };
    }
  }

  const origMatch = content.match(/original:\s*"?([^",\n\r]+)"?/i);
  const refMatch = content.match(/refactored:\s*"?([^",\n\r]+)"?/i);
  const mapMatch = content.match(/mapping:\s*"?([^",\n\r]+)"?/i);
  if (origMatch || refMatch) {
    const orig = origMatch ? origMatch[1].trim() : undefined;
    const ref = refMatch ? refMatch[1].trim() : undefined;
    const map = mapMatch ? mapMatch[1].trim() : undefined;
    return {
      original: orig && orig !== "None" ? orig : undefined,
      refactored: ref && ref !== "None" ? ref : undefined,
      mapping: map && map !== "None" ? map : undefined,
    };
  }
  return undefined;
}

export function parseBaselineMetrics(content: string): { cyclomaticComplexity?: number; linesOfCode?: number } | undefined {
  const ccMatch = content.match(/Cyclomatic\s+Complexity:\s*(\d+)/i);
  const locMatch = content.match(/(?:Lines?\s+of\s+Code|#\s*(\d+)\s*LINES):\s*(\d+)?/i);
  const cc = ccMatch ? parseInt(ccMatch[1], 10) : undefined;
  const loc = locMatch ? parseInt(locMatch[1] || locMatch[2], 10) : undefined;
  if (cc !== undefined || loc !== undefined) {
    return { cyclomaticComplexity: cc, linesOfCode: loc };
  }
  return undefined;
}

export function reconstructPhaseSummariesFromLogs(
  logs: Array<{ role?: string; status?: string; content?: string | null; phase?: number | null }>
): Record<number, { summary?: string; timestamp?: number; detail?: CurrentStatusDetail }> {
  const phaseSummaries: Record<number, { summary?: string; timestamp?: number; detail?: CurrentStatusDetail }> = {};

  for (const log of logs) {
    const content = (log.content || log.status || "").trim();
    if (!content) continue;

    const parsedPhase = parsePhaseNumber(content);
    const phaseNum = parsedPhase !== null && parsedPhase !== undefined ? parsedPhase : (log.phase || 0);
    const firstLine = content.split("\n")[0].trim();
    const isRawJson = firstLine.startsWith("{") || firstLine.startsWith("[");
    const validSummary = isRawJson ? undefined : firstLine;

    if (phaseNum > 0) {
      phaseSummaries[phaseNum] = {
        summary: phaseSummaries[phaseNum]?.summary || validSummary,
        detail: phaseSummaries[phaseNum]?.detail || {},
        timestamp: Date.now(),
      };
    }

    const baselineMetrics = parseBaselineMetrics(content);
    const intent = parseIntentDetail(content);
    const mutations = parseMutationPlan(content);
    const checks = parseValidationChecks(content);
    const findings = parseValidationFindings(content);
    const decision = parseJudgeDecision(content);
    const logicComparison = parseLogicComparison(content);
    const variableTrace = parseVariableTrace(content);
    const judgeIssues = parseJudgeIssues(content);

    if (baselineMetrics) {
      phaseSummaries[1] = {
        summary: phaseSummaries[1]?.summary || firstLine,
        timestamp: Date.now(),
        detail: { ...phaseSummaries[1]?.detail, baselineMetrics },
      };
    }
    if (intent || (mutations && phaseNum <= 2)) {
      phaseSummaries[2] = {
        summary: phaseSummaries[2]?.summary || firstLine,
        timestamp: Date.now(),
        detail: {
          ...phaseSummaries[2]?.detail,
          ...(intent ? { intent } : {}),
          ...(mutations ? { mutations } : {}),
        },
      };
    }
    if (mutations && (phaseNum === 3 || phaseNum === 2)) {
      phaseSummaries[3] = {
        summary: phaseSummaries[3]?.summary || firstLine,
        timestamp: Date.now(),
        detail: { ...phaseSummaries[3]?.detail, mutations },
      };
    }
    if (checks || findings) {
      phaseSummaries[4] = {
        summary: phaseSummaries[4]?.summary || firstLine,
        timestamp: Date.now(),
        detail: {
          ...phaseSummaries[4]?.detail,
          ...(checks ? { checks } : {}),
          ...(findings ? { findings } : {}),
        },
      };
    }
    if (decision || logicComparison || variableTrace || judgeIssues) {
      phaseSummaries[5] = {
        summary: phaseSummaries[5]?.summary || firstLine,
        timestamp: Date.now(),
        detail: {
          ...phaseSummaries[5]?.detail,
          ...(decision ? { judgeVerdict: decision } : {}),
          ...(logicComparison ? { logicComparison } : {}),
          ...(variableTrace ? { variableTrace } : {}),
          ...(judgeIssues ? { judgeIssues } : {}),
        },
      };
    }
  }

  return phaseSummaries;
}

/**
 * Replay historical logs to reconstruct the graph-level state fields
 * (strategyIteration, syntaxHealAttempt, visitedPhases, flaggedPhases,
 * previousPhase, currentPhase) that buildGraphState needs for edge/node rendering.
 *
 * Mirrors the live logic in useOrchestrationSocket handleStatus (lines 121-147).
 */
export function reconstructGraphStateFromLogs(
  logs: Array<{ role?: string; status?: string; content?: string | null; phase?: number | null }>
): {
  currentPhase: number;
  previousPhase: number | null;
  strategyIteration: number;
  syntaxHealAttempt: number;
  visitedPhases: number[];
  flaggedPhases: number[];
} {
  let currentPhase = 1;
  let previousPhase: number | null = null;
  let strategyIteration = 1;
  let syntaxHealAttempt = 0;
  const visited = new Set<number>();
  const flagged = new Set<number>();

  for (const log of logs) {
    const content = (log.content || log.status || "").trim();
    if (!content) continue;

    // Extract phase number from log content or log.phase field
    const parsedPhase = parsePhaseNumber(content);
    const phase = parsedPhase !== null && parsedPhase !== undefined ? parsedPhase : (log.phase || 0);

    if (phase > 0) {
      visited.add(phase);

      if (phase !== currentPhase) {
        // Detect backward transition (reroute) → flag the origin phase
        if (currentPhase > phase) {
          flagged.add(currentPhase);
        }

        // Track syntax heal: P4 → P3
        if (currentPhase === 4 && phase === 3) {
          syntaxHealAttempt = Math.max(syntaxHealAttempt, 1);
        }

        // Track strategy revision: P4/P5 → P2
        if (currentPhase >= 4 && phase === 2) {
          strategyIteration = Math.max(strategyIteration, 2);
        }

        previousPhase = currentPhase;
        currentPhase = phase;
      }
    }

    // Also parse explicit iteration/retry counters from log text
    const iterFromContent = parseStrategyIteration(content);
    if (iterFromContent !== null && iterFromContent > strategyIteration) {
      strategyIteration = iterFromContent;
    }

    const retry = parseRetryInfo(content);
    if (retry !== null && retry.type === "syntax_heal" && retry.current > syntaxHealAttempt) {
      syntaxHealAttempt = retry.current;
    }
  }

  return {
    currentPhase,
    previousPhase,
    strategyIteration,
    syntaxHealAttempt,
    visitedPhases: Array.from(visited),
    flaggedPhases: Array.from(flagged),
  };
}
