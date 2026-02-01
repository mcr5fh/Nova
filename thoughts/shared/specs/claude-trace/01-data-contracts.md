# Claude Trace System - Data Contracts & Core Interfaces

**Version:** 1.0
**Status:** Draft
**Last Updated:** 2026-01-31

## Overview

This document defines the core data structures, interfaces, and contracts that all components of the Claude trace system must implement. These contracts ensure interoperability between the hook, trace server, and frontend dashboard.

**MVP assumption:** single active session. Session list endpoints are optional for MVP; the frontend can operate with a fixed `session_id`.

---

## Design Principles

1. **OpenTelemetry-Compatible**: Align with OpenTelemetry trace semantics where applicable
2. **Language-Agnostic**: JSON-based contracts that work across Go, TypeScript, and other languages
3. **Extensible**: Support custom attributes and metadata without breaking existing consumers
4. **Hierarchical**: First-class support for parent-child relationships in traces
5. **Cost-Aware**: Built-in support for token counting and cost tracking

---

## Core Data Models

### 1. TraceEvent (JSONL Format)

The fundamental unit of trace data, written by the hook and consumed by the aggregator.

```typescript
interface TraceEvent {
  // Core Identifiers (OpenTelemetry-compatible)
  trace_id: string;           // Root execution identifier (UUID v4)
  span_id: string;            // This event's unique identifier (UUID v4)
  parent_id: string | null;   // Parent span ID (null for root spans)
  session_id: string;         // Claude session identifier

  // Task Context (Beads Integration)
  task_id?: string;           // Beads task ID (e.g., "NOV-123")
  task_status?: TaskStatus;   // open | in_progress | blocked | closed
  task_title?: string;        // Human-readable task description

  // Timing
  timestamp: string;          // ISO 8601 timestamp (e.g., "2026-01-31T10:15:30Z")
  start_time?: string;        // ISO 8601 start time (for timeline rendering)
  end_time?: string;          // ISO 8601 end time (for timeline rendering)
  duration_ms?: number;       // Duration for completed events (PostToolUse only)

  // Event Classification
  event_type: EventType;      // pre_tool_use | post_tool_use | user_prompt
  hook_type: HookType;        // PreToolUse | PostToolUse | UserPromptSubmit

  // Tool/Action Details
  tool_name?: string;         // Tool name (e.g., "Bash", "Read", "Edit")
  tool_input?: unknown;       // Tool input parameters (JSON)
  tool_output?: unknown;      // Tool result or error (JSON)
  tool_use_id?: string;       // Unique identifier for this tool invocation

  // Metrics & Costs
  metrics: Metrics;

  // Extensibility
  tags: Record<string, string>;     // Key-value pairs for filtering
  metadata: Record<string, unknown>; // Arbitrary metadata
}

type EventType =
  | "pre_tool_use"
  | "post_tool_use"
  | "user_prompt";

type HookType =
  | "PreToolUse"
  | "PostToolUse"
  | "UserPromptSubmit";

type TaskStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "closed";
```text

### 2. Metrics

Cost and resource tracking for each event.

```typescript
interface Metrics {
  // Token Usage (Claude API)
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;

  // Cost Estimation
  estimated_cost?: number;    // USD (computed from tokens + model pricing)

  // Tool-Specific Metrics
  tool_count?: number;        // Number of tools invoked
  tool_error_count?: number;  // Number of tool failures

  // File Operations (tracked by hook)
  files_read?: number;
  files_written?: number;
  files_edited?: number;
}
```text

### 3. AggregatedTaskTrace (Server Response)

Aggregated view of a task's traces, rolled up from individual events.

```typescript
interface AggregatedTaskTrace {
  // Identity
  task_id: string;
  task_description: string;
  parent_task_id: string | null;
  child_task_ids: string[];

  // Status
  status: TaskStatus;

  // Timing
  start_time: string;         // ISO 8601
  end_time?: string;          // ISO 8601 (null if in progress)
  duration_ms?: number;

  // Aggregated Metrics (sum of all spans)
  total_tokens: number;
  total_cost: number;
  tool_usage: Record<string, number>; // tool name -> invocation count
  span_count: number;

  // Subtree Rollup (includes all descendants)
  rollup?: {
    total_tokens: number;
    total_cost: number;
    total_traces: number;
    total_duration_ms: number;
    error_count: number;
    last_event_time: string;   // ISO 8601
  };

  // Hierarchy
  depth: number;              // 0 for root, 1 for children, etc.

  // Health Indicators
  error_count: number;
  retry_count: number;

  // Spans
  spans: TraceEvent[];        // All events for this task
}
```text

---

## API Contracts (REST + SSE)

### REST Endpoints

The trace aggregator server exposes the following endpoints:

