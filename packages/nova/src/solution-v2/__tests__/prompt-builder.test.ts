import { describe, it, expect } from 'vitest';
import {
  buildSystemPromptV2,
  buildEvaluationPromptV2,
  buildCodebaseContextSection,
  buildEdgeCaseSection,
} from '../core/prompt-builder.js';
import { createSessionV2, setCodebaseContext, addEdgeCase, setSessionPhase } from '../core/state-machine.js';
import type { CodebaseContext, EdgeCase, DimensionIdV2 } from '../core/types.js';

describe('solution-v2 prompt-builder', () => {
  describe('buildSystemPromptV2', () => {
    it('should include v2-specific role description', () => {
      const session = createSessionV2('test-id');
      const prompt = buildSystemPromptV2(session);

      expect(prompt).toContain('Solution Architect');
      expect(prompt).toContain('codebase-aware');
    });

    it('should include all dimension progress', () => {
      const session = createSessionV2('test-id');
      const prompt = buildSystemPromptV2(session);

      expect(prompt).toContain('Solution Clarity');
      expect(prompt).toContain('User Value');
      expect(prompt).toContain('Scope Boundaries');
      expect(prompt).toContain('Success Criteria');
      expect(prompt).toContain('Technical Constraints');
      expect(prompt).toContain('Edge Cases');
    });

    it('should include current focus guidance when focus is set', () => {
      const session = createSessionV2('test-id');
      session.currentFocus = 'technical_constraints';
      const prompt = buildSystemPromptV2(session);

      expect(prompt).toContain('Current Focus: Technical Constraints');
      expect(prompt).toContain('integration');
    });

    it('should include codebase context when present', () => {
      let session = createSessionV2('test-id');
      const context: CodebaseContext = {
        files: [
          { path: 'src/auth.ts', type: 'service', description: 'Auth service', relevance: 'high' },
        ],
        patterns: [
          { name: 'Repository Pattern', location: 'src/repos', description: 'Data access layer', examples: ['userRepo.ts'] },
        ],
        dependencies: [],
        techStack: ['TypeScript', 'Node.js'],
        architecture: 'Layered architecture',
        discoveredAt: Date.now(),
      };
      session = setCodebaseContext(session, context);
      const prompt = buildSystemPromptV2(session);

      expect(prompt).toContain('Codebase Context');
      expect(prompt).toContain('src/auth.ts');
      expect(prompt).toContain('TypeScript');
      expect(prompt).toContain('Repository Pattern');
    });

    it('should include discovered edge cases when present', () => {
      let session = createSessionV2('test-id');
      const edgeCase: EdgeCase = {
        id: 'ec-1',
        description: 'Network timeout handling',
        source: 'llm_inference',
        severity: 'high',
        recommendation: 'Add retry logic with exponential backoff',
        discoveredAt: Date.now(),
      };
      session = addEdgeCase(session, edgeCase);
      const prompt = buildSystemPromptV2(session);

      expect(prompt).toContain('Edge Cases Discovered');
      expect(prompt).toContain('Network timeout handling');
    });

    it('should include v2-specific commands', () => {
      const session = createSessionV2('test-id');
      const prompt = buildSystemPromptV2(session);

      expect(prompt).toContain('/progress');
      expect(prompt).toContain('/eject');
      expect(prompt).toContain('/context');
    });

    it('should include phase-specific guidance', () => {
      let session = createSessionV2('test-id');
      session = setSessionPhase(session, 'edge_case_discovery');
      const prompt = buildSystemPromptV2(session);

      expect(prompt).toContain('Edge Case Discovery');
    });

    it('should indicate ready for sign-off when all dimensions meet threshold', () => {
      const session = createSessionV2('test-id');
      // Set all v1 dimensions to strong, v2 dimensions to partial
      for (const dimId of Object.keys(session.dimensions) as DimensionIdV2[]) {
        if (dimId === 'technical_constraints' || dimId === 'edge_cases') {
          session.dimensions[dimId].coverage = 'partial';
        } else {
          session.dimensions[dimId].coverage = 'strong';
        }
      }
      const prompt = buildSystemPromptV2(session);

      expect(prompt).toContain('Ready for Sign-Off');
    });
  });

  describe('buildEvaluationPromptV2', () => {
    it('should include dimension definition', () => {
      const prompt = buildEvaluationPromptV2(
        'We need to handle network failures gracefully',
        'user: what about error handling?\nassistant: Good question!',
        'edge_cases',
        null
      );

      expect(prompt).toContain('Edge Cases');
      expect(prompt).toContain('Unusual scenarios');
    });

    it('should include conversation context', () => {
      const conversationContext = 'user: I want to add caching\nassistant: Where should we cache?';
      const prompt = buildEvaluationPromptV2(
        'In the API layer',
        conversationContext,
        'solution_clarity',
        null
      );

      expect(prompt).toContain(conversationContext);
    });

    it('should include loaded problem context when present', () => {
      const loadedProblem = {
        problem: 'Users wait too long for search results',
        who: 'Product teams',
        sourceFile: 'problem.md',
      };
      const prompt = buildEvaluationPromptV2(
        'Add caching',
        'context here',
        'solution_clarity',
        loadedProblem
      );

      expect(prompt).toContain('Problem Being Solved');
      expect(prompt).toContain('Users wait too long');
    });

    it('should request JSON response format', () => {
      const prompt = buildEvaluationPromptV2(
        'message',
        'context',
        'user_value',
        null
      );

      expect(prompt).toContain('JSON');
      expect(prompt).toContain('coverage');
      expect(prompt).toContain('evidence');
    });
  });

  describe('buildCodebaseContextSection', () => {
    it('should format files with relevance', () => {
      const context: CodebaseContext = {
        files: [
          { path: 'src/api.ts', type: 'controller', description: 'API handler', relevance: 'high' },
          { path: 'src/utils.ts', type: 'utility', description: 'Helpers', relevance: 'low' },
        ],
        patterns: [],
        dependencies: [],
        techStack: ['TypeScript'],
        architecture: 'MVC',
        discoveredAt: Date.now(),
      };
      const section = buildCodebaseContextSection(context);

      expect(section).toContain('src/api.ts');
      expect(section).toContain('high');
      expect(section).toContain('controller');
    });

    it('should format patterns with examples', () => {
      const context: CodebaseContext = {
        files: [],
        patterns: [
          { name: 'Factory', location: 'src/factories', description: 'Object creation', examples: ['userFactory.ts', 'orderFactory.ts'] },
        ],
        dependencies: [],
        techStack: [],
        architecture: '',
        discoveredAt: Date.now(),
      };
      const section = buildCodebaseContextSection(context);

      expect(section).toContain('Factory');
      expect(section).toContain('userFactory.ts');
    });

    it('should include tech stack', () => {
      const context: CodebaseContext = {
        files: [],
        patterns: [],
        dependencies: [],
        techStack: ['React', 'GraphQL', 'PostgreSQL'],
        architecture: '',
        discoveredAt: Date.now(),
      };
      const section = buildCodebaseContextSection(context);

      expect(section).toContain('React');
      expect(section).toContain('GraphQL');
      expect(section).toContain('PostgreSQL');
    });
  });

  describe('buildEdgeCaseSection', () => {
    it('should format edge cases with severity', () => {
      const edgeCases: EdgeCase[] = [
        {
          id: 'ec-1',
          description: 'Database connection pool exhaustion',
          source: 'codebase_analysis',
          severity: 'critical',
          recommendation: 'Implement connection pooling limits',
          discoveredAt: Date.now(),
        },
      ];
      const section = buildEdgeCaseSection(edgeCases);

      expect(section).toContain('Database connection pool exhaustion');
      expect(section).toContain('critical');
      expect(section).toContain('codebase_analysis');
    });

    it('should return empty message when no edge cases', () => {
      const section = buildEdgeCaseSection([]);

      expect(section).toContain('No edge cases');
    });
  });
});
