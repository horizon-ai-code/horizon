import { describe, it, expect } from 'vitest';
import {
  INITIAL_SOURCE,
  INITIAL_REFACTORED,
  EMPTY_ORCHESTRATION_RESULT,
  ROLE_VISUALS,
  DEFAULT_ROLE_VISUALS,
} from '@/lib/constants';

describe('constants', () => {
  it('INITIAL_SOURCE is empty string', () => {
    expect(INITIAL_SOURCE).toBe('');
  });

  it('INITIAL_REFACTORED is empty string', () => {
    expect(INITIAL_REFACTORED).toBe('');
  });

  it('EMPTY_ORCHESTRATION_RESULT has expected shape', () => {
    expect(EMPTY_ORCHESTRATION_RESULT).toEqual({
      replaySteps: [],
      metrics: [],
      summary: '',
      diffHighlights: { added: [], removed: [] },
      planner_model: "",
      generator_model: "",
      judge_model: "",
    });
  });

  describe('ROLE_VISUALS', () => {
    it('has entries for all 5 roles', () => {
      expect(Object.keys(ROLE_VISUALS)).toHaveLength(5);
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

    it('Planner has step 1 and color #56a8f5', () => {
      expect(ROLE_VISUALS.Planner).toEqual({
        step: 1,
        icon: 'Cpu',
        colorClass: 'text-[#56a8f5]',
      });
    });

    it('Judge has step 4 and color #27c93f', () => {
      expect(ROLE_VISUALS.Judge).toEqual({
        step: 4,
        icon: 'CheckCircle2',
        colorClass: 'text-[#27c93f]',
      });
    });

    it('System has step 1 and color yellow-400', () => {
      expect(ROLE_VISUALS.System).toEqual({
        step: 1,
        icon: 'Clock',
        colorClass: 'text-yellow-400',
      });
    });
  });

  describe('DEFAULT_ROLE_VISUALS', () => {
    it('defaults to step 1 with Cpu icon', () => {
      expect(DEFAULT_ROLE_VISUALS).toEqual({
        step: 1,
        icon: 'Cpu',
        colorClass: 'text-jb-accent',
      });
    });
  });
});
