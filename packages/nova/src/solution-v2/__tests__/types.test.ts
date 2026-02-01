import { describe, it, expect } from 'vitest';
import type {
  CodebaseContext,
  FileInfo,
  PatternInfo,
  DependencyInfo,
  EdgeCase,
  EdgeCaseSeverity,
  TShirtSize,
  TShirtSizeValue,
  ImplementationDiagram,
  SolutionSpecV2,
  DimensionIdV2,
  CoverageLevelV2,
  DimensionStateV2,
  SessionStateV2,
  EvaluationResultV2,
  MessageV2,
} from '../core/types.js';

describe('solution-v2 types', () => {
  describe('CodebaseContext', () => {
    it('should represent discovered codebase information', () => {
      const fileInfo: FileInfo = {
        path: 'src/components/Button.tsx',
        type: 'component',
        description: 'Reusable button component',
        relevance: 'high',
      };

      const patternInfo: PatternInfo = {
        name: 'Repository Pattern',
        location: 'src/repositories/',
        description: 'Data access abstraction',
        examples: ['UserRepository.ts', 'ProductRepository.ts'],
      };

      const dependencyInfo: DependencyInfo = {
        name: 'react',
        version: '^18.2.0',
        type: 'production',
        usage: 'UI framework',
      };

      const context: CodebaseContext = {
        files: [fileInfo],
        patterns: [patternInfo],
        dependencies: [dependencyInfo],
        techStack: ['TypeScript', 'React', 'Node.js'],
        architecture: 'Monolith with modular structure',
        discoveredAt: Date.now(),
      };

      expect(context.files).toHaveLength(1);
      expect(context.files[0].relevance).toBe('high');
      expect(context.patterns).toHaveLength(1);
      expect(context.dependencies).toHaveLength(1);
      expect(context.techStack).toContain('TypeScript');
    });
  });

  describe('EdgeCase', () => {
    it('should represent edge cases with severity levels', () => {
      const severities: EdgeCaseSeverity[] = ['critical', 'high', 'medium', 'low'];

      const edgeCase: EdgeCase = {
        id: 'edge-001',
        description: 'User submits form with empty required fields',
        source: 'codebase_analysis',
        severity: 'high',
        recommendation: 'Add client-side validation before submission',
        affectedFiles: ['src/forms/UserForm.tsx'],
        discoveredAt: Date.now(),
      };

      expect(edgeCase.severity).toBe('high');
      expect(severities).toContain(edgeCase.severity);
      expect(edgeCase.source).toBe('codebase_analysis');
    });

    it('should support multiple edge case sources', () => {
      const sources = ['codebase_analysis', 'user_input', 'llm_inference'] as const;

      const edgeCases: EdgeCase[] = sources.map((source, i) => ({
        id: `edge-00${i}`,
        description: `Edge case from ${source}`,
        source,
        severity: 'medium',
        recommendation: 'Handle this case',
        discoveredAt: Date.now(),
      }));

      expect(edgeCases).toHaveLength(3);
      edgeCases.forEach((ec, i) => {
        expect(ec.source).toBe(sources[i]);
      });
    });
  });

  describe('TShirtSize', () => {
    it('should represent effort estimation with reasoning', () => {
      const sizes: TShirtSizeValue[] = ['XS', 'S', 'M', 'L', 'XL'];

      const estimation: TShirtSize = {
        size: 'M',
        reasoning: 'Moderate complexity due to multiple API integrations',
        confidence: 'medium',
        factors: [
          'New API endpoints needed',
          'Database schema changes required',
          'Frontend components to build',
        ],
      };

      expect(sizes).toContain(estimation.size);
      expect(estimation.confidence).toBe('medium');
      expect(estimation.factors).toHaveLength(3);
    });

    it('should support all confidence levels', () => {
      const confidences = ['low', 'medium', 'high'] as const;

      confidences.forEach(confidence => {
        const estimation: TShirtSize = {
          size: 'S',
          reasoning: 'Test',
          confidence,
          factors: [],
        };
        expect(estimation.confidence).toBe(confidence);
      });
    });
  });

  describe('ImplementationDiagram', () => {
    it('should contain mermaid diagram output', () => {
      const diagram: ImplementationDiagram = {
        type: 'flowchart',
        mermaid: `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]`,
        description: 'Implementation flow for feature X',
        generatedAt: Date.now(),
      };

      expect(diagram.type).toBe('flowchart');
      expect(diagram.mermaid).toContain('flowchart TD');
      expect(diagram.description).toBeDefined();
    });

    it('should support multiple diagram types', () => {
      const types = ['flowchart', 'sequence', 'class', 'state'] as const;

      types.forEach(type => {
        const diagram: ImplementationDiagram = {
          type,
          mermaid: `${type} diagram content`,
          description: `A ${type} diagram`,
          generatedAt: Date.now(),
        };
        expect(diagram.type).toBe(type);
      });
    });
  });

  describe('SolutionSpecV2', () => {
    it('should include all v1 fields plus new v2 outputs', () => {
      const spec: SolutionSpecV2 = {
        // v1 fields
        solutionSummary: 'A CLI tool for problem definition',
        userValue: 'Helps teams clarify requirements',
        scope: {
          included: ['CLI interface', 'Problem statements'],
          excluded: ['Web UI', 'Mobile app'],
          futureConsiderations: ['API export'],
        },
        successCriteria: ['Users complete problem statements', 'Output is actionable'],
        userFlow: 'User starts CLI -> Answers questions -> Gets problem statement',
        gaps: [],
        confidence: 'high',

        // v2 additions
        codebaseContext: {
          files: [],
          patterns: [],
          dependencies: [],
          techStack: ['TypeScript'],
          architecture: 'CLI application',
          discoveredAt: Date.now(),
        },
        edgeCases: [
          {
            id: 'edge-001',
            description: 'User cancels mid-session',
            source: 'llm_inference',
            severity: 'medium',
            recommendation: 'Save session state for recovery',
            discoveredAt: Date.now(),
          },
        ],
        effortEstimate: {
          size: 'M',
          reasoning: 'Moderate scope with well-defined requirements',
          confidence: 'medium',
          factors: ['CLI parsing', 'LLM integration', 'State management'],
        },
        implementationDiagram: {
          type: 'flowchart',
          mermaid: 'flowchart TD\n  A --> B',
          description: 'High-level implementation flow',
          generatedAt: Date.now(),
        },
        technicalConstraints: [
          'Must work offline with cached LLM responses',
          'Node.js 18+ required',
        ],
      };

      // v1 fields present
      expect(spec.solutionSummary).toBeDefined();
      expect(spec.userValue).toBeDefined();
      expect(spec.scope.included).toHaveLength(2);

      // v2 additions present
      expect(spec.codebaseContext).toBeDefined();
      expect(spec.edgeCases).toHaveLength(1);
      expect(spec.effortEstimate.size).toBe('M');
      expect(spec.implementationDiagram.type).toBe('flowchart');
      expect(spec.technicalConstraints).toHaveLength(2);
    });

    it('should allow optional v2 fields for incremental building', () => {
      const partialSpec: Partial<SolutionSpecV2> = {
        solutionSummary: 'In progress...',
        gaps: ['solution_clarity'],
        confidence: 'low',
      };

      expect(partialSpec.codebaseContext).toBeUndefined();
      expect(partialSpec.edgeCases).toBeUndefined();
    });
  });

  describe('DimensionIdV2', () => {
    it('should include v1 dimensions plus new v2 dimensions', () => {
      const v1Dimensions: DimensionIdV2[] = [
        'solution_clarity',
        'user_value',
        'scope_boundaries',
        'success_criteria',
      ];

      const v2Dimensions: DimensionIdV2[] = [
        'technical_constraints',
        'edge_cases',
      ];

      const allDimensions: DimensionIdV2[] = [...v1Dimensions, ...v2Dimensions];

      expect(allDimensions).toContain('solution_clarity');
      expect(allDimensions).toContain('technical_constraints');
      expect(allDimensions).toContain('edge_cases');
      expect(allDimensions).toHaveLength(6);
    });
  });

  describe('SessionStateV2', () => {
    it('should include codebase context and edge case tracking', () => {
      const now = Date.now();

      const state: SessionStateV2 = {
        id: 'session-001',
        dimensions: {
          solution_clarity: {
            id: 'solution_clarity',
            coverage: 'not_started',
            evidence: [],
            lastUpdated: now,
          },
          user_value: {
            id: 'user_value',
            coverage: 'not_started',
            evidence: [],
            lastUpdated: now,
          },
          scope_boundaries: {
            id: 'scope_boundaries',
            coverage: 'not_started',
            evidence: [],
            lastUpdated: now,
          },
          success_criteria: {
            id: 'success_criteria',
            coverage: 'not_started',
            evidence: [],
            lastUpdated: now,
          },
          technical_constraints: {
            id: 'technical_constraints',
            coverage: 'not_started',
            evidence: [],
            lastUpdated: now,
          },
          edge_cases: {
            id: 'edge_cases',
            coverage: 'not_started',
            evidence: [],
            lastUpdated: now,
          },
        },
        conversationHistory: [],
        currentFocus: 'solution_clarity',
        startedAt: now,
        lastActivityAt: now,
        loadedProblem: null,

        // v2 additions
        codebaseContext: null,
        discoveredEdgeCases: [],
        currentPhase: 'gathering',
      };

      expect(state.codebaseContext).toBeNull();
      expect(state.discoveredEdgeCases).toHaveLength(0);
      expect(state.currentPhase).toBe('gathering');
      expect(Object.keys(state.dimensions)).toHaveLength(6);
    });

    it('should support all session phases', () => {
      const phases = ['gathering', 'edge_case_discovery', 'validation', 'complete'] as const;

      phases.forEach(phase => {
        const state: Partial<SessionStateV2> = {
          currentPhase: phase,
        };
        expect(state.currentPhase).toBe(phase);
      });
    });
  });

  describe('EvaluationResultV2', () => {
    it('should work with v2 dimensions', () => {
      const evaluation: EvaluationResultV2 = {
        dimensionId: 'technical_constraints',
        newCoverage: 'partial',
        evidence: ['Must use existing auth system', 'Database is PostgreSQL'],
        reasoning: 'Identified some technical constraints from discussion',
      };

      expect(evaluation.dimensionId).toBe('technical_constraints');
      expect(evaluation.newCoverage).toBe('partial');
      expect(evaluation.evidence).toHaveLength(2);
    });
  });

  describe('MessageV2', () => {
    it('should support metadata for codebase context', () => {
      const message: MessageV2 = {
        role: 'assistant',
        content: 'Based on the codebase analysis...',
        timestamp: Date.now(),
        metadata: {
          codebaseContextUsed: true,
          referencedFiles: ['src/api/routes.ts'],
        },
      };

      expect(message.metadata?.codebaseContextUsed).toBe(true);
      expect(message.metadata?.referencedFiles).toContain('src/api/routes.ts');
    });

    it('should allow messages without metadata', () => {
      const message: MessageV2 = {
        role: 'user',
        content: 'What about edge cases?',
        timestamp: Date.now(),
      };

      expect(message.metadata).toBeUndefined();
    });
  });
});
