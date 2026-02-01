# nova-go trace - Hook Handler Specification

**Version:** 2.0
**Status:** Draft
**Last Updated:** 2026-01-31

## Overview

The `nova-go trace` command handles Claude Code hook events and writes structured trace data to JSONL files. It executes synchronously on every hook event (PreToolUse, PostToolUse, UserPromptSubmit) with sub-100ms latency.

> **📖 Complete System Guide:** This document covers the `nova-go trace` command (hook handler) in detail. For the complete system architecture showing how all `nova-go` commands work together, installation instructions, and usage examples, see **[05-unified-architecture.md](./05-unified-architecture.md)** first.

**Important:** This is a subcommand of the unified `nova-go` CLI, not a standalone binary. The system includes:
- `nova-go trace` - Hook handler (this spec)
- `nova-go implement` - Task orchestrator
- `nova-go serve` - Trace HTTP server

This document focuses specifically on the hook handler implementation details.

---

## MVP Scope

### What's IN the MVP ✅

The minimal working system includes:

1. **Core Hook Handler**
   - Parse hook input from stdin (JSON)
   - Validate required fields (session_id, hook_event_name)
   - Exit quickly (< 100ms, always exit 0)

2. **Basic Trace Events**
   - Generate trace events with timestamps
   - Map hook types to event types (PreToolUse → pre_tool_use)
   - Generate unique span IDs (UUID)
   - Capture tool names and basic tool input/output

3. **JSONL Storage**
   - Write traces to `~/.claude/traces/traces-YYYY-MM-DD.jsonl`
   - Direct append (no buffering)
   - Daily log rotation based on filename
   - Auto-create directory if missing

4. **Minimal Project Structure**
   ```
   nova/
   ├── cmd/nova-go/
   │   ├── main.go         # Cobra root CLI
   │   └── trace.go        # Trace subcommand (~50 lines)
   ├── internal/
   │   ├── hook/
   │   │   ├── parser.go   # Parse stdin JSON (~30 lines)
   │   │   └── types.go    # HookInput struct
   │   ├── trace/
   │   │   ├── builder.go  # Build TraceEvent (~40 lines)
   │   │   └── types.go    # TraceEvent struct
   │   └── storage/
   │       └── writer.go   # JSONL append (~40 lines)
   └── go.mod
   ```

### What's OUT of MVP ❌ (Deferred to Phase 2+)

**Beads Integration** (lines 296-323, 359-438)
- Task context enrichment
- Reading `.beads/issues/*.json`
- Adding `task_id` and `task_status` to traces
- **Why defer:** Optional enrichment, not required for basic tracing

**Metrics & Token Counting** (lines 325-342, 665-695)
- Token counting (input/output)
- Cost estimation
- File operation counters
- **Why defer:** Heuristic estimation is complex, can add later

**Performance Optimizations** (lines 584-643)
- Buffered writes with background flusher
- Pre-allocated buffer pools
- **Why defer:** Direct append is fast enough for MVP

**Advanced Features**
- Data redaction for sensitive fields (lines 749-761)
- Debug mode and verbose logging (lines 772-791)
- SQLite indexing (line 799)
- Remote trace shipping (line 804)
- Compression (line 805)

### Implementation Order

**Step 1: Basic Hook Handler** (~2-3 hours)
```go
// cmd/nova-go/main.go - Root CLI
// cmd/nova-go/trace.go - Trace subcommand that reads stdin
// internal/hook/parser.go - Parse JSON, validate required fields
```

**Step 2: Storage Writer** (~1-2 hours)
```go
// internal/storage/writer.go - Append to JSONL file
// - Daily rotation: traces-YYYY-MM-DD.jsonl
// - Create ~/.claude/traces/ if missing
```

**Step 3: Trace Builder** (~1-2 hours)
```go
// internal/trace/builder.go - Map HookInput → TraceEvent
// - Generate UUID for span_id
// - Basic event type mapping
// - NO Beads, NO metrics for MVP
```

**Step 4: Hook Configuration** (~30 min)
```json
// .claude/settings.json - Configure PreToolUse/PostToolUse hooks
// Test with manual stdin echo
```

**Step 5: Build & Test** (~1 hour)
```bash
make build && make install
# Integration test script
# Verify traces written to JSONL
```