#### GET /api/traces

Query trace events with filtering.

**Query Parameters:**

- `session_id` (optional): Filter by session
- `task_id` (optional): Filter by task
- `from` (optional): Start timestamp (ISO 8601 or Unix ms)
- `to` (optional): End timestamp (ISO 8601 or Unix ms)
- `tool_name` (optional): Filter by tool
- `limit` (default: 100): Maximum results
- `offset` (default: 0): Pagination offset

**Response:**

```typescript
interface TracesResponse {
  traces: TraceEvent[];
  total: number;
  limit: number;
  offset: number;
}
```text

#### GET /api/tasks/:task_id

Get aggregated task trace with metrics.

**Response:**

```typescript
interface TaskResponse {
  task: AggregatedTaskTrace;
}
```text

#### GET /api/tasks/:task_id/tree

Get task hierarchy (parent + children + grandchildren).

**Response:**

```typescript
interface TaskTreeResponse {
  root: AggregatedTaskTrace;
  children: AggregatedTaskTrace[];
  ancestors: AggregatedTaskTrace[];  // Path to root
}
```text

#### GET /api/sessions/:session_id/summary

Get session-level aggregated metrics.

**Response:**

```typescript
interface SessionSummary {
  session_id: string;
  start_time: string;
  end_time?: string;
  duration_ms?: number;

  // Aggregated metrics
  total_traces: number;
  total_tokens: number;
  total_cost: number;
  tool_usage: Record<string, number>;

  // Task breakdown
  tasks: {
    total: number;
    by_status: Record<TaskStatus, number>;
  };
}
```text

### Server-Sent Events (SSE)

#### GET /api/stream

Real-time trace event stream.

**Query Parameters:**

- `session_id` (optional): Stream events for specific session only
- `task_id` (optional): Stream events for specific task only

**Event Format:**

```text
event: trace
data: {"trace_id":"...","span_id":"...","event_type":"post_tool_use",...}

event: heartbeat
data: {"timestamp":"2026-01-31T10:15:30Z"}
```text

**SSE Event Types:**

- `trace`: New trace event
- `task_updated`: Task status changed
- `heartbeat`: Keep-alive ping (every 30 seconds)

---

## Storage Contracts

### JSONL Format (Append-Only Log)

File: `.claude/traces/traces-YYYY-MM-DD.jsonl`

Each line is a complete `TraceEvent` JSON object:

```jsonl
{"trace_id":"t1","span_id":"s1","parent_id":null,"timestamp":"2026-01-31T10:00:00Z","event_type":"user_prompt","session_id":"abc123","metrics":{"input_tokens":150}}
{"trace_id":"t1","span_id":"s2","parent_id":"s1","timestamp":"2026-01-31T10:00:05Z","event_type":"pre_tool_use","tool_name":"Read","session_id":"abc123","metrics":{}}
{"trace_id":"t1","span_id":"s2","parent_id":"s1","timestamp":"2026-01-31T10:00:06Z","event_type":"post_tool_use","tool_name":"Read","duration_ms":1000,"session_id":"abc123","metrics":{}}
```text

### SQLite Schema

File: `.claude/traces/traces.db`

```sql
-- Core trace events table
CREATE TABLE traces (
    span_id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL,
    parent_id TEXT,
    session_id TEXT NOT NULL,
    task_id TEXT,
    task_status TEXT,
    timestamp INTEGER NOT NULL,        -- Unix milliseconds
    duration_ms INTEGER,
    event_type TEXT NOT NULL,
    hook_type TEXT NOT NULL,
    tool_name TEXT,
    tool_input JSON,
    tool_output JSON,
    metrics JSON,
    tags JSON,
    metadata JSON,

    -- Indexes for common queries
    INDEX idx_trace_id (trace_id),
    INDEX idx_session_id (session_id),
    INDEX idx_task_id (task_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_parent_id (parent_id),
    INDEX idx_tool_name (tool_name)
);

-- Aggregated task hierarchy
CREATE TABLE task_hierarchy (
    task_id TEXT PRIMARY KEY,
    parent_task_id TEXT,
    task_description TEXT,
    status TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    total_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0.0,
    error_count INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 0,

    INDEX idx_parent (parent_task_id),
    INDEX idx_status (status),
    INDEX idx_start_time (start_time)
);

-- Tool usage aggregations (for fast queries)
CREATE TABLE tool_usage (
    task_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    invocation_count INTEGER DEFAULT 0,
    total_duration_ms INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,

    PRIMARY KEY (task_id, tool_name),
    FOREIGN KEY (task_id) REFERENCES task_hierarchy(task_id)
);
```text

---

## Hook Input/Output Contract

### Input (stdin JSON)

The Claude hook receives events via stdin:

