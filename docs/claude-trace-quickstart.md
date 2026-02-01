# Claude Trace System - Quick Start

## Project Structure

```
claude-trace/
├── cmd/
│   ├── claude-trace/           # Main hook binary
│   │   └── main.go
│   ├── trace-server/           # Aggregator API server
│   │   └── main.go
│   └── trace-query/            # CLI query tool
│       └── main.go
├── internal/
│   ├── hook/                   # Hook event processing
│   │   ├── parser.go
│   │   ├── processor.go
│   │   └── types.go
│   ├── storage/                # Storage backends
│   │   ├── jsonl.go
│   │   └── sqlite.go
│   ├── beads/                  # Beads integration
│   │   └── reader.go
│   ├── metrics/                # Token/cost calculation
│   │   └── calculator.go
│   └── api/                    # REST API handlers
│       ├── handlers.go
│       └── server.go
├── web/                        # Dashboard frontend (Phase 5)
│   ├── src/
│   ├── public/
│   └── package.json
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

## Phase 1: Basic Hook Implementation

### Step 1: Initialize Go Module

```bash
cd claude-trace
go mod init github.com/yourusername/claude-trace

# Add dependencies
go get github.com/google/uuid
go get github.com/mattn/go-sqlite3
```

### Step 2: Core Types (`internal/hook/types.go`)

```go
package hook

import (
    "time"
)

// HookEvent represents the raw event from Claude hooks
type HookEvent struct {
    SessionID      string                 `json:"session_id"`
    ConversationID string                 `json:"conversation_id"`
    ToolName       string                 `json:"tool_name,omitempty"`
    ToolInput      map[string]interface{} `json:"tool_input,omitempty"`
    ToolOutput     map[string]interface{} `json:"tool_output,omitempty"`
    Timestamp      string                 `json:"timestamp"`
    UserMessage    string                 `json:"user_message,omitempty"`
}

// TraceEvent is the enriched event we store
type TraceEvent struct {
    TraceID     string                 `json:"trace_id"`
    SpanID      string                 `json:"span_id"`
    ParentID    *string                `json:"parent_id,omitempty"`
    SessionID   string                 `json:"session_id"`
    TaskID      *string                `json:"task_id,omitempty"`
    TaskStatus  *string                `json:"task_status,omitempty"`
    Timestamp   time.Time              `json:"timestamp"`
    DurationMs  *int64                 `json:"duration_ms,omitempty"`
    EventType   string                 `json:"event_type"`
    HookType    string                 `json:"hook_type"`
    ToolName    *string                `json:"tool_name,omitempty"`
    ToolInput   map[string]interface{} `json:"tool_input,omitempty"`
    ToolOutput  map[string]interface{} `json:"tool_output,omitempty"`
    Metrics     Metrics                `json:"metrics"`
    Tags        map[string]string      `json:"tags"`
}

type Metrics struct {
    InputTokens      int     `json:"input_tokens,omitempty"`
    OutputTokens     int     `json:"output_tokens,omitempty"`
    CacheReadTokens  int     `json:"cache_read_tokens,omitempty"`
    CacheWriteTokens int     `json:"cache_write_tokens,omitempty"`
    EstimatedCost    float64 `json:"estimated_cost,omitempty"`
    ToolCount        int     `json:"tool_count,omitempty"`
    FilesRead        int     `json:"files_read,omitempty"`
    FilesWritten     int     `json:"files_written,omitempty"`
    FilesEdited      int     `json:"files_edited,omitempty"`
}
```

### Step 3: Hook Processor (`internal/hook/processor.go`)

```go
package hook

import (
    "os"
    "path/filepath"
    "time"

    "github.com/google/uuid"
)

type Processor struct {
    projectDir string
    sessionID  string
    traceID    string
}

func NewProcessor(projectDir, sessionID string) *Processor {
    return &Processor{
        projectDir: projectDir,
        sessionID:  sessionID,
        traceID:    getOrCreateTraceID(sessionID),
    }
}

