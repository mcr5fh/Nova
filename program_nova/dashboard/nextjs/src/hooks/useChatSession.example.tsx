/**
 * Example usage of useChatSession hook
 *
 * This file demonstrates how to use the useChatSession hook in a React component.
 * It is not part of the production code, just a reference for developers.
 */

'use client';

import { useChatSession } from './useChatSession';
import { ServerEvent } from '@/types/chat';

export function ChatSessionExample() {
  const { sessionId, history, addToHistory, clearSession } = useChatSession();

  // Example: Add a user message event to history
  const handleUserMessage = (message: string) => {
    const event: ServerEvent = {
      type: 'user_message',
      message,
    };
    addToHistory(event);
  };

  // Example: Add an agent message event to history
  const handleAgentMessage = (message: string) => {
    const event: ServerEvent = {
      type: 'agent_message',
      message,
    };
    addToHistory(event);
  };

  // Example: Clear the session and history
  const handleClearSession = () => {
    clearSession();
    console.log('Session cleared, new session ID:', sessionId);
  };

  return (
    <div>
      <h2>Chat Session</h2>
      <p>Session ID: {sessionId}</p>
      <p>Message Count: {history.length}</p>

      <button onClick={() => handleUserMessage('Hello!')}>
        Send User Message
      </button>
      <button onClick={() => handleAgentMessage('Hi there!')}>
        Send Agent Message
      </button>
      <button onClick={handleClearSession}>
        Clear Session
      </button>

      <div>
        <h3>Message History:</h3>
        {history.map((event, index) => (
          <div key={index}>
            <strong>{event.type}:</strong>
            {' '}
            {'message' in event && event.message}
          </div>
        ))}
      </div>
    </div>
  );
}
