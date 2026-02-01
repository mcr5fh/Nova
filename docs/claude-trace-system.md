# Claude Trace System Design

## Overview

A Go-based tracing system for Claude Code that captures structured telemetry from hook events and enables hierarchical drill-down/drill-up analysis through a dashboard interface.

## Architecture

```text
┌─────────────────┐
│  Claude Code    │
│   (Runtime)     │
└────────┬────────┘
         │ Hook Events (stdin JSON)
         ▼
┌─────────────────────────────────┐
│  claude-trace (Go Binary)       │
│  ┌───────────────────────────┐  │
│  │ Event Parser              │  │
│  │ - PreToolUse              │  │
│  │ - PostToolUse             │  │
│  │ - UserPromptSubmit        │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Trace Builder             │  │
│  │ - Task hierarchy          │  │
│  │ - Metrics aggregation     │  │
│  │ - Parent/child linking    │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Storage Writer            │  │
│  │ - JSONL append-only       │  │
│  │ - Optional SQLite index   │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Storage Layer                  │
│  ┌───────────────────────────┐  │
│  │ traces.jsonl              │  │
│  │ (append-only event log)   │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ traces.db (SQLite)        │  │
│  │ - Indexed queries         │  │
│  │ - Aggregations            │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Aggregator Service (Go)        │
│  - REST API                     │
│  - Real-time updates (SSE)      │
│  - Hierarchy computation        │
│  - Metrics rollup               │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Dashboard Frontend             │
│  - Mermaid diagram view         │
│  - Drill-down/drill-up          │
│  - Cost/token analytics         │
│  - Timeline view                │
└─────────────────────────────────┘
```text

## Trace Data Model

### Core Event Structure

```go
type TraceEvent struct {
    // Core identifiers
    TraceID     string    `json:"trace_id"`      // Root execution ID
    SpanID      string    `json:"span_id"`       // This event's unique ID
    ParentID    *string   `json:"parent_id"`     // Parent span ID (null for root)
    SessionID   string    `json:"session_id"`    // Claude session ID

    // Task context (from Beads if available)
    TaskID      *string   `json:"task_id"`       // Beads task ID
    TaskStatus  *string   `json:"task_status"`   // open/in_progress/closed/blocked

    // Timing
    Timestamp   time.Time `json:"timestamp"`
    Duration    *int64    `json:"duration_ms"`   // For completed events

    // Event type and source
    EventType   string    `json:"event_type"`    // "pre_tool_use", "post_tool_use", "user_prompt"
    HookType    string    `json:"hook_type"`     // "PreToolUse", "PostToolUse", "UserPromptSubmit"

    // Tool/Action details
    ToolName    *string   `json:"tool_name"`
    ToolInput   any       `json:"tool_input"`    // Raw tool input parameters
    ToolOutput  any       `json:"tool_output"`   // Tool result/error

    // Metrics
    Metrics     Metrics   `json:"metrics"`

    // Context
    Tags        map[string]string `json:"tags"`
    Metadata    map[string]any    `json:"metadata"`
}

type Metrics struct {
    // Token usage (when available)
    InputTokens     int     `json:"input_tokens,omitempty"`
    OutputTokens    int     `json:"output_tokens,omitempty"`
    CacheReadTokens int     `json:"cache_read_tokens,omitempty"`
    CacheWriteTokens int    `json:"cache_write_tokens,omitempty"`

    // Cost (computed)
    EstimatedCost   float64 `json:"estimated_cost,omitempty"`

    // Tool metrics
    ToolCount       int     `json:"tool_count,omitempty"`
    ToolErrorCount  int     `json:"tool_error_count,omitempty"`

    // File operations (from tracking)
    FilesRead       int     `json:"files_read,omitempty"`
    FilesWritten    int     `json:"files_written,omitempty"`
    FilesEdited     int     `json:"files_edited,omitempty"`
}
```text

### Aggregated View (for Dashboard)

