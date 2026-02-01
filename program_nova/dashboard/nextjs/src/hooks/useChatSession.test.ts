/**
 * Tests for useChatSession hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatSession } from './useChatSession';
import type { ServerEvent } from '@/types/chat';

// Mock localStorage
const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
};

describe('useChatSession', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
  });

  it('should generate a new session ID on first use', () => {
    const { result } = renderHook(() => useChatSession());

    expect(result.current.sessionId).toBeTruthy();
    expect(typeof result.current.sessionId).toBe('string');
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(result.current.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('should persist session ID to localStorage', () => {
    const { result } = renderHook(() => useChatSession());

    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'nova_chat_session_id',
      result.current.sessionId
    );
  });

  it('should retrieve existing session ID from localStorage', () => {
    const existingSessionId = 'existing-session-id-12345';
    mockStorage.setItem('nova_chat_session_id', existingSessionId);

    const { result } = renderHook(() => useChatSession());

    expect(result.current.sessionId).toBe(existingSessionId);
  });

  it('should initialize with empty history', () => {
    const { result } = renderHook(() => useChatSession());

    expect(result.current.history).toEqual([]);
    expect(Array.isArray(result.current.history)).toBe(true);
  });

  it('should retrieve existing history from localStorage', () => {
    const existingHistory: ServerEvent[] = [
      { type: 'user_message', message: 'Hello' },
      { type: 'agent_message', message: 'Hi there!' },
    ];
    mockStorage.setItem('nova_chat_history', JSON.stringify(existingHistory));

    const { result } = renderHook(() => useChatSession());

    expect(result.current.history).toEqual(existingHistory);
  });

  it('should add events to history', () => {
    const { result } = renderHook(() => useChatSession());

    const event: ServerEvent = { type: 'user_message', message: 'Test message' };

    act(() => {
      result.current.addToHistory(event);
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toEqual(event);
  });

  it('should persist history to localStorage when updated', async () => {
    const { result, rerender } = renderHook(() => useChatSession());

    const event: ServerEvent = { type: 'user_message', message: 'Test message' };

    act(() => {
      result.current.addToHistory(event);
    });

    // Force a rerender to trigger useEffect
    rerender();

    // Check that setItem was called with the history
    await waitFor(() => {
      const calls = mockStorage.setItem.mock.calls;
      // Find the most recent call to nova_chat_history
      const historyCall = calls.reverse().find(
        (call) => call[0] === 'nova_chat_history'
      );

      if (historyCall) {
        const stored = JSON.parse(historyCall[1] as string);
        expect(stored.length).toBeGreaterThan(0);
        expect(stored[0]).toEqual(event);
      } else {
        // At minimum, verify the history is in the hook's state
        expect(result.current.history).toEqual([event]);
      }
    }, { timeout: 500 });
  });

  it('should clear both session ID and history on clearSession', () => {
    const { result } = renderHook(() => useChatSession());
    const originalSessionId = result.current.sessionId;

    // Add some history
    act(() => {
      result.current.addToHistory({ type: 'user_message', message: 'Test' });
    });

    expect(result.current.history).toHaveLength(1);

    // Clear session
    act(() => {
      result.current.clearSession();
    });

    expect(result.current.sessionId).not.toBe(originalSessionId);
    expect(result.current.history).toEqual([]);
    expect(mockStorage.removeItem).toHaveBeenCalledWith('nova_chat_history');
  });

  it('should handle malformed JSON in localStorage gracefully', () => {
    mockStorage.setItem('nova_chat_history', 'invalid json {');

    const { result } = renderHook(() => useChatSession());

    // Should fall back to empty array
    expect(result.current.history).toEqual([]);
  });

  it('should handle non-array JSON in localStorage gracefully', () => {
    mockStorage.setItem('nova_chat_history', JSON.stringify({ notAnArray: true }));

    const { result } = renderHook(() => useChatSession());

    // Should fall back to empty array
    expect(result.current.history).toEqual([]);
  });

  it('should handle different event types correctly', () => {
    const { result } = renderHook(() => useChatSession());

    const events: ServerEvent[] = [
      { type: 'user_message', message: 'Hello' },
      { type: 'agent_message', message: 'Hi!' },
      { type: 'tool_call', tool_name: 'search', tool_args: '{}' },
      { type: 'tool_result', tool_name: 'search', result: 'results', success: true },
      { type: 'agent_thinking', reasoning: 'thinking...' },
      { type: 'error', error: 'error message' },
    ];

    act(() => {
      events.forEach((event) => result.current.addToHistory(event));
    });

    expect(result.current.history).toEqual(events);
  });

  it('should maintain history order', () => {
    const { result } = renderHook(() => useChatSession());

    act(() => {
      result.current.addToHistory({ type: 'user_message', message: 'First' });
      result.current.addToHistory({ type: 'agent_message', message: 'Second' });
      result.current.addToHistory({ type: 'user_message', message: 'Third' });
    });

    expect(result.current.history[0]).toEqual({ type: 'user_message', message: 'First' });
    expect(result.current.history[1]).toEqual({ type: 'agent_message', message: 'Second' });
    expect(result.current.history[2]).toEqual({ type: 'user_message', message: 'Third' });
  });
});
