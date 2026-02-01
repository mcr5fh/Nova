/**
 * Tests for useAgentChat hook
 * Following TDD approach - tests written first
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentChat } from "./useAgentChat";
import type { ServerEvent } from "../types/chat";

describe("useAgentChat", () => {
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

  it("should initialize with connecting state", () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    // Hook starts connecting immediately
    expect(result.current.connectionState).toBe("connecting");
    expect(result.current.isConnected).toBe(false);
    expect(result.current.messages).toEqual([]);
  });

  it("should connect to WebSocket and update connection state", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    // Wait for connection
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.connectionState).toBe("connected");
    expect(result.current.isConnected).toBe(true);
  });

  it("should accept session_id option", async () => {
    const sessionId = "test-session-123";
    const { result } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws", { session_id: sessionId })
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("should receive and store messages", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const testMessage: ServerEvent = {
      type: "agent_message",
      message: "Hello, how can I help?",
    };

    act(() => {
      simulateMessage(testMessage);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual(testMessage);
  });

  it("should send chat messages with session_id", async () => {
    const sessionId = "test-session-456";
    const { result } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws", { session_id: sessionId })
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const sendSpy = vi.spyOn(mockWebSocketInstance!, "send");

    act(() => {
      result.current.sendMessage("Hello agent");
    });

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({
        type: "chat",
        message: "Hello agent",
        session_id: sessionId,
      })
    );
  });

  it("should not send empty messages", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const sendSpy = vi.spyOn(mockWebSocketInstance!, "send");

    act(() => {
      result.current.sendMessage("");
    });

    expect(sendSpy).not.toHaveBeenCalled();

    act(() => {
      result.current.sendMessage("   ");
    });

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("should handle disconnection", async () => {
    // Disable auto-reconnect for this test
    const { result } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws", { autoReconnect: false })
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      mockWebSocketInstance?.close();
    });

    expect(result.current.connectionState).toBe("disconnected");
    expect(result.current.isConnected).toBe(false);
  });

  it("should handle error events", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const errorEvent: ServerEvent = {
      type: "error",
      error: "Invalid message",
    };

    act(() => {
      simulateMessage(errorEvent);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual(errorEvent);
  });

  it("should clean up WebSocket on unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws")
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const closeSpy = vi.spyOn(mockWebSocketInstance!, "close");

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  it("should provide clearMessages function", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Add some messages
    act(() => {
      simulateMessage({
        type: "agent_message",
        message: "Test",
      });
    });

    expect(result.current.messages).toHaveLength(1);

    // Clear messages
    act(() => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
  });

  it("should provide reconnect and disconnect functions", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Should have reconnect and disconnect functions
    expect(typeof result.current.reconnect).toBe("function");
    expect(typeof result.current.disconnect).toBe("function");
  });
});
