# Claude Trace Dashboard - Examples & Queries

## Dashboard Mockups

### 1. Task Hierarchy View (Mermaid)

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'fontSize':'14px'}}}%%
graph TB
    root["📋 NOV-100: Implement Authentication<br/>⏱️ 2h 15m | 💰 $3.50 | 🔤 45K tokens<br/>Status: 🟡 In Progress"]

    root --> auth["🔐 NOV-123: JWT Token Generation<br/>⏱️ 45m | 💰 $1.20 | 🔤 15K tokens<br/>Status: ✅ Complete"]
    root --> login["🌐 NOV-124: Login Endpoint<br/>⏱️ 1h 10m | 💰 $1.80 | 🔤 22K tokens<br/>Status: 🟡 In Progress"]
    root --> tests["🧪 NOV-125: Test Suite<br/>⏱️ 0m | 💰 $0.00 | 🔤 0 tokens<br/>Status: ⚪ Pending"]

    login --> validate["✓ NOV-126: Credential Validation<br/>⏱️ 35m | 💰 $0.80 | 🔤 10K tokens<br/>Status: ✅ Complete"]
    login --> token["🎫 NOV-127: Token Response<br/>⏱️ 25m | 💰 $0.60 | 🔤 8K tokens<br/>Status: 🟡 In Progress"]
    login --> error["⚠️ NOV-128: Error Handling<br/>⏱️ 10m | 💰 $0.40 | 🔤 4K tokens<br/>Status: 🔴 Failed"]

    style root fill:#fff4e6,stroke:#fb923c,stroke-width:3px
    style auth fill:#dcfce7,stroke:#22c55e,stroke-width:2px
    style login fill:#fef3c7,stroke:#eab308,stroke-width:2px
    style tests fill:#f3f4f6,stroke:#9ca3af,stroke-width:2px
    style validate fill:#dcfce7,stroke:#22c55e,stroke-width:2px
    style token fill:#fef3c7,stroke:#eab308,stroke-width:2px
    style error fill:#fee2e2,stroke:#ef4444,stroke-width:2px
```text

**Interactive Features:**

- Click node → drill into task details
- Hover → show tooltip with more metrics
- Color coding: 🟢 Complete | 🟡 In Progress | 🔴 Failed | ⚪ Pending
- Expandable/collapsible branches

### 2. Timeline View

```text
Session: abc123 | Duration: 2h 15m | Cost: $3.50
─────────────────────────────────────────────────────────────────────
10:00 ┃ 🔵 Task Start: Implement Authentication
      ┃
10:05 ┣━━ 📖 Read: auth/types.go (2s)
      ┃
10:08 ┣━━ ✏️  Edit: auth/jwt.go (45s)
      ┃
10:15 ┣━━ ⚙️  Bash: go test ./auth (5s)
      ┃   └─ ✅ Passed
      ┃
10:20 ┣━━ 📖 Read: server/routes.go (1s)
      ┃
10:25 ┣━━ ✏️  Edit: server/routes.go (30s)
      ┃
10:30 ┣━━ ⚙️  Bash: go build (8s)
      ┃   └─ ⚠️  Warning: unused variable
      ┃
10:35 ┣━━ ✏️  Edit: server/routes.go (20s)
      ┃
10:40 ┣━━ ⚙️  Bash: go build (7s)
      ┃   └─ ✅ Success
      ┃
10:45 ┣━━ 🔄 Bash: go test -race ./... (15s)
      ┃   └─ ❌ FAIL: TestAuthHandler
      ┃
10:50 ┣━━ 📖 Read: auth/handler_test.go (2s)
      ┃
11:00 ┣━━ ✏️  Edit: auth/handler.go (60s)
      ┃
11:15 ┣━━ 🔄 Bash: go test ./auth (4s)
      ┃   └─ ✅ PASS
      ┃
12:15 ┃ 🏁 Task Complete
─────────────────────────────────────────────────────────────────────

