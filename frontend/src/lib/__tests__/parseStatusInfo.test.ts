import { describe, it, expect } from "vitest";
import {
  parsePhaseNumber,
  parseStrategyIteration,
  parseRetryInfo,
  parseValidationFaults,
  parseJudgeDecision,
  parseIntentDetail,
  parseMutationPlan,
  parseValidationFindings,
  parseJudgeIssues,
  parsePhaseAction,
} from "../parseStatusInfo";

describe("parsePhaseNumber", () => {
  it("returns phase number from PhN prefix", () => {
    expect(parsePhaseNumber("Ph1: Starting baseline analysis")).toBe(1);
    expect(parsePhaseNumber("Ph3: Executing mutations")).toBe(3);
    expect(parsePhaseNumber("Ph6: Finalizing results")).toBe(6);
  });

  it("returns null for content without phase prefix", () => {
    expect(parsePhaseNumber("Random status message")).toBeNull();
  });

  it("detects baseline by keyword", () => {
    expect(parsePhaseNumber("Performing baseline evaluation")).toBe(1);
  });

  it("detects audit/adjudication by keyword", () => {
    expect(parsePhaseNumber("Running audit checks")).toBe(5);
    expect(parsePhaseNumber("Adjudication phase started")).toBe(5);
  });

  it("detects finalizing/result by keyword", () => {
    expect(parsePhaseNumber("Finalizing output")).toBe(6);
    expect(parsePhaseNumber("Generating result report")).toBe(6);
  });
});

describe("parseStrategyIteration", () => {
  it("extracts iteration number", () => {
    expect(parseStrategyIteration("Strategy Iter 2")).toBe(2);
    expect(parseStrategyIteration("Strategy Iter 10")).toBe(10);
  });

  it("returns null if no strategy iteration", () => {
    expect(parseStrategyIteration("No iteration here")).toBeNull();
  });
});

describe("parseRetryInfo", () => {
  it("parses syntax heal attempts", () => {
    const result = parseRetryInfo("attempt 2 / 5");
    expect(result).toEqual({ current: 2, max: 5, type: "syntax_heal" });
  });

  it("parses sequential mutation retries", () => {
    const result = parseRetryInfo("retrying 3 / 7");
    expect(result).toEqual({ current: 3, max: 7, type: "sequential_mutation" });
  });

  it("returns null if no retry pattern matches", () => {
    expect(parseRetryInfo("Normal progress")).toBeNull();
  });
});

describe("parseValidationFaults", () => {
  it("extracts fault count", () => {
    expect(parseValidationFaults("Total Faults: 42")).toBe(42);
    expect(parseValidationFaults("Total Fault: 1")).toBe(1);
  });

  it("returns null if no fault count", () => {
    expect(parseValidationFaults("All checks passed")).toBeNull();
  });
});

describe("parseJudgeDecision", () => {
  it("detects ACCEPT", () => {
    expect(parseJudgeDecision("Judge: ACCEPT")).toBe("ACCEPT");
    expect(parseJudgeDecision("decision: accept with minor changes")).toBe("ACCEPT");
  });

  it("detects REVISE", () => {
    expect(parseJudgeDecision("Judge: REVISE")).toBe("REVISE");
    expect(parseJudgeDecision("decision: revise implementation")).toBe("REVISE");
  });

  it("returns null if no decision keyword", () => {
    expect(parseJudgeDecision("Waiting for judgment")).toBeNull();
  });
});

describe("parseIntentDetail", () => {
  it("extracts backtick-quoted fields", () => {
    const content = "Category: `Performance` Intent: `Optimize loops` Target Unit: `foo` Target Class: `Bar` Target Member: `run`";
    const result = parseIntentDetail(content);
    expect(result).toEqual({
      category: "Performance",
      intent: "Optimize loops",
      targetUnit: "foo",
      targetClass: "Bar",
      targetMember: "run",
    });
  });

  it("returns partial result for partial matches", () => {
    const content = "Category: `Security` Target Class: `Auth`";
    const result = parseIntentDetail(content);
    expect(result).toEqual({
      category: "Security",
      intent: undefined,
      targetUnit: undefined,
      targetClass: "Auth",
      targetMember: undefined,
    });
  });

  it("returns undefined if no fields match", () => {
    expect(parseIntentDetail("No structured data here")).toBeUndefined();
  });
});

describe("parseMutationPlan", () => {
  it("parses **action** on `target` patterns", () => {
    const content = "- **Inline temp** on `Main.java`\n- **Extract method** on `Helper.java`";
    const result = parseMutationPlan(content);
    expect(result).toEqual([
      { action: "Inline temp", target: "Main.java" },
      { action: "Extract method", target: "Helper.java" },
    ]);
  });

  it("returns undefined if no matches", () => {
    expect(parseMutationPlan("No mutations planned")).toBeUndefined();
  });
});

describe("parseValidationFindings", () => {
  it("parses **[tier]** >description patterns", () => {
    const content = "**[CRITICAL]** >Missing null check\n**[WARNING]** >Magic number";
    const result = parseValidationFindings(content);
    expect(result).toEqual([
      { tier: "CRITICAL", description: "Missing null check" },
      { tier: "WARNING", description: "Magic number" },
    ]);
  });

  it("returns undefined if no findings", () => {
    expect(parseValidationFindings("All clear")).toBeUndefined();
  });
});

describe("parseJudgeIssues", () => {
  it("parses issue_type and description pairs", () => {
    const content = "'issue_type': 'Style', 'description': 'Use camelCase', 'issue_type': 'Bug', 'description': 'Null deref'";
    const result = parseJudgeIssues(content);
    expect(result).toEqual([
      { issueType: "Style", description: "Use camelCase" },
      { issueType: "Bug", description: "Null deref" },
    ]);
  });

  it("returns undefined if no issues", () => {
    expect(parseJudgeIssues("No issues found")).toBeUndefined();
  });
});

describe("parsePhaseAction", () => {
  it("extracts action after PhN:", () => {
    expect(parsePhaseAction("Ph2: Strategy generation...")).toBe("Strategy generation");
    expect(parsePhaseAction("Ph4: Validation checks")).toBe("Validation checks");
  });

  it("returns undefined if no phase action", () => {
    expect(parsePhaseAction("Just a status")).toBeUndefined();
  });
});
