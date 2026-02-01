# Nova Unified Architecture - Trace & Orchestration

**Version:** 1.0
**Status:** Draft
**Last Updated:** 2026-01-31

## Overview

Nova is a single Go CLI that provides both **observability** and **orchestration** for Claude-based task automation. All functionality is provided through subcommands of the unified `nova-go` binary.

**Key Principle:** The `hook` command captures *what happens* during execution; the `implement` command controls *what should happen* and orchestrates the execution flow; the `serve` command provides analytics and querying.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
         nova-go implement --spec task.md
                 │
    ┌────────────┴────────────┐
    │  Nova-Go Implement CMD  │
    │  (Recursive Execution)  │
    └────────────┬────────────┘
                 │
         ┌───────┼───────────────────┐
         │       │                   │
         ▼       ▼                   ▼
    ┌────────┐ ┌──────────┐   ┌──────────┐
    │  BAML  │ │  Beads   │   │  Claude  │
    │ (LLM)  │ │   CLI    │   │   CLI    │
    └────────┘ └──────────┘   └────┬─────┘
         │          │               │
         │          │               │ (hooks triggered)
         │          │               ▼
         │          │       ┌────────────────┐
         │          │       │  nova-go trace │
         │          │       │ (Hook Handler) │
         │          │       └───────┬────────┘
         │          │               │
         │          │               ▼
         └──────────┴───────► Unified Trace Events
                              (JSONL storage)
```

### Data Flow

1. **User Input** → nova-go receives spec
2. **Planning** → BAML decomposes into subtasks
3. **Task Creation** → Beads CLI creates task hierarchy
4. **Sizing** → BAML sizes each task (only XS is executable)
5. **Execution** → Claude CLI runs XS tasks in yolo mode
   - **nova-trace hooks capture every tool call** (Read, Write, Edit, Bash, etc.)
6. **Verification** → BAML verifies completion using execution logs + trace data
7. **Status Update** → Beads CLI marks tasks complete
8. **Trace Storage** → All events (orchestration + tool usage) written to unified JSONL

---

## Project Structure

```
nova/
├── cmd/
│   └── nova-go/                 # Single unified CLI
│       ├── main.go              # Root command and CLI setup
│       ├── trace.go             # 'trace' subcommand (Claude Code hook handler)
│       ├── implement.go         # 'implement' subcommand (orchestrator)
│       └── serve.go             # 'serve' subcommand (trace HTTP server)
│
├── internal/
│   ├── trace/                   # 🔥 SHARED: Core trace system
│   │   ├── events.go            # Event type definitions
│   │   ├── writer.go            # JSONL storage with daily rotation
│   │   ├── enricher.go          # Context enrichment (Beads, metrics)
│   │   ├── types.go             # TraceEvent model
│   │   └── events_test.go
│   │
│   ├── beads/                   # 🔥 SHARED: Beads integration
│   │   ├── reader.go            # Read task state from .beads/
│   │   ├── cli.go               # Shell adapter (bd commands)
│   │   ├── types.go             # BeadsTask model
│   │   └── reader_test.go
│   │
│   ├── hook/                    # nova-trace specific
│   │   ├── parser.go            # Parse hook stdin (HookInput)
│   │   ├── handler.go           # Hook event handler
│   │   ├── types.go             # Hook I/O types
│   │   └── parser_test.go
│   │
│   ├── server/                  # nova-go serve specific
│   │   ├── server.go            # HTTP server setup
│   │   ├── handlers.go          # REST API handlers
│   │   ├── sse.go               # Server-Sent Events streaming
│   │   ├── aggregator.go        # Trace aggregation logic
│   │   ├── storage.go           # SQLite storage layer
│   │   └── server_test.go
│   │
│   ├── engine/                  # nova-go implement specific
│   │   ├── engine.go            # Orchestration logic
│   │   ├── planner.go           # Recursive task decomposition
│   │   ├── sizing.go            # Task sizing with BAML
│   │   ├── executor.go          # Execution coordination
│   │   ├── types.go             # Task, Run, Constraints
│   │   └── engine_test.go
│   │
│   ├── executor/                # nova-go implement specific
│   │   ├── claude.go            # Claude CLI execution
│   │   ├── verifier.go          # Task verification with BAML
│   │   └── claude_test.go
│   │
│   ├── llm/                     # nova-go implement specific
│   │   ├── baml_client.go       # BAML wrapper
│   │   └── baml_client_test.go
│   │
│   └── metrics/                 # 🔥 SHARED: Metrics calculation
│       ├── calculator.go        # Token counting, cost estimation
│       ├── pricing.go           # Model pricing tables
│       └── calculator_test.go
│
├── baml_src/                    # BAML definitions (nova-go)
│   ├── functions.baml           # PlanTask, SizeTask, VerifyTaskComplete
│   ├── types.baml               # TaskSize, Plan, SizeResult, etc.
│   ├── clients.baml             # Anthropic Sonnet/Haiku clients
│   └── generators.baml          # Go code generation config
│
├── baml_client/                 # Generated BAML Go client (gitignored)
│   └── (generated code)
│
├── scripts/
│   ├── baml-generate.sh         # Run BAML code generation
│   └── install-hooks.sh         # Install nova-trace to .claude/hooks
│
├── .claude/
│   ├── settings.json            # Hook configuration
│   └── hooks/
│       └── nova-trace           # Installed hook binary
│
├── runs/                        # Run artifacts (gitignored)
│   └── <run-id>/
│       ├── trace.jsonl          # Unified trace events
│       └── run.json             # Run summary
│
├── go.mod
├── go.sum
├── Makefile
├── .golangci.yml             # Linter configuration
├── .pre-commit-config.yaml
├── .gitignore
└── README.md
```

### Linter Configuration

**File:** `.golangci.yml`

```yaml
# golangci-lint configuration for Nova
# See: https://golangci-lint.run/usage/configuration/