```typescript
interface HookInput {
  // Always present
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  hook_event_name: HookType;

  // Event-specific (PreToolUse/PostToolUse)
  tool_name?: string;
  tool_input?: unknown;
  tool_output?: unknown;
  tool_use_id?: string;

  // UserPromptSubmit specific
  prompt?: string;
}
```text

### Output (stdout JSON)

The hook returns decisions via stdout (exit 0):

```typescript
interface HookOutput {
  continue?: boolean;              // false = block action
  stopReason?: string;             // Message when continue=false
  suppressOutput?: boolean;        // Hide from user context
  systemMessage?: string;          // Warning/info to user
}
```text

Exit codes:

- **0**: Success (parse JSON from stdout)
- **2**: Blocking error (stderr sent to Claude)
- **Other**: Non-blocking error (logged, execution continues)

---

## Frontend Data Contracts

### Dashboard State

```typescript
interface DashboardState {
  // Current view
  selectedTask: string | null;
  selectedSession: string | null;

  // Filters
  filters: {
    timeRange: { from: string; to: string };
    toolNames: string[];
    taskStatus: TaskStatus[];
  };

  // Real-time connection
  streamConnected: boolean;

  // Data
  tasks: Record<string, AggregatedTaskTrace>;
  traces: TraceEvent[];
}
```text

### Visualization Data Formats

#### Mermaid Diagram (Task Tree)

```typescript
interface MermaidNode {
  id: string;
  label: string;
  status: TaskStatus;
  metrics: {
    duration?: string;    // "2h 15m"
    cost?: string;        // "$3.50"
    tokens?: string;      // "45K tokens"
  };
  children: MermaidNode[];
}
```text

#### Timeline Data (Gantt-style)

```typescript
interface TimelineSpan {
  span_id: string;
  tool_name: string;
  start_time: number;     // Unix ms
  end_time: number;       // Unix ms
  duration_ms: number;
  status: "success" | "error";
  y_position: number;     // For vertical stacking
}
```text

---

## Validation Rules

### Required Fields

**TraceEvent:**

- `trace_id`, `span_id`, `session_id`, `timestamp`, `event_type`, `hook_type`, `metrics`

**AggregatedTaskTrace:**

- `task_id`, `status`, `start_time`, `depth`

### Constraints

- `trace_id`, `span_id`: Must be valid UUIDs
- `timestamp`: Must be valid ISO 8601 or Unix milliseconds
- `duration_ms`: Must be >= 0
- `estimated_cost`: Must be >= 0
- `depth`: Must be >= 0
- Tool usage counts: Must be >= 0

### Relationships

- If `parent_id` is set, a span with that `span_id` must exist
- If `task_id` is set, it should match a Beads task
- `post_tool_use` events should have corresponding `pre_tool_use` events

---

## Versioning Strategy

**Contract Version:** Embedded in API responses and trace metadata

```typescript
interface VersionedResponse<T> {
  version: string;        // e.g., "1.0"
  data: T;
}
```text

**Backward Compatibility Rules:**

1. Never remove required fields
2. New optional fields are safe to add
3. New event types must be handled gracefully by old clients
4. SQLite schema changes require migration scripts

---

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;         // e.g., "INVALID_TASK_ID"
    message: string;      // Human-readable error
    details?: unknown;    // Optional debug info
  };
  request_id: string;     // For debugging
}
```text

### Common Error Codes

- `INVALID_TASK_ID`: Task not found
- `INVALID_SESSION_ID`: Session not found
- `INVALID_TIME_RANGE`: Invalid from/to parameters
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

---

## Performance Requirements

### Latency Targets

- Trace event write (hook): < 100ms
- REST API queries: < 500ms (p95)
- SSE event delivery: < 100ms after write
- Dashboard initial load: < 2s

### Throughput Requirements

- Hook: 100+ events/second
- REST API: 1000+ requests/second
- SSE: 100+ concurrent connections

---

## Security Considerations

### Data Redaction

The following fields should be redacted in tool_input/tool_output:

- Passwords, tokens, API keys
- File contents (store file path only)
- Environment variables
- PII (email, phone numbers)

**Implementation:** Hook performs redaction before writing to JSONL.

### Authentication

- REST API: Optional Bearer token authentication
- SSE: Same token via query parameter or header
- Local-only deployment: No authentication required

---

## Next Steps

See companion specifications:

- [05-unified-architecture.md](./05-unified-architecture.md) - **START HERE** - System overview and integration
- [02-hook-specification.md](./02-hook-specification.md) - Go hook implementation (nova-trace)
- [03-trace-server-specification.md](./03-trace-server-specification.md) - Aggregator server
- [04-frontend-specification.md](./04-frontend-specification.md) - React dashboard
