import { describe, it, expect } from 'vitest';
import {
  parsePhaseNumber, parseStrategyIteration, parseRetryInfo,
  parseValidationFaults, parseJudgeDecision, parseIntentDetail,
  parseMutationPlan, parsePhaseAction,
} from '@/lib/parseStatusInfo';

describe('parsePhaseNumber', () => {
  it('detects Ph1 pattern', () => { expect(parsePhaseNumber('Ph1: x')).toBe(1); });
  it('detects Baseline', () => { expect(parsePhaseNumber('Starting Baseline')).toBe(1); });
  it('detects Strategy', () => { expect(parsePhaseNumber('Strategy phase')).toBe(2); });
});

describe('parseStrategyIteration', () => {
  it('extracts iteration number', () => { expect(parseStrategyIteration('Strategy Iter 2')).toBe(2); });
});

describe('parseRetryInfo', () => {
  it('detects syntax heal', () => {
    const r = parseRetryInfo('Syntax heal attempt 2/3');
    expect(r!.current).toBe(2); expect(r!.max).toBe(3);
  });
  it('detects sequential retry', () => { expect(parseRetryInfo('Retry mutation 1/5')).toBeDefined(); });
});

describe('parseValidationFaults', () => {
  it('extracts fault count', () => { expect(parseValidationFaults('Total Faults: 3')).toBe(3); });
});

describe('parseJudgeDecision', () => {
  it('detects ACCEPT', () => { expect(parseJudgeDecision('Decision: ACCEPT')).toBe('ACCEPT'); });
  it('detects REVISE', () => { expect(parseJudgeDecision('Verdict: REVISE')).toBe('REVISE'); });
});

describe('parseIntentDetail', () => {
  it('returns undefined for unmatched', () => {
    expect(parseIntentDetail('unmatched')).toBeUndefined();
  });
});

describe('parseMutationPlan', () => {
  it('returns undefined for unmatched', () => {
    expect(parseMutationPlan('unmatched')).toBeUndefined();
  });
});

describe('parsePhaseAction', () => {
  it('extracts action', () => { expect(parsePhaseAction('Ph2: Analyzing code')).toBe('Analyzing code'); });
});