run:
  timeout: 5m
  tests: true
  build-tags: []

linters:
  enable:
    # Default linters
    - errcheck      # Check for unchecked errors
    - gosimple      # Simplify code
    - govet         # Go vet
    - ineffassign   # Detect ineffectual assignments
    - staticcheck   # Static analysis
    - typecheck     # Type checking (like go build)
    - unused        # Detect unused code

    # Additional recommended linters
    - gofmt         # Check formatting
    - goimports     # Check import formatting
    - gocritic      # Comprehensive code checks
    - misspell      # Spelling
    - revive        # Fast, extensible linter
    - gosec         # Security issues
    - bodyclose     # HTTP response body closure
    - noctx         # HTTP requests without context
    - sqlclosecheck # SQL rows/statements not closed

linters-settings:
  errcheck:
    check-type-assertions: true
    check-blank: true

  govet:
    enable-all: true

  gofmt:
    simplify: true

  gocritic:
    enabled-tags:
      - diagnostic
      - style
      - performance

  revive:
    confidence: 0.8

issues:
  exclude-rules:
    # Exclude some linters from running on test files
    - path: _test\.go
      linters:
        - errcheck
        - gosec

    # Exclude BAML generated code
    - path: baml_client/
      linters:
        - all

  max-issues-per-linter: 0
  max-same-issues: 0
```

### Directory Responsibilities

| Directory | Purpose | Used By |
|-----------|---------|---------|
| `internal/trace/` | Trace event model, storage | All |
| `internal/beads/` | Beads CLI integration | All |
| `internal/metrics/` | Token/cost calculation | All |
| `internal/hook/` | Hook input parsing | nova-trace only |
| `internal/server/` | HTTP API, SSE, aggregation | nova-go serve |
| `internal/engine/` | Task orchestration | nova-go implement |
| `internal/executor/` | Claude CLI execution | nova-go implement |
| `internal/llm/` | BAML client wrapper | nova-go implement |
| `baml_src/` | BAML definitions | nova-go implement |

### Key Dependencies

**go.mod:**
```go
module github.com/yourusername/nova

go 1.22

require (
    github.com/google/uuid v1.6.0           // Trace/span ID generation
    github.com/spf13/cobra v1.8.0           // Multi-command CLI
    // BAML generated client dependencies (added by baml-cli generate)
)
```

**External Tools:**
- `baml-cli` - BAML code generation
- `bd` (Beads CLI) - Task management
- `claude` (Claude Code CLI) - Task execution
- `golangci-lint` - Go linter (install: `go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest`)

---

## Unified Trace Event Model

Both binaries write to the same trace format, enabling correlation across orchestration and execution layers.

### Core Event Structure

```go
// internal/trace/types.go
type TraceEvent struct {
    // Distributed tracing identifiers
    SessionID    string  `json:"session_id"`              // Claude session or run ID
    TraceID      string  `json:"trace_id"`                // Root trace ID (run ID)
    SpanID       string  `json:"span_id"`                 // Unique span ID
    ParentSpanID *string `json:"parent_span_id,omitempty"` // Parent span for nesting
    Timestamp    string  `json:"timestamp"`               // RFC3339 format

    // Event classification
    EventType    string  `json:"event_type"`              // "tool_use", "orchestration", "llm_call"
    EventName    string  `json:"event_name"`              // Specific event name

    // Tool execution context (from nova-trace)
    ToolName     *string                `json:"tool_name,omitempty"`
    ToolInput    map[string]interface{} `json:"tool_input,omitempty"`
    ToolOutput   map[string]interface{} `json:"tool_output,omitempty"`
    ToolUseID    *string                `json:"tool_use_id,omitempty"`
    HookType     string                 `json:"hook_type,omitempty"` // PreToolUse, PostToolUse

    // Orchestration context (from nova-go)
    RunID        *string `json:"run_id,omitempty"`        // nova-go run ID
    TaskID       *string `json:"task_id,omitempty"`       // Beads task ID (bd-xxx)
    TaskTitle    *string `json:"task_title,omitempty"`    // Human-readable task title
    TaskSize     *string `json:"task_size,omitempty"`     // XS, S, M, L, XL
    TaskStatus   *string `json:"task_status,omitempty"`   // pending, in_progress, completed, failed
    Phase        *string `json:"phase,omitempty"`         // planning, sizing, execution, verification

    // LLM call context (from nova-go)
    Model        *string `json:"model,omitempty"`         // sonnet, haiku, opus
    PromptType   *string `json:"prompt_type,omitempty"`   // plan, size, verify

    // Execution metadata
    ExitCode     *int    `json:"exit_code,omitempty"`     // Process exit code
    ErrorMessage *string `json:"error_message,omitempty"` // Error details

    // Metrics
    Metrics      Metrics `json:"metrics"`

    // Extensibility
    Tags         map[string]string      `json:"tags"`
    Metadata     map[string]interface{} `json:"metadata"`
}

