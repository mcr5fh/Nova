/**
 * Enhanced WebSocket hook for Agent Chat
 *
 * Features:
 * - TypeScript support with proper types from chat.ts
 * - session_id support for conversation continuity across reconnects
 * - Auto-reconnection with exponential backoff
 * - Connection state management (disconnected, connecting, connected, reconnecting)
 * - Message history management
 * - Automatic cleanup on unmount
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ServerEvent, ChatRequest } from "../types/chat";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface UseAgentChatOptions {
  /**
   * Session identifier for conversation continuity across reconnects
   */
  session_id?: string;

  /**
   * Enable automatic reconnection on disconnect
   * @default true
   */
  autoReconnect?: boolean;

  /**
   * Maximum number of reconnection attempts before giving up
   * @default 5
   */
  maxReconnectAttempts?: number;

  /**
   * Initial delay before first reconnection attempt (in milliseconds)
   * @default 1000
   */
  reconnectDelay?: number;

  /**
   * Maximum delay between reconnection attempts (in milliseconds)
   * @default 30000
   */
  maxReconnectDelay?: number;

  /**
   * Callback fired when connection state changes
   */
  onConnectionStateChange?: (state: ConnectionState) => void;

  /**
   * Callback fired when a message is received
   */
  onMessage?: (event: ServerEvent) => void;

  /**
   * Callback fired on connection error
   */
  onError?: (error: Event) => void;

  /**
   * Callback fired when a diagram update is received
   */
  onDiagramUpdate?: (diagram: string) => void;

  /**
   * Callback fired when a diagram error occurs
   */
  onDiagramError?: (error: string) => void;
}

export interface UseAgentChatReturn {
  /**
   * Array of all received messages
   */
  messages: ServerEvent[];

  /**
   * Current connection state
   */
  connectionState: ConnectionState;

  /**
   * Convenience flag: true if connectionState === 'connected'
   */
  isConnected: boolean;

  /**
   * Send a chat message to the agent
   */
  sendMessage: (message: string) => void;

  /**
   * Clear all messages from history
   */
  clearMessages: () => void;

  /**
   * Current number of reconnection attempts
   */
  reconnectAttempts: number;

  /**
   * Manually trigger reconnection
   */
  reconnect: () => void;

  /**
   * Manually disconnect
   */
  disconnect: () => void;

  /**
   * Last error that occurred (null if no error)
   */
  lastError: Event | null;

  /**
   * Whether the browser is currently online
   */
  isOnline: boolean;

  /**
   * Whether the agent is currently processing a message
   * True after sending a message, false after receiving agent_message or error
   */
  isLoading: boolean;
}

/**
 * React hook for managing WebSocket connection to agent chat server
 *
 * @param url - WebSocket server URL (e.g., "ws://localhost:8000/ws")
 * @param options - Configuration options
 * @returns Hook state and control functions
 *
 * @example
 * ```tsx
 * const { messages, isConnected, sendMessage } = useAgentChat(
 *   "ws://localhost:8000/ws",
 *   { session_id: "my-session" }
 * );
 * ```
 */
export function useAgentChat(
  url: string,
  options: UseAgentChatOptions = {}
): UseAgentChatReturn {
  const {
    session_id,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    maxReconnectDelay = 30000,
    onConnectionStateChange,
    onMessage,
    onError,
    onDiagramUpdate,
    onDiagramError,
  } = options;

  const [messages, setMessages] = useState<ServerEvent[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastError, setLastError] = useState<Event | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isLoading, setIsLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const isOnlineRef = useRef(true);
  const connectRef = useRef<(() => void) | null>(null);

  // Update connection state with callback
  const updateConnectionState = useCallback(
    (newState: ConnectionState) => {
      setConnectionState(newState);
      onConnectionStateChange?.(newState);
    },
    [onConnectionStateChange]
  );

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback(
    (attempt: number): number => {
      const delay = Math.min(
        reconnectDelay * Math.pow(2, attempt),
        maxReconnectDelay
      );
      return delay;
    },
    [reconnectDelay, maxReconnectDelay]
  );

  // Cleanup function
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;

      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }

      wsRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    cleanup();

    updateConnectionState(
      reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting"
    );

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        updateConnectionState("connected");
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        setLastError(null); // Clear error on successful connection
      };

      ws.onclose = () => {
        updateConnectionState("disconnected");

        // Attempt reconnection if enabled, online, and under max attempts
        if (
          autoReconnect &&
          shouldReconnectRef.current &&
          isOnlineRef.current &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          const delay = getReconnectDelay(reconnectAttemptsRef.current);
          reconnectAttemptsRef.current += 1;
          setReconnectAttempts(reconnectAttemptsRef.current);

          updateConnectionState("reconnecting");

          reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current?.();
          }, delay);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: ServerEvent = JSON.parse(event.data);
          setMessages((prev) => [...prev, data]);
          onMessage?.(data);

          // Update loading state based on message type
          if (data.type === "agent_message" || data.type === "error") {
            setIsLoading(false);
          }

          // Handle diagram_update event
          if (data.type === "diagram_update") {
            onDiagramUpdate?.(data.diagram);
          }

          // Handle diagram_error event
          if (data.type === "diagram_error") {
            onDiagramError?.(data.error);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setLastError(error);
        onError?.(error);
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      updateConnectionState("disconnected");
    }
  }, [
    url,
    autoReconnect,
    maxReconnectAttempts,
    getReconnectDelay,
    updateConnectionState,
    cleanup,
    onMessage,
    onError,
    onDiagramUpdate,
    onDiagramError,
  ]);

  // Store connect in ref for use in timeouts
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Send message function
  const sendMessage = useCallback(
    (message: string) => {
      // Validate message
      if (!message || !message.trim()) {
        console.warn("Cannot send empty or whitespace-only message");
        return;
      }

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket is not connected");
        return;
      }

      const request: ChatRequest = {
        type: "chat",
        message: message.trim(),
        ...(session_id && { session_id }),
      };

      try {
        wsRef.current.send(JSON.stringify(request));
        // Set loading state after sending message
        setIsLoading(true);
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    },
    [session_id]
  );

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    // Reset loading state when clearing messages
    setIsLoading(false);
  }, []);

  // Manual reconnect
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    shouldReconnectRef.current = true;
    connect();
  }, [connect]);

  // Manual disconnect
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    cleanup();
    updateConnectionState("disconnected");
  }, [cleanup, updateConnectionState]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      isOnlineRef.current = true;
      // Attempt reconnection when coming back online
      if (connectionState === "disconnected" && shouldReconnectRef.current) {
        reconnect();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      isOnlineRef.current = false;
    };

    // Sync ref with initial state
    isOnlineRef.current = typeof navigator !== "undefined" ? navigator.onLine : true;

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [connectionState, reconnect]);

  // Initialize connection
  useEffect(() => {
    shouldReconnectRef.current = true;
    // Initialize connection on mount
    const initConnection = async () => {
      connect();
    };
    void initConnection();

    return () => {
      shouldReconnectRef.current = false;
      cleanup();
    };
  }, [connect, cleanup]);

  return {
    messages,
    connectionState,
    isConnected: connectionState === "connected",
    sendMessage,
    clearMessages,
    reconnectAttempts,
    reconnect,
    disconnect,
    lastError,
    isOnline,
    isLoading,
  };
}
