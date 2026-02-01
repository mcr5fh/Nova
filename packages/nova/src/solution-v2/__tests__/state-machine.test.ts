import { describe, it, expect } from 'vitest';
import {
  createSessionV2,
  addMessageV2,
  applyEvaluationV2,
  selectNextFocusV2,
  setCodebaseContext,
  addEdgeCase,
  setSessionPhase,
  serializeStateV2,
  deserializeStateV2,
  setLoadedProblemV2,
} from '../core/state-machine.js';
import { DIMENSIONS_V2, canSignOffV2 } from '../core/dimensions.js';
import type {
  DimensionIdV2,
  CoverageLevelV2,
  EvaluationResultV2,
  CodebaseContext,
  EdgeCase,
  SessionPhase,
} from '../core/types.js';

describe('solution-v2 state-machine', () => {
  describe('createSessionV2', () => {
    it('should create a session with all 6 dimensions at not_started', () => {
      const session = createSessionV2('test-id');

      expect(session.id).toBe('test-id');
      expect(session.currentFocus).toBe('solution_clarity');
      expect(session.conversationHistory).toHaveLength(0);

      for (const dimId of Object.keys(DIMENSIONS_V2) as DimensionIdV2[]) {
        expect(session.dimensions[dimId].coverage).toBe('not_started');
        expect(session.dimensions[dimId].evidence).toHaveLength(0);
      }
    });

    it('should initialize v2 specific fields', () => {
      const session = createSessionV2('test-id');

      expect(session.codebaseContext).toBeNull();
      expect(session.discoveredEdgeCases).toHaveLength(0);
      expect(session.currentPhase).toBe('gathering');
      expect(session.loadedProblem).toBeNull();
    });

    it('should have 6 dimensions including v2 additions', () => {
      const session = createSessionV2('test-id');

      expect(Object.keys(session.dimensions)).toHaveLength(6);
      expect(session.dimensions.technical_constraints).toBeDefined();
      expect(session.dimensions.edge_cases).toBeDefined();
    });
  });

  describe('addMessageV2', () => {
    it('should add a message to conversation history', () => {
      const session = createSessionV2('test-id');
      const updated = addMessageV2(session, 'user', 'Hello');

      expect(updated.conversationHistory).toHaveLength(1);
      expect(updated.conversationHistory[0].role).toBe('user');
      expect(updated.conversationHistory[0].content).toBe('Hello');
    });

    it('should support optional metadata', () => {
      const session = createSessionV2('test-id');
      const updated = addMessageV2(session, 'assistant', 'Based on the codebase...', {
        codebaseContextUsed: true,
        referencedFiles: ['src/api.ts'],
      });

      expect(updated.conversationHistory[0].metadata?.codebaseContextUsed).toBe(true);
      expect(updated.conversationHistory[0].metadata?.referencedFiles).toContain('src/api.ts');
    });

    it('should update lastActivityAt', () => {
      const session = createSessionV2('test-id');
      const originalTime = session.lastActivityAt;

      // Small delay to ensure time difference
      const updated = addMessageV2(session, 'user', 'Test');

      expect(updated.lastActivityAt).toBeGreaterThanOrEqual(originalTime);
    });
  });

  describe('applyEvaluationV2', () => {
    it('should upgrade coverage level when new level is higher', () => {
      const session = createSessionV2('test-id');
      const evaluation: EvaluationResultV2 = {
        dimensionId: 'solution_clarity',
        newCoverage: 'partial',
        evidence: ['Some evidence'],
        reasoning: 'Test reasoning',
      };

      const updated = applyEvaluationV2(session, evaluation);

      expect(updated.dimensions.solution_clarity.coverage).toBe('partial');
      expect(updated.dimensions.solution_clarity.evidence).toContain('Some evidence');
    });

    it('should not downgrade coverage level', () => {
      let session = createSessionV2('test-id');

      // First upgrade to strong
      session = applyEvaluationV2(session, {
        dimensionId: 'solution_clarity',
        newCoverage: 'strong',
        evidence: ['Strong evidence'],
        reasoning: 'Strong',
      });

      // Try to downgrade to weak
      const updated = applyEvaluationV2(session, {
        dimensionId: 'solution_clarity',
        newCoverage: 'weak',
        evidence: ['Weak evidence'],
        reasoning: 'Weak',
      });

      // Should still be strong
      expect(updated.dimensions.solution_clarity.coverage).toBe('strong');
      // But evidence should still be accumulated
      expect(updated.dimensions.solution_clarity.evidence).toContain('Weak evidence');
    });

    it('should work with v2 dimensions', () => {
      const session = createSessionV2('test-id');
      const evaluation: EvaluationResultV2 = {
        dimensionId: 'technical_constraints',
        newCoverage: 'partial',
        evidence: ['Must use PostgreSQL'],
        reasoning: 'Tech constraint identified',
      };

      const updated = applyEvaluationV2(session, evaluation);

      expect(updated.dimensions.technical_constraints.coverage).toBe('partial');
      expect(updated.dimensions.technical_constraints.evidence).toContain('Must use PostgreSQL');
    });
  });

  describe('selectNextFocusV2', () => {
    it('should return solution_clarity first for new sessions', () => {
      const session = createSessionV2('test-id');
      expect(selectNextFocusV2(session)).toBe('solution_clarity');
    });

    it('should progress through v1 dimensions first', () => {
      let session = createSessionV2('test-id');

      // Complete solution_clarity
      session = applyEvaluationV2(session, {
        dimensionId: 'solution_clarity',
        newCoverage: 'strong',
        evidence: [],
        reasoning: 'Done',
      });
      expect(selectNextFocusV2(session)).toBe('user_value');

      // Complete user_value
      session = applyEvaluationV2(session, {
        dimensionId: 'user_value',
        newCoverage: 'strong',
        evidence: [],
        reasoning: 'Done',
      });
      expect(selectNextFocusV2(session)).toBe('scope_boundaries');
    });

    it('should move to v2 dimensions after v1 dimensions are complete', () => {
      let session = createSessionV2('test-id');

      // Complete all v1 dimensions
      const v1Dims: DimensionIdV2[] = ['solution_clarity', 'user_value', 'scope_boundaries', 'success_criteria'];
      for (const dimId of v1Dims) {
        session = applyEvaluationV2(session, {
          dimensionId: dimId,
          newCoverage: 'strong',
          evidence: [],
          reasoning: 'Done',
        });
      }

      // Should now focus on v2 dimensions
      const nextFocus = selectNextFocusV2(session);
      expect(['technical_constraints', 'edge_cases']).toContain(nextFocus);
    });

    it('should return null when all dimensions meet thresholds', () => {
      let session = createSessionV2('test-id');

      // Set all dimensions to their required thresholds
      const thresholds: Record<DimensionIdV2, CoverageLevelV2> = {
        solution_clarity: 'strong',
        user_value: 'strong',
        scope_boundaries: 'strong',
        success_criteria: 'strong',
        technical_constraints: 'partial',
        edge_cases: 'partial',
      };

      for (const [dimId, threshold] of Object.entries(thresholds)) {
        session = applyEvaluationV2(session, {
          dimensionId: dimId as DimensionIdV2,
          newCoverage: threshold,
          evidence: [],
          reasoning: 'Test',
        });
      }

      expect(selectNextFocusV2(session)).toBe(null);
    });

    it('should match canSignOffV2 when returning null', () => {
      let session = createSessionV2('test-id');

      // Set all dimensions to strong (exceeds all thresholds)
      for (const dimId of Object.keys(DIMENSIONS_V2) as DimensionIdV2[]) {
        session = applyEvaluationV2(session, {
          dimensionId: dimId,
          newCoverage: 'strong',
          evidence: [],
          reasoning: 'Test',
        });
      }

      expect(selectNextFocusV2(session)).toBe(null);
      expect(canSignOffV2(session.dimensions).ready).toBe(true);
    });
  });

  describe('setCodebaseContext', () => {
    it('should inject codebase context into session', () => {
      const session = createSessionV2('test-id');
      const context: CodebaseContext = {
        files: [
          {
            path: 'src/api.ts',
            type: 'service',
            description: 'API endpoints',
            relevance: 'high',
          },
        ],
        patterns: [
          {
            name: 'Repository Pattern',
            location: 'src/repos/',
            description: 'Data access layer',
            examples: ['UserRepo.ts'],
          },
        ],
        dependencies: [
          {
            name: 'express',
            version: '^4.18.0',
            type: 'production',
            usage: 'HTTP server',
          },
        ],
        techStack: ['TypeScript', 'Node.js', 'PostgreSQL'],
        architecture: 'REST API with repository pattern',
        discoveredAt: Date.now(),
      };

      const updated = setCodebaseContext(session, context);

      expect(updated.codebaseContext).not.toBeNull();
      expect(updated.codebaseContext?.files).toHaveLength(1);
      expect(updated.codebaseContext?.techStack).toContain('TypeScript');
    });

    it('should update lastActivityAt', () => {
      const session = createSessionV2('test-id');
      const context: CodebaseContext = {
        files: [],
        patterns: [],
        dependencies: [],
        techStack: [],
        architecture: 'Test',
        discoveredAt: Date.now(),
      };

      const updated = setCodebaseContext(session, context);

      expect(updated.lastActivityAt).toBeGreaterThanOrEqual(session.lastActivityAt);
    });
  });

  describe('addEdgeCase', () => {
    it('should add edge case to discoveredEdgeCases', () => {
      const session = createSessionV2('test-id');
      const edgeCase: EdgeCase = {
        id: 'edge-001',
        description: 'User submits empty form',
        source: 'user_input',
        severity: 'medium',
        recommendation: 'Add validation',
        discoveredAt: Date.now(),
      };

      const updated = addEdgeCase(session, edgeCase);

      expect(updated.discoveredEdgeCases).toHaveLength(1);
      expect(updated.discoveredEdgeCases[0].id).toBe('edge-001');
    });

    it('should accumulate multiple edge cases', () => {
      let session = createSessionV2('test-id');

      session = addEdgeCase(session, {
        id: 'edge-001',
        description: 'Case 1',
        source: 'user_input',
        severity: 'low',
        recommendation: 'Handle',
        discoveredAt: Date.now(),
      });

      session = addEdgeCase(session, {
        id: 'edge-002',
        description: 'Case 2',
        source: 'codebase_analysis',
        severity: 'high',
        recommendation: 'Handle',
        discoveredAt: Date.now(),
      });

      expect(session.discoveredEdgeCases).toHaveLength(2);
    });
  });

  describe('setSessionPhase', () => {
    it('should update current phase', () => {
      const session = createSessionV2('test-id');
      expect(session.currentPhase).toBe('gathering');

      const updated = setSessionPhase(session, 'edge_case_discovery');
      expect(updated.currentPhase).toBe('edge_case_discovery');
    });

    it('should support all phases', () => {
      const phases: SessionPhase[] = ['gathering', 'edge_case_discovery', 'validation', 'complete'];
      let session = createSessionV2('test-id');

      for (const phase of phases) {
        session = setSessionPhase(session, phase);
        expect(session.currentPhase).toBe(phase);
      }
    });
  });

  describe('setLoadedProblemV2', () => {
    it('should set loaded problem from problem-advisor', () => {
      const session = createSessionV2('test-id');
      const problem = {
        problem: 'Users struggle to define requirements',
        who: 'Product managers',
        frequencySeverity: 'Weekly, high severity',
        businessImpact: 'Delayed projects',
        validation: 'Interviewed 10 PMs',
        confidence: 'high' as const,
        sourceFile: '/projects/test.md',
      };

      const updated = setLoadedProblemV2(session, problem);

      expect(updated.loadedProblem).not.toBeNull();
      expect(updated.loadedProblem?.problem).toBe('Users struggle to define requirements');
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize state', () => {
      let session = createSessionV2('test-id');
      session = addMessageV2(session, 'user', 'Test message');
      session = applyEvaluationV2(session, {
        dimensionId: 'solution_clarity',
        newCoverage: 'partial',
        evidence: ['Test evidence'],
        reasoning: 'Test',
      });
      session = addEdgeCase(session, {
        id: 'edge-001',
        description: 'Test edge case',
        source: 'user_input',
        severity: 'medium',
        recommendation: 'Handle it',
        discoveredAt: Date.now(),
      });

      const serialized = serializeStateV2(session);
      const deserialized = deserializeStateV2(serialized);

      expect(deserialized.id).toBe(session.id);
      expect(deserialized.conversationHistory).toHaveLength(1);
      expect(deserialized.dimensions.solution_clarity.coverage).toBe('partial');
      expect(deserialized.discoveredEdgeCases).toHaveLength(1);
    });
  });
});