type Metrics struct {
    // File operations (from nova-trace)
    FilesRead       int `json:"files_read,omitempty"`
    FilesWritten    int `json:"files_written,omitempty"`
    FilesEdited     int `json:"files_edited,omitempty"`

    // LLM usage (from nova-go BAML calls)
    InputTokens     int     `json:"input_tokens,omitempty"`
    OutputTokens    int     `json:"output_tokens,omitempty"`
    CostUSD         float64 `json:"cost_usd,omitempty"`

    // Execution timing
    DurationMs      int `json:"duration_ms,omitempty"`

    // Retry tracking
    RetryCount      int `json:"retry_count,omitempty"`

    // Task metrics (from nova-go)
    SubtasksCreated int `json:"subtasks_created,omitempty"`
}
```

### Event Types & Names

| EventType | EventName | Source | Description |
|-----------|-----------|--------|-------------|
| `tool_use` | `PreToolUse` | nova-trace | Before tool execution |
| `tool_use` | `PostToolUse` | nova-trace | After tool execution |
| `orchestration` | `RunStarted` | nova-go | Run begins |
| `orchestration` | `RunCompleted` | nova-go | Run finishes |
| `orchestration` | `TaskCreated` | nova-go | Beads task created |
| `orchestration` | `TaskPlanned` | nova-go | Task decomposed |
| `orchestration` | `TaskSized` | nova-go | Task sizing complete |
| `orchestration` | `TaskExecutionStarted` | nova-go | Leaf task execution begins |
| `orchestration` | `TaskExecutionCompleted` | nova-go | Leaf task execution ends |
| `orchestration` | `TaskVerified` | nova-go | Verification complete |
| `orchestration` | `TaskSucceeded` | nova-go | Task marked complete |
| `orchestration` | `TaskFailed` | nova-go | Task failed |
| `orchestration` | `TaskRetried` | nova-go | Retry attempt |
| `llm_call` | `PlanTask` | nova-go | BAML planning call |
| `llm_call` | `SizeTask` | nova-go | BAML sizing call |
| `llm_call` | `VerifyTask` | nova-go | BAML verification call |

---

## Event Examples

### 1. Orchestration Event (nova-go)

nova-go emits when planning a task:

```json
{
  "session_id": "run-20260131-abc123",
  "trace_id": "run-20260131-abc123",
  "span_id": "span-001",
  "timestamp": "2026-01-31T10:15:25.123Z",
  "event_type": "orchestration",
  "event_name": "TaskPlanned",
  "run_id": "run-20260131-abc123",
  "task_id": "bd-abc",
  "task_title": "Implement user authentication",
  "task_size": "M",
  "phase": "planning",
  "metrics": {
    "subtasks_created": 3,
    "duration_ms": 2500
  },
  "metadata": {
    "subtask_ids": ["bd-def", "bd-ghi", "bd-jkl"],
    "decomposition_depth": 2
  }
}
```

### 2. LLM Call Event (nova-go)

nova-go emits for BAML calls:

```json
{
  "session_id": "run-20260131-abc123",
  "trace_id": "run-20260131-abc123",
  "span_id": "span-002",
  "parent_span_id": "span-001",
  "timestamp": "2026-01-31T10:15:26.456Z",
  "event_type": "llm_call",
  "event_name": "SizeTask",
  "run_id": "run-20260131-abc123",
  "task_id": "bd-def",
  "model": "sonnet",
  "prompt_type": "size",
  "phase": "sizing",
  "metrics": {
    "input_tokens": 1500,
    "output_tokens": 200,
    "cost_usd": 0.0051,
    "duration_ms": 1200
  },
  "metadata": {
    "size_result": "XS",
    "confidence": "high"
  }
}
```

### 3. Execution Started Event (nova-go)

nova-go emits when starting Claude CLI execution:

```json
{
  "session_id": "claude-session-xyz",
  "trace_id": "run-20260131-abc123",
  "span_id": "span-003",
  "parent_span_id": "span-001",
  "timestamp": "2026-01-31T10:16:00.000Z",
  "event_type": "orchestration",
  "event_name": "TaskExecutionStarted",
  "run_id": "run-20260131-abc123",
  "task_id": "bd-def",
  "task_title": "Add login form component",
  "task_size": "XS",
  "task_status": "in_progress",
  "phase": "execution",
  "metadata": {
    "claude_command": "claude --dangerously-skip-permissions -p 'Add login form...'",
    "execution_mode": "yolo",
    "linked_session": "claude-session-xyz"
  }
}
```

### 4. Tool Usage Event (nova-trace)

nova-trace hooks capture during Claude CLI execution:

```json
{
  "session_id": "claude-session-xyz",
  "trace_id": "claude-session-xyz",
  "span_id": "span-tool-001",
  "timestamp": "2026-01-31T10:16:15.789Z",
  "event_type": "tool_use",
  "event_name": "PostToolUse",
  "hook_type": "PostToolUse",
  "tool_name": "Write",
  "tool_use_id": "toolu_123",
  "tool_input": {
    "file_path": "src/components/LoginForm.tsx",
    "content": "..."
  },
  "tool_output": {
    "success": true,
    "bytes_written": 1234
  },
  "task_id": "bd-def",
  "task_status": "in_progress",
  "metrics": {
    "files_written": 1,
    "duration_ms": 45
  },
  "tags": {
    "file_type": "tsx",
    "component_type": "form"
  }
}
```

### 5. Verification Event (nova-go)

nova-go emits after BAML verification:

```json
{
  "session_id": "run-20260131-abc123",
  "trace_id": "run-20260131-abc123",
  "span_id": "span-004",
  "parent_span_id": "span-003",
  "timestamp": "2026-01-31T10:17:30.000Z",
  "event_type": "orchestration",
  "event_name": "TaskVerified",
  "run_id": "run-20260131-abc123",
  "task_id": "bd-def",
  "phase": "verification",
  "model": "sonnet",
  "prompt_type": "verify",
  "metrics": {
    "input_tokens": 2000,
    "output_tokens": 300,
    "cost_usd": 0.0069,
    "duration_ms": 1500
  },
  "metadata": {
    "is_complete": true,
    "files_checked": ["src/components/LoginForm.tsx"],
    "missing_items": []
  }
}
```

### 6. Task Success Event (nova-go)

nova-go emits when marking task complete:

```json
{
  "session_id": "run-20260131-abc123",
  "trace_id": "run-20260131-abc123",
  "span_id": "span-005",
  "parent_span_id": "span-003",
  "timestamp": "2026-01-31T10:17:31.000Z",
  "event_type": "orchestration",
  "event_name": "TaskSucceeded",
  "run_id": "run-20260131-abc123",
  "task_id": "bd-def",
  "task_status": "completed",
  "phase": "execution",
  "metadata": {
    "beads_update": "bd update bd-def --status completed",
    "total_duration_ms": 91000
  }
}
```

---

## Integration Points

### 1. nova-go CLI Structure

**File:** `cmd/nova-go/main.go`

```go
package main

