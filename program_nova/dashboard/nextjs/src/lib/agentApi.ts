/**
 * Agent Loop WebSocket API client
 * Connects to the agent loop server on port 8001
 */

import type { ChatRequest, ServerEvent } from '@/types';

const AGENT_WS_URL = 'ws://localhost:8001/ws';

export class AgentWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * Connect to the agent loop WebSocket server
   */
  connect(
    onMessage: (event: ServerEvent) => void,
    onError?: (error: Event) => void,
    onClose?: () => void
  ): void {
    try {
      this.ws = new WebSocket(AGENT_WS_URL);

      this.ws.onopen = () => {
        console.log('Connected to agent loop server');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ServerEvent;
          onMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (onError) {
          onError(error);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from agent loop server');
        if (onClose) {
          onClose();
        }
        this.attemptReconnect(onMessage, onError, onClose);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      if (onError) {
        onError(error as Event);
      }
    }
  }

  /**
   * Send a chat message to the agent
   */
  sendMessage(message: string, sessionId?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const chatRequest: ChatRequest = {
      type: 'chat',
      message,
      ...(sessionId && { session_id: sessionId }),
    };

    this.ws.send(JSON.stringify(chatRequest));
  }

  /**
   * Close the WebSocket connection
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if the WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  private attemptReconnect(
    onMessage: (event: ServerEvent) => void,
    onError?: (error: Event) => void,
    onClose?: () => void
  ): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );

      setTimeout(() => {
        this.connect(onMessage, onError, onClose);
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }
}
