import { describe, it, expect } from 'vitest';
import {
  parsePhaseNumber,
  parseStrategyIteration,
  parseRetryInfo,
  parseValidationFaults,
  parseJudgeDecision,
  parseIntentDetail,
  parseMutationPlan,
  parsePhaseAction,
} from '@/lib/parseStatusInfo';

describe('parsePhaseNumber', () => {
  it('detects Ph1 pattern', () => {
    expect(parsePhaseNumber('Ph1: Analyzing baseline...')).toBe(1);
  });

  it('detects Baseline keyword', () => {
    expect(parsePhaseNumber('Starting Baseline phase')).toBe(1);
  });

  it('detects Strategy keyword', () => {
    expect(parsePhaseNumber('Strategy phase analyzing...')).toBe(2);
  });
});

describe('parseStrategyIteration', () => {
  it('extracts iteration number', () => {
    expect(parseStrategyIteration('Strategy Iter 2')).toBe(2);
  });
});

describe('parseRetryInfo', () => {
  it('detects syntax heal attempts', () => {
    const r = parseRetryInfo('Syntax heal attempt 2/3');
    expect(r).toBeDefined();
    expect(r!.current).toBe(2);
    expect(r!.max).toBe(3);
  });
});

describe('parseValidationFaults', () => {
  it('extracts fault count', () => {
    expect(parseValidationFaults('Total Faults: 3')).toBe(3);
  });
});

describe('parseJudgeDecision', () => {
  it('detects ACCEPT', () => {
    expect(parseJudgeDecision('Decision: ACCEPT')).toBe('ACCEPT');
  });

  it('detects REVISE', () => {
    expect(parseJudgeDecision('Verdict: REVISE')).toBe('REVISE');
  });
});

describe('parseIntentDetail', () => {
  it('returns undefined for unmatched input', () => {
    const result = parseIntentDetail('unmatched content');
    expect(result).toBeUndefined();
  });
});

describe('parseMutationPlan', () => {
  it('returns undefined for unmatched input', () => {
    const result = parseMutationPlan('unmatched content');
    expect(result).toBeUndefined();
  });
});

describe('parsePhaseAction', () => {
  it('extracts action description', () => {
    expect(parsePhaseAction('Ph2: Analyzing code structure')).toBe('Analyzing code structure');
  });
});