Legend:
📖 Read | ✏️  Edit | ⚙️  Bash | 🔄 Test | 🔵 Task | ✅ Success | ❌ Fail
```text

### 3. Cost Analytics Dashboard

```text
┌─────────────────────────────────────────────────────────────────┐
│  Cost Overview - Last 30 Days                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Total Spent: $127.50                                          │
│  Total Tokens: 1.5M                                            │
│  Avg Cost/Task: $2.15                                          │
│  Most Expensive Task: NOV-089 ($15.20)                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Daily Spend                                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ $12 ┤                                            ╭─╮       │ │
│  │     ┤                                 ╭─╮        │ │       │ │
│  │  $8 ┤              ╭─╮     ╭─╮        │ │ ╭─╮    │ │       │ │
│  │     ┤     ╭─╮      │ │     │ │  ╭─╮   │ │ │ │    │ │       │ │
│  │  $4 ┤ ╭─╮ │ │ ╭─╮  │ │ ╭─╮ │ │  │ │   │ │ │ │ ╭─╮│ │       │ │
│  │     ┤ │ │ │ │ │ │  │ │ │ │ │ │  │ │   │ │ │ │ │ ││ │       │ │
│  │  $0 ┼─┴─┴─┴─┴─┴─┴──┴─┴─┴─┴─┴─┴──┴─┴───┴─┴─┴─┴─┴─┴┴─┴───────│ │
│  │       1  3  5  7   9  11 13 15  17  19  21 23  25 27  29   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Cost by Tool                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Task (Agent)     ████████████████████████████  $45.20 35% │ │
│  │ Bash             ████████████████            $32.10 25%   │ │
│  │ Read             ████████████                $25.40 20%   │ │
│  │ Edit             ████████                    $16.20 13%   │ │
│  │ Other            ████                        $ 8.60  7%   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Token Distribution                                             │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Input:   █████████████████ 850K (57%)                     │ │
│  │ Output:  ██████████ 450K (30%)                            │ │
│  │ Cache Read:  ███ 150K (10%)                               │ │
│  │ Cache Write: █ 50K (3%)                                   │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```text

### 4. Session Summary Card

```text
┌─────────────────────────────────────────────────────────┐
│ 🎯 Session: abc-def-123                                 │
│ ⏱️  Duration: 2h 15m                                     │
│ 📅 Started: 2024-01-31 10:00 AM                         │
├─────────────────────────────────────────────────────────┤
│ 💰 Cost: $3.50            🔤 Tokens: 45,000            │
│ 🛠️  Tools: 42 calls        ⚠️  Errors: 3               │
│ 📝 Files: 12 edited       ✅ Tests: 8 passed           │
├─────────────────────────────────────────────────────────┤
│ 📊 Status Breakdown:                                    │
│   ✅ Completed: 5 tasks                                 │
│   🟡 In Progress: 2 tasks                               │
│   🔴 Failed: 1 task                                     │
│   ⚪ Pending: 3 tasks                                   │
├─────────────────────────────────────────────────────────┤
│ 🔝 Top Tool Usage:                                      │
│   1. Read (15×)                                         │
│   2. Edit (12×)                                         │
│   3. Bash (8×)                                          │
│   4. Task (5×)                                          │
│   5. Glob (2×)                                          │
├─────────────────────────────────────────────────────────┤
│ [View Details] [Export] [Share]                        │
└─────────────────────────────────────────────────────────┘
```text

## SQL Queries for Dashboard

### Setup SQLite Schema

```sql
-- traces table
CREATE TABLE IF NOT EXISTS traces (
    span_id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL,
    parent_id TEXT,
    session_id TEXT NOT NULL,
    task_id TEXT,
    task_status TEXT,
    timestamp INTEGER NOT NULL,  -- Unix timestamp
    duration_ms INTEGER,
    event_type TEXT NOT NULL,
    hook_type TEXT NOT NULL,
    tool_name TEXT,
    tool_input TEXT,  -- JSON
    tool_output TEXT, -- JSON
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cache_write_tokens INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0.0,
    files_read INTEGER DEFAULT 0,
    files_written INTEGER DEFAULT 0,
    files_edited INTEGER DEFAULT 0,
    tags TEXT, -- JSON
    metadata TEXT -- JSON
);

CREATE INDEX idx_traces_trace_id ON traces(trace_id);
CREATE INDEX idx_traces_session_id ON traces(session_id);
CREATE INDEX idx_traces_task_id ON traces(task_id);
CREATE INDEX idx_traces_timestamp ON traces(timestamp);
CREATE INDEX idx_traces_parent_id ON traces(parent_id);
CREATE INDEX idx_traces_tool_name ON traces(tool_name);