**Total MVP Effort:** ~6-8 hours of focused development

### MVP Acceptance Criteria

```bash
# 1. Build and install
make build && make install

# 2. Test manually
echo '{"session_id":"test","hook_event_name":"PostToolUse","tool_name":"Read","cwd":"'$(pwd)'"}' | nova-go trace

# 3. Verify output
cat ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq

# Expected output:
# {
#   "session_id": "test",
#   "timestamp": "2026-01-31T10:30:00Z",
#   "event_type": "post_tool_use",
#   "hook_type": "PostToolUse",
#   "tool_name": "Read",
#   "span_id": "550e8400-e29b-41d4-a716-446655440000",
#   "trace_id": "test"
# }

# 4. Configure hooks in .claude/settings.json

# 5. Run Claude Code and verify traces are written automatically
```

### Simplified MVP Builder (No Beads)

For MVP, the trace builder is minimal:

```go
func (b *Builder) Build(ctx context.Context, input *hook.HookInput) (*TraceEvent, error) {
    event := &TraceEvent{
        SessionID:  input.SessionID,
        Timestamp:  time.Now().Format(time.RFC3339),
        EventType:  mapEventType(input.HookEventName),
        HookType:   input.HookEventName,
        ToolName:   input.ToolName,
        ToolInput:  input.ToolInput,
        ToolOutput: input.ToolOutput,
        SpanID:     uuid.New().String(),
        TraceID:    input.SessionID,
        Tags:       make(map[string]string),
        Metadata:   make(map[string]interface{}),
    }
    return event, nil
}
```

No Beads reader, no metrics calculator, no span caching. Just pure stdin → trace event → JSONL flow.

---

## Architecture

### MVP Architecture (Phase 1)

```
Claude Code (hook trigger)
    ↓ (stdin JSON)
nova-go trace
    ├─ Event Parser (parse HookInput)       ✅ MVP
    ├─ Trace Builder (basic event)          ✅ MVP
    └─ Storage Writer (JSONL append)        ✅ MVP
    ↓ (exit 0)
Claude Code (continues execution)
```

### Full Architecture (Phase 2+)

```
Claude Code (hook trigger)
    ↓ (stdin JSON)
nova-go trace
    ├─ Event Parser (parse HookInput)
    ├─ Trace Builder (enrich with context)
    ├─ Beads Integration (read task info)   ❌ Phase 2
    ├─ Metrics Calculator (tokens, cost)    ❌ Phase 2
    └─ Storage Writer (JSONL append)
    ↓ (exit 0)
Claude Code (continues execution)
```

### Design Goals

1. **Non-blocking**: Exit quickly (< 100ms) to avoid slowing Claude
2. **Reliable**: Never lose trace data due to crashes
3. **Simple**: Single binary, no external dependencies
4. **Portable**: Pure Go for easy cross-platform compilation

---

## Project Structure

Based on 2026 Go best practices (part of unified nova-go CLI):

```
nova/
├── cmd/
│   └── nova-go/
│       ├── main.go                 # Root CLI
│       ├── trace.go                # Trace command (hook handler)
│       ├── implement.go            # Implement command
│       └── serve.go                # Serve command
├── internal/
│   ├── hook/
│   │   ├── parser.go               # Parse stdin JSON
│   │   ├── handler.go              # Main hook logic
│   │   └── types.go                # HookInput/HookOutput
│   ├── trace/
│   │   ├── builder.go              # Build TraceEvent from HookInput
│   │   ├── enricher.go             # Add context (Beads, metrics)
│   │   └── types.go                # TraceEvent model
│   ├── beads/
│   │   ├── reader.go               # Read .beads/issues/*.json
│   │   └── types.go                # BeadsTask model
│   ├── metrics/
│   │   ├── calculator.go           # Token counting, cost estimation
│   │   └── pricing.go              # Model pricing tables
│   └── storage/
│       ├── writer.go               # JSONL append
│       └── rotator.go              # Daily log rotation
├── go.mod
├── go.sum
├── Makefile
├── .golangci.yml
└── README.md
```

---

## Implementation Details

