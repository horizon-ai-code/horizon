import { describe, it, expect } from 'vitest';
import {
  INITIAL_SOURCE,
  EMPTY_ORCHESTRATION_RESULT,
  ROLE_VISUALS,
  DEFAULT_ROLE_VISUALS,
} from '@/lib/constants';

describe('INITIAL_SOURCE', () => {
  it('is empty string', () => {
    expect(INITIAL_SOURCE).toBe('');
  });
});

describe('EMPTY_ORCHESTRATION_RESULT', () => {
  it('has expected shape', () => {
    expect(EMPTY_ORCHESTRATION_RESULT).toHaveProperty('metrics');
    expect(EMPTY_ORCHESTRATION_RESULT).toHaveProperty('summary');
    expect(EMPTY_ORCHESTRATION_RESULT).toHaveProperty('diffHighlights');
    expect(EMPTY_ORCHESTRATION_RESULT).toHaveProperty('planner_model');
  });
});

describe('ROLE_VISUALS', () => {
  it('has entries for all 6 roles', () => {
    expect(Object.keys(ROLE_VISUALS)).toHaveLength(6);
  });

  it('each role has step, icon, and colorClass', () => {
    for (const role of Object.values(ROLE_VISUALS)) {
      expect(role).toHaveProperty('step');
      expect(role).toHaveProperty('icon');
      expect(role).toHaveProperty('colorClass');
      expect(typeof role.step).toBe('number');
      expect(typeof role.icon).toBe('string');
      expect(typeof role.colorClass).toBe('string');
    }
  });

  it('Planner has step 1 and blue color', () => {
    expect(ROLE_VISUALS.Planner).toEqual({
      step: 1,
      icon: 'Cpu',
      colorClass: 'text-[#56a8f5]',
    });
  });
});

describe('DEFAULT_ROLE_VISUALS', () => {
  it('has fallback values', () => {
    expect(DEFAULT_ROLE_VISUALS).toEqual({
      step: 1,
      icon: 'Cpu',
      colorClass: 'text-jb-accent',
    });
  });
});
