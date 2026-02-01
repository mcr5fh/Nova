/**
 * Example usage of useAgentChat hook
 *
 * This file demonstrates how to use the useAgentChat hook in a React component.
 * This is NOT a test file - it's documentation.
 */

import React from "react";
import { useAgentChat } from "./useAgentChat";
import type { ServerEvent } from "../types/chat";
import {
  isAgentMessageEvent,
  isUserMessageEvent,
  isToolCallEvent,
  isToolResultEvent,
  isAgentThinkingEvent,
  isErrorEvent,
} from "../types/chat";

export function ChatExample() {
  const {
    messages,
    connectionState,
    isConnected,
    sendMessage,
    clearMessages,
    reconnectAttempts,
    reconnect,
    disconnect,
  } = useAgentChat("ws://localhost:8000/ws", {
    session_id: "my-session-id", // Optional: for conversation continuity
    autoReconnect: true, // Default: true
    maxReconnectAttempts: 5, // Default: 5
    onMessage: (event: ServerEvent) => {
      console.log("Received message:", event);
    },
    onConnectionStateChange: (state) => {
      console.log("Connection state changed to:", state);
    },
  });

  const handleSend = (input: string) => {
    if (input.trim()) {
      sendMessage(input);
    }
  };

  return (
    <div>
      <div>
        Connection Status: {connectionState}
        {reconnectAttempts > 0 && ` (Attempt: ${reconnectAttempts})`}
      </div>

      <div>
        {messages.map((msg, idx) => {
          if (isUserMessageEvent(msg)) {
            return <div key={idx}>You: {msg.message}</div>;
          }
          if (isAgentMessageEvent(msg)) {
            return <div key={idx}>Agent: {msg.message}</div>;
          }
          if (isToolCallEvent(msg)) {
            return (
              <div key={idx}>
                Tool Call: {msg.tool_name} - {msg.tool_args}
              </div>
            );
          }
          if (isToolResultEvent(msg)) {
            return (
              <div key={idx}>
                Tool Result: {msg.tool_name} - {msg.result} (
                {msg.success ? "success" : "failed"})
              </div>
            );
          }
          if (isAgentThinkingEvent(msg)) {
            return <div key={idx}>Thinking: {msg.reasoning}</div>;
          }
          if (isErrorEvent(msg)) {
            return <div key={idx}>Error: {msg.error}</div>;
          }
          return null;
        })}
      </div>

      <button onClick={() => handleSend("Hello agent")} disabled={!isConnected}>
        Send Message
      </button>
      <button onClick={clearMessages}>Clear Messages</button>
      <button onClick={reconnect}>Reconnect</button>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
