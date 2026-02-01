/**
 * API Client for Claude Trace Server
 *
 * Provides methods to interact with the trace server REST API
 * Based on: thoughts/shared/specs/claude-trace/03-trace-server-specification.md
 */

import type {
  TracesResponse,
  TaskSummary,
  TaskTreeNode,
  SessionSummary,
  QueryParams,
  APIError,
} from '../types/api';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export class TraceAPIClient {
  private baseURL: string;

  constructor(baseURL: string = DEFAULT_BASE_URL) {
    this.baseURL = baseURL;
  }

  // ==========================================================================
  // Traces Endpoints
  // ==========================================================================

  /**
   * Get traces with optional filtering
   * GET /api/traces
   */
  async getTraces(params?: QueryParams): Promise<TracesResponse> {
    const queryString = this.buildQueryString(params);
    const response = await this.fetch(`/api/traces${queryString}`);
    return response.json();
  }

  // ==========================================================================
  // Task Endpoints
  // ==========================================================================

  /**
   * Get aggregated task summary
   * GET /api/tasks/:task_id
   */
  async getTask(taskId: string): Promise<{ task: TaskSummary }> {
    const response = await this.fetch(`/api/tasks/${taskId}`);
    return response.json();
  }

  /**
   * Get task tree (hierarchical view)
   * GET /api/tasks/:task_id/tree
   */
  async getTaskTree(taskId: string): Promise<TaskTreeNode> {
    const response = await this.fetch(`/api/tasks/${taskId}/tree`);
    return response.json();
  }

  // ==========================================================================
  // Session Endpoints
  // ==========================================================================

  /**
   * Get session summary
   * GET /api/sessions/:session_id/summary
   */
  async getSessionSummary(sessionId: string): Promise<SessionSummary> {
    const response = await this.fetch(`/api/sessions/${sessionId}/summary`);
    return response.json();
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Health check
   * GET /health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetch('/health');
      return response.ok;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private async fetch(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseURL}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error: APIError = {
        message: response.statusText,
        status: response.status,
      };

      try {
        const data = await response.json();
        error.details = data;
      } catch {
        // Response body is not JSON
      }

      throw error;
    }

    return response;
  }

  private buildQueryString(params?: QueryParams): string {
    if (!params) return '';

    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }
}

// ============================================================================
// Default Export (Singleton Instance)
// ============================================================================

export const apiClient = new TraceAPIClient();
