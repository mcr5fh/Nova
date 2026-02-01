/**
 * Tests for loading state functionality in useAgentChat hook
 * Following TDD approach - tests written first
 *
 * Loading state should be active:
 * - After sending a message
 * - Until receiving an agent_message event
 * - Should handle tool_call, tool_result, agent_thinking events during loading
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentChat } from "./useAgentChat";
import type { ServerEvent } from "../types/chat";

describe("useAgentChat - loading state", () => {
  let mockWebSocketInstance: any = null;

  beforeEach(() => {
    // Mock global WebSocket with proper constructor
    (global as any).WebSocket = class WebSocket {
      url: string;
      readyState: number = 0;
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url: string) {
        this.url = url;
        mockWebSocketInstance = this;
        this.readyState = 1; // Immediately OPEN for testing
        // Trigger onopen synchronously for testing
        setTimeout(() => {
          if (this.onopen) {
            this.onopen(new Event("open"));
          }
        }, 0);
      }

      send(data: string) {
        if (this.readyState !== 1) {
          throw new Error("WebSocket is not open");
        }
      }

      close() {
        this.readyState = 3; // CLOSED
        if (this.onclose) {
          this.onclose(new CloseEvent("close"));
        }
      }
    };

    (global as any).WebSocket.CONNECTING = 0;
    (global as any).WebSocket.OPEN = 1;
    (global as any).WebSocket.CLOSING = 2;
    (global as any).WebSocket.CLOSED = 3;
  });

  afterEach(() => {
    mockWebSocketInstance = null;
    vi.clearAllMocks();
  });

  const simulateMessage = (data: ServerEvent) => {
    if (mockWebSocketInstance?.onmessage) {
      mockWebSocketInstance.onmessage(
        new MessageEvent("message", {
          data: JSON.stringify(data),
        })
      );
    }
  };

  it("should not be loading initially", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("should set isLoading to true after sending a message", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.isLoading).toBe(false);

    // Send a message
    act(() => {
      result.current.sendMessage("Hello agent");
    });

    // Should now be loading
    expect(result.current.isLoading).toBe(true);
  });

  it("should set isLoading to false after receiving agent_message", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Send a message
    act(() => {
      result.current.sendMessage("Hello agent");
    });

    expect(result.current.isLoading).toBe(true);

    // Receive agent response
    act(() => {
      simulateMessage({
        type: "agent_message",
        message: "Hi! How can I help?",
      });
    });

    // Should no longer be loading
    expect(result.current.isLoading).toBe(false);
  });

  it("should remain loading during intermediate events (user_message, agent_thinking, tool_call, tool_result)", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Send a message
    act(() => {
      result.current.sendMessage("What's the weather?");
    });

    expect(result.current.isLoading).toBe(true);

    // Receive user message echo
    act(() => {
      simulateMessage({
        type: "user_message",
        message: "What's the weather?",
      });
    });

    // Still loading
    expect(result.current.isLoading).toBe(true);

    // Receive agent thinking
    act(() => {
      simulateMessage({
        type: "agent_thinking",
        reasoning: "I need to check the weather API...",
      });
    });

    // Still loading
    expect(result.current.isLoading).toBe(true);

    // Receive tool call
    act(() => {
      simulateMessage({
        type: "tool_call",
        tool_name: "GetWeather",
        tool_args: '{"location":"SF"}',
      });
    });

    // Still loading
    expect(result.current.isLoading).toBe(true);

    // Receive tool result
    act(() => {
      simulateMessage({
        type: "tool_result",
        tool_name: "GetWeather",
        result: "Sunny, 70F",
        success: true,
      });
    });

    // Still loading
    expect(result.current.isLoading).toBe(true);

    // Finally receive agent message
    act(() => {
      simulateMessage({
        type: "agent_message",
        message: "The weather is sunny and 70F.",
      });
    });

    // No longer loading
    expect(result.current.isLoading).toBe(false);
  });

  it("should set isLoading to false on error event", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Send a message
    act(() => {
      result.current.sendMessage("Hello agent");
    });

    expect(result.current.isLoading).toBe(true);

    // Receive error
    act(() => {
      simulateMessage({
        type: "error",
        error: "Something went wrong",
      });
    });

    // Should no longer be loading after error
    expect(result.current.isLoading).toBe(false);
  });

  it("should handle multiple sequential messages correctly", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // First message
    act(() => {
      result.current.sendMessage("First message");
    });

    expect(result.current.isLoading).toBe(true);

    // First response
    act(() => {
      simulateMessage({
        type: "agent_message",
        message: "Response to first message",
      });
    });

    expect(result.current.isLoading).toBe(false);

    // Second message
    act(() => {
      result.current.sendMessage("Second message");
    });

    expect(result.current.isLoading).toBe(true);

    // Second response
    act(() => {
      simulateMessage({
        type: "agent_message",
        message: "Response to second message",
      });
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("should reset loading state when clearing messages", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Send a message
    act(() => {
      result.current.sendMessage("Hello");
    });

    expect(result.current.isLoading).toBe(true);

    // Clear messages
    act(() => {
      result.current.clearMessages();
    });

    // Loading should be reset
    expect(result.current.isLoading).toBe(false);
  });
});
