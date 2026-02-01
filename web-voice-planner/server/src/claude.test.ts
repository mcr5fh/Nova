import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeClient } from './claude';
import type { SessionState } from '../../shared/types';

// Mock the Anthropic SDK
const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: mockCreate,
    };
  },
}));

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

describe('ClaudeClient', () => {
  let client: ClaudeClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ClaudeClient();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('chat', () => {
    it('sends message to Claude and returns response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'What feature would you like to build?' }],
      });

      const session = createTestSession();
      const result = await client.chat(session, 'I want to build a dashboard');

      expect(result.response).toBe('What feature would you like to build?');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('includes conversation history in messages', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Great!' }],
      });

      const session = createTestSession();
      session.conversationHistory = [
        { role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
        { role: 'assistant', content: 'Hi there!', timestamp: '2024-01-01T00:00:01Z' },
      ];

      await client.chat(session, 'New message');

      const call = mockCreate.mock.calls[0][0];
      expect(call.messages).toHaveLength(3);
      expect(call.messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(call.messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
      expect(call.messages[2]).toEqual({ role: 'user', content: 'New message' });
    });

    it('uses claude-sonnet-4-20250514 model', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      });

      const session = createTestSession();
      await client.chat(session, 'Hello');

      const call = mockCreate.mock.calls[0][0];
      expect(call.model).toBe('claude-sonnet-4-20250514');
    });

    it('uses short max_tokens for voice conversation', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      });

      const session = createTestSession();
      await client.chat(session, 'Hello');

      const call = mockCreate.mock.calls[0][0];
      expect(call.max_tokens).toBe(500);
    });

    it('includes system prompt with context', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      });

      const session = createTestSession();
      session.slug = 'my-feature';
      await client.chat(session, 'Hello');

      const call = mockCreate.mock.calls[0][0];
      expect(call.system).toContain('Solution Architect');
      expect(call.system).toContain('my-feature');
    });

    it('returns shouldGenerate false when dimensions incomplete', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      });

      const session = createTestSession();
      const result = await client.chat(session, 'Hello');

      expect(result.shouldGenerate).toBe(false);
    });

    it('returns shouldGenerate true when all thresholds met', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
      });

      const session = createTestSession();
      session.dimensions.solution_clarity.coverage = 'strong';
      session.dimensions.user_value.coverage = 'strong';
      session.dimensions.scope_boundaries.coverage = 'strong';
      session.dimensions.success_criteria.coverage = 'strong';
      session.dimensions.technical_constraints.coverage = 'partial';
      session.dimensions.edge_cases.coverage = 'partial';

      const result = await client.chat(session, 'Hello');

      expect(result.shouldGenerate).toBe(true);
    });

    it('handles non-text response content blocks', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'tool_use', name: 'something' }],
      });

      const session = createTestSession();
      const result = await client.chat(session, 'Hello');

      expect(result.response).toBe('');
    });
  });

  describe('generateSpec', () => {
    it('generates spec markdown from conversation', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '# Solution Specification: Test Feature\n\n## Summary\n...' }],
      });

      const session = createTestSession();
      session.conversationHistory = [
        { role: 'user', content: 'I want to build a feature', timestamp: '2024-01-01T00:00:00Z' },
        { role: 'assistant', content: 'Tell me more', timestamp: '2024-01-01T00:00:01Z' },
      ];

      const spec = await client.generateSpec(session);

      expect(spec).toContain('# Solution Specification');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('uses longer max_tokens for spec generation', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '# Spec' }],
      });

      const session = createTestSession();
      await client.generateSpec(session);

      const call = mockCreate.mock.calls[0][0];
      expect(call.max_tokens).toBe(4000);
    });

    it('includes spec generation system prompt', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '# Spec' }],
      });

      const session = createTestSession();
      await client.generateSpec(session);

      const call = mockCreate.mock.calls[0][0];
      expect(call.system).toContain('solution specification');
      expect(call.system).toContain('markdown');
    });

    it('adds generation request to messages', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '# Spec' }],
      });

      const session = createTestSession();
      session.conversationHistory = [
        { role: 'user', content: 'Feature description', timestamp: '2024-01-01T00:00:00Z' },
      ];

      await client.generateSpec(session);

      const call = mockCreate.mock.calls[0][0];
      const lastMessage = call.messages[call.messages.length - 1];
      expect(lastMessage.role).toBe('user');
      expect(lastMessage.content).toContain('generate');
    });
  });
});
