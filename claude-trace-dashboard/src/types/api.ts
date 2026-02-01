/**
 * API Types for Claude Trace Dashboard
 *
 * Based on the trace server specification:
 * - thoughts/shared/specs/claude-trace/03-trace-server-specification.md
 */

// ============================================================================
// Core Trace Event Types
// ============================================================================

export interface TraceEvent {
  span_id: string;
  trace_id: string;
  parent_id: string | null;
  session_id: string;
  task_id: string | null;
  task_status: string | null;
  timestamp: number; // Unix timestamp in milliseconds
  duration_ms: number | null;
  event_type: string;
  hook_type: string;
  tool_name: string | null;
  tool_input: Record<string, unknown> | null;
  tool_output: Record<string, unknown> | null;
  metrics: TraceMetrics | null;
  tags: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  indexed_at?: number;
}

export interface TraceMetrics {
  files_edited?: number;
  files_read?: number;
  files_written?: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  estimated_cost?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface TracesResponse {
  traces: TraceEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface TaskSummary {
  task_id: string;
  parent_task_id: string | null;
  task_description: string | null;
  status: TaskStatus;
  start_time: number;
  end_time: number | null;
  duration_ms: number | null;
  total_tokens: number;
  total_cost: number;
  tool_calls: number;
  files_modified: number;
}

export interface TaskTreeNode {
  task_id: string;
  parent_task_id: string | null;
  children: TaskTreeNode[];
  summary: TaskSummary;
}

export interface SessionSummary {
  session_id: string;
  start_time: number;
  end_time: number | null;
  duration_ms: number | null;
  total_cost: number;
  total_tokens: number;
  tool_calls: number;
  files_modified: number;
  errors: number;
  tasks_completed: number;
  tasks_in_progress: number;
  tasks_failed: number;
  tasks_pending: number;
  top_tools: ToolUsage[];
}

export interface ToolUsage {
  tool_name: string;
  count: number;
  total_cost: number;
  total_tokens: number;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface QueryParams {
  session_id?: string;
  task_id?: string;
  tool_name?: string;
  from?: string; // ISO date string
  to?: string; // ISO date string
  limit?: number;
  offset?: number;
}

// ============================================================================
// SSE Event Types
// ============================================================================

export interface SSETraceEvent {
  event: 'trace';
  data: TraceEvent;
}

export interface SSEHeartbeatEvent {
  event: 'heartbeat';
  data: {
    timestamp: string;
  };
}

export type SSEEvent = SSETraceEvent | SSEHeartbeatEvent;

// ============================================================================
// Task Status Enum
// ============================================================================

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'blocked';

// ============================================================================
// Error Types
// ============================================================================

export interface APIError {
  message: string;
  status: number;
  details?: unknown;
}
