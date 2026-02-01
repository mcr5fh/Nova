import { describe, it, expect } from 'vitest';
import {
  formatV2Output,
  formatUXFlow,
  formatEdgeCasesSection,
  formatComplexitySection,
  formatMermaidSection,
} from '../core/output-formatter.js';
import type { SolutionSpecV2, EdgeCase, TShirtSize, ImplementationDiagram } from '../core/types.js';

// Helper to create minimal spec
function createTestSpec(overrides: Partial<SolutionSpecV2> = {}): SolutionSpecV2 {
  return {
    solutionSummary: 'A user authentication system',
    userValue: 'Users can securely log in and manage sessions',
    scope: {
      included: ['Login', 'Logout', 'Session management'],
      excluded: ['Social login', 'OAuth'],
      futureConsiderations: ['MFA support'],
    },
    successCriteria: ['Users can log in', 'Sessions persist', 'Logout works'],
    userFlow: 'User -> Login -> Dashboard -> Logout',
    gaps: [],
    confidence: 'high',
    edgeCases: [
      {
        id: 'ec1',
        description: 'Invalid credentials',
        source: 'user_input',
        severity: 'high',
        recommendation: 'Show clear error message',
        discoveredAt: Date.now(),
      },
      {
        id: 'ec2',
        description: 'Session timeout',
        source: 'llm_inference',
        severity: 'medium',
        recommendation: 'Redirect to login',
        discoveredAt: Date.now(),
      },
    ],
    effortEstimate: {
      size: 'M',
      reasoning: 'Medium complexity with multiple components',
      confidence: 'medium',
      factors: ['3 files to modify', '3 scope items'],
    },
    implementationDiagram: {
      type: 'flowchart',
      mermaid: 'flowchart TD\n    A[User] --> B[Auth Service]\n    B --> C[Database]',
      description: 'Authentication flow',
      generatedAt: Date.now(),
    },
    technicalConstraints: ['Must use existing database', 'JWT tokens required'],
    ...overrides,
  };
}

