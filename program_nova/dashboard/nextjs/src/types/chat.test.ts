/**
 * Tests for chat types and type guards
 */

import { describe, it, expect } from 'vitest';
import type {
  ChatRequest,
  UserMessageEvent,
  AgentMessageEvent,
  ToolCallEvent,
  ToolResultEvent,
  AgentThinkingEvent,
  ErrorEvent,
  ServerEvent,
} from './chat';

import {
  isUserMessageEvent,
  isAgentMessageEvent,
  isToolCallEvent,
  isToolResultEvent,
  isAgentThinkingEvent,
  isErrorEvent,
} from './chat';

describe('Chat Types - Type Guards', () => {
  describe('isUserMessageEvent', () => {
    it('should return true for valid user message event', () => {
      const event: ServerEvent = {
        type: 'user_message',
        message: 'Hello',
      };
      expect(isUserMessageEvent(event)).toBe(true);
    });

    it('should return false for other event types', () => {
      const event: ServerEvent = {
        type: 'agent_message',
        message: 'Hello',
      };
      expect(isUserMessageEvent(event)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const event: ServerEvent = {
        type: 'user_message',
        message: 'Test',
      };

      if (isUserMessageEvent(event)) {
        // TypeScript should know event.message exists here
        expect(event.message).toBe('Test');
      }
    });
  });

  describe('isAgentMessageEvent', () => {
    it('should return true for valid agent message event', () => {
      const event: ServerEvent = {
        type: 'agent_message',
        message: 'Response',
      };
      expect(isAgentMessageEvent(event)).toBe(true);
    });

    it('should return false for other event types', () => {
      const event: ServerEvent = {
        type: 'user_message',
        message: 'Hello',
      };
      expect(isAgentMessageEvent(event)).toBe(false);
    });
  });

  describe('isToolCallEvent', () => {
    it('should return true for valid tool call event', () => {
      const event: ServerEvent = {
        type: 'tool_call',
        tool_name: 'Search',
        tool_args: '{"query":"test"}',
      };
      expect(isToolCallEvent(event)).toBe(true);
    });

    it('should return false for other event types', () => {
      const event: ServerEvent = {
        type: 'agent_message',
        message: 'Hello',
      };
      expect(isToolCallEvent(event)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const event: ServerEvent = {
        type: 'tool_call',
        tool_name: 'Search',
        tool_args: '{}',
      };

      if (isToolCallEvent(event)) {
        expect(event.tool_name).toBe('Search');
        expect(event.tool_args).toBe('{}');
      }
    });
  });

  describe('isToolResultEvent', () => {
    it('should return true for valid tool result event', () => {
      const event: ServerEvent = {
        type: 'tool_result',
        tool_name: 'Search',
        result: 'Found results',
        success: true,
      };
      expect(isToolResultEvent(event)).toBe(true);
    });

    it('should return false for other event types', () => {
      const event: ServerEvent = {
        type: 'tool_call',
        tool_name: 'Search',
        tool_args: '{}',
      };
      expect(isToolResultEvent(event)).toBe(false);
    });

    it('should narrow type correctly for successful result', () => {
      const event: ServerEvent = {
        type: 'tool_result',
        tool_name: 'Search',
        result: 'Success',
        success: true,
      };

      if (isToolResultEvent(event)) {
        expect(event.success).toBe(true);
        expect(event.result).toBe('Success');
      }
    });

    it('should narrow type correctly for failed result', () => {
      const event: ServerEvent = {
        type: 'tool_result',
        tool_name: 'Search',
        result: 'Error occurred',
        success: false,
      };

      if (isToolResultEvent(event)) {
        expect(event.success).toBe(false);
        expect(event.result).toBe('Error occurred');
      }
    });
  });

  describe('isAgentThinkingEvent', () => {
    it('should return true for valid agent thinking event', () => {
      const event: ServerEvent = {
        type: 'agent_thinking',
        reasoning: 'Planning next step...',
      };
      expect(isAgentThinkingEvent(event)).toBe(true);
    });

    it('should return false for other event types', () => {
      const event: ServerEvent = {
        type: 'agent_message',
        message: 'Hello',
      };
      expect(isAgentThinkingEvent(event)).toBe(false);
    });
  });

  describe('isErrorEvent', () => {
    it('should return true for valid error event', () => {
      const event: ServerEvent = {
        type: 'error',
        error: 'Something went wrong',
      };
      expect(isErrorEvent(event)).toBe(true);
    });

    it('should return false for other event types', () => {
      const event: ServerEvent = {
        type: 'agent_message',
        message: 'Hello',
      };
      expect(isErrorEvent(event)).toBe(false);
    });
  });

  describe('Type Guard Coverage', () => {
    it('should handle all ServerEvent types', () => {
      const events: ServerEvent[] = [
        { type: 'user_message', message: 'User' },
        { type: 'agent_message', message: 'Agent' },
        { type: 'tool_call', tool_name: 'Tool', tool_args: '{}' },
        { type: 'tool_result', tool_name: 'Tool', result: 'Result', success: true },
        { type: 'agent_thinking', reasoning: 'Thinking' },
        { type: 'error', error: 'Error' },
      ];

      events.forEach((event) => {
        const isRecognized =
          isUserMessageEvent(event) ||
          isAgentMessageEvent(event) ||
          isToolCallEvent(event) ||
          isToolResultEvent(event) ||
          isAgentThinkingEvent(event) ||
          isErrorEvent(event);

        expect(isRecognized).toBe(true);
      });
    });
  });
});

describe('Chat Types - Type Structure', () => {
  it('should create valid ChatRequest with session_id', () => {
    const request: ChatRequest = {
      type: 'chat',
      message: 'Hello',
      session_id: 'session-123',
    };

    expect(request.type).toBe('chat');
    expect(request.message).toBe('Hello');
    expect(request.session_id).toBe('session-123');
  });

  it('should create valid ChatRequest without session_id', () => {
    const request: ChatRequest = {
      type: 'chat',
      message: 'Hello',
    };

    expect(request.type).toBe('chat');
    expect(request.message).toBe('Hello');
    expect(request.session_id).toBeUndefined();
  });

  it('should create valid UserMessageEvent', () => {
    const event: UserMessageEvent = {
      type: 'user_message',
      message: 'Test message',
    };

    expect(event.type).toBe('user_message');
    expect(event.message).toBe('Test message');
  });

  it('should create valid AgentMessageEvent', () => {
    const event: AgentMessageEvent = {
      type: 'agent_message',
      message: 'Response message',
    };

    expect(event.type).toBe('agent_message');
    expect(event.message).toBe('Response message');
  });

  it('should create valid ToolCallEvent', () => {
    const event: ToolCallEvent = {
      type: 'tool_call',
      tool_name: 'DatabaseQuery',
      tool_args: '{"table":"users","limit":10}',
    };

    expect(event.type).toBe('tool_call');
    expect(event.tool_name).toBe('DatabaseQuery');
    expect(JSON.parse(event.tool_args)).toEqual({ table: 'users', limit: 10 });
  });

  it('should create valid ToolResultEvent with success', () => {
    const event: ToolResultEvent = {
      type: 'tool_result',
      tool_name: 'DatabaseQuery',
      result: 'Found 10 users',
      success: true,
    };

    expect(event.type).toBe('tool_result');
    expect(event.success).toBe(true);
    expect(event.result).toBe('Found 10 users');
  });

  it('should create valid ToolResultEvent with failure', () => {
    const event: ToolResultEvent = {
      type: 'tool_result',
      tool_name: 'DatabaseQuery',
      result: 'Connection failed',
      success: false,
    };

    expect(event.type).toBe('tool_result');
    expect(event.success).toBe(false);
    expect(event.result).toBe('Connection failed');
  });

  it('should create valid AgentThinkingEvent', () => {
    const event: AgentThinkingEvent = {
      type: 'agent_thinking',
      reasoning: 'Analyzing available tools...',
    };

    expect(event.type).toBe('agent_thinking');
    expect(event.reasoning).toBe('Analyzing available tools...');
  });

  it('should create valid ErrorEvent', () => {
    const event: ErrorEvent = {
      type: 'error',
      error: 'WebSocket connection lost',
    };

    expect(event.type).toBe('error');
    expect(event.error).toBe('WebSocket connection lost');
  });
});