func (p *Processor) Process(hookEvent HookEvent) (*TraceEvent, error) {
    spanID := uuid.New().String()

    timestamp, err := time.Parse(time.RFC3339, hookEvent.Timestamp)
    if err != nil {
        timestamp = time.Now()
    }

    trace := &TraceEvent{
        TraceID:   p.traceID,
        SpanID:    spanID,
        SessionID: p.sessionID,
        Timestamp: timestamp,
        EventType: determineEventType(hookEvent),
        HookType:  os.Getenv("CLAUDE_HOOK_TYPE"), // PreToolUse, PostToolUse, etc.
        Tags:      make(map[string]string),
    }

    // Add tool information if present
    if hookEvent.ToolName != "" {
        trace.ToolName = &hookEvent.ToolName
        trace.ToolInput = hookEvent.ToolInput
        trace.ToolOutput = hookEvent.ToolOutput
    }

    // Try to get Beads context
    if task := p.getCurrentTask(); task != nil {
        trace.TaskID = &task.ID
        trace.TaskStatus = &task.Status
        trace.Tags["task_title"] = task.Title
    }

    // Compute metrics
    trace.Metrics = p.computeMetrics(hookEvent)

    return trace, nil
}

func determineEventType(event HookEvent) string {
    hookType := os.Getenv("CLAUDE_HOOK_TYPE")
    switch hookType {
    case "PreToolUse":
        return "pre_tool_use"
    case "PostToolUse":
        return "post_tool_use"
    case "UserPromptSubmit":
        return "user_prompt"
    default:
        return "unknown"
    }
}

func (p *Processor) computeMetrics(event HookEvent) Metrics {
    metrics := Metrics{}

    // Count file operations based on tool
    if event.ToolName == "Read" || event.ToolName == "Glob" {
        metrics.FilesRead = 1
    } else if event.ToolName == "Write" {
        metrics.FilesWritten = 1
    } else if event.ToolName == "Edit" || event.ToolName == "MultiEdit" {
        metrics.FilesEdited = 1
    }

    // TODO: Extract token counts from LLM responses
    // This requires parsing the tool output for messages API responses

    return metrics
}

func (p *Processor) getCurrentTask() *BeadsTask {
    // Read from .beads/issues/ directory
    // Find task with status "in_progress"
    // This is simplified - see full implementation in design doc
    return nil
}

func getOrCreateTraceID(sessionID string) string {
    // Use session ID as trace ID for now
    // Later: read from state file to maintain trace ID across invocations
    return sessionID
}
```

### Step 4: Storage Writer (`internal/storage/jsonl.go`)

```go
package storage

import (
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"
    "time"

    "github.com/yourusername/claude-trace/internal/hook"
)

type JSONLWriter struct {
    baseDir string
}

func NewJSONLWriter(baseDir string) *JSONLWriter {
    return &JSONLWriter{baseDir: baseDir}
}