-- Aggregated task view
CREATE TABLE IF NOT EXISTS task_summary (
    task_id TEXT PRIMARY KEY,
    parent_task_id TEXT,
    task_description TEXT,
    status TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration_ms INTEGER,
    total_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0.0,
    error_count INTEGER DEFAULT 0,
    tool_usage TEXT, -- JSON: {"Read": 5, "Edit": 3}
    depth INTEGER DEFAULT 0,

    INDEX idx_task_parent (parent_task_id),
    INDEX idx_task_status (status),
    INDEX idx_task_start (start_time)
);
```text

### Common Queries

#### 1. Get All Sessions with Summary

```sql
SELECT
    session_id,
    MIN(timestamp) as start_time,
    MAX(timestamp) as end_time,
    (MAX(timestamp) - MIN(timestamp)) / 1000 as duration_seconds,
    COUNT(*) as total_events,
    SUM(input_tokens + output_tokens) as total_tokens,
    SUM(estimated_cost) as total_cost,
    COUNT(DISTINCT tool_name) as unique_tools,
    SUM(CASE WHEN tool_output LIKE '%error%' THEN 1 ELSE 0 END) as error_count
FROM traces
GROUP BY session_id
ORDER BY start_time DESC;
```text

#### 2. Get Task Hierarchy (Parent → Children)

```sql
WITH RECURSIVE task_tree AS (
    -- Root task
    SELECT
        task_id,
        parent_task_id,
        task_description,
        status,
        0 as depth,
        task_id as root_id
    FROM task_summary
    WHERE parent_task_id IS NULL
        AND task_id = ?  -- Parameter: root task ID

    UNION ALL

    -- Children
    SELECT
        ts.task_id,
        ts.parent_task_id,
        ts.task_description,
        ts.status,
        tt.depth + 1,
        tt.root_id
    FROM task_summary ts
    INNER JOIN task_tree tt ON ts.parent_task_id = tt.task_id
)
SELECT * FROM task_tree
ORDER BY depth, task_id;
```text

#### 3. Get Tool Usage Distribution

```sql
SELECT
    tool_name,
    COUNT(*) as usage_count,
    SUM(duration_ms) as total_duration_ms,
    AVG(duration_ms) as avg_duration_ms,
    SUM(estimated_cost) as total_cost,
    SUM(input_tokens + output_tokens) as total_tokens
FROM traces
WHERE tool_name IS NOT NULL
    AND session_id = ?  -- Parameter: session ID
GROUP BY tool_name
ORDER BY usage_count DESC;
```text

#### 4. Get Timeline for Session

```sql
SELECT
    span_id,
    timestamp,
    event_type,
    tool_name,
    duration_ms,
    CASE
        WHEN tool_output LIKE '%error%' THEN 'error'
        WHEN tool_output LIKE '%success%' THEN 'success'
        ELSE 'unknown'
    END as status,
    files_read,
    files_written,
    files_edited
FROM traces
WHERE session_id = ?  -- Parameter: session ID
ORDER BY timestamp ASC;
```text

#### 5. Get Cost Over Time (Daily)

```sql
SELECT
    DATE(timestamp, 'unixepoch') as date,
    COUNT(*) as event_count,
    SUM(input_tokens + output_tokens) as total_tokens,
    SUM(estimated_cost) as total_cost,
    COUNT(DISTINCT session_id) as session_count
FROM traces
WHERE timestamp >= ?  -- Parameter: start timestamp
    AND timestamp <= ?  -- Parameter: end timestamp
GROUP BY date
ORDER BY date DESC;
```text

#### 6. Get Top Expensive Tasks

```sql
SELECT
    t.task_id,
    t.task_description,
    t.duration_ms,
    t.total_cost,
    t.total_tokens,
    t.status,
    COUNT(tr.span_id) as event_count
FROM task_summary t
LEFT JOIN traces tr ON tr.task_id = t.task_id
GROUP BY t.task_id
ORDER BY t.total_cost DESC
LIMIT 10;
```text

#### 7. Get Failed Operations

```sql
SELECT
    span_id,
    timestamp,
    tool_name,
    task_id,
    tool_input,
    tool_output
FROM traces
WHERE tool_output LIKE '%error%'
    OR tool_output LIKE '%failed%'
    OR tool_output LIKE '%exception%'
