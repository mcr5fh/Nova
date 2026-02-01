import { describe, it, expect, vi } from 'vitest';
import {
  analyzeEdgeCases,
  categorizeEdgeCase,
  parseEdgeCasesFromResponse,
} from '../core/edge-case-analyzer.js';
import type { CodebaseContext, EdgeCase, MessageV2 } from '../core/types.js';
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
    ],
    patterns: [
      { name: 'Error Handling', location: 'src/utils/', description: 'Centralized error handling', examples: ['src/utils/errors.ts'] },
    ],
    dependencies: [
      { name: 'express', version: '^4.18.0', type: 'production', usage: 'Web framework' },
    ],
    techStack: ['TypeScript', 'Node.js'],
    architecture: 'Layered architecture',
    discoveredAt: Date.now(),
    ...overrides,
  };
}

// Helper to create conversation messages
function createTestMessages(contents: string[]): MessageV2[] {
  return contents.map((content, idx) => ({
    role: idx % 2 === 0 ? 'user' : 'assistant',
    content,
    timestamp: Date.now() + idx * 1000,
  }));
}

describe('edge-case-analyzer', () => {
  describe('analyzeEdgeCases', () => {
    it('should analyze edge cases from conversation and codebase', async () => {
      const mockResponse = `1. [critical] Network timeout during user save - Files: src/api/users.ts - Recommendation: Implement retry with exponential backoff
2. [high] Invalid email format in registration - Files: src/validators.ts - Recommendation: Add email validation before save
3. [medium] Empty username field - Files: src/api/users.ts - Recommendation: Add required field validation`;

      const llm = createMockLLM(mockResponse);
      const context = createTestContext();
      const messages = createTestMessages([
        'I want to add user registration',
        'What happens if the user enters an invalid email?',
        'We should validate that first',
      ]);

      const result = await analyzeEdgeCases(context, messages, llm);

      expect(result.length).toBe(3);
      expect(result[0].severity).toBe('critical');
      expect(result[0].description).toContain('Network timeout');
      expect(result[1].severity).toBe('high');
      expect(result[2].severity).toBe('medium');
    });

    it('should return empty array when LLM fails', async () => {
      const llm: LLMAdapter = {
        chat: vi.fn().mockRejectedValue(new Error('API error')),
        chatStream: vi.fn(),
      };
      const context = createTestContext();
      const messages = createTestMessages(['Test message']);

      const result = await analyzeEdgeCases(context, messages, llm);

      expect(result).toEqual([]);
    });

    it('should include codebase patterns in analysis prompt', async () => {
      const mockResponse = '1. [low] Test edge case - Files: test.ts - Recommendation: Handle it';
      const llm = createMockLLM(mockResponse);
      const context = createTestContext({
        patterns: [
          { name: 'Circuit Breaker', location: 'src/resilience/', description: 'Handles failures', examples: [] },
        ],
      });
      const messages = createTestMessages(['Test']);

      await analyzeEdgeCases(context, messages, llm);

      const callArgs = (llm.chat as ReturnType<typeof vi.fn>).mock.calls[0];
      const prompt = callArgs[0][0].content;
      expect(prompt).toContain('Circuit Breaker');
    });

    it('should handle empty conversation gracefully', async () => {
      const mockResponse = '1. [medium] Generic edge case - Recommendation: Handle appropriately';
      const llm = createMockLLM(mockResponse);
      const context = createTestContext();

      const result = await analyzeEdgeCases(context, [], llm);

      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('categorizeEdgeCase', () => {
    it('should categorize codebase analysis edge cases', () => {
      const edgeCase: EdgeCase = {
        id: 'ec1',
        description: 'Existing error handler does not catch async errors',
        source: 'codebase_analysis',
        severity: 'high',
        recommendation: 'Wrap in try-catch',
        discoveredAt: Date.now(),
      };

      const category = categorizeEdgeCase(edgeCase);
      expect(category).toBe('code-pattern');
    });

    it('should categorize user input edge cases', () => {
      const edgeCase: EdgeCase = {
        id: 'ec2',
        description: 'User mentioned we need to handle offline mode',
        source: 'user_input',
        severity: 'medium',
        recommendation: 'Add offline support',
        discoveredAt: Date.now(),
      };

      const category = categorizeEdgeCase(edgeCase);
      expect(category).toBe('business-rule');
    });

    it('should categorize LLM inference edge cases', () => {
      const edgeCase: EdgeCase = {
        id: 'ec3',
        description: 'API rate limits may cause failures',
        source: 'llm_inference',
        severity: 'high',
        recommendation: 'Implement rate limiting',
        discoveredAt: Date.now(),
      };

      const category = categorizeEdgeCase(edgeCase);
      expect(category).toBe('technical-constraint');
    });
  });

  describe('parseEdgeCasesFromResponse', () => {
    it('should parse numbered edge cases with severity', () => {
      const response = `1. [critical] Database connection failure - Files: src/db.ts - Recommendation: Add connection pooling
2. [high] Invalid input format - Files: src/parser.ts - Recommendation: Validate input schema
3. [low] Log verbosity too high - Recommendation: Add log levels`;

      const result = parseEdgeCasesFromResponse(response);

      expect(result.length).toBe(3);
      expect(result[0]).toEqual({
        severity: 'critical',
        description: 'Database connection failure',
        affectedFiles: ['src/db.ts'],
        recommendation: 'Add connection pooling',
      });
      expect(result[1].severity).toBe('high');
      expect(result[2].severity).toBe('low');
      expect(result[2].affectedFiles).toBeUndefined();
    });

    it('should handle malformed response gracefully', () => {
      const response = 'This is not a properly formatted response';

      const result = parseEdgeCasesFromResponse(response);

      expect(result).toEqual([]);
    });

    it('should handle edge cases without files', () => {
      const response = '1. [medium] Consider caching - Recommendation: Add Redis cache';

      const result = parseEdgeCasesFromResponse(response);

      expect(result.length).toBe(1);
      expect(result[0].description).toBe('Consider caching');
      expect(result[0].affectedFiles).toBeUndefined();
    });

    it('should default to medium severity for unspecified', () => {
      const response = '1. Some edge case without severity - Recommendation: Handle it';

      const result = parseEdgeCasesFromResponse(response);

      expect(result.length).toBe(1);
      expect(result[0].severity).toBe('medium');
    });
  });
});