> **⚠️ Note:** The implementation code below shows the **full architecture** including Phase 2 features (Beads integration, metrics calculation). For the **simplified MVP implementation**, see the [MVP Scope](#mvp-scope) section above which excludes these optional components.

### 1. Trace Command Implementation

**File:** `cmd/nova-go/trace.go`

```go
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"
	"github.com/yourusername/nova/internal/hook"
	"github.com/yourusername/nova/internal/storage"
	"github.com/yourusername/nova/internal/trace"
)

var traceCmd = &cobra.Command{
	Use:   "trace",
	Short: "Process Claude Code hook events",
	Long: `Handle hook events from Claude Code and write trace data to JSONL.
This command is called by Claude Code hooks (PreToolUse, PostToolUse).`,
	RunE: runTrace,
}

func runTrace(cmd *cobra.Command, args []string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := processHook(ctx); err != nil {
		// Log error but don't fail hook (non-blocking)
		fmt.Fprintf(os.Stderr, "nova-go trace error: %v\n", err)
	}

	// Always exit 0 for observability hooks
	return nil
}

func processHook(ctx context.Context) error {
	// 1. Parse hook input from stdin
	input, err := hook.ParseInput(os.Stdin)
	if err != nil {
		return fmt.Errorf("parse input: %w", err)
	}

	// 2. Build trace event
	builder := trace.NewBuilder()
	event, err := builder.Build(ctx, input)
	if err != nil {
		return fmt.Errorf("build trace: %w", err)
	}

	// 3. Write to storage
	writer := storage.NewWriter()
	if err := writer.Write(ctx, event); err != nil {
		return fmt.Errorf("write trace: %w", err)
	}

	return nil
}
```

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
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.AddCommand(traceCmd)      // Hook handler
	rootCmd.AddCommand(implementCmd)  // Orchestrator
	rootCmd.AddCommand(serveCmd)      // HTTP server
}
```

### 2. Hook Input Parser

**File:** `internal/hook/parser.go`

```go
package hook

import (
	"encoding/json"
	"fmt"
	"io"
)

type HookInput struct {
	SessionID      string                 `json:"session_id"`
	TranscriptPath string                 `json:"transcript_path"`
	CWD            string                 `json:"cwd"`
	PermissionMode string                 `json:"permission_mode"`
	HookEventName  string                 `json:"hook_event_name"`
	ToolName       string                 `json:"tool_name,omitempty"`
	ToolInput      map[string]interface{} `json:"tool_input,omitempty"`
	ToolOutput     map[string]interface{} `json:"tool_output,omitempty"`
	ToolUseID      string                 `json:"tool_use_id,omitempty"`
	Prompt         string                 `json:"prompt,omitempty"`
}

func ParseInput(r io.Reader) (*HookInput, error) {
	var input HookInput
	if err := json.NewDecoder(r).Decode(&input); err != nil {
		return nil, fmt.Errorf("decode JSON: %w", err)
	}

	// Basic validation
	if input.SessionID == "" {
		return nil, fmt.Errorf("missing session_id")
	}
	if input.HookEventName == "" {
		return nil, fmt.Errorf("missing hook_event_name")
	}

	return &input, nil
}
```

### 3. Trace Builder

**File:** `internal/trace/builder.go`

```go
package trace

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/yourusername/nova-go trace/internal/beads"
	"github.com/yourusername/nova-go trace/internal/hook"
	"github.com/yourusername/nova-go trace/internal/metrics"
)

type Builder struct {
	beadsReader  *beads.Reader
	metricsCalc  *metrics.Calculator
	spanCache    map[string]string // tool_use_id -> span_id
}

func NewBuilder() *Builder {
	return &Builder{
		beadsReader: beads.NewReader(),
		metricsCalc: metrics.NewCalculator(),
		spanCache:   make(map[string]string),
	}
}