ORDER BY timestamp DESC
LIMIT 50;
```text

#### 8. Get Token Efficiency (Tokens per Dollar)

```sql
SELECT
    tool_name,
    SUM(input_tokens + output_tokens) as total_tokens,
    SUM(estimated_cost) as total_cost,
    ROUND(SUM(input_tokens + output_tokens) / NULLIF(SUM(estimated_cost), 0), 2) as tokens_per_dollar,
    COUNT(*) as call_count
FROM traces
WHERE tool_name IS NOT NULL
    AND estimated_cost > 0
GROUP BY tool_name
ORDER BY tokens_per_dollar DESC;
```text

#### 9. Get Session Activity Heatmap Data

```sql
SELECT
    strftime('%H', datetime(timestamp, 'unixepoch')) as hour,
    strftime('%w', datetime(timestamp, 'unixepoch')) as day_of_week,
    COUNT(*) as activity_count
FROM traces
WHERE timestamp >= ?  -- Last 7 days
GROUP BY hour, day_of_week
ORDER BY day_of_week, hour;
```text

#### 10. Get Most Edited Files

```sql
SELECT
    json_extract(tool_input, '$.file_path') as file_path,
    COUNT(*) as edit_count,
    SUM(duration_ms) as total_time_ms,
    COUNT(DISTINCT session_id) as session_count
FROM traces
WHERE tool_name IN ('Edit', 'Write', 'MultiEdit')
    AND json_extract(tool_input, '$.file_path') IS NOT NULL
GROUP BY file_path
ORDER BY edit_count DESC
LIMIT 20;
```text

## API Endpoints for Dashboard

### REST API Design

```text
GET /api/sessions
  → List all sessions with summary

GET /api/sessions/{session_id}
  → Get session details

GET /api/sessions/{session_id}/timeline
  → Get event timeline for session

GET /api/sessions/{session_id}/metrics
  → Get aggregated metrics

GET /api/tasks/{task_id}
  → Get task details

GET /api/tasks/{task_id}/tree
  → Get task hierarchy (parent + children)

GET /api/tasks/{task_id}/traces
  → Get all trace events for task

GET /api/stats/overview
  → Get overall statistics

GET /api/stats/costs?from={timestamp}&to={timestamp}
  → Get cost breakdown

GET /api/stats/tools
  → Get tool usage statistics

GET /api/search?q={query}
  → Search traces by content

GET /api/stream (SSE)
  → Real-time trace updates
```text

### Example API Response

#### GET /api/sessions/{session_id}

```json
{
  "session_id": "abc-def-123",
  "start_time": "2024-01-31T10:00:00Z",
  "end_time": "2024-01-31T12:15:00Z",
  "duration_ms": 8100000,
  "status": "completed",
  "metrics": {
    "total_events": 42,
    "total_tokens": 45000,
    "total_cost": 3.50,
    "input_tokens": 28000,
    "output_tokens": 17000,
    "cache_read_tokens": 5000,
    "files_read": 15,
    "files_written": 3,
    "files_edited": 12,
    "error_count": 3
  },
  "tool_usage": {
    "Read": 15,
    "Edit": 12,
    "Bash": 8,
    "Task": 5,
    "Glob": 2
  },
  "tasks": [
    {
      "task_id": "NOV-100",
      "title": "Implement Authentication",
      "status": "in_progress",
      "children_count": 3
    }
  ],
  "top_files": [
    "auth/jwt.go",
    "server/routes.go",
    "auth/handler_test.go"
  ]
}
```text

## Dashboard Component Hierarchy (React)

```text
App
├── Header
│   ├── Logo
│   ├── SessionSelector
│   └── DateRangePicker
├── Sidebar
│   ├── SessionList
│   ├── Filters
│   └── QuickStats
├── MainView
│   ├── TaskTreeView (Mermaid)
│   │   ├── MermaidDiagram
│   │   ├── ZoomControls
│   │   └── NodeTooltip
│   ├── TimelineView
│   │   ├── EventList
│   │   ├── TimeRuler
│   │   └── EventDetails
│   ├── MetricsView
│   │   ├── CostChart (recharts)
│   │   ├── TokenDistribution
│   │   ├── ToolUsagePie
│   │   └── StatCards
│   └── DetailsPanel
│       ├── TaskDetails
│       ├── TraceEvents
│       └── ExportButton
└── Footer
    ├── Status
    └── Version
```text

## Mermaid Generation from Traces

### Go Code to Generate Mermaid

```go
package dashboard

import (
    "fmt"
    "strings"
)

