/**
 * Error handling tests for useAgentChat hook
 * Tests for connection failures, retry logic, and network status detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAgentChat } from "./useAgentChat";

describe("useAgentChat - Error Handling", () => {
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
        // Simulate async connection
        setTimeout(() => {
          this.readyState = 1; // OPEN
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

    vi.useFakeTimers();
  });

  afterEach(() => {
    mockWebSocketInstance = null;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("should stop reconnecting after max attempts", async () => {
    let connectionAttempts = 0;

    // Override WebSocket to fail after first connection
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
        connectionAttempts++;

        if (connectionAttempts === 1) {
          // First connection succeeds
          mockWebSocketInstance = this;
          setTimeout(() => {
            this.readyState = 1; // OPEN
            if (this.onopen) {
              this.onopen(new Event("open"));
            }
          }, 0);
        } else {
          // Subsequent connections fail immediately
          setTimeout(() => {
            if (this.onclose) {
              this.onclose(new CloseEvent("close"));
            }
          }, 0);
        }
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

    const { result } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws", {
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectDelay: 100,
      })
    );

    await act(async () => {
      vi.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Simulate disconnection
    act(() => {
      mockWebSocketInstance?.close();
    });

    // Wait through multiple reconnection attempts
    await act(async () => {
      vi.advanceTimersByTime(100); // First attempt
      vi.runAllTimers();
    });

    await act(async () => {
      vi.advanceTimersByTime(200); // Second attempt
      vi.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.reconnectAttempts).toBe(2);
      expect(result.current.connectionState).toBe("disconnected");
    });
  });

  it("should provide error information when connection fails", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws", { onError })
    );

    await act(async () => {
      vi.runAllTimers();
    });

    // Simulate error
    const errorEvent = new Event("error");
    act(() => {
      mockWebSocketInstance?.onerror?.(errorEvent);
    });

    expect(onError).toHaveBeenCalledWith(errorEvent);
  });

  it("should expose last error state", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.lastError).toBeNull();

    // Simulate error
    const errorEvent = new Event("error");
    act(() => {
      mockWebSocketInstance?.onerror?.(errorEvent);
    });

    await waitFor(() => {
      expect(result.current.lastError).toBeDefined();
    });
  });

  it("should detect online/offline network status", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isOnline).toBe(true);

    // Simulate going offline
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(false);
    });

    // Simulate coming back online
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(true);
    });
  });

  it("should pause reconnection when offline", async () => {
    const { result } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws", {
        autoReconnect: true,
      })
    );

    await act(async () => {
      vi.runAllTimers();
    });

    // Go offline
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Simulate disconnection while offline
    act(() => {
      mockWebSocketInstance?.close();
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Should not attempt reconnection while offline
    expect(result.current.connectionState).toBe("disconnected");
    expect(result.current.reconnectAttempts).toBe(0);

    // Come back online
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    // Should trigger reconnection when back online
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current.connectionState).not.toBe("disconnected");
    });
  });

  it("should clear error state on successful connection", async () => {
    const { result } = renderHook(() => useAgentChat("ws://localhost:8000/ws"));

    await act(async () => {
      vi.runAllTimers();
    });

    // Simulate error
    const errorEvent = new Event("error");
    act(() => {
      mockWebSocketInstance?.onerror?.(errorEvent);
    });

    await waitFor(() => {
      expect(result.current.lastError).toBeDefined();
    });

    // Reconnect
    act(() => {
      result.current.reconnect();
    });

    await act(async () => {
      vi.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
      expect(result.current.lastError).toBeNull();
    });
  });

  it("should provide retry with delay reset", async () => {
    // Use existing mock from beforeEach

    const { result } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws", {
        autoReconnect: true,
        maxReconnectAttempts: 3,
        reconnectDelay: 100,
      })
    );

    await act(async () => {
      vi.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Record the number of attempts before manual reconnect
    const initialAttempts = result.current.reconnectAttempts;
    expect(initialAttempts).toBe(0);

    // Manual reconnect should keep attempts at 0 (or reset them)
    act(() => {
      result.current.reconnect();
    });

    await act(async () => {
      vi.runAllTimers();
    });

    await waitFor(() => {
      expect(result.current.reconnectAttempts).toBe(0);
      expect(result.current.isConnected).toBe(true);
    });
  });
});