func (w *JSONLWriter) Write(event *hook.TraceEvent) error {
    // Ensure directory exists
    tracesDir := filepath.Join(w.baseDir, ".claude", "traces")
    if err := os.MkdirAll(tracesDir, 0755); err != nil {
        return fmt.Errorf("failed to create traces directory: %w", err)
    }

    // Use daily log files
    filename := fmt.Sprintf("traces-%s.jsonl", time.Now().Format("2006-01-02"))
    filepath := filepath.Join(tracesDir, filename)

    // Open file in append mode
    file, err := os.OpenFile(filepath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    if err != nil {
        return fmt.Errorf("failed to open trace file: %w", err)
    }
    defer file.Close()

    // Write JSON line
    data, err := json.Marshal(event)
    if err != nil {
        return fmt.Errorf("failed to marshal event: %w", err)
    }

    if _, err := file.Write(append(data, '\n')); err != nil {
        return fmt.Errorf("failed to write event: %w", err)
    }

    return nil
}
```

### Step 5: Main Hook Binary (`cmd/claude-trace/main.go`)

```go
package main

import (
    "encoding/json"
    "fmt"
    "io"
    "os"

    "github.com/yourusername/claude-trace/internal/hook"
    "github.com/yourusername/claude-trace/internal/storage"
)

func main() {
    // Get project directory from environment
    projectDir := os.Getenv("CLAUDE_PROJECT_DIR")
    if projectDir == "" {
        projectDir, _ = os.Getwd()
    }

    // Read hook event from stdin
    input, err := io.ReadAll(os.Stdin)
    if err != nil {
        fmt.Fprintf(os.Stderr, "Error reading stdin: %v\n", err)
        os.Exit(1)
    }

    // Parse hook event
    var hookEvent hook.HookEvent
    if err := json.Unmarshal(input, &hookEvent); err != nil {
        fmt.Fprintf(os.Stderr, "Error parsing hook event: %v\n", err)
        os.Exit(1)
    }

    // Process event
    processor := hook.NewProcessor(projectDir, hookEvent.SessionID)
    trace, err := processor.Process(hookEvent)
    if err != nil {
        fmt.Fprintf(os.Stderr, "Error processing event: %v\n", err)
        os.Exit(1)
    }

    // Store trace
    writer := storage.NewJSONLWriter(projectDir)
    if err := writer.Write(trace); err != nil {
        fmt.Fprintf(os.Stderr, "Error writing trace: %v\n", err)
        os.Exit(1)
    }

    // Exit successfully (non-blocking)
    os.Exit(0)
}
```

### Step 6: Build and Install

Create a `Makefile`:

```makefile
.PHONY: build install test clean

BINARY_NAME=claude-trace
INSTALL_DIR=$(HOME)/.local/bin

build:
	go build -o bin/$(BINARY_NAME) ./cmd/claude-trace

install: build
	mkdir -p $(INSTALL_DIR)
	cp bin/$(BINARY_NAME) $(INSTALL_DIR)/
	chmod +x $(INSTALL_DIR)/$(BINARY_NAME)

test:
	go test -v ./...

clean:
	rm -rf bin/
	go clean

# Development: install to project .claude/hooks
install-local: build
	mkdir -p .claude/hooks
	cp bin/$(BINARY_NAME) .claude/hooks/
	chmod +x .claude/hooks/$(BINARY_NAME)
```

Build and install:

```bash
make build
make install-local  # or: make install for global
```

### Step 7: Configure Hook

Update `.claude/settings.json`:

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
    ]
  }
}
```

### Step 8: Test It

1. Run any Claude command (e.g., ask Claude to read a file)
2. Check for trace files:

```bash
ls -la .claude/traces/
cat .claude/traces/traces-2024-01-31.jsonl | jq
```

Expected output:
```json
{
  "trace_id": "abc123",
  "span_id": "span-1",
  "session_id": "abc123",
  "timestamp": "2024-01-31T10:00:00Z",
  "event_type": "pre_tool_use",
  "hook_type": "PreToolUse",
  "tool_name": "Read",
  "tool_input": {
    "file_path": "/path/to/file.txt"
  },
  "metrics": {
    "files_read": 1
  },
  "tags": {}
}
```

## Phase 2: Query Tool (CLI)

Create a simple CLI to query traces:

```go
// cmd/trace-query/main.go
package main

import (
    "bufio"
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"

    "github.com/spf13/cobra"
    "github.com/yourusername/claude-trace/internal/hook"
)

func main() {
    rootCmd := &cobra.Command{
        Use:   "trace-query",
        Short: "Query Claude trace data",
    }

    // List sessions
    listCmd := &cobra.Command{
        Use:   "sessions",
        Short: "List all sessions",
        Run:   listSessions,
    }

    // Show session details
    showCmd := &cobra.Command{
        Use:   "show [session-id]",
        Short: "Show session details",
        Args:  cobra.ExactArgs(1),
        Run:   showSession,
    }

    // Stats
    statsCmd := &cobra.Command{
        Use:   "stats",
        Short: "Show overall statistics",
        Run:   showStats,
    }

    rootCmd.AddCommand(listCmd, showCmd, statsCmd)
    rootCmd.Execute()
}

func listSessions(cmd *cobra.Command, args []string) {
    tracesDir := filepath.Join(".claude", "traces")

    sessions := make(map[string]int)

    files, _ := filepath.Glob(filepath.Join(tracesDir, "*.jsonl"))
    for _, file := range files {
        f, _ := os.Open(file)
        defer f.Close()

        scanner := bufio.NewScanner(f)
        for scanner.Scan() {
            var event hook.TraceEvent
            if json.Unmarshal(scanner.Bytes(), &event) == nil {
                sessions[event.SessionID]++
            }
        }
    }

    fmt.Println("Sessions:")
    for sessionID, count := range sessions {
        fmt.Printf("  %s: %d events\n", sessionID, count)
    }
}

func showSession(cmd *cobra.Command, args []string) {
    sessionID := args[0]
    tracesDir := filepath.Join(".claude", "traces")

    files, _ := filepath.Glob(filepath.Join(tracesDir, "*.jsonl"))
    for _, file := range files {
        f, _ := os.Open(file)
        defer f.Close()

        scanner := bufio.NewScanner(f)
        for scanner.Scan() {
            var event hook.TraceEvent
            if json.Unmarshal(scanner.Bytes(), &event) == nil {
                if event.SessionID == sessionID {
                    data, _ := json.MarshalIndent(event, "", "  ")
                    fmt.Println(string(data))
                }
            }
        }
    }
}

func showStats(cmd *cobra.Command, args []string) {
    tracesDir := filepath.Join(".claude", "traces")

    totalEvents := 0
    toolCounts := make(map[string]int)

    files, _ := filepath.Glob(filepath.Join(tracesDir, "*.jsonl"))
    for _, file := range files {
        f, _ := os.Open(file)
        defer f.Close()

        scanner := bufio.NewScanner(f)
        for scanner.Scan() {
            var event hook.TraceEvent
            if json.Unmarshal(scanner.Bytes(), &event) == nil {
                totalEvents++
                if event.ToolName != nil {
                    toolCounts[*event.ToolName]++
                }
            }
        }
    }

    fmt.Printf("Total events: %d\n", totalEvents)
    fmt.Println("\nTool usage:")
    for tool, count := range toolCounts {
        fmt.Printf("  %s: %d\n", tool, count)
    }
}
```

## Next Steps After Phase 1

1. **Add Beads integration** to link traces with tasks
2. **Implement SQLite indexing** for faster queries
3. **Build aggregator API** for dashboard
4. **Create dashboard frontend** with Mermaid diagrams
5. **Add real-time updates** via Server-Sent Events

## Development Tips

### Debugging Hooks

Add verbose logging:

```go
// Enable debug mode via environment variable
if os.Getenv("CLAUDE_TRACE_DEBUG") == "1" {
    logFile, _ := os.OpenFile("/tmp/claude-trace.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    defer logFile.Close()

    fmt.Fprintf(logFile, "[%s] Hook event: %+v\n", time.Now(), hookEvent)
}
```

### Testing Without Claude

Create test input files:

```bash
# test-input.json
{
  "session_id": "test-session-123",
  "tool_name": "Read",
  "tool_input": {
    "file_path": "/path/to/file.txt"
  },
  "timestamp": "2024-01-31T10:00:00Z"
}

# Test the hook
cat test-input.json | CLAUDE_HOOK_TYPE=PreToolUse ./bin/claude-trace
```

### Performance Monitoring

Add timing:

```go
start := time.Now()
defer func() {
    duration := time.Since(start)
    if duration > 100*time.Millisecond {
        fmt.Fprintf(os.Stderr, "WARN: Hook took %v\n", duration)
    }
}()
```

## Common Issues

### Hook Not Triggering

- Check hook file is executable: `chmod +x .claude/hooks/claude-trace`
- Verify path in settings.json is correct
- Check Claude logs: Look for hook errors

### Permission Errors

- Ensure `.claude/traces/` directory is writable
- Check file permissions: `ls -la .claude/traces/`

### JSON Parsing Errors

- Add error logging to see what stdin contains
- Use `jq` to validate JSON: `cat test-input.json | jq`

## Resources

- Full design doc: `docs/claude-trace-system.md`
- Example hook: https://github.com/Dicklesworthstone/destructive_command_guard
- Claude hooks docs: https://code.claude.com/docs/en/hooks