type MermaidNode struct {
    ID          string
    Title       string
    Status      string
    Duration    string
    Cost        string
    Tokens      string
    Children    []*MermaidNode
}

func GenerateMermaidDiagram(root *MermaidNode) string {
    var sb strings.Builder

    sb.WriteString("graph TB\n")
    sb.WriteString(generateNode(root))
    generateEdges(&sb, root)
    generateStyles(&sb, root)

    return sb.String()
}

func generateNode(node *MermaidNode) string {
    icon := getStatusIcon(node.Status)
    statusEmoji := getStatusEmoji(node.Status)

    label := fmt.Sprintf(
        "%s %s: %s<br/>⏱️ %s | 💰 %s | 🔤 %s<br/>Status: %s %s",
        icon, node.ID, node.Title,
        node.Duration, node.Cost, node.Tokens,
        statusEmoji, node.Status,
    )

    return fmt.Sprintf("    %s[\"%s\"]\n", sanitizeID(node.ID), label)
}

func generateEdges(sb *strings.Builder, node *MermaidNode) {
    for _, child := range node.Children {
        sb.WriteString(fmt.Sprintf("    %s --> %s\n",
            sanitizeID(node.ID), sanitizeID(child.ID)))
        generateEdges(sb, child)
    }
}

func generateStyles(sb *strings.Builder, node *MermaidNode) {
    style := getStatusStyle(node.Status)
    sb.WriteString(fmt.Sprintf("    style %s %s\n", sanitizeID(node.ID), style))

    for _, child := range node.Children {
        generateStyles(sb, child)
    }
}

func getStatusIcon(status string) string {
    switch status {
    case "completed": return "✅"
    case "in_progress": return "🟡"
    case "failed": return "🔴"
    case "pending": return "⚪"
    default: return "📋"
    }
}

func getStatusEmoji(status string) string {
    switch status {
    case "completed": return "✅"
    case "in_progress": return "🟡"
    case "failed": return "🔴"
    case "pending": return "⚪"
    default: return "❓"
    }
}

func getStatusStyle(status string) string {
    switch status {
    case "completed":
        return "fill:#dcfce7,stroke:#22c55e,stroke-width:2px"
    case "in_progress":
        return "fill:#fef3c7,stroke:#eab308,stroke-width:2px"
    case "failed":
        return "fill:#fee2e2,stroke:#ef4444,stroke-width:2px"
    case "pending":
        return "fill:#f3f4f6,stroke:#9ca3af,stroke-width:2px"
    default:
        return "fill:#fff,stroke:#333,stroke-width:2px"
    }
}

func sanitizeID(id string) string {
    // Replace special characters for Mermaid compatibility
    return strings.ReplaceAll(id, "-", "_")
}
```text

## Real-Time Updates (Server-Sent Events)

### Go SSE Handler

```go
package api

import (
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

func (api *API) StreamTraces(w http.ResponseWriter, r *http.Request) {
    // Set SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")

    // Create channel for new traces
    traceChan := make(chan *TraceEvent, 10)
    api.subscribeToTraces(traceChan)
    defer api.unsubscribeFromTraces(traceChan)

    // Send events
    for {
        select {
        case trace := <-traceChan:
            data, _ := json.Marshal(trace)
            fmt.Fprintf(w, "event: trace\n")
            fmt.Fprintf(w, "data: %s\n\n", data)
            w.(http.Flusher).Flush()

        case <-r.Context().Done():
            return

        case <-time.After(30 * time.Second):
            // Keepalive
            fmt.Fprintf(w, ": keepalive\n\n")
            w.(http.Flusher).Flush()
        }
    }
}
```text

### React Component Using SSE

```tsx
import { useEffect, useState } from 'react';

function RealtimeTraces() {
  const [traces, setTraces] = useState<TraceEvent[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/stream');

    eventSource.addEventListener('trace', (event) => {
      const trace = JSON.parse(event.data);
      setTraces(prev => [trace, ...prev].slice(0, 100)); // Keep last 100
    });

    return () => eventSource.close();
  }, []);

  return (
    <div>
      {traces.map(trace => (
        <div key={trace.span_id}>
          {trace.tool_name} at {trace.timestamp}
        </div>
      ))}
    </div>
  );
}
```text

## Next Steps

1. Build aggregator API with these endpoints
2. Create React dashboard using these designs
3. Implement Mermaid diagram generation
4. Add real-time updates via SSE
5. Deploy and test with real workflow