```go
type TaskTrace struct {
    // Identity
    TaskID          string    `json:"task_id"`
    TaskDescription string    `json:"task_description"`
    ParentTaskID    *string   `json:"parent_task_id"`
    ChildTaskIDs    []string  `json:"child_task_ids"`

    // Status
    Status          string    `json:"status"` // pending/running/completed/failed/blocked

    // Timing
    StartTime       time.Time `json:"start_time"`
    EndTime         *time.Time `json:"end_time"`
    Duration        *int64    `json:"duration_ms"`

    // Aggregated metrics (rolled up from all spans)
    TotalTokens     int       `json:"total_tokens"`
    TotalCost       float64   `json:"total_cost"`
    ToolUsage       map[string]int `json:"tool_usage"` // tool name -> count

    // Hierarchy depth
    Depth           int       `json:"depth"` // 0 for root, 1 for children, etc.

    // Health indicators
    ErrorCount      int       `json:"error_count"`
    RetryCount      int       `json:"retry_count"`
}
```text

## Hook Integration

### Hook Event Schema (from Claude)

Based on the Claude hooks documentation, events arrive as JSON on stdin:

```json
{
  "session_id": "abc123",
  "conversation_id": "conv456",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run tests"
  },
  "tool_output": {
    "stdout": "...",
    "stderr": "...",
    "exit_code": 0
  },
  "timestamp": "2024-01-31T10:30:00Z",
  "user_message": "..."
}
```text

### Hook Configuration

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/claude-trace"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/claude-trace"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/claude-trace"
          }
        ]
      }
    ]
  }
}
```text

### Go Binary Interface

```go
package main

import (
    "encoding/json"
    "io"
    "os"
)

type HookEvent struct {
    SessionID      string         `json:"session_id"`
    ConversationID string         `json:"conversation_id"`
    ToolName       string         `json:"tool_name"`
    ToolInput      map[string]any `json:"tool_input"`
    ToolOutput     map[string]any `json:"tool_output"`
    Timestamp      string         `json:"timestamp"`
    UserMessage    string         `json:"user_message"`
}

func main() {
    // Read hook event from stdin
    input, err := io.ReadAll(os.Stdin)
    if err != nil {
        os.Exit(1)
    }

    var event HookEvent
    if err := json.Unmarshal(input, &event); err != nil {
        os.Exit(1)
    }

    // Process and store trace
    trace := convertToTrace(event)
    storeTrace(trace)

    // Exit 0 for success (non-blocking)
    os.Exit(0)
}
```text

## Storage Strategy

### Phase 1: JSONL Append-Only

**Benefits:**

- Simple, fast writes
- No schema migrations
- Easy to replay/audit
- Human-readable

**Structure:**

```text
.claude/traces/
  ├── traces-2024-01-31.jsonl
  ├── traces-2024-02-01.jsonl
  └── current.jsonl -> traces-2024-02-01.jsonl
