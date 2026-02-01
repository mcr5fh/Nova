import { describe, it, expect, vi } from 'vitest';
import {
  generateImplementationDiagram,
  generateFallbackDiagram,
  createMermaidFlowchart,
} from '../core/mermaid-generator.js';
import type { CodebaseContext, SolutionSpecV2, ImplementationDiagram } from '../core/types.js';
import type { LLMAdapter, LLMResponse } from '../../shared/llm/types.js';

// Helper to create a mock LLM adapter
function createMockLLM(response: string): LLMAdapter {
  return {
    chat: vi.fn().mockResolvedValue({ content: response, stopReason: 'end_turn' } as LLMResponse),
    chatStream: vi.fn(),
  };
}

// Helper to create minimal codebase context
function createTestContext(overrides: Partial<CodebaseContext> = {}): CodebaseContext {
  return {
    files: [
      { path: 'src/api/users.ts', type: 'service', description: 'User service', relevance: 'high' },
      { path: 'src/db/models.ts', type: 'model', description: 'Database models', relevance: 'high' },
    ],
    patterns: [
      { name: 'Repository Pattern', location: 'src/db/', description: 'Data access layer', examples: ['src/db/user-repo.ts'] },
    ],
    dependencies: [
      { name: 'express', version: '^4.18.0', type: 'production', usage: 'Web framework' },
    ],
    techStack: ['TypeScript', 'Node.js', 'Express'],
    architecture: 'Layered architecture with service/repository pattern',
    discoveredAt: Date.now(),
    ...overrides,
  };
}

// Helper to create minimal spec
function createTestSpec(overrides: Partial<SolutionSpecV2> = {}): SolutionSpecV2 {
  return {
    solutionSummary: 'A user authentication system',
    userValue: 'Users can securely log in and manage sessions',
    scope: {
      included: ['Login', 'Logout', 'Session management'],
      excluded: ['Social login'],
      futureConsiderations: ['OAuth integration'],
    },
    successCriteria: ['Users can log in', 'Sessions persist across requests'],
    userFlow: '',
    gaps: [],
    confidence: 'high',
    edgeCases: [],
    effortEstimate: { size: 'M', reasoning: 'Test', confidence: 'medium', factors: [] },
    implementationDiagram: { type: 'flowchart', mermaid: '', description: '', generatedAt: Date.now() },
    technicalConstraints: ['Must use existing database'],
    ...overrides,
  };
}

describe('mermaid-generator', () => {
  describe('generateImplementationDiagram', () => {
    it('should generate a flowchart diagram from LLM response', async () => {
      const mockMermaid = `flowchart TD
    A[User Request] --> B[Auth Service]
    B --> C[Database]
    C --> D[Response]`;

      const llm = createMockLLM(mockMermaid);
      const context = createTestContext();
      const spec = createTestSpec();

      const result = await generateImplementationDiagram(context, spec, llm);

      expect(result.type).toBe('flowchart');
      expect(result.mermaid).toBe(mockMermaid);
      expect(result.description).toBeTruthy();
      expect(result.generatedAt).toBeLessThanOrEqual(Date.now());
      expect(llm.chat).toHaveBeenCalled();
    });

    it('should return fallback diagram when LLM fails', async () => {
      const llm: LLMAdapter = {
        chat: vi.fn().mockRejectedValue(new Error('API error')),
        chatStream: vi.fn(),
      };
      const context = createTestContext();
      const spec = createTestSpec();

      const result = await generateImplementationDiagram(context, spec, llm);

      expect(result.type).toBe('flowchart');
      expect(result.mermaid).toContain('flowchart TD');
      expect(result.description).toContain('fallback');
    });

    it('should include file information in prompt', async () => {
      const mockMermaid = 'flowchart TD\n    A --> B';
      const llm = createMockLLM(mockMermaid);
      const context = createTestContext({
        files: [
          { path: 'src/auth/login.ts', type: 'handler', description: 'Login handler', relevance: 'high' },
          { path: 'src/auth/session.ts', type: 'service', description: 'Session manager', relevance: 'high' },
        ],
      });
      const spec = createTestSpec();

      await generateImplementationDiagram(context, spec, llm);

      const callArgs = (llm.chat as ReturnType<typeof vi.fn>).mock.calls[0];
      const prompt = callArgs[0][0].content;
      expect(prompt).toContain('src/auth/login.ts');
      expect(prompt).toContain('src/auth/session.ts');
    });

    it('should handle empty codebase context gracefully', async () => {
      const mockMermaid = 'flowchart TD\n    A[Start] --> B[End]';
      const llm = createMockLLM(mockMermaid);
      const context = createTestContext({
        files: [],
        patterns: [],
        dependencies: [],
        techStack: [],
      });
      const spec = createTestSpec();

      const result = await generateImplementationDiagram(context, spec, llm);

      expect(result.type).toBe('flowchart');
      expect(result.mermaid).toBeTruthy();
    });
  });

  describe('generateFallbackDiagram', () => {
    it('should create a valid mermaid flowchart', () => {
      const spec = createTestSpec();
      const result = generateFallbackDiagram(spec);

      expect(result.type).toBe('flowchart');
      expect(result.mermaid).toContain('flowchart TD');
      expect(result.description).toContain('fallback');
    });

    it('should include scope items in the diagram', () => {
      const spec = createTestSpec({
        scope: {
          included: ['Feature A', 'Feature B', 'Feature C'],
          excluded: [],
          futureConsiderations: [],
        },
      });
      const result = generateFallbackDiagram(spec);

      expect(result.mermaid).toContain('Feature A');
      expect(result.mermaid).toContain('Feature B');
      expect(result.mermaid).toContain('Feature C');
    });
  });

  describe('createMermaidFlowchart', () => {
    it('should create a flowchart from node-edge definitions', () => {
      const nodes = [
        { id: 'A', label: 'Start' },
        { id: 'B', label: 'Process' },
        { id: 'C', label: 'End' },
      ];
      const edges = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ];

      const result = createMermaidFlowchart(nodes, edges);

      expect(result).toContain('flowchart TD');
      expect(result).toContain('A[Start]');
      expect(result).toContain('B[Process]');
      expect(result).toContain('C[End]');
      expect(result).toContain('A --> B');
      expect(result).toContain('B --> C');
    });

    it('should handle labeled edges', () => {
      const nodes = [
        { id: 'A', label: 'Check' },
        { id: 'B', label: 'Yes' },
        { id: 'C', label: 'No' },
      ];
      const edges = [
        { from: 'A', to: 'B', label: 'success' },
        { from: 'A', to: 'C', label: 'failure' },
      ];

      const result = createMermaidFlowchart(nodes, edges);

      expect(result).toContain('A -->|success| B');
      expect(result).toContain('A -->|failure| C');
    });

    it('should escape special characters in labels', () => {
      const nodes = [
        { id: 'A', label: 'Check "status"' },
        { id: 'B', label: 'Process & Save' },
      ];
      const edges = [{ from: 'A', to: 'B' }];

      const result = createMermaidFlowchart(nodes, edges);

      // Quotes and ampersands should be escaped or handled
      expect(result).not.toContain('"status"');
    });
  });
});