import (
    "os"
    "github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
    Use:   "nova-go",
    Short: "Nova orchestration and trace management CLI",
    Long:  `Nova provides task orchestration with recursive decomposition and comprehensive trace observability.`,
}

func main() {
    if err := rootCmd.Execute(); err != nil {
        os.Exit(1)
    }
}

func init() {
    // Register subcommands
    rootCmd.AddCommand(traceCmd)      // Hook handler (reads stdin)
    rootCmd.AddCommand(implementCmd)  // Orchestrator
    rootCmd.AddCommand(serveCmd)      // HTTP server
}
```

**File:** `cmd/nova-go/implement.go`

```go
package main

import (
    "context"
    "fmt"
    "os"

    "github.com/spf13/cobra"
    "github.com/yourusername/nova/internal/engine"
)

var implementCmd = &cobra.Command{
    Use:   "implement",
    Short: "Implement a task from specification",
    Long:  `Recursively decompose and execute a task specification using Claude and BAML.`,
    RunE:  runImplement,
}

var (
    specFile string
    runDir   string
)

func init() {
    implementCmd.Flags().StringVar(&specFile, "spec", "", "Path to task specification file (required)")
    implementCmd.Flags().StringVar(&runDir, "run-dir", "./runs", "Directory for run artifacts")
    implementCmd.MarkFlagRequired("spec")
}

func runImplement(cmd *cobra.Command, args []string) error {
    ctx := context.Background()

    // Read spec
    spec, err := os.ReadFile(specFile)
    if err != nil {
        return fmt.Errorf("read spec: %w", err)
    }

    // Create and run engine
    eng := engine.New(engine.Config{
        RunDir: runDir,
    })

    return eng.Run(ctx, string(spec))
}
```

**File:** `cmd/nova-go/serve.go`

```go
package main

import (
    "context"
    "fmt"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/spf13/cobra"
    "github.com/yourusername/nova/internal/server"
)

var serveCmd = &cobra.Command{
    Use:   "serve",
    Short: "Start the trace aggregation server",
    Long:  `Run HTTP server with REST API and SSE streaming for trace queries and real-time updates.`,
    RunE:  runServe,
}

var (
    port       int
    traceDir   string
    dbPath     string
    enableCORS bool
)

func init() {
    serveCmd.Flags().IntVar(&port, "port", 8080, "HTTP server port")
    serveCmd.Flags().StringVar(&traceDir, "trace-dir", "~/.claude/traces", "Directory containing trace JSONL files")
    serveCmd.Flags().StringVar(&dbPath, "db", "./.claude/traces/traces.db", "SQLite database path")
    serveCmd.Flags().BoolVar(&enableCORS, "cors", false, "Enable CORS for frontend development")
}