```text

**Example:**

```jsonl
{"trace_id":"t1","span_id":"s1","parent_id":null,"timestamp":"2024-01-31T10:00:00Z","event_type":"user_prompt","metrics":{"input_tokens":150}}
{"trace_id":"t1","span_id":"s2","parent_id":"s1","timestamp":"2024-01-31T10:00:05Z","event_type":"pre_tool_use","tool_name":"Read"}
{"trace_id":"t1","span_id":"s2","parent_id":"s1","timestamp":"2024-01-31T10:00:06Z","event_type":"post_tool_use","tool_name":"Read","duration_ms":1000}
```text

### Phase 2: SQLite Index

**Benefits:**

- Fast queries for dashboard
- Aggregations
- No external dependencies

**Schema:**

```sql
CREATE TABLE traces (
    span_id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL,
    parent_id TEXT,
    session_id TEXT NOT NULL,
    task_id TEXT,
    timestamp INTEGER NOT NULL,
    duration_ms INTEGER,
    event_type TEXT NOT NULL,
    tool_name TEXT,
    metrics JSON,
    tags JSON,

    -- Indexes for common queries
    INDEX idx_trace_id (trace_id),
    INDEX idx_session_id (session_id),
    INDEX idx_task_id (task_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_parent_id (parent_id)
);

CREATE TABLE task_hierarchy (
    task_id TEXT PRIMARY KEY,
    parent_task_id TEXT,
    status TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    total_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0.0,
    depth INTEGER DEFAULT 0,

    INDEX idx_parent (parent_task_id),
    INDEX idx_status (status)
);
```text

### Phase 3: Optional Time-Series DB

For production scale, consider:

- **ClickHouse**: OLAP queries, aggregations
- **TimescaleDB**: PostgreSQL with time-series extensions
- **Victoria Metrics**: Prometheus-compatible metrics

## Integration with Beads

### Reading Beads Task Context

```go
import (
    "encoding/json"
    "os"
    "path/filepath"
)

type BeadsTask struct {
    ID          string   `json:"id"`
    Title       string   `json:"title"`
    Status      string   `json:"status"`
    ParentID    *string  `json:"parentId"`
    ChildIDs    []string `json:"childIds"`
    CreatedAt   string   `json:"createdAt"`
    UpdatedAt   string   `json:"updatedAt"`
}

func getCurrentBeadsTask(projectDir string) (*BeadsTask, error) {
    // Read .beads/issues/*.json files
    issuesDir := filepath.Join(projectDir, ".beads", "issues")

    // Find most recently updated task with status "in_progress"
    // This is a simplified approach - real implementation should be more robust

    files, err := os.ReadDir(issuesDir)
    if err != nil {
        return nil, err
    }

    var currentTask *BeadsTask
    var latestTime string

    for _, file := range files {
        if !file.IsDir() && filepath.Ext(file.Name()) == ".json" {
            data, _ := os.ReadFile(filepath.Join(issuesDir, file.Name()))
            var task BeadsTask
            if json.Unmarshal(data, &task) == nil {
                if task.Status == "in_progress" && task.UpdatedAt > latestTime {
                    currentTask = &task
                    latestTime = task.UpdatedAt
                }
            }
        }
    }

    return currentTask, nil
}
```text

### Linking Traces to Beads Tasks

```go
func enhanceTraceWithBeadsContext(trace *TraceEvent, projectDir string) {
    task, err := getCurrentBeadsTask(projectDir)
    if err == nil && task != nil {
        trace.TaskID = &task.ID
        trace.TaskStatus = &task.Status
        trace.Tags["task_title"] = task.Title
        if task.ParentID != nil {
            trace.ParentID = task.ParentID
        }
    }
}
```text

## Aggregator Service API

### REST API

```go
type AggregatorAPI struct {
    db *sql.DB
}

// GET /api/traces?session_id={id}&from={timestamp}&to={timestamp}
func (api *AggregatorAPI) GetTraces(w http.ResponseWriter, r *http.Request) {
    // Return filtered trace events
}

// GET /api/tasks/{task_id}
func (api *AggregatorAPI) GetTask(w http.ResponseWriter, r *http.Request) {
    // Return task trace with aggregated metrics
}

// GET /api/tasks/{task_id}/tree
func (api *AggregatorAPI) GetTaskTree(w http.ResponseWriter, r *http.Request) {
    // Return task hierarchy (parent + children)
}

// GET /api/sessions/{session_id}/summary
func (api *AggregatorAPI) GetSessionSummary(w http.ResponseWriter, r *http.Request) {
    // Return aggregated session metrics
}

// GET /api/stream (Server-Sent Events)
func (api *AggregatorAPI) StreamTraces(w http.ResponseWriter, r *http.Request) {
    // Real-time trace updates
}
```text

### Example API Response

```json
{
  "task_id": "NOV-123",
  "task_description": "Implement authentication system",
  "parent_task_id": "NOV-100",
  "child_task_ids": ["NOV-124", "NOV-125"],
  "status": "in_progress",
  "start_time": "2024-01-31T10:00:00Z",
  "duration_ms": 45000,
  "metrics": {
    "total_tokens": 15000,
    "total_cost": 0.75,
    "tool_usage": {
      "Read": 25,
      "Edit": 8,
      "Bash": 5
    },
    "files_modified": 12,
    "error_count": 2
  },
  "children_summary": {
    "total_children": 2,
    "completed": 1,
    "in_progress": 1,
    "failed": 0
  }
}
```text

## Dashboard Frontend

### Technology Stack

#### Option 1: Simple HTML + Mermaid

- Static HTML page
- Mermaid.js for diagrams
- Fetch API for data
- No build step

#### Option 2: React/Next.js

- Rich interactivity
- react-flow or reactflow for graph visualization
- Real-time updates via SSE
- D3.js for custom visualizations

#### Option 3: Terminal UI (Bubble Tea)

- Built-in Go
- No separate frontend needed
- Great for CLI workflows

### Key Views

#### 1. Task Tree View (Mermaid)

```mermaid
graph TD
    root[NOV-100: Implement Auth<br/>Status: in_progress<br/>Tokens: 50K | Cost: $2.50]

    root --> child1[NOV-123: Add JWT tokens<br/>Status: completed<br/>Tokens: 20K | Cost: $1.00]
    root --> child2[NOV-124: Add login endpoint<br/>Status: in_progress<br/>Tokens: 15K | Cost: $0.75]
    root --> child3[NOV-125: Add tests<br/>Status: pending<br/>Tokens: 0 | Cost: $0.00]

    child2 --> subchild1[NOV-126: Validate credentials<br/>Status: completed]
    child2 --> subchild2[NOV-127: Generate token<br/>Status: in_progress]

    style root fill:#f9f,stroke:#333,stroke-width:4px
    style child1 fill:#9f9,stroke:#333
    style child2 fill:#ff9,stroke:#333
    style child3 fill:#ccc,stroke:#333
```text

#### 2. Timeline View

Horizontal timeline showing tool usage over time:

```text
10:00 |-- Read: user.go --|
10:01                      |-- Edit: user.go --|
10:02                                          |-- Bash: go build --|
10:03                                                                |-- Read: test.go --|
```text

#### 3. Cost/Token Analytics

- Token distribution by tool
- Cost over time
- Average cost per task
- Token efficiency metrics

#### 4. Session Dashboard

**Overview Metrics:**

- Total sessions
- Average session duration
- Total cost
- Most used tools
- Error rate

**Task Status:**

- Pending: 5
- In Progress: 2
- Completed: 15
- Failed: 1

**Interactive Filters:**

- Date range
- Task status
- Tool type
- Cost threshold

## Implementation Phases

### Phase 1: MVP Hook (Week 1)

**Goal:** Capture basic trace events to JSONL

```text
Tasks:
1. ✅ Create Go binary that reads stdin JSON
2. ✅ Parse Claude hook events
3. ✅ Generate span IDs and trace hierarchy
4. ✅ Write to JSONL file
5. ✅ Add hook configuration
6. ✅ Test with simple tool calls
```text

**Deliverable:** Working hook that logs tool usage to file

### Phase 2: Beads Integration (Week 2)

**Goal:** Link traces to Beads tasks

```text
Tasks:
1. ✅ Read Beads task files
2. ✅ Associate traces with current task
3. ✅ Capture task status transitions
4. ✅ Store parent/child relationships
5. ✅ Test with multi-level task hierarchy
```text

**Deliverable:** Traces contain task context

### Phase 3: Metrics & Aggregation (Week 3)

**Goal:** Compute token usage and costs

```text
Tasks:
1. ✅ Add token counting logic
2. ✅ Compute estimated costs per model
3. ✅ Aggregate metrics by task
4. ✅ Create SQLite index
5. ✅ Build aggregation queries
```text

**Deliverable:** Rich metrics available for querying

### Phase 4: Aggregator Service (Week 4)

**Goal:** REST API for dashboard

```text
Tasks:
1. ✅ Create HTTP server
2. ✅ Implement query endpoints
3. ✅ Add real-time updates (SSE)
4. ✅ Optimize query performance
5. ✅ Add authentication (optional)
```text

**Deliverable:** API serving trace data

### Phase 5: Dashboard UI (Week 5-6)

**Goal:** Interactive visualization

```text
Tasks:
1. ✅ Choose tech stack (React/Next.js recommended)
2. ✅ Build task tree view with Mermaid
3. ✅ Add drill-down/drill-up navigation
4. ✅ Create timeline view
5. ✅ Add cost analytics charts
6. ✅ Real-time updates
```text

**Deliverable:** Production-ready dashboard

### Phase 6: Polish & Scale (Week 7+)

**Goal:** Production readiness

```text
Tasks:
1. ✅ Add data retention policies
2. ✅ Implement log rotation
3. ✅ Add export capabilities
4. ✅ Performance optimization
5. ✅ Documentation
6. ✅ Consider cloud storage (S3, etc.)
```text

## Example Usage Scenarios

### Scenario 1: Debugging a Failed Task

1. User sees red status in dashboard
2. Click on failed task node
3. View trace timeline showing:
   - Last successful tool call
   - Error message
   - Token usage spike
4. Drill into child tasks to find root cause
5. Export trace for issue reporting

### Scenario 2: Cost Optimization

1. Filter tasks by cost > $5
2. View token distribution
3. Identify inefficient prompts
4. Compare similar tasks to find patterns
5. Optimize prompts to reduce cost

### Scenario 3: Session Analysis

1. View session timeline
2. See task hierarchy as Mermaid diagram
3. Identify blocked tasks (yellow)
4. Drill down to see why blocked
5. Resume from checkpoint

## Open Questions

1. **Token Capture**: How do we get actual token counts from Claude responses?
   - Parse from LLM responses if available
   - Use tiktoken for estimation
   - Fallback to character count heuristics

2. **Task Correlation**: How do we reliably link tool calls to Beads tasks?
   - Watch for `bd create`, `bd update` commands
   - Parse tool outputs for task IDs
   - Use session-level task context

3. **Real-time Updates**: Should the hook be blocking or async?
   - Async (non-blocking) for performance
   - Use background goroutine for writes
   - Buffer events in memory if needed

4. **Data Retention**: How long to keep traces?
   - Keep raw JSONL for 30 days
   - Keep aggregated data indefinitely
   - Compress old traces

5. **Privacy**: What data should we redact?
   - File contents
   - API keys
   - User prompts (optional)
   - PII in tool outputs

## Related Work / Inspiration

### Similar Systems

1. **OpenTelemetry**: Distributed tracing standard
   - Use span/trace concepts
   - Compatible export formats

2. **Jaeger/Zipkin**: Trace visualization
   - Inspiration for UI
   - Waterfall views

3. **Sentry**: Error tracking + performance
   - Session replay concept
   - Breadcrumb trail

4. **LangSmith**: LLM observability
   - Token tracking
   - Prompt versioning

5. **OpenAI Agents SDK**: Tracing built-in
   - Event streaming
   - Structured logs

### References

- Claude Hooks Docs: <https://code.claude.com/docs/en/hooks>
- Example Hook: <https://github.com/Dicklesworthstone/destructive_command_guard>
- OpenTelemetry: <https://opentelemetry.io/docs/concepts/signals/traces/>
- Mermaid: <https://mermaid.js.org/syntax/flowchart.html>

## Next Steps

1. **Review this design** with team
2. **Choose tech stack** for dashboard
3. **Start Phase 1** implementation
4. **Create POC** with simple hook
5. **Test with real workflow** (e.g., ralph_impl)
6. **Iterate** based on feedback