func (b *Builder) Build(ctx context.Context, input *hook.HookInput) (*TraceEvent, error) {
	now := time.Now()

	event := &TraceEvent{
		SessionID:  input.SessionID,
		Timestamp:  now.Format(time.RFC3339),
		EventType:  mapEventType(input.HookEventName),
		HookType:   input.HookEventName,
		Tags:       make(map[string]string),
		Metadata:   make(map[string]interface{}),
		Metrics:    Metrics{},
	}

	// Generate or reuse span ID
	if input.HookEventName == "PreToolUse" {
		event.SpanID = uuid.New().String()
		if input.ToolUseID != "" {
			b.spanCache[input.ToolUseID] = event.SpanID
		}
	} else if input.HookEventName == "PostToolUse" {
		// Reuse span ID from PreToolUse
		if input.ToolUseID != "" && b.spanCache[input.ToolUseID] != "" {
			event.SpanID = b.spanCache[input.ToolUseID]
		} else {
			event.SpanID = uuid.New().String()
		}
	} else {
		event.SpanID = uuid.New().String()
	}

	// Generate trace ID (for now, use session as trace root)
	event.TraceID = input.SessionID

	// Tool details
	if input.ToolName != "" {
		event.ToolName = &input.ToolName
		event.ToolInput = input.ToolInput
		event.ToolOutput = input.ToolOutput
	}

	// Enrich with Beads context
	if err := b.enrichWithBeads(ctx, event, input.CWD); err != nil {
		// Log but don't fail - Beads integration is optional
		fmt.Fprintf(os.Stderr, "beads enrichment failed: %v\n", err)
	}

	// Calculate metrics
	if err := b.enrichWithMetrics(ctx, event, input); err != nil {
		fmt.Fprintf(os.Stderr, "metrics calculation failed: %v\n", err)
	}

	return event, nil
}

func (b *Builder) enrichWithBeads(ctx context.Context, event *TraceEvent, cwd string) error {
	task, err := b.beadsReader.GetCurrentTask(ctx, cwd)
	if err != nil {
		return err
	}
	if task == nil {
		return nil // No active task
	}

	event.TaskID = &task.ID
	event.TaskStatus = &task.Status
	event.Tags["task_title"] = task.Title

	return nil
}

func (b *Builder) enrichWithMetrics(ctx context.Context, event *TraceEvent, input *hook.HookInput) error {
	// Calculate file operation metrics
	if input.ToolName == "Read" {
		event.Metrics.FilesRead = 1
	} else if input.ToolName == "Write" {
		event.Metrics.FilesWritten = 1
	} else if input.ToolName == "Edit" {
		event.Metrics.FilesEdited = 1
	}

	// Token counting and cost estimation
	// (For MVP, we'll estimate based on heuristics; later integrate with Claude API)
	if input.Prompt != "" {
		event.Metrics.InputTokens = b.metricsCalc.EstimateTokens(input.Prompt)
	}

	return nil
}

func mapEventType(hookType string) string {
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
```

### 4. Beads Integration

**File:** `internal/beads/reader.go`

```go
package beads

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type BeadsTask struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Status    string   `json:"status"`
	ParentID  *string  `json:"parentId"`
	UpdatedAt string   `json:"updatedAt"`
}

type Reader struct{}

func NewReader() *Reader {
	return &Reader{}
}

func (r *Reader) GetCurrentTask(ctx context.Context, projectDir string) (*BeadsTask, error) {
	issuesDir := filepath.Join(projectDir, ".beads", "issues")

	// Check if .beads directory exists
	if _, err := os.Stat(issuesDir); os.IsNotExist(err) {
		return nil, nil // No Beads integration
	}

	// Find most recently updated task with status "in_progress"
	entries, err := os.ReadDir(issuesDir)
	if err != nil {
		return nil, fmt.Errorf("read issues dir: %w", err)
	}

	var currentTask *BeadsTask
	var latestTime time.Time

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		taskPath := filepath.Join(issuesDir, entry.Name())
		data, err := os.ReadFile(taskPath)
		if err != nil {
			continue
		}

		var task BeadsTask
		if err := json.Unmarshal(data, &task); err != nil {
			continue
		}

		if task.Status != "in_progress" {
			continue
		}

		updatedAt, err := time.Parse(time.RFC3339, task.UpdatedAt)
		if err != nil {
			continue
		}

		if currentTask == nil || updatedAt.After(latestTime) {
			currentTask = &task
			latestTime = updatedAt
		}
	}

	return currentTask, nil
}
```

### 5. Storage Writer

**File:** `internal/storage/writer.go`

```go
package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/yourusername/nova-go trace/internal/trace"
)

type Writer struct {
	baseDir string
}

