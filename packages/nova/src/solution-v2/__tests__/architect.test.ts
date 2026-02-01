import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SolutionArchitectV2 } from '../api/architect.js';
import type { ArchitectConfigV2, CodebaseContext, SessionStateV2 } from '../core/types.js';

// Mock the LLM adapter
vi.mock('../../shared/llm/anthropic.js', () => ({
  AnthropicAdapter: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        coverage: 'partial',
        evidence: ['test evidence'],
        reasoning: 'test reasoning',
      }),
      stopReason: 'end_turn',
    }),
    chatStream: vi.fn().mockImplementation(async function* () {
      yield { type: 'text', text: 'Hello, ' };
      yield { type: 'text', text: 'this is a test response.' };
      yield { type: 'done' };
    }),
  })),
}));

describe('SolutionArchitectV2', () => {
  let config: ArchitectConfigV2;

  beforeEach(() => {
    config = {
      llmProvider: 'anthropic',
      modelId: 'claude-sonnet-4-20250514',
      apiKey: 'test-api-key',
      streamResponses: false,
    };
  });

  describe('constructor', () => {
    it('should create an instance with the provided config', () => {
      const architect = new SolutionArchitectV2(config);
      expect(architect).toBeDefined();
    });

    it('should accept an optional basePath', () => {
      const architect = new SolutionArchitectV2(config, '/custom/path');
      expect(architect).toBeDefined();
    });
  });

  describe('startSession', () => {
    it('should create a new session with a unique ID', () => {
      const architect = new SolutionArchitectV2(config);
      const { id, state } = architect.startSession();

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(state).toBeDefined();
      expect(state.id).toBe(id);
    });

    it('should initialize all 6 dimensions at not_started', () => {
      const architect = new SolutionArchitectV2(config);
      const { state } = architect.startSession();

      expect(Object.keys(state.dimensions)).toHaveLength(6);
      for (const dim of Object.values(state.dimensions)) {
        expect(dim.coverage).toBe('not_started');
      }
    });

    it('should initialize v2-specific fields', () => {
      const architect = new SolutionArchitectV2(config);
      const { state } = architect.startSession();

      expect(state.codebaseContext).toBeNull();
      expect(state.discoveredEdgeCases).toHaveLength(0);
      expect(state.currentPhase).toBe('gathering');
    });

    it('should restore state from existing serialized state', () => {
      const architect = new SolutionArchitectV2(config);
      const { state: originalState } = architect.startSession();

      // Modify some state
      const modifiedState: SessionStateV2 = {
        ...originalState,
        currentPhase: 'edge_case_discovery',
        conversationHistory: [
          { role: 'user', content: 'Test message', timestamp: Date.now() },
        ],
      };

      const serialized = JSON.stringify(modifiedState);
      const { id, state: restoredState } = architect.startSession(serialized);

      expect(id).toBe(originalState.id);
      expect(restoredState.currentPhase).toBe('edge_case_discovery');
      expect(restoredState.conversationHistory).toHaveLength(1);
    });

    it('should accept codebase context on session start', () => {
      const architect = new SolutionArchitectV2(config);
      const codebaseContext: CodebaseContext = {
        files: [{ path: 'src/test.ts', type: 'service', description: 'Test service', relevance: 'high' }],
        patterns: [],
        dependencies: [],
        techStack: ['TypeScript'],
        architecture: 'Layered',
        discoveredAt: Date.now(),
      };

      const { state } = architect.startSession(undefined, codebaseContext);

      expect(state.codebaseContext).toEqual(codebaseContext);
    });
  });

  describe('injectCodebaseContext', () => {
    it('should add codebase context to an existing session', () => {
      const architect = new SolutionArchitectV2(config);
      const { id } = architect.startSession();

      const context: CodebaseContext = {
        files: [{ path: 'src/api.ts', type: 'controller', description: 'API controller', relevance: 'high' }],
        patterns: [{ name: 'Repository', location: 'src/repos', description: 'Data access', examples: ['userRepo.ts'] }],
        dependencies: [],
        techStack: ['Node.js', 'Express'],
        architecture: 'REST API',
        discoveredAt: Date.now(),
      };

      architect.injectCodebaseContext(id, context);
      const state = architect.getState(id);

      expect(state?.codebaseContext).toEqual(context);
    });

    it('should throw if session not found', () => {
      const architect = new SolutionArchitectV2(config);

      expect(() => architect.injectCodebaseContext('invalid-id', {} as CodebaseContext)).toThrow('Session not found');
    });
  });

  describe('getState', () => {
    it('should return session state by ID', () => {
      const architect = new SolutionArchitectV2(config);
      const { id, state } = architect.startSession();

      const retrieved = architect.getState(id);
      expect(retrieved).toEqual(state);
    });

    it('should return undefined for non-existent session', () => {
      const architect = new SolutionArchitectV2(config);
      const retrieved = architect.getState('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('chat', () => {
    it('should yield text chunks for a response', async () => {
      const architect = new SolutionArchitectV2({
        ...config,
        streamResponses: true,
      });
      const { id } = architect.startSession();

      const chunks: string[] = [];
      for await (const chunk of architect.chat(id, 'Hello')) {
        if (chunk.type === 'text' && chunk.text) {
          chunks.push(chunk.text);
        }
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle /progress command', async () => {
      const architect = new SolutionArchitectV2(config);
      const { id } = architect.startSession();

      const chunks: string[] = [];
      for await (const chunk of architect.chat(id, '/progress')) {
        if (chunk.type === 'text' && chunk.text) {
          chunks.push(chunk.text);
        }
      }

      const output = chunks.join('');
      expect(output).toContain('Solution Clarity');
      expect(output).toContain('not_started');
    });

    it('should handle /context command', async () => {
      const architect = new SolutionArchitectV2(config);
      const { id } = architect.startSession();

      const context: CodebaseContext = {
        files: [{ path: 'src/test.ts', type: 'service', description: 'Test', relevance: 'high' }],
        patterns: [],
        dependencies: [],
        techStack: ['TypeScript'],
        architecture: 'MVC',
        discoveredAt: Date.now(),
      };
      architect.injectCodebaseContext(id, context);

      const chunks: string[] = [];
      for await (const chunk of architect.chat(id, '/context')) {
        if (chunk.type === 'text' && chunk.text) {
          chunks.push(chunk.text);
        }
      }

      const output = chunks.join('');
      expect(output).toContain('Codebase Context');
      expect(output).toContain('TypeScript');
    });

    it('should handle /help command', async () => {
      const architect = new SolutionArchitectV2(config);
      const { id } = architect.startSession();

      const chunks: string[] = [];
      for await (const chunk of architect.chat(id, '/help')) {
        if (chunk.type === 'text' && chunk.text) {
          chunks.push(chunk.text);
        }
      }

      const output = chunks.join('');
      expect(output).toContain('Available Commands');
      expect(output).toContain('/progress');
      expect(output).toContain('/context');
    });

    it('should throw if session not found', async () => {
      const architect = new SolutionArchitectV2(config);

      await expect(async () => {
        for await (const _ of architect.chat('invalid', 'Hello')) {
          // consume iterator
        }
      }).rejects.toThrow('Session not found');
    });
  });

  describe('eject', () => {
    it('should return formatted v2 output', async () => {
      const architect = new SolutionArchitectV2(config);
      const { id } = architect.startSession();

      const output = await architect.eject(id);

      expect(output).toContain('Solution Specification');
      expect(output).toContain('Edge Cases');
      expect(output).toContain('Effort Estimate');
    });

    it('should throw if session not found', async () => {
      const architect = new SolutionArchitectV2(config);

      await expect(architect.eject('invalid')).rejects.toThrow('Session not found');
    });
  });

  describe('saveSession', () => {
    it('should return serialized state', () => {
      const architect = new SolutionArchitectV2(config);
      const { id, state } = architect.startSession();

      const serialized = architect.saveSession(id);
      const parsed = JSON.parse(serialized);

      expect(parsed.id).toBe(state.id);
      expect(parsed.currentPhase).toBe(state.currentPhase);
    });

    it('should throw if session not found', () => {
      const architect = new SolutionArchitectV2(config);

      expect(() => architect.saveSession('invalid')).toThrow('Session not found');
    });
  });
});
