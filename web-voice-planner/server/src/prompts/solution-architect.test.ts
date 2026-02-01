import { describe, it, expect } from 'vitest';
import {
  assessDimensionCoverage,
  isReadyToGenerate,
  buildContextPrompt,
  formatConversationHistory,
  SYSTEM_PROMPT,
} from './solution-architect';
import type { SessionState, DimensionName } from '../../../shared/types';

describe('Solution Architect Prompts', () => {
  describe('SYSTEM_PROMPT', () => {
    it('contains the 6 dimensions', () => {
      expect(SYSTEM_PROMPT).toContain('solution_clarity');
      expect(SYSTEM_PROMPT).toContain('user_value');
      expect(SYSTEM_PROMPT).toContain('scope_boundaries');
      expect(SYSTEM_PROMPT).toContain('success_criteria');
      expect(SYSTEM_PROMPT).toContain('technical_constraints');
      expect(SYSTEM_PROMPT).toContain('edge_cases');
    });

    it('emphasizes voice conversation style', () => {
      expect(SYSTEM_PROMPT).toContain('VOICE');
    });
  });

  describe('assessDimensionCoverage', () => {
    it('returns not_started for empty evidence', () => {
      expect(assessDimensionCoverage('solution_clarity', [])).toBe('not_started');
    });

    it('returns weak for single evidence', () => {
      expect(assessDimensionCoverage('solution_clarity', ['one'])).toBe('weak');
    });

    it('returns partial for 2 evidence items', () => {
      expect(assessDimensionCoverage('solution_clarity', ['one', 'two'])).toBe('partial');
    });

    it('returns strong for 3+ evidence items', () => {
      expect(assessDimensionCoverage('solution_clarity', ['one', 'two', 'three'])).toBe('strong');
    });

    it('returns strong for more than 3 evidence items', () => {
      expect(assessDimensionCoverage('edge_cases', ['a', 'b', 'c', 'd', 'e'])).toBe('strong');
    });
  });

  describe('isReadyToGenerate', () => {
    it('returns false when dimensions are incomplete', () => {
      const session = createTestSession();
      expect(isReadyToGenerate(session)).toBe(false);
    });

    it('returns false when only some strong dimensions are met', () => {
      const session = createTestSession();
      session.dimensions.solution_clarity.coverage = 'strong';
      session.dimensions.user_value.coverage = 'strong';
      expect(isReadyToGenerate(session)).toBe(false);
    });

    it('returns false when strong met but partial not met', () => {
      const session = createTestSession();
      session.dimensions.solution_clarity.coverage = 'strong';
      session.dimensions.user_value.coverage = 'strong';
      session.dimensions.scope_boundaries.coverage = 'strong';
      session.dimensions.success_criteria.coverage = 'strong';
      // technical_constraints and edge_cases still at not_started
      expect(isReadyToGenerate(session)).toBe(false);
    });

    it('returns true when all thresholds met', () => {
      const session = createTestSession();
      // Set strong for required dimensions
      session.dimensions.solution_clarity.coverage = 'strong';
      session.dimensions.user_value.coverage = 'strong';
      session.dimensions.scope_boundaries.coverage = 'strong';
      session.dimensions.success_criteria.coverage = 'strong';
      // Set partial for optional dimensions
      session.dimensions.technical_constraints.coverage = 'partial';
      session.dimensions.edge_cases.coverage = 'partial';

      expect(isReadyToGenerate(session)).toBe(true);
    });

    it('returns true when all dimensions are strong', () => {
      const session = createTestSession();
      Object.keys(session.dimensions).forEach((dim) => {
        session.dimensions[dim as DimensionName].coverage = 'strong';
      });

      expect(isReadyToGenerate(session)).toBe(true);
    });
  });

  describe('buildContextPrompt', () => {
    it('includes session slug', () => {
      const session = createTestSession();
      const prompt = buildContextPrompt(session);
      expect(prompt).toContain('test-feature');
    });

    it('includes current phase', () => {
      const session = createTestSession();
      session.currentPhase = 'validation';
      const prompt = buildContextPrompt(session);
      expect(prompt).toContain('validation');
    });

    it('includes all dimension coverage levels', () => {
      const session = createTestSession();
      session.dimensions.solution_clarity.coverage = 'strong';
      session.dimensions.user_value.coverage = 'partial';
      const prompt = buildContextPrompt(session);
      expect(prompt).toContain('solution_clarity: strong');
      expect(prompt).toContain('user_value: partial');
    });
  });

  describe('formatConversationHistory', () => {
    it('returns empty array for no history', () => {
      const session = createTestSession();
      const history = formatConversationHistory(session);
      expect(history).toEqual([]);
    });

    it('formats conversation entries correctly', () => {
      const session = createTestSession();
      session.conversationHistory = [
        { role: 'user', content: 'I want to build a feature', timestamp: '2024-01-01T00:00:00Z' },
        { role: 'assistant', content: 'Tell me more', timestamp: '2024-01-01T00:00:01Z' },
      ];

      const history = formatConversationHistory(session);

      expect(history).toEqual([
        { role: 'user', content: 'I want to build a feature' },
        { role: 'assistant', content: 'Tell me more' },
      ]);
    });

    it('excludes audioUrl from formatted output', () => {
      const session = createTestSession();
      session.conversationHistory = [
        { role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z', audioUrl: 'some-url' },
      ];

      const history = formatConversationHistory(session);

      expect(history[0]).not.toHaveProperty('audioUrl');
      expect(history[0]).not.toHaveProperty('timestamp');
    });
  });
});

function createTestSession(): SessionState {
  return {
    id: 'test-id',
    slug: 'test-feature',
    startedAt: new Date().toISOString(),
    currentPhase: 'gathering',
    dimensions: {
      solution_clarity: { coverage: 'not_started', evidence: [] },
      user_value: { coverage: 'not_started', evidence: [] },
      scope_boundaries: { coverage: 'not_started', evidence: [] },
      success_criteria: { coverage: 'not_started', evidence: [] },
      technical_constraints: { coverage: 'not_started', evidence: [] },
      edge_cases: { coverage: 'not_started', evidence: [] },
    },
    conversationHistory: [],
  };
}