func NewWriter() *Writer {
	baseDir := os.Getenv("CLAUDE_TRACE_DIR")
	if baseDir == "" {
		homeDir, _ := os.UserHomeDir()
		baseDir = filepath.Join(homeDir, ".claude", "traces")
	}
	return &Writer{baseDir: baseDir}
}

func (w *Writer) Write(ctx context.Context, event *trace.TraceEvent) error {
	// Ensure directory exists
	if err := os.MkdirAll(w.baseDir, 0755); err != nil {
		return fmt.Errorf("create traces dir: %w", err)
	}

	// Daily rotation: traces-YYYY-MM-DD.jsonl
	filename := fmt.Sprintf("traces-%s.jsonl", time.Now().Format("2006-01-02"))
	filePath := filepath.Join(w.baseDir, filename)

	// Open file in append mode
	file, err := os.OpenFile(filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("open trace file: %w", err)
	}
	defer file.Close()

	// Write as single-line JSON
	if err := json.NewEncoder(file).Encode(event); err != nil {
		return fmt.Errorf("encode trace: %w", err)
	}

	return nil
}
```

---

## Configuration

### Environment Variables

- `CLAUDE_TRACE_DIR`: Directory for trace files (default: `~/.claude/traces`)
- `CLAUDE_TRACE_DEBUG`: Enable debug logging (default: `false`)
- `CLAUDE_PROJECT_DIR`: Project root (set by Claude automatically)

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

**Notes:**
- Assumes `nova-go` is in your PATH (installed via `make install`)
- Alternatively, use absolute path: `"/usr/local/bin/nova-go trace"`
- For complete installation instructions, see [05-unified-architecture.md](./05-unified-architecture.md#installation-steps)

---

## Build & Installation

**Note:** `nova-go trace` is part of the unified `nova-go` CLI. For complete build and installation instructions, see **[05-unified-architecture.md - Build & Installation](./05-unified-architecture.md#build--installation)**.

### Quick Start

```bash
# 1. Build unified CLI (from project root)
make build

# 2. Install to PATH
make install

# 3. Configure Claude Code hooks
# Edit .claude/settings.json (see Hook Configuration section above)

# 4. Test trace command manually
echo '{"session_id":"test","hook_event_name":"PostToolUse","tool_name":"Read","cwd":"'$(pwd)'"}' | \
  nova-go trace

# 5. Check traces
cat ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq
```

### Testing

```bash
# Run all tests
go test -v -race ./...

# Test hook-specific code
go test -v ./internal/hook/...
go test -v ./internal/trace/...
```

---

## Performance Optimizations

### 1. Buffered Writes

For high-frequency events, batch writes:

```go
type BufferedWriter struct {
	buffer   []*trace.TraceEvent
	mu       sync.Mutex
	ticker   *time.Ticker
	done     chan struct{}
}

func (w *BufferedWriter) Start() {
	w.ticker = time.NewTicker(1 * time.Second)
	go func() {
		for {
			select {
			case <-w.ticker.C:
				w.flush()
			case <-w.done:
				w.flush()
				return
			}
		}
	}()
}

func (w *BufferedWriter) Write(event *trace.TraceEvent) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.buffer = append(w.buffer, event)
}

func (w *BufferedWriter) flush() {
	// Write all buffered events to file
}
```

### 2. Pre-allocated Buffers

```go
var bufPool = sync.Pool{
	New: func() interface{} {
		return new(bytes.Buffer)
	},
}