func runServe(cmd *cobra.Command, args []string) error {
    ctx := context.Background()

    // Create server
    srv, err := server.New(server.Config{
        Port:       port,
        TraceDir:   traceDir,
        DBPath:     dbPath,
        EnableCORS: enableCORS,
    })
    if err != nil {
        return fmt.Errorf("create server: %w", err)
    }

    // Start server in background
    errChan := make(chan error, 1)
    go func() {
        fmt.Printf("Starting trace server on http://localhost:%d\n", port)
        fmt.Println("Endpoints:")
        fmt.Println("  GET /api/traces")
        fmt.Println("  GET /api/tasks/:task_id")
        fmt.Println("  GET /api/sessions/:session_id/summary")
        fmt.Println("  GET /api/stream (SSE)")
        fmt.Println("\nPress Ctrl+C to stop")
        errChan <- srv.Start(ctx)
    }()

    // Handle graceful shutdown
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

    select {
    case err := <-errChan:
        return fmt.Errorf("server error: %w", err)
    case <-sigChan:
        fmt.Println("\nShutting down server...")
        ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
        defer cancel()
        return srv.Shutdown(ctx)
    }
}
```

### 2. nova-go Engine Layer

**File:** `internal/engine/engine.go`

```go
package engine

import (
    "context"
    "github.com/yourusername/nova/internal/trace"
    "github.com/yourusername/nova/internal/beads"
)

type Engine struct {
    tracer   *trace.Writer
    beads    *beads.Client
    executor *Executor
    runID    string
}

func (e *Engine) Run(ctx context.Context, spec string) error {
    // Emit run started
    e.tracer.LogEvent(&trace.TraceEvent{
        SessionID: e.runID,
        TraceID:   e.runID,
        SpanID:    uuid.New().String(),
        EventType: "orchestration",
        EventName: "RunStarted",
        RunID:     &e.runID,
        Metadata: map[string]interface{}{
            "spec": spec,
        },
    })

    // Create root task via Beads
    rootTaskID, err := e.beads.CreateTask("Root Task", spec, nil, nil)
    if err != nil {
        return err
    }

    // Plan and execute recursively
    return e.planAndExecute(ctx, rootTaskID)
}

func (e *Engine) ExecuteTask(ctx context.Context, taskID string) error {
    task, err := e.beads.GetTask(taskID)
    if err != nil {
        return err
    }

    // Emit execution started
    spanID := uuid.New().String()
    e.tracer.LogEvent(&trace.TraceEvent{
        SessionID: e.runID,
        TraceID:   e.runID,
        SpanID:    spanID,
        EventType: "orchestration",
        EventName: "TaskExecutionStarted",
        RunID:     &e.runID,
        TaskID:    &taskID,
        TaskSize:  &task.Size,
        Phase:     ptr("execution"),
    })

    // Execute via Claude CLI (nova-trace hooks capture tool usage)
    claudeSession, output, err := e.executor.ExecuteClaude(ctx, task)

    // Emit execution completed
    e.tracer.LogEvent(&trace.TraceEvent{
        SessionID: e.runID,
        TraceID:   e.runID,
        SpanID:    spanID,
        EventType: "orchestration",
        EventName: "TaskExecutionCompleted",
        TaskID:    &taskID,
        Metadata: map[string]interface{}{
            "linked_session": claudeSession,
            "output_length":  len(output),
        },
    })

    return err
}
```

### 3. nova-go trace (Hook Handler)

**File:** `cmd/nova-go/trace.go`

```go
package main

import (
    "context"
    "os"
    "time"

    "github.com/spf13/cobra"
    "github.com/yourusername/nova/internal/hook"
    "github.com/yourusername/nova/internal/trace"
)

var traceCmd = &cobra.Command{
    Use:   "trace",
    Short: "Process Claude Code hook events",
    Long:  `Handle hook events from Claude Code and write trace data to JSONL.
This command is called by Claude Code hooks (PreToolUse, PostToolUse).`,
    RunE:  runTrace,
}

func runTrace(cmd *cobra.Command, args []string) error {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    // Parse hook input from stdin
    input, err := hook.ParseInput(os.Stdin)
    if err != nil {
        // Never fail the hook
        return nil
    }

    // Build trace event
    builder := trace.NewBuilder()
    event, err := builder.Build(ctx, input)
    if err != nil {
        return nil
    }

    // Write to unified trace storage
    writer := trace.NewWriter()
    writer.Write(ctx, event)

    return nil // Always succeed for observability hooks
}
```

### 4. Shared Trace Writer

**File:** `internal/trace/writer.go`

```go
package trace

import (
    "context"
    "encoding/json"
    "os"
    "path/filepath"
    "time"
)

type Writer struct {
    baseDir string
    runID   string // Optional: for nova-go runs
}

func NewWriter(opts ...WriterOption) *Writer {
    w := &Writer{
        baseDir: getDefaultTraceDir(),
    }
    for _, opt := range opts {
        opt(w)
    }
    return w
}

func (w *Writer) Write(ctx context.Context, event *TraceEvent) error {
    // Determine output path
    var filePath string
    if w.runID != "" {
        // nova-go: write to runs/<run-id>/trace.jsonl
        filePath = filepath.Join("runs", w.runID, "trace.jsonl")
    } else {
        // nova-trace: write to ~/.claude/traces/traces-YYYY-MM-DD.jsonl
        filename := fmt.Sprintf("traces-%s.jsonl", time.Now().Format("2006-01-02"))
        filePath = filepath.Join(w.baseDir, filename)
    }

    // Ensure directory exists
    if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
        return err
    }

    // Append to JSONL
    file, err := os.OpenFile(filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
    if err != nil {
        return err
    }
    defer file.Close()

    return json.NewEncoder(file).Encode(event)
}

