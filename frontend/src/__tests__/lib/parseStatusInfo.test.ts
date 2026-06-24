import { describe, it, expect } from 'vitest';
import {
  parsePhaseNumber, parseStrategyIteration, parseRetryInfo,
  parseValidationFaults, parseJudgeDecision, parseIntentDetail,
  parseMutationPlan, parsePhaseAction,
} from '@/lib/parseStatusInfo';

describe('parsePhaseNumber', () => {
  it('detects Ph1', () => { expect(parsePhaseNumber('Ph1: x')).toBe(1); }); // TC-PS-001
  it('detects Baseline', () => { expect(parsePhaseNumber('Baseline')).toBe(1); }); // TC-PS-002
  it('detects Strategy', () => { expect(parsePhaseNumber('Strategy')).toBe(2); }); // TC-PS-003
});

describe('parseStrategyIteration', () => {
  it('extracts number', () => { expect(parseStrategyIteration('Strategy Iter 2')).toBe(2); }); // TC-PS-004
});

describe('parseRetryInfo', () => {
  it('syntax heal', () => { // TC-PS-005
    const r = parseRetryInfo('Syntax heal attempt 2/3')!;
    expect(r.current).toBe(2); expect(r.max).toBe(3);
  });
  it('sequential retry', () => { // TC-PS-006
    const r = parseRetryInfo('Retry mutation 1/5');
    expect(r).toBeDefined();
  });
});

describe('parseValidationFaults', () => {
  it('extracts count', () => { expect(parseValidationFaults('Total Faults: 3')).toBe(3); }); // TC-PS-007
});

describe('parseJudgeDecision', () => {
  it('ACCEPT', () => { expect(parseJudgeDecision('Decision: ACCEPT')).toBe('ACCEPT'); }); // TC-PS-008
  it('REVISE', () => { expect(parseJudgeDecision('Verdict: REVISE')).toBe('REVISE'); }); // TC-PS-009
});

describe('parseIntentDetail', () => {
  it('undefined unmatched', () => { expect(parseIntentDetail('x')).toBeUndefined(); }); // TC-PS-010

});

describe('parseMutationPlan', () => {
  it('undefined unmatched', () => { expect(parseMutationPlan('x')).toBeUndefined(); }); // TC-PS-011

});

describe('parsePhaseAction', () => {
  it('extracts action', () => { expect(parsePhaseAction('Ph2: Analyze')).toBe('Analyze'); }); // TC-PS-014
});
