/**
 * Server-Sent Events (SSE) Client for Real-Time Trace Streaming
 *
 * Based on: thoughts/shared/specs/claude-trace/03-trace-server-specification.md
 */

import type { TraceEvent } from '../types/api';

// ============================================================================
// Types
// ============================================================================

export interface SSEOptions {
  sessionId?: string;
  taskId?: string;
  onTrace?: (trace: TraceEvent) => void;
  onHeartbeat?: (timestamp: string) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
}

// ============================================================================
// SSE Client
// ============================================================================

export class TraceSSEClient {
  private baseURL: string;
  private eventSource: EventSource | null = null;
  private options: SSEOptions = {};

  constructor(
    baseURL: string = import.meta.env.VITE_API_BASE_URL ||
      'http://localhost:8080'
  ) {
    this.baseURL = baseURL;
  }

  /**
   * Connect to the SSE stream
   */
  connect(options: SSEOptions = {}): void {
    this.options = options;

    // Build URL with query parameters
    const url = this.buildStreamURL(options.sessionId, options.taskId);

    // Create EventSource
    this.eventSource = new EventSource(url);

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Disconnect from the SSE stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private setupEventListeners(): void {
    if (!this.eventSource) return;

    // Handle trace events
    this.eventSource.addEventListener('trace', (event: MessageEvent) => {
      try {
        const trace: TraceEvent = JSON.parse(event.data);
        this.options.onTrace?.(trace);
      } catch (error) {
        console.error('Failed to parse trace event:', error);
      }
    });

    // Handle heartbeat events
    this.eventSource.addEventListener('heartbeat', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        this.options.onHeartbeat?.(data.timestamp);
      } catch (error) {
        console.error('Failed to parse heartbeat event:', error);
      }
    });

    // Handle connection open
    this.eventSource.addEventListener('open', () => {
      this.options.onOpen?.();
    });

    // Handle errors
    this.eventSource.addEventListener('error', (event: Event) => {
      this.options.onError?.(event);
    });
  }

  private buildStreamURL(sessionId?: string, taskId?: string): string {
    const params = new URLSearchParams();

    if (sessionId) {
      params.append('session_id', sessionId);
    }

    if (taskId) {
      params.append('task_id', taskId);
    }

    const queryString = params.toString();
    const path = `/api/stream${queryString ? `?${queryString}` : ''}`;

    return `${this.baseURL}${path}`;
  }
}

// ============================================================================
// Default Export (Factory Function)
// ============================================================================

export const createSSEClient = (baseURL?: string): TraceSSEClient => {
  return new TraceSSEClient(baseURL);
};