func (w *Writer) LogEvent(event *TraceEvent) error {
    return w.Write(context.Background(), event)
}
```

### 5. Shared Beads Integration

**File:** `internal/beads/reader.go`

```go
package beads

import (
    "context"
    "encoding/json"
    "os"
    "path/filepath"
)

type Reader struct{}

func NewReader() *Reader {
    return &Reader{}
}

// GetCurrentTask finds the most recently updated in_progress task
// Used by nova-trace to enrich hook events with task context
func (r *Reader) GetCurrentTask(ctx context.Context, projectDir string) (*Task, error) {
    issuesDir := filepath.Join(projectDir, ".beads", "issues")

    // Check if .beads directory exists
    if _, err := os.Stat(issuesDir); os.IsNotExist(err) {
        return nil, nil
    }

    // Find most recent in_progress task
    entries, err := os.ReadDir(issuesDir)
    if err != nil {
        return nil, err
    }

    var currentTask *Task
    var latestTime time.Time

    for _, entry := range entries {
        if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
            continue
        }

        data, _ := os.ReadFile(filepath.Join(issuesDir, entry.Name()))
        var task Task
        if json.Unmarshal(data, &task) != nil {
            continue
        }

        if task.Status == "in_progress" {
            updatedAt, _ := time.Parse(time.RFC3339, task.UpdatedAt)
            if currentTask == nil || updatedAt.After(latestTime) {
                currentTask = &task
                latestTime = updatedAt
            }
        }
    }

    return currentTask, nil
}
```

**File:** `internal/beads/cli.go`

```go
package beads

import (
    "context"
    "encoding/json"
    "os/exec"
)

type Client struct{}

func NewClient() *Client {
    return &Client{}
}

// CreateTask creates a new Beads task via bd CLI
// Used by nova-go for task tree creation
func (c *Client) CreateTask(ctx context.Context, title, description string, parentID *string, deps []string) (string, error) {
    args := []string{"create", title, "--description", description, "--json"}
    if parentID != nil {
        args = append(args, "--parent", *parentID)
    }

    cmd := exec.CommandContext(ctx, "bd", args...)
    output, err := cmd.CombinedOutput()
    if err != nil {
        return "", err
    }

    var result struct {
        ID string `json:"id"`
    }
    if err := json.Unmarshal(output, &result); err != nil {
        return "", err
    }

    // Add dependencies
    for _, dep := range deps {
        if err := c.AddDependency(ctx, result.ID, dep); err != nil {
            return "", err
        }
    }

    return result.ID, nil
}

func (c *Client) UpdateStatus(ctx context.Context, taskID, status string) error {
    cmd := exec.CommandContext(ctx, "bd", "update", taskID, "--status", status)
    return cmd.Run()
}

func (c *Client) AddDependency(ctx context.Context, blocked, blocker string) error {
    cmd := exec.CommandContext(ctx, "bd", "dep", "add", blocked, blocker)
    return cmd.Run()
}

func (c *Client) GetReadyTasks(ctx context.Context, parentID *string) ([]string, error) {
    args := []string{"ready", "--json"}
    if parentID != nil {
        args = append(args, "--parent", *parentID)
    }

    cmd := exec.CommandContext(ctx, "bd", args...)
    output, err := cmd.CombinedOutput()
    if err != nil {
        return nil, err
    }

    var tasks []struct {
        ID string `json:"id"`
    }
    if err := json.Unmarshal(output, &tasks); err != nil {
        return nil, err
    }

    ids := make([]string, len(tasks))
    for i, t := range tasks {
        ids[i] = t.ID
    }
    return ids, nil
}
```

---

## Configuration

### Hook Configuration

**File:** `.claude/settings.json`

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "nova-go trace"
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
            "command": "nova-go trace"
          }
        ]
      }
    ]
  }
}
```

**Note:** Assumes `nova-go` is in your PATH. Alternatively, use absolute path:
```json
"command": "/usr/local/bin/nova-go trace"
```

### Environment Variables

| Variable | Purpose | Default | Used By |
|----------|---------|---------|---------|
| `CLAUDE_TRACE_DIR` | Base directory for traces | `~/.claude/traces` | nova-trace |
| `CLAUDE_TRACE_DEBUG` | Enable debug logging | `false` | nova-trace |
| `CLAUDE_PROJECT_DIR` | Project root | Set by Claude | Both |
| `NOVA_RUN_DIR` | Run artifacts directory | `./runs` | nova-go |
| `ANTHROPIC_API_KEY` | API key for BAML | (required) | nova-go |

---

## Build & Installation

### Makefile