describe('output-formatter', () => {
  describe('formatV2Output', () => {
    it('should format complete spec as markdown', () => {
      const spec = createTestSpec();
      const result = formatV2Output(spec);

      expect(result).toContain('# Solution Specification');
      expect(result).toContain('## Summary');
      expect(result).toContain('user authentication system');
      expect(result).toContain('## User Value');
      expect(result).toContain('## Scope');
      expect(result).toContain('## Success Criteria');
    });

    it('should include edge cases section', () => {
      const spec = createTestSpec();
      const result = formatV2Output(spec);

      expect(result).toContain('## Edge Cases');
      expect(result).toContain('Invalid credentials');
      expect(result).toContain('Session timeout');
    });

    it('should include complexity section', () => {
      const spec = createTestSpec();
      const result = formatV2Output(spec);

      expect(result).toContain('## Effort Estimate');
      expect(result).toContain('**Size:** M');
    });

    it('should include mermaid diagram', () => {
      const spec = createTestSpec();
      const result = formatV2Output(spec);

      expect(result).toContain('## Implementation Diagram');
      expect(result).toContain('```mermaid');
      expect(result).toContain('flowchart TD');
    });

    it('should include technical constraints', () => {
      const spec = createTestSpec();
      const result = formatV2Output(spec);

      expect(result).toContain('## Technical Constraints');
      expect(result).toContain('existing database');
      expect(result).toContain('JWT tokens');
    });

    it('should show confidence level', () => {
      const spec = createTestSpec({ confidence: 'high' });
      const result = formatV2Output(spec);

      expect(result).toContain('**Confidence:** HIGH');
    });

    it('should show gaps if present', () => {
      const spec = createTestSpec({ gaps: ['edge_cases', 'technical_constraints'] });
      const result = formatV2Output(spec);

      expect(result).toContain('## Gaps');
      expect(result).toContain('edge_cases');
      expect(result).toContain('technical_constraints');
    });

    it('should include problem context if present', () => {
      const spec = createTestSpec({
        problemContext: {
          problem: 'Users cannot log in securely',
          who: 'End users',
          sourceFile: '/path/to/problem.json',
        },
      });
      const result = formatV2Output(spec);

      expect(result).toContain('## Problem Context');
      expect(result).toContain('cannot log in securely');
    });
  });

  describe('formatUXFlow', () => {
    it('should format simple flow', () => {
      const flow = 'User -> Login -> Dashboard';
      const result = formatUXFlow(flow);

      expect(result).toContain('User');
      expect(result).toContain('Login');
      expect(result).toContain('Dashboard');
    });

    it('should handle empty flow', () => {
      const result = formatUXFlow('');
      expect(result).toBe('_Not yet defined_');
    });
  });

  describe('formatEdgeCasesSection', () => {
    it('should format edge cases with severity badges', () => {
      const edgeCases: EdgeCase[] = [
        {
          id: 'ec1',
          description: 'Network failure',
          source: 'llm_inference',
          severity: 'critical',
          recommendation: 'Retry with backoff',
          discoveredAt: Date.now(),
        },
        {
          id: 'ec2',
          description: 'Invalid input',
          source: 'user_input',
          severity: 'low',
          recommendation: 'Validate early',
          discoveredAt: Date.now(),
        },
      ];

      const result = formatEdgeCasesSection(edgeCases);

      expect(result).toContain('🔴'); // critical
      expect(result).toContain('Network failure');
      expect(result).toContain('🟢'); // low
      expect(result).toContain('Invalid input');
    });

    it('should show recommendations', () => {
      const edgeCases: EdgeCase[] = [
        {
          id: 'ec1',
          description: 'Test case',
          source: 'llm_inference',
          severity: 'medium',
          recommendation: 'Handle gracefully',
          discoveredAt: Date.now(),
        },
      ];

      const result = formatEdgeCasesSection(edgeCases);
      expect(result).toContain('Handle gracefully');
    });

    it('should show affected files if present', () => {
      const edgeCases: EdgeCase[] = [
        {
          id: 'ec1',
          description: 'Database error',
          source: 'codebase_analysis',
          severity: 'high',
          recommendation: 'Add error handling',
          affectedFiles: ['src/db.ts', 'src/api.ts'],
          discoveredAt: Date.now(),
        },
      ];

      const result = formatEdgeCasesSection(edgeCases);
      expect(result).toContain('src/db.ts');
      expect(result).toContain('src/api.ts');
    });

    it('should handle empty edge cases', () => {
      const result = formatEdgeCasesSection([]);
      expect(result).toContain('No edge cases');
    });
  });

  describe('formatComplexitySection', () => {
    it('should format t-shirt size with reasoning', () => {
      const estimate: TShirtSize = {
        size: 'L',
        reasoning: 'Large scope with many integrations',
        confidence: 'medium',
        factors: ['5 files', '4 integrations'],
      };

      const result = formatComplexitySection(estimate);

      expect(result).toContain('**Size:** L');
      expect(result).toContain('Large scope');
      expect(result).toContain('5 files');
      expect(result).toContain('4 integrations');
    });

    it('should show confidence level', () => {
      const estimate: TShirtSize = {
        size: 'S',
        reasoning: 'Small change',
        confidence: 'high',
        factors: [],
      };

      const result = formatComplexitySection(estimate);
      expect(result).toContain('**Confidence:** high');
    });
  });

  describe('formatMermaidSection', () => {
    it('should wrap diagram in code fence', () => {
      const diagram: ImplementationDiagram = {
        type: 'flowchart',
        mermaid: 'flowchart TD\n    A --> B',
        description: 'Test diagram',
        generatedAt: Date.now(),
      };

      const result = formatMermaidSection(diagram);

      expect(result).toContain('```mermaid');
      expect(result).toContain('flowchart TD');
      expect(result).toContain('A --> B');
      expect(result).toContain('```');
    });

    it('should include diagram description', () => {
      const diagram: ImplementationDiagram = {
        type: 'sequence',
        mermaid: 'sequenceDiagram\n    A->>B: message',
        description: 'Sequence of API calls',
        generatedAt: Date.now(),
      };

      const result = formatMermaidSection(diagram);
      expect(result).toContain('Sequence of API calls');
    });

    it('should handle empty mermaid content', () => {
      const diagram: ImplementationDiagram = {
        type: 'flowchart',
        mermaid: '',
        description: 'Empty diagram',
        generatedAt: Date.now(),
      };

      const result = formatMermaidSection(diagram);
      expect(result).toContain('_Diagram not available_');
    });
  });
});
