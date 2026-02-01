/**
 * Tests for diagram event handling in useAgentChat
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAgentChat } from "./useAgentChat";
import type { DiagramUpdateEvent, DiagramErrorEvent } from "../types/chat";

describe("useAgentChat - Diagram Events", () => {
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
  });

  it("should call onDiagramUpdate when diagram_update event is received", async () => {
    const onDiagramUpdate = vi.fn();
    const { result } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws", {
        onDiagramUpdate,
      })
    );

    // Wait for connection to establish
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Send diagram_update event
    const diagramEvent: DiagramUpdateEvent = {
      type: "diagram_update",
      diagram: "graph TD\n  A-->B",
    };

    await act(async () => {
      if (mockWebSocketInstance?.onmessage) {
        mockWebSocketInstance.onmessage({
          data: JSON.stringify(diagramEvent),
        });
      }
    });

    // Verify callback was called with diagram string
    expect(onDiagramUpdate).toHaveBeenCalledWith("graph TD\n  A-->B");
    expect(onDiagramUpdate).toHaveBeenCalledTimes(1);

    // Verify message was added to history
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual(diagramEvent);
  });

  it("should call onDiagramError when diagram_error event is received", async () => {
    const onDiagramError = vi.fn();
    const { result } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws", {
        onDiagramError,
      })
    );

    // Wait for connection to establish
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Send diagram_error event
    const errorEvent: DiagramErrorEvent = {
      type: "diagram_error",
      error: "Invalid Mermaid syntax",
    };

    await act(async () => {
      if (mockWebSocketInstance?.onmessage) {
        mockWebSocketInstance.onmessage({
          data: JSON.stringify(errorEvent),
        });
      }
    });

    // Verify callback was called with error string
    expect(onDiagramError).toHaveBeenCalledWith("Invalid Mermaid syntax");
    expect(onDiagramError).toHaveBeenCalledTimes(1);

    // Verify message was added to history
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toEqual(errorEvent);
  });

  it("should handle multiple diagram events", async () => {
    const onDiagramUpdate = vi.fn();
    const onDiagramError = vi.fn();
    const { result } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws", {
        onDiagramUpdate,
        onDiagramError,
      })
    );

    // Wait for connection to establish
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Send multiple events
    const updateEvent: DiagramUpdateEvent = {
      type: "diagram_update",
      diagram: "graph TD\n  A-->B",
    };
    const errorEvent: DiagramErrorEvent = {
      type: "diagram_error",
      error: "Render failed",
    };

    await act(async () => {
      if (mockWebSocketInstance?.onmessage) {
        mockWebSocketInstance.onmessage({
          data: JSON.stringify(updateEvent),
        });
        mockWebSocketInstance.onmessage({
          data: JSON.stringify(errorEvent),
        });
      }
    });

    // Verify both callbacks were called
    expect(onDiagramUpdate).toHaveBeenCalledWith("graph TD\n  A-->B");
    expect(onDiagramError).toHaveBeenCalledWith("Render failed");

    // Verify messages were added to history
    expect(result.current.messages).toHaveLength(2);
  });

  it("should still call onMessage callback for diagram events", async () => {
    const onMessage = vi.fn();
    const onDiagramUpdate = vi.fn();
    const { result } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws", {
        onMessage,
        onDiagramUpdate,
      })
    );

    // Wait for connection to establish
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Send diagram_update event
    const diagramEvent: DiagramUpdateEvent = {
      type: "diagram_update",
      diagram: "graph TD\n  A-->B",
    };

    await act(async () => {
      if (mockWebSocketInstance?.onmessage) {
        mockWebSocketInstance.onmessage({
          data: JSON.stringify(diagramEvent),
        });
      }
    });

    // Verify both callbacks were called
    expect(onMessage).toHaveBeenCalledWith(diagramEvent);
    expect(onDiagramUpdate).toHaveBeenCalledWith("graph TD\n  A-->B");
  });

  it("should not throw if diagram callbacks are not provided", async () => {
    const { result } = renderHook(() =>
      useAgentChat("ws://localhost:8000/ws", {})
    );

    // Wait for connection to establish
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Send diagram events without callbacks
    const updateEvent: DiagramUpdateEvent = {
      type: "diagram_update",
      diagram: "graph TD\n  A-->B",
    };
    const errorEvent: DiagramErrorEvent = {
      type: "diagram_error",
      error: "Error",
    };

    // Should not throw
    await act(async () => {
      expect(() => {
        if (mockWebSocketInstance?.onmessage) {
          mockWebSocketInstance.onmessage({
            data: JSON.stringify(updateEvent),
          });
          mockWebSocketInstance.onmessage({
            data: JSON.stringify(errorEvent),
          });
        }
      }).not.toThrow();
    });

    // Messages should still be added to history
    expect(result.current.messages).toHaveLength(2);
  });
});