```makefile
.PHONY: build baml-generate check test test-coverage lint fmt clean install

# Generate BAML client and build binary
build: baml-generate
	@echo "→ Building nova-go..."
	go build -o bin/nova-go ./cmd/nova-go
	@echo "✓ Build complete"

# BAML code generation
baml-generate:
	@echo "→ Generating BAML client..."
	baml-cli generate
	go fmt ./baml_client/...
	@echo "✓ BAML client generated"

# Type checking and static analysis
check: baml-generate
	@echo "→ Running type checker..."
	go build -o /dev/null ./cmd/nova-go
	@echo "→ Running static analysis..."
	go vet ./...
	@echo "→ Running linter..."
	golangci-lint run ./...
	@echo "✓ All checks passed"

# Testing
test:
	@echo "→ Running tests..."
	go test -v -race ./...

test-coverage:
	@echo "→ Running tests with coverage..."
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "✓ Coverage report: coverage.html"

# Linting
lint:
	@echo "→ Running linter..."
	golangci-lint run ./...

# Format code
fmt:
	@echo "→ Formatting code..."
	go fmt ./...
	@echo "✓ Code formatted"

# Check formatting without modifying
fmt-check:
	@echo "→ Checking formatting..."
	@test -z "$$(gofmt -l .)" || (echo "Files need formatting:" && gofmt -l . && exit 1)
	@echo "✓ All files properly formatted"

# Clean build artifacts
clean:
	@echo "→ Cleaning build artifacts..."
	rm -rf bin/
	rm -rf baml_client/
	rm -rf runs/
	rm -f coverage.out coverage.html
	@echo "✓ Clean complete"

# Install nova-go to system PATH
install: build
	@echo "→ Installing nova-go..."
	cp bin/nova-go /usr/local/bin/
	chmod +x /usr/local/bin/nova-go
	@echo "✓ nova-go installed to /usr/local/bin/"
	@echo "✓ Configure hooks in .claude/settings.json to use: nova-go trace"

# Pre-commit checks (run before committing)
pre-commit: fmt check test
	@echo "✓ Pre-commit checks passed"
```

### Installation Steps

```bash
# 1. Clone and setup
git clone https://github.com/yourusername/nova.git
cd nova
go mod download

# 2. Build (includes BAML generation)
make build

# 3. Run checks (type checking, linting, tests)
make check
make test

# 4. Install to PATH
make install

# 5. Verify installation
which nova-go
nova-go --help

# 6. Configure Claude Code hooks
# Edit .claude/settings.json (see Hook Configuration section)

# 7. Test hook handler manually
echo '{"session_id":"test","hook_event_name":"PostToolUse","tool_name":"Read","cwd":"'$(pwd)'"}' | \
  nova-go trace

# 8. Check traces
cat ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq
```

### Development Workflow

```bash
# Format code
make fmt

# Type check and lint (fast, no tests)
make check

# Run tests
make test

# Run tests with coverage report
make test-coverage

# Pre-commit checks (format + check + test)
make pre-commit

# Clean and rebuild
make clean
make build
```

### Make Targets Explained

| Target | Purpose | When to Use |
|--------|---------|-------------|
| `make build` | Generate BAML client + compile binary | After code changes, before running |
| `make check` | Type check + static analysis + lint | Before committing, fast feedback |
| `make test` | Run all tests with race detector | Before committing, verify correctness |
| `make test-coverage` | Tests + HTML coverage report | When analyzing test coverage |
| `make fmt` | Format all Go code | Before committing, auto-fix formatting |
| `make fmt-check` | Check formatting without changes | In CI, verify formatting |
| `make lint` | Run golangci-lint | Deep code quality check |
| `make pre-commit` | fmt + check + test (all validations) | **Before every commit** |
| `make clean` | Remove build artifacts | When rebuild needed |
| `make install` | Build + install to /usr/local/bin | After successful build |

**Recommended Workflow:**
```bash
# 1. Make changes
vim cmd/nova-go/implement.go

# 2. Format
make fmt

# 3. Check types/lint (fast)
make check

# 4. Run tests
make test

# 5. Or run all checks at once
make pre-commit

# 6. Commit
git add .
git commit -m "Add new feature"
```

---

## Usage

### nova-go CLI Commands

#### Trace Command (Hook Handler)

Process Claude Code hook events (called automatically by hooks):

```bash
# This is called automatically by Claude Code hooks
# Can test manually:
echo '{"session_id":"test","hook_event_name":"PostToolUse","tool_name":"Read"}' | nova-go trace

# Check trace output
tail -f ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq
```

**Note:** You don't normally call this manually - Claude Code calls it automatically when hooks trigger.

#### Implement Command

Execute task specifications with recursive decomposition:

```bash
# Basic execution
nova-go implement --spec task-spec.md

# With custom run directory
nova-go implement --spec task-spec.md --run-dir ./my-runs

# Debug mode
NOVA_DEBUG=1 nova-go implement --spec task-spec.md

# Check run artifacts
ls -la runs/<run-id>/
cat runs/<run-id>/trace.jsonl | jq
cat runs/<run-id>/run.json | jq
```

#### Serve Command

Start the trace aggregation server:

```bash
# Start server on default port (8080)
nova-go serve

# Custom port and trace directory
nova-go serve --port 3000 --trace-dir ~/.claude/traces

# With CORS enabled (for frontend development)
nova-go serve --port 8080 --cors

# Custom database path
nova-go serve --db ./custom-traces.db
```

Then access the API:
```bash
# Query traces via REST API
curl http://localhost:8080/api/traces
curl http://localhost:8080/api/tasks/bd-abc
curl http://localhost:8080/api/sessions/session-123/summary

# Stream real-time events via SSE
curl -N http://localhost:8080/api/stream
```

#### Help

```bash
# Show all commands
nova-go --help

# Show command-specific help
nova-go implement --help
nova-go serve --help
```