func encodeEvent(event *TraceEvent) ([]byte, error) {
	buf := bufPool.Get().(*bytes.Buffer)
	defer bufPool.Put(buf)
	buf.Reset()

	if err := json.NewEncoder(buf).Encode(event); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
```

### 3. Context Timeout

Always use short timeouts to prevent hanging:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()
```

---

## Testing Strategy

### Unit Tests

```go
func TestParseInput(t *testing.T) {
	tests := map[string]struct {
		input       string
		expected    *HookInput
		expectError bool
	}{
		"valid PreToolUse": {
			input: `{"session_id":"abc","hook_event_name":"PreToolUse","tool_name":"Read"}`,
			expected: &HookInput{
				SessionID:     "abc",
				HookEventName: "PreToolUse",
				ToolName:      "Read",
			},
		},
		"missing session_id": {
			input:       `{"hook_event_name":"PreToolUse"}`,
			expectError: true,
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			result, err := ParseInput(strings.NewReader(tt.input))
			if tt.expectError && err == nil {
				t.Fatal("expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			// Assert result matches expected
		})
	}
}
```

### Integration Tests

```bash
#!/bin/bash
# Test hook with sample events

echo "Testing PreToolUse..."
echo '{"session_id":"test123","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"ls"}}' | \
  ./bin/nova-go trace

echo "Testing PostToolUse..."
echo '{"session_id":"test123","hook_event_name":"PostToolUse","tool_name":"Bash","tool_output":{"exit_code":0}}' | \
  ./bin/nova-go trace

# Verify traces written
if [ -f ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl ]; then
  echo "✓ Traces written successfully"
  cat ~/.claude/traces/traces-$(date +%Y-%m-% d).jsonl | jq -c .
else
  echo "✗ No traces found"
  exit 1
fi
```

---

## Error Handling

### Non-Blocking Errors

The hook should NEVER fail the Claude workflow:

```go
func main() {
	if err := run(); err != nil {
		// Log error but always exit 0
		fmt.Fprintf(os.Stderr, "nova-go trace: %v\n", err)
	}
	os.Exit(0) // Always succeed
}
```

### Graceful Degradation

- Beads not available? Skip task context
- File write fails? Log error, continue
- Timeout exceeded? Abandon trace, exit

---

## Security Considerations

### Data Redaction

Redact sensitive data before writing:

```go
func redactToolInput(input map[string]interface{}) {
	sensitiveKeys := []string{"password", "token", "api_key", "secret", "authorization"}
	for _, key := range sensitiveKeys {
		if _, exists := input[key]; exists {
			input[key] = "REDACTED"
		}
	}
}
```

### File Permissions

- Trace files: `0644` (readable by user only)
- Binary: `0755` (executable by user)

---

## Monitoring & Debugging

### Debug Mode

```bash
export CLAUDE_TRACE_DEBUG=1
```

Outputs:
- Parsed hook input
- Built trace event
- File write confirmation

### Manual Testing

```bash
# Test hook directly
echo '{"session_id":"test","hook_event_name":"PostToolUse","tool_name":"Read"}' | \
  CLAUDE_TRACE_DEBUG=1 ./.claude/hooks/nova-go trace

# Watch traces in real-time
tail -f ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq
```

---

## Future Enhancements

> **Note:** These features were explicitly deferred from MVP (see [MVP Scope](#mvp-scope) for rationale).

### Phase 2 (Post-MVP)
- **Beads Integration**: Task context enrichment (lines 296-323, 359-438)
- **Token Counting**: Estimate tokens via Claude API (lines 325-342)
- **Cost Metrics**: Calculate usage costs per event
- **File Operation Metrics**: Count files read/written/edited
- **SQLite Indexing**: Faster queries for dashboard
- **Async Batch Writes**: Buffer events for high-frequency scenarios (lines 588-622)
- **Data Redaction**: Automatically redact sensitive fields (lines 749-761)
- **Debug Mode**: Verbose logging for troubleshooting (lines 772-791)

### Phase 3 (Advanced Features)
- **Remote Trace Shipping**: HTTP POST to aggregator
- **Compression**: Compress old traces (gzip)
- **Advanced Metrics**: Memory usage, CPU time, disk I/O
- **Span Correlation**: Parent-child span relationships
- **Sampling**: Only capture % of traces at high volume

---

## References

- **[Unified Architecture](./05-unified-architecture.md)** - ⭐ **START HERE** - Complete system overview showing how `nova-go trace`, `implement`, and `serve` work together
- [Data Contracts](./01-data-contracts.md) - Core data models and trace event schemas
- [Engine Recursion MVP](../engine-recursion-mvp/plan.md) - `nova-go implement` command specification
- [Trace Server Spec](./03-trace-server-specification.md) - `nova-go serve` command specification
- [Claude Hooks Documentation](https://code.claude.com/docs/en/hooks) - Official Claude Code hook spec
- [Go Project Structure Best Practices](https://github.com/golang-standards/project-layout)
