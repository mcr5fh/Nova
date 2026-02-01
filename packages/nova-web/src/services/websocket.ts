import type { ClientMessage, ServerMessage } from '../types';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketServiceOptions {
  url?: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface WebSocketServiceCallbacks {
  onMessage?: (message: ServerMessage) => void;
  onStateChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
}

/**
 * WebSocket service for connecting to nova-server
 */
export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts: number;
  private reconnectDelay: number;
  private currentAttempt = 0;
  private callbacks: WebSocketServiceCallbacks = {};
  private connectionState: ConnectionState = 'disconnected';
  private reconnectTimer: number | null = null;

  constructor(options: WebSocketServiceOptions = {}) {
    // Use relative URL to work with Vite proxy in dev, or set VITE_WS_URL for production
    const defaultUrl = typeof window !== 'undefined'
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
      : 'ws://localhost:3001/ws';
    this.url = options.url ?? import.meta.env.VITE_WS_URL ?? defaultUrl;
    this.reconnectAttempts = options.reconnectAttempts ?? 5;
    this.reconnectDelay = options.reconnectDelay ?? 1000;
  }

  setCallbacks(callbacks: WebSocketServiceCallbacks): void {
    this.callbacks = callbacks;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.setConnectionState('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.currentAttempt = 0;
        this.setConnectionState('connected');
      };

      this.ws.onclose = (event) => {
        this.setConnectionState('disconnected');

        // Attempt reconnection if not a clean close
        if (!event.wasClean && this.currentAttempt < this.reconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.callbacks.onError?.(new Error('WebSocket connection error'));
        this.setConnectionState('error');
      };

      this.ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data);
          this.callbacks.onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    } catch (error) {
      this.setConnectionState('error');
      this.callbacks.onError?.(error as Error);
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setConnectionState('disconnected');
  }

  send(message: ClientMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      return false;
    }
  }

  getState(): ConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.callbacks.onStateChange?.(state);
  }

  private scheduleReconnect(): void {
    this.currentAttempt++;
    const delay = this.reconnectDelay * Math.pow(2, this.currentAttempt - 1);

    console.log(`Attempting reconnect ${this.currentAttempt}/${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }
}

// Singleton instance
let instance: WebSocketService | null = null;

export function getWebSocketService(options?: WebSocketServiceOptions): WebSocketService {
  if (!instance) {
    instance = new WebSocketService(options);
  }
  return instance;
}