### Monitoring Traces

```bash
# Watch nova-trace events in real-time
tail -f ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq

# Watch nova-go run trace
tail -f runs/<run-id>/trace.jsonl | jq

# Filter orchestration events
cat runs/<run-id>/trace.jsonl | jq 'select(.event_type == "orchestration")'

# Filter tool usage events
cat runs/<run-id>/trace.jsonl | jq 'select(.event_type == "tool_use")'

# Track task progression
cat runs/<run-id>/trace.jsonl | \
  jq 'select(.event_name | test("Task")) | {task_id, event_name, timestamp}'

# Calculate total cost
cat runs/<run-id>/trace.jsonl | \
  jq -s 'map(select(.metrics.cost_usd)) | map(.metrics.cost_usd) | add'
```

### Querying Traces

```bash
# Find all failed tasks
cat runs/<run-id>/trace.jsonl | jq 'select(.event_name == "TaskFailed")'

# Find tasks that required retries
cat runs/<run-id>/trace.jsonl | jq 'select(.metrics.retry_count > 0)'

# Get execution timeline for a specific task
cat runs/<run-id>/trace.jsonl | jq 'select(.task_id == "bd-abc") | {timestamp, event_name}'

# Find most expensive LLM calls
cat runs/<run-id>/trace.jsonl | \
  jq -s 'sort_by(.metrics.cost_usd) | reverse | .[0:5]'

# Count events by type
cat runs/<run-id>/trace.jsonl | jq -s 'group_by(.event_type) | map({type: .[0].event_type, count: length})'
```

---

## Testing Strategy

### Quick Validation (Before Committing)

```bash
# Run all pre-commit checks (format + type check + lint + tests)
make pre-commit

# Or run individually:
make fmt        # Format code
make check      # Type check + lint (fast, no tests)
make test       # Run tests with race detector
```

### Type Checking & Static Analysis

```bash
# Type check only (fastest)
go build -o /dev/null ./cmd/nova-go

# Static analysis
go vet ./...

# Comprehensive linting
make lint  # or: golangci-lint run ./...

# All checks at once
make check
```

### Unit Tests

```bash
# Run all tests
make test  # or: go test -v -race ./...

# Test specific packages
go test ./internal/trace -v
go test ./internal/beads -v
go test ./internal/engine -v
go test ./internal/hook -v

# With coverage
make test-coverage
# Opens coverage.html in browser
```

### Integration Tests

```bash
# End-to-end test with mock BAML client
go test ./internal/engine -tags=integration -v

# Test scripts (create these as needed)
./scripts/test-hook.sh
./scripts/test-orchestrator.sh
```

### Manual Testing

```bash
# 1. Build and install
make build
make install

# 2. Test trace command (hook handler)
echo '{"session_id":"test123","hook_event_name":"PostToolUse","tool_name":"Read","cwd":"'$(pwd)'"}' | \
  nova-go trace

# 3. Verify trace written
cat ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq

# 4. Test implement command with simple spec
cat > test-spec.md <<EOF
# Test Task
Create a simple hello world program in Go
EOF

nova-go implement --spec test-spec.md

# 5. Verify run artifacts
RUN_ID=$(ls -t runs/ | head -1)
cat runs/$RUN_ID/trace.jsonl | jq
cat runs/$RUN_ID/run.json | jq

# 6. Test serve command
nova-go serve --port 8080
# In another terminal:
curl http://localhost:8080/api/traces
```

### Continuous Integration

For CI/CD pipelines:

```bash
# Complete CI workflow
make baml-generate  # Generate BAML client
make fmt-check      # Verify formatting (no changes)
make check          # Type check + lint
make test           # Run tests with race detector

# Or use pre-commit which does format + check + test
make pre-commit
```

---

## Benefits of Unified Architecture

### 1. **Single Source of Truth**
- One trace format for all events
- Consistent timestamps and identifiers
- Unified querying and analysis

### 2. **End-to-End Observability**
- Track from high-level orchestration → individual tool calls
- Correlation via task_id and trace_id
- Complete execution visibility

### 3. **Code Reuse**
- ~40% shared infrastructure (trace, beads, metrics)
- Consistent error handling
- Unified testing approach

### 4. **Simplified Deployment**
- Single repository
- Shared dependencies
- Coordinated versioning

### 5. **Rich Analytics**
- Token usage tracking across planning + execution
- Cost attribution per task
- Performance profiling
- Failure analysis with full context

---

## Future Enhancements

### Phase 2
- SQLite index for trace queries
- Trace aggregation and rollups
- Cost budgets and alerts

### Phase 3
- Remote trace shipping (HTTP)
- Real-time trace streaming
- Trace visualization UI

### Phase 4
- Distributed tracing across multiple runs
- Trace sampling for high-volume scenarios
- Advanced analytics and ML on trace data

---

## References

- [Data Contracts](./01-data-contracts.md) - Core data models
- [Hook Specification](./02-hook-specification.md) - nova-trace implementation
- [Engine Recursion MVP](../engine-recursion-mvp/plan.md) - nova-go implementation
- [BAML Documentation](https://docs.boundaryml.com/) - BAML usage
- [Beads CLI Reference](../../docs/beads-cli-reference.md) - Task management
