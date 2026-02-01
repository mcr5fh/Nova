import { describe, it, expect } from 'vitest';
import {
  createSession,
  addMessage,
  applyEvaluation,
  selectNextFocus,
} from '../core/state-machine.js';
import { DIMENSIONS, canSignOff } from '../core/dimensions.js';
import type { DimensionId, CoverageLevel, EvaluationResult } from '../core/types.js';

describe('state-machine', () => {
  describe('createSession', () => {
    it('should create a session with all dimensions at not_started', () => {
      const session = createSession('test-id');

      expect(session.id).toBe('test-id');
      expect(session.currentFocus).toBe('problem_clarity');
      expect(session.conversationHistory).toHaveLength(0);

      for (const dimId of Object.keys(DIMENSIONS) as DimensionId[]) {
        expect(session.dimensions[dimId].coverage).toBe('not_started');
        expect(session.dimensions[dimId].evidence).toHaveLength(0);
      }
    });
  });

  describe('addMessage', () => {
    it('should add a message to conversation history', () => {
      const session = createSession('test-id');
      const updated = addMessage(session, 'user', 'Hello');

      expect(updated.conversationHistory).toHaveLength(1);
      expect(updated.conversationHistory[0].role).toBe('user');
      expect(updated.conversationHistory[0].content).toBe('Hello');
    });
  });

  describe('applyEvaluation', () => {
    it('should upgrade coverage level when new level is higher', () => {
      const session = createSession('test-id');
      const evaluation: EvaluationResult = {
        dimensionId: 'problem_clarity',
        newCoverage: 'partial',
        evidence: ['Some evidence'],
        reasoning: 'Test reasoning',
      };

      const updated = applyEvaluation(session, evaluation);

      expect(updated.dimensions.problem_clarity.coverage).toBe('partial');
      expect(updated.dimensions.problem_clarity.evidence).toContain('Some evidence');
    });

    it('should not downgrade coverage level', () => {
      let session = createSession('test-id');

      // First upgrade to strong
      session = applyEvaluation(session, {
        dimensionId: 'problem_clarity',
        newCoverage: 'strong',
        evidence: ['Strong evidence'],
        reasoning: 'Strong',
      });

      // Try to downgrade to weak
      const updated = applyEvaluation(session, {
        dimensionId: 'problem_clarity',
        newCoverage: 'weak',
        evidence: ['Weak evidence'],
        reasoning: 'Weak',
      });

      // Should still be strong
      expect(updated.dimensions.problem_clarity.coverage).toBe('strong');
      // But evidence should still be accumulated
      expect(updated.dimensions.problem_clarity.evidence).toContain('Weak evidence');
    });
  });

  describe('selectNextFocus', () => {
    it('should return problem_clarity first for new sessions', () => {
      const session = createSession('test-id');
      expect(selectNextFocus(session)).toBe('problem_clarity');
    });

    it('should return null when all dimensions meet thresholds', () => {
      let session = createSession('test-id');

      // Set all dimensions to their required thresholds
      const thresholds: Record<DimensionId, CoverageLevel> = {
        problem_clarity: 'strong',
        customer_context: 'strong',
        business_impact: 'strong',
        severity_frequency: 'partial',
        root_cause: 'partial',
        validation: 'partial',
      };

      for (const [dimId, threshold] of Object.entries(thresholds)) {
        session = applyEvaluation(session, {
          dimensionId: dimId as DimensionId,
          newCoverage: threshold,
          evidence: [],
          reasoning: 'Test',
        });
      }

      expect(selectNextFocus(session)).toBe(null);
    });

    it('should match canSignOff when returning null', () => {
      let session = createSession('test-id');

      // Set all dimensions to strong (exceeds all thresholds)
      for (const dimId of Object.keys(DIMENSIONS) as DimensionId[]) {
        session = applyEvaluation(session, {
          dimensionId: dimId,
          newCoverage: 'strong',
          evidence: [],
          reasoning: 'Test',
        });
      }

      expect(selectNextFocus(session)).toBe(null);
      expect(canSignOff(session.dimensions).ready).toBe(true);
    });
  });
});
