# Nova Trace System Refactor - Session-Based Architecture

**Version:** 1.2
**Status:** Simplified - Live Tracking Removed
**Last Updated:** 2026-01-31

> **Note (2026-01-31):** The live tracking feature (background watcher and session-*-live.json files)
> has been removed to simplify the system. Only SessionStart/SessionEnd hooks are now used for
> end-of-session trace generation. Historical plan content below describes the original design.

## Overview

Refactor the nova-go trace system from per-tool-use hooks to session lifecycle hooks with transcript parsing. This eliminates hook overhead on every tool call and enables access to token usage and cost data that isn't available in tool hooks.

**Key Architectural Decision:**
After analyzing the transcript file format and Claude Code hook documentation, we discovered:

1. **Every assistant message contains token usage** - Available in real-time as transcript grows
2. **transcript_path is provided in BOTH SessionStart AND SessionEnd hooks**
3. This enables a **dual-mode architecture**: live tracking during session + detailed breakdown at end

**Implementation Strategy:**

- SessionStart: Spawn background watcher that monitors transcript file
- Watcher: Parse each new assistant message, update running token totals
- SessionEnd: Stop watcher, do full parse, write detailed traces

## Current State Analysis

**Existing Architecture (Already Implemented):**

```text
Current Flow:
  PreToolUse hook → nova-go trace → write basic trace
  PostToolUse hook → nova-go trace → write basic trace
  (Fires on EVERY tool call)
```text

**Current Implementation:**

- `cmd/nova-go/main.go` - Root CLI with trace subcommand
- `cmd/nova-go/main.go:newTraceCommand()` - Handles PreToolUse/PostToolUse
- `internal/hook/parser.go` - Parses hook stdin JSON
- `internal/hook/types.go` - HookInput struct
- `internal/trace/builder.go` - Builds basic trace events (no metrics)
- `internal/trace/types.go` - TraceEvent struct
- `internal/storage/writer.go` - Writes to `.claude/traces/traces-YYYY-MM-DD.jsonl`

**What We Get:**

- ✅ Basic tool names and inputs
- ✅ Span IDs for correlation
- ❌ **No token usage** (hooks don't provide this)
- ❌ **No cost data**
- ❌ Runs on every tool call (overhead)

**Key Discovery:**
The `transcript_path` field in hook input points to a JSONL file containing:

- All tool calls in `message.content[]` arrays
- **Token usage in `message.usage` objects on EVERY assistant message**
- Model information for cost calculation

**Example transcript entry with usage:**

```json
{
  "type": "assistant",
  "message": {
    "model": "claude-sonnet-4-5-20250929",
    "content": [
      {"type": "tool_use", "name": "Read", "input": {...}}
    ],
    "usage": {
      "input_tokens": 2,
      "cache_creation_input_tokens": 45208,
      "cache_read_input_tokens": 0,
      "output_tokens": 214,
      "service_tier": "standard"
    }
  },
  "timestamp": "2026-02-01T01:34:53.419Z"
}
```text

**SessionStart Hook Input (verified from Claude Code docs):**

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "SessionStart",
  "source": "startup",  // or "resume", "clear", "compact"
  "model": "claude-sonnet-4-5-20250929"
}
```text

**SessionEnd Hook Input (verified from Claude Code docs):**

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../session.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "SessionEnd",
  "reason": "clear" | "logout" | "prompt_input_exit" | "other"
}
```text

## Desired End State

**New Architecture (Dual-Mode: Live + End-of-Session):**

```text
New Flow:
  SessionStart hook → nova-go track-session →
    1. Log session to sessions.jsonl
    2. Spawn background watcher on transcript_path
    3. Watcher updates live stats: ~/.claude/traces/session-{id}-live.json

  [Session runs, transcript grows in real-time]
  [Background watcher parses each new assistant message]
  [Live stats updated: running token totals, current cost]

  SessionEnd hook → nova-go process-transcript →
    1. Stop background watcher
    2. Parse full transcript
    3. Write detailed traces to traces-YYYY-MM-DD.jsonl
    4. Update sessions.jsonl with ended_at
```text

**What We'll Get:**

- ✅ **Live token tracking** - Running totals available during session
- ✅ **Detailed end-of-session breakdown** - Tool uses + token data per message
- ✅ Token counts (input, output, cache read, cache write)
- ✅ Cost calculation based on model pricing
- ✅ Reduced hook overhead (only at session boundaries, not per-tool)
- ✅ Simpler implementation (no per-tool processing)

**Verification:**

```bash
# 1. Session registry exists
cat ~/.claude/traces/sessions.jsonl | jq .
# Shows: {session_id, transcript_path, started_at, ended_at}

# 2. Live tracking works during session
cat ~/.claude/traces/session-{id}-live.json | jq .
# Shows: {session_id, input_tokens, output_tokens, cache_read_tokens,
#         cache_write_tokens, cost_usd, last_updated}

# 3. Detailed traces include token usage at end
cat ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq '.metrics'
# Shows: {input_tokens, output_tokens, cache_creation_input_tokens,
#         cache_read_input_tokens, cost_usd}

# 4. Hooks configured correctly
cat .claude/settings.json | jq '.hooks | keys'
# Shows: ["SessionStart", "SessionEnd"] (no PreToolUse/PostToolUse)
```text

## What We're NOT Doing

- ❌ Interactive dashboard UI (just JSON files for now)
- ❌ Backwards compatibility with old hook format
- ❌ Migration path from old traces (clean break)
- ❌ Support for pre-session-hook Claude Code versions
- ❌ Real-time streaming to external systems (just local files)

## Implementation Approach

The refactor consists of four main changes:

1. **Add new commands** for session lifecycle (`track-session`, `process-transcript`)
2. **Implement background watcher** for live token tracking during session
3. **Parse transcripts** to extract tool uses + token data (both live and end-of-session)
4. **Delete old code** (per-tool hook handler)

We'll test thoroughly with real transcript data before switching live systems.

**Live Tracking Flow:**

- SessionStart spawns `nova-go watch-transcript {session_id} {transcript_path}` in background
- Watcher uses `tail -f` to read new lines as they're appended
- Each assistant message parsed for `usage` object
- Running totals written to `~/.claude/traces/session-{id}-live.json`
- SessionEnd kills watcher process and does final full parse

---

## Phase 1: Add SessionStart/SessionEnd Hook Handlers

### Overview

Add new CLI commands to handle session lifecycle events, maintain a sessions registry, and spawn background watcher for live token tracking.

### Changes Required

#### 1. Create SessionStart Handler

**File**: `cmd/nova-go/track_session.go`

```go
package main

import (
 "encoding/json"
 "fmt"
 "os"
 "path/filepath"
 "time"

 "github.com/spf13/cobra"
)

func newTrackSessionCommand() *cobra.Command {
 return &cobra.Command{
  Use:   "track-session",
  Short: "Handle SessionStart hook - log session metadata",
  RunE:  runTrackSession,
 }
}

func runTrackSession(cmd *cobra.Command, args []string) error {
 // Read hook input from stdin
 var input map[string]interface{}
 if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil {
  return fmt.Errorf("parse stdin: %w", err)
 }

 // Extract session metadata
 sessionID, _ := input["session_id"].(string)
 transcriptPath, _ := input["transcript_path"].(string)
 source, _ := input["source"].(string) // "startup", "resume", etc.

 if sessionID == "" || transcriptPath == "" {
  return fmt.Errorf("missing required fields")
 }

 // Create session entry
 entry := map[string]interface{}{
  "session_id":      sessionID,
  "transcript_path": transcriptPath,
  "source":          source,
  "started_at":      time.Now().Format(time.RFC3339),
 }

 // Write to sessions registry
 homeDir, _ := os.UserHomeDir()
 registryPath := filepath.Join(homeDir, ".claude", "traces", "sessions.jsonl")

 // Ensure directory exists
 os.MkdirAll(filepath.Dir(registryPath), 0755)

 // Append to registry
 file, err := os.OpenFile(registryPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
 if err != nil {
  return fmt.Errorf("open registry: %w", err)
 }
 defer file.Close()

 if err := json.NewEncoder(file).Encode(entry); err != nil {
  return fmt.Errorf("write entry: %w", err)
 }

 // Spawn background watcher for live token tracking
 // Note: Implementation in Phase 2
 // This will run: nova-go watch-transcript {session_id} {transcript_path} &

 return nil
}
```text

#### 2. Create SessionEnd Handler Stub

**File**: `cmd/nova-go/process_transcript.go`

```go
package main

import (
 "encoding/json"
 "fmt"
 "os"

 "github.com/spf13/cobra"
 "github.com/mattruiters/nova/internal/transcript"
)

func newProcessTranscriptCommand() *cobra.Command {
 return &cobra.Command{
  Use:   "process-transcript",
  Short: "Handle SessionEnd hook - parse transcript and generate traces",
  RunE:  runProcessTranscript,
 }
}

func runProcessTranscript(cmd *cobra.Command, args []string) error {
 // Read hook input from stdin
 var input map[string]interface{}
 if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil {
  return fmt.Errorf("parse stdin: %w", err)
 }

 sessionID, _ := input["session_id"].(string)
 transcriptPath, _ := input["transcript_path"].(string)

 if sessionID == "" || transcriptPath == "" {
  return fmt.Errorf("missing required fields")
 }

 // Parse transcript and generate traces
 parser := transcript.NewParser()
 traces, err := parser.Parse(transcriptPath, sessionID)
 if err != nil {
  return fmt.Errorf("parse transcript: %w", err)
 }

 // Write traces (implementation in Phase 2)
 fmt.Fprintf(os.Stderr, "Generated %d traces from transcript\n", len(traces))

 return nil
}
```text

#### 3. Register New Commands

**File**: `cmd/nova-go/main.go`

Update the `init()` function:

```go
func init() {
 rootCmd.AddCommand(newTraceCommand())           // Old - will delete in Phase 5
 rootCmd.AddCommand(newTrackSessionCommand())    // New - SessionStart
 rootCmd.AddCommand(newProcessTranscriptCommand()) // New - SessionEnd
}
```text

### Success Criteria

#### Automated Verification

- [ ] Build succeeds: `make build`
- [ ] Commands exist: `./bin/nova-go track-session --help`
- [ ] Commands exist: `./bin/nova-go process-transcript --help`
- [ ] Unit test for track-session: `go test ./cmd/nova-go/... -run TestTrackSession`

#### Manual Verification

- [ ] Test track-session manually:

  ```bash
  echo '{"session_id":"test123","transcript_path":"/tmp/test.jsonl","source":"startup"}' | \
    ./bin/nova-go track-session
  ```

- [ ] Verify sessions.jsonl created:

  ```bash
  cat ~/.claude/traces/sessions.jsonl | jq .
  ```

- [ ] Entry contains: session_id, transcript_path, source, started_at

---

## Phase 2: Implement Transcript Parser and Live Watcher

### Overview

Parse Claude Code transcript JSONL files to extract tool uses, token counts, and calculate costs. Implement background watcher for live token tracking during active sessions.

### Changes Required

#### 1. Create Transcript Parser

**File**: `internal/transcript/parser.go`

```go
package transcript

import (
 "bufio"
 "encoding/json"
 "fmt"
 "os"
 "time"
)

type Parser struct {
 pricing *PricingCalculator
}

func NewParser() *Parser {
 return &Parser{
  pricing: NewPricingCalculator(),
 }
}

// TranscriptEntry represents one line in the transcript JSONL
type TranscriptEntry struct {
 Type      string                 `json:"type"`
 Message   *Message               `json:"message,omitempty"`
 Timestamp string                 `json:"timestamp"`
 SessionID string                 `json:"sessionId"`
}

type Message struct {
 Model   string        `json:"model"`
 Content []ContentItem `json:"content"`
 Usage   *Usage        `json:"usage,omitempty"`
}

type ContentItem struct {
 Type  string                 `json:"type"`
 Name  string                 `json:"name,omitempty"`  // tool name
 Input map[string]interface{} `json:"input,omitempty"` // tool input
 Text  string                 `json:"text,omitempty"`  // text content
}

type Usage struct {
 InputTokens               int `json:"input_tokens"`
 CacheCreationInputTokens  int `json:"cache_creation_input_tokens"`
 CacheReadInputTokens      int `json:"cache_read_input_tokens"`
 OutputTokens              int `json:"output_tokens"`
}

// TraceEvent is what we write to traces-YYYY-MM-DD.jsonl
type TraceEvent struct {
 SessionID  string                 `json:"session_id"`
 TraceID    string                 `json:"trace_id"`
 SpanID     string                 `json:"span_id"`
 Timestamp  string                 `json:"timestamp"`
 EventType  string                 `json:"event_type"` // "tool_use"
 ToolName   string                 `json:"tool_name"`
 ToolInput  map[string]interface{} `json:"tool_input,omitempty"`
 Metrics    Metrics                `json:"metrics"`
 Tags       map[string]string      `json:"tags"`
}

type Metrics struct {
 InputTokens              int     `json:"input_tokens"`
 OutputTokens             int     `json:"output_tokens"`
 CacheCreationInputTokens int     `json:"cache_creation_input_tokens"`
 CacheReadInputTokens     int     `json:"cache_read_input_tokens"`
 CostUSD                  float64 `json:"cost_usd"`
}

// Parse reads a transcript file and generates trace events
func (p *Parser) Parse(transcriptPath string, sessionID string) ([]TraceEvent, error) {
 file, err := os.Open(transcriptPath)
 if err != nil {
  return nil, fmt.Errorf("open transcript: %w", err)
 }
 defer file.Close()

 var traces []TraceEvent
 scanner := bufio.NewScanner(file)

 for scanner.Scan() {
  var entry TranscriptEntry
  if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
   // Skip malformed lines
   continue
  }

  // Only process assistant messages with tool uses
  if entry.Type != "assistant" || entry.Message == nil {
   continue
  }

  // Extract tool uses from content array
  for _, item := range entry.Message.Content {
   if item.Type == "tool_use" && item.Name != "" {
    trace := TraceEvent{
     SessionID: sessionID,
     TraceID:   sessionID, // Use session as trace root
     SpanID:    generateSpanID(), // UUID
     Timestamp: entry.Timestamp,
     EventType: "tool_use",
     ToolName:  item.Name,
     ToolInput: item.Input,
     Tags:      make(map[string]string),
    }

    // Add token metrics if available
    if entry.Message.Usage != nil {
     trace.Metrics = Metrics{
      InputTokens:              entry.Message.Usage.InputTokens,
      OutputTokens:             entry.Message.Usage.OutputTokens,
      CacheCreationInputTokens: entry.Message.Usage.CacheCreationInputTokens,
      CacheReadInputTokens:     entry.Message.Usage.CacheReadInputTokens,
     }

     // Calculate cost
     trace.Metrics.CostUSD = p.pricing.Calculate(
      entry.Message.Model,
      entry.Message.Usage,
     )
    }

    traces = append(traces, trace)
   }
  }
 }

 if err := scanner.Err(); err != nil {
  return nil, fmt.Errorf("scan transcript: %w", err)
 }

 return traces, nil
}

func generateSpanID() string {
 // Import github.com/google/uuid
 return uuid.New().String()
}
```text

#### 2. Create Pricing Calculator

**File**: `internal/transcript/pricing.go`

```go
package transcript

import (
 "strings"
)

type PricingCalculator struct {
 // Prices per million tokens (as of 2026-01-31)
 prices map[string]ModelPricing
}

type ModelPricing struct {
 InputPerMillion  float64
 OutputPerMillion float64
 CacheWritePerMillion float64
 CacheReadPerMillion  float64
}

func NewPricingCalculator() *PricingCalculator {
 return &PricingCalculator{
  prices: map[string]ModelPricing{
   "claude-sonnet-4-5": {
    InputPerMillion:      3.00,
    OutputPerMillion:     15.00,
    CacheWritePerMillion: 3.75,
    CacheReadPerMillion:  0.30,
   },
   "claude-opus-4-5": {
    InputPerMillion:      15.00,
    OutputPerMillion:     75.00,
    CacheWritePerMillion: 18.75,
    CacheReadPerMillion:  1.50,
   },
   "claude-haiku-3-5": {
    InputPerMillion:      0.80,
    OutputPerMillion:     4.00,
    CacheWritePerMillion: 1.00,
    CacheReadPerMillion:  0.08,
   },
  },
 }
}

func (pc *PricingCalculator) Calculate(model string, usage *Usage) float64 {
 // Extract model family from full model string
 // e.g. "claude-sonnet-4-5-20250929" -> "claude-sonnet-4-5"
 modelFamily := extractModelFamily(model)

 pricing, ok := pc.prices[modelFamily]
 if !ok {
  // Unknown model, return 0
  return 0
 }

 cost := 0.0

 // Regular input tokens
 cost += float64(usage.InputTokens) / 1_000_000 * pricing.InputPerMillion

 // Cache creation (write) tokens
 cost += float64(usage.CacheCreationInputTokens) / 1_000_000 * pricing.CacheWritePerMillion

 // Cache read tokens
 cost += float64(usage.CacheReadInputTokens) / 1_000_000 * pricing.CacheReadPerMillion

 // Output tokens
 cost += float64(usage.OutputTokens) / 1_000_000 * pricing.OutputPerMillion

 return cost
}

func extractModelFamily(fullModel string) string {
 // "claude-sonnet-4-5-20250929" -> "claude-sonnet-4-5"
 // "claude-opus-4-5-20251101" -> "claude-opus-4-5"

 parts := strings.Split(fullModel, "-")
 if len(parts) >= 4 {
  // Take first 4 parts: claude-sonnet-4-5
  return strings.Join(parts[:4], "-")
 }
 return fullModel
}
```text

#### 3. Create Background Watcher Command

**File**: `cmd/nova-go/watch_transcript.go`

```go
package main

import (
 "bufio"
 "encoding/json"
 "fmt"
 "os"
 "path/filepath"
 "time"

 "github.com/spf13/cobra"
 "github.com/mattruiters/nova/internal/transcript"
)

func newWatchTranscriptCommand() *cobra.Command {
 return &cobra.Command{
  Use:   "watch-transcript <session-id> <transcript-path>",
  Short: "Watch transcript file and update live token stats",
  Args:  cobra.ExactArgs(2),
  RunE:  runWatchTranscript,
 }
}

func runWatchTranscript(cmd *cobra.Command, args []string) error {
 sessionID := args[0]
 transcriptPath := args[1]

 homeDir, _ := os.UserHomeDir()
 liveStatsPath := filepath.Join(homeDir, ".claude", "traces",
  fmt.Sprintf("session-%s-live.json", sessionID))

 // Ensure directory exists
 os.MkdirAll(filepath.Dir(liveStatsPath), 0755)

 // Initialize live stats
 stats := &LiveStats{
  SessionID:   sessionID,
  LastUpdated: time.Now().Format(time.RFC3339),
 }

 // Use tail -f to watch for new lines (or file watcher library)
 // Parse each new assistant message for usage data
 // Update running totals in stats
 // Write to liveStatsPath on each update

 // Placeholder - full implementation uses tail or fsnotify
 fmt.Fprintf(os.Stderr, "Watching transcript for session %s\n", sessionID)

 return nil
}

type LiveStats struct {
 SessionID              string  `json:"session_id"`
 InputTokens            int     `json:"input_tokens"`
 OutputTokens           int     `json:"output_tokens"`
 CacheReadTokens        int     `json:"cache_read_tokens"`
 CacheWriteTokens       int     `json:"cache_write_tokens"`
 CostUSD                float64 `json:"cost_usd"`
 MessageCount           int     `json:"message_count"`
 LastUpdated            string  `json:"last_updated"`
}
```text

Register in `cmd/nova-go/main.go`:

```go
func init() {
 rootCmd.AddCommand(newTraceCommand())              // Old - will delete
 rootCmd.AddCommand(newTrackSessionCommand())       // SessionStart
 rootCmd.AddCommand(newProcessTranscriptCommand())  // SessionEnd
 rootCmd.AddCommand(newWatchTranscriptCommand())    // Background watcher
}
```text

#### 4. Update track-session to Spawn Watcher

**File**: `cmd/nova-go/track_session.go`

Add to end of `runTrackSession()`:

```go
 // Spawn background watcher for live tracking
 watchCmd := exec.Command(os.Args[0], "watch-transcript", sessionID, transcriptPath)
 watchCmd.Stdout = os.Stderr
 watchCmd.Stderr = os.Stderr

 if err := watchCmd.Start(); err != nil {
  // Log error but don't fail - live tracking is optional
  fmt.Fprintf(os.Stderr, "Warning: could not start watcher: %v\n", err)
 }

 // Detach so it survives after hook exits
 go watchCmd.Wait()
```text

#### 5. Update process-transcript to Use Parser

**File**: `cmd/nova-go/process_transcript.go`

Update `runProcessTranscript()`:

```go
func runProcessTranscript(cmd *cobra.Command, args []string) error {
 // ... existing stdin parsing ...

 // Parse transcript
 parser := transcript.NewParser()
 traces, err := parser.Parse(transcriptPath, sessionID)
 if err != nil {
  return fmt.Errorf("parse transcript: %w", err)
 }

 // Write traces to storage
 writer := storage.NewWriter()
 for _, trace := range traces {
  if err := writer.Write(trace); err != nil {
   fmt.Fprintf(os.Stderr, "write trace error: %v\n", err)
  }
 }

 // Update sessions registry with end time
 updateSessionEndTime(sessionID)

 // Kill the background watcher process
 stopWatcher(sessionID)

 return nil
}

func updateSessionEndTime(sessionID string) error {
 // Read sessions.jsonl, find matching session, append updated entry
 // (Simplified for now - can optimize later)
 return nil
}

func stopWatcher(sessionID string) error {
 // Find and kill the watch-transcript process for this session
 // Can use pkill or store PID file during SessionStart
 // For now, watcher can self-terminate when transcript stops growing
 return nil
}
```text

### Success Criteria

#### Automated Verification

- [ ] Parser compiles: `go build ./internal/transcript/...`
- [ ] Parser tests pass: `go test ./internal/transcript/... -v`
- [ ] Pricing tests pass: `go test ./internal/transcript/... -run TestPricingCalculator`
- [ ] Watcher compiles: `go build ./cmd/nova-go/...`
- [ ] Integration test: `go test ./cmd/nova-go/... -run TestProcessTranscript`
- [ ] Watcher test: `go test ./cmd/nova-go/... -run TestWatchTranscript`

#### Manual Verification

- [ ] Test live watcher:

  ```bash
  ./bin/nova-go watch-transcript test-session ~/.claude/projects/.../session.jsonl &
  # Let it run for a few seconds
  cat ~/.claude/traces/session-test-session-live.json | jq .
  # Should show running totals
  ```

- [ ] Parse real transcript:

  ```bash
  echo '{"session_id":"test","transcript_path":"'$HOME'/.claude/projects/.../session.jsonl"}' | \
    ./bin/nova-go process-transcript
  ```

- [ ] Verify traces generated with metrics:

  ```bash
  cat ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | \
    jq 'select(.session_id=="test") | .metrics'
  ```

- [ ] Check cost calculation is non-zero for sessions with usage
- [ ] Verify live stats update in real-time during active session

---

## Phase 3: Add Unit Tests with Real Transcript Data

### Overview

Create comprehensive test suite using actual transcript data from live Claude Code sessions.

### Changes Required

#### 1. Capture Real Transcript Samples

**File**: `internal/transcript/testdata/sample_transcript.jsonl`

Copy actual entries from a live session:

```bash
# Extract representative entries from current session
cat ~/.claude/projects/.../62157f1e-5efa-409b-b873-0f2461137911.jsonl | \
  jq -c 'select(.type == "assistant" and .message.content[].type == "tool_use") | .' | \
  head -20 > internal/transcript/testdata/sample_transcript.jsonl
```text

#### 2. Create Parser Tests

**File**: `internal/transcript/parser_test.go`

```go
package transcript

import (
 "testing"
)

func TestParseRealTranscript(t *testing.T) {
 parser := NewParser()

 // Use real transcript sample
 traces, err := parser.Parse("testdata/sample_transcript.jsonl", "test-session")
 if err != nil {
  t.Fatalf("parse failed: %v", err)
 }

 if len(traces) == 0 {
  t.Fatal("no traces extracted")
 }

 // Verify first trace has expected fields
 first := traces[0]
 if first.SessionID != "test-session" {
  t.Errorf("session_id = %q, want %q", first.SessionID, "test-session")
 }
 if first.ToolName == "" {
  t.Error("tool_name is empty")
 }
 if first.EventType != "tool_use" {
  t.Errorf("event_type = %q, want %q", first.EventType, "tool_use")
 }
}

func TestExtractToolUses(t *testing.T) {
 tests := []struct {
  name           string
  transcriptFile string
  wantToolCount  int
  wantTools      []string // tool names we expect
 }{
  {
   name:           "sample with read and bash",
   transcriptFile: "testdata/sample_transcript.jsonl",
   wantToolCount:  20, // adjust based on actual sample
   wantTools:      []string{"Read", "Bash", "Write"},
  },
 }

 parser := NewParser()
 for _, tt := range tests {
  t.Run(tt.name, func(t *testing.T) {
   traces, err := parser.Parse(tt.transcriptFile, "test")
   if err != nil {
    t.Fatalf("parse failed: %v", err)
   }

   if len(traces) < tt.wantToolCount {
    t.Errorf("got %d traces, want at least %d", len(traces), tt.wantToolCount)
   }

   // Check we found expected tools
   foundTools := make(map[string]bool)
   for _, trace := range traces {
    foundTools[trace.ToolName] = true
   }

   for _, tool := range tt.wantTools {
    if !foundTools[tool] {
     t.Errorf("did not find expected tool: %s", tool)
    }
   }
  })
 }
}

func TestTokenMetricsExtraction(t *testing.T) {
 parser := NewParser()
 traces, err := parser.Parse("testdata/sample_transcript.jsonl", "test")
 if err != nil {
  t.Fatalf("parse failed: %v", err)
 }

 // Find a trace with metrics
 var found bool
 for _, trace := range traces {
  if trace.Metrics.InputTokens > 0 || trace.Metrics.OutputTokens > 0 {
   found = true

   // Verify cost calculated
   if trace.Metrics.CostUSD == 0 {
    t.Error("cost not calculated despite having token counts")
   }

   // Verify cache tokens if present
   if trace.Metrics.CacheReadInputTokens > 0 {
    t.Logf("Found cache read tokens: %d", trace.Metrics.CacheReadInputTokens)
   }

   break
  }
 }

 if !found {
  t.Error("no traces with token metrics found")
 }
}
```text

#### 3. Create Pricing Calculator Tests

**File**: `internal/transcript/pricing_test.go`

```go
package transcript

import (
 "testing"
)

func TestPricingCalculator(t *testing.T) {
 calc := NewPricingCalculator()

 tests := []struct {
  name      string
  model     string
  usage     *Usage
  wantCost  float64 // approximate
  wantError bool
 }{
  {
   name:  "sonnet 4.5 basic",
   model: "claude-sonnet-4-5-20250929",
   usage: &Usage{
    InputTokens:  1000,
    OutputTokens: 500,
   },
   wantCost: 0.0105, // (1000/1M * $3) + (500/1M * $15) = $0.003 + $0.0075
  },
  {
   name:  "opus 4.5 with cache",
   model: "claude-opus-4-5-20251101",
   usage: &Usage{
    InputTokens:              1000,
    CacheCreationInputTokens: 50000,
    CacheReadInputTokens:     10000,
    OutputTokens:             500,
   },
   wantCost: 0.0, // Calculate manually
  },
  {
   name:  "haiku 3.5",
   model: "claude-haiku-3-5-20241022",
   usage: &Usage{
    InputTokens:  1000,
    OutputTokens: 500,
   },
   wantCost: 0.0028, // (1000/1M * $0.8) + (500/1M * $4)
  },
 }

 for _, tt := range tests {
  t.Run(tt.name, func(t *testing.T) {
   cost := calc.Calculate(tt.model, tt.usage)

   // Use approximate comparison (within 0.0001)
   diff := cost - tt.wantCost
   if diff < 0 {
    diff = -diff
   }
   if diff > 0.0001 {
    t.Errorf("Calculate(%s) = %f, want ~%f", tt.model, cost, tt.wantCost)
   }
  })
 }
}

func TestExtractModelFamily(t *testing.T) {
 tests := []struct {
  fullModel string
  want      string
 }{
  {"claude-sonnet-4-5-20250929", "claude-sonnet-4-5"},
  {"claude-opus-4-5-20251101", "claude-opus-4-5"},
  {"claude-haiku-3-5-20241022", "claude-haiku-3-5"},
 }

 for _, tt := range tests {
  got := extractModelFamily(tt.fullModel)
  if got != tt.want {
   t.Errorf("extractModelFamily(%q) = %q, want %q", tt.fullModel, got, tt.want)
  }
 }
}
```text

#### 4. Test Edge Cases

**File**: `internal/transcript/parser_test.go` (additional tests)

```go
func TestParseEmptyTranscript(t *testing.T) {
 // Test with empty file
 parser := NewParser()
 traces, err := parser.Parse("testdata/empty_transcript.jsonl", "test")
 if err != nil {
  t.Fatalf("parse empty transcript failed: %v", err)
 }
 if len(traces) != 0 {
  t.Errorf("got %d traces from empty file, want 0", len(traces))
 }
}

func TestParseMalformedLines(t *testing.T) {
 // Test with some malformed JSON lines mixed in
 parser := NewParser()
 traces, err := parser.Parse("testdata/malformed_transcript.jsonl", "test")
 if err != nil {
  t.Fatalf("parse failed: %v", err)
 }
 // Should skip malformed lines and continue
 if len(traces) == 0 {
  t.Error("should have extracted some valid traces despite malformed lines")
 }
}

func TestParseCompactedTranscript(t *testing.T) {
 // Test transcript after compaction (different structure?)
 parser := NewParser()
 traces, err := parser.Parse("testdata/compacted_transcript.jsonl", "test")
 if err != nil {
  t.Fatalf("parse compacted transcript failed: %v", err)
 }
 // Verify we can still extract traces
 t.Logf("Extracted %d traces from compacted transcript", len(traces))
}
```text

### Success Criteria

#### Automated Verification

- [ ] All parser tests pass: `go test ./internal/transcript/... -v`
- [ ] Test coverage > 80%: `go test ./internal/transcript/... -cover`
- [ ] Pricing tests pass: `go test ./internal/transcript/... -run TestPricing`
- [ ] Edge case tests pass: `go test ./internal/transcript/... -run TestParse`
- [ ] Race detector passes: `go test ./internal/transcript/... -race`

#### Manual Verification

- [ ] Test fixtures exist: `ls internal/transcript/testdata/`
- [ ] Sample transcript has real data: `wc -l internal/transcript/testdata/sample_transcript.jsonl`
- [ ] Tests produce detailed output: `go test -v ./internal/transcript/... | grep -i "tool"`

---

## Phase 4: Update Hook Configuration

### Overview

Switch from per-tool hooks to session lifecycle hooks in Claude Code configuration.

### Changes Required

#### 1. Create track-session Hook Script

**File**: `.claude/hooks/track-session.sh`

```bash
#!/bin/bash
set -e

# SessionStart hook - log session metadata to registry

# Get project directory
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Path to nova-go binary (prefer local build, fallback to installed)
NOVA_GO_BIN="$PROJECT_DIR/bin/nova-go"
if [[ ! -x "$NOVA_GO_BIN" ]]; then
    NOVA_GO_BIN="$(command -v nova-go 2>/dev/null || echo "")"
fi

# Exit silently if nova-go is not available
if [[ ! -x "$NOVA_GO_BIN" ]]; then
    exit 0
fi

# Read hook event from stdin and pass to nova-go track-session
cat | "$NOVA_GO_BIN" track-session

# Exit cleanly
exit 0
```text

```bash
chmod +x .claude/hooks/track-session.sh
```text

#### 2. Create process-session Hook Script

**File**: `.claude/hooks/process-session.sh`

```bash
#!/bin/bash
set -e

# SessionEnd hook - parse transcript and generate traces

# Get project directory
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Path to nova-go binary
NOVA_GO_BIN="$PROJECT_DIR/bin/nova-go"
if [[ ! -x "$NOVA_GO_BIN" ]]; then
    NOVA_GO_BIN="$(command -v nova-go 2>/dev/null || echo "")"
fi

# Exit silently if nova-go is not available
if [[ ! -x "$NOVA_GO_BIN" ]]; then
    exit 0
fi

# Read hook event from stdin and pass to nova-go process-transcript
cat | "$NOVA_GO_BIN" process-transcript

# Exit cleanly
exit 0
```text

```bash
chmod +x .claude/hooks/process-session.sh
```text

#### 3. Update .claude/settings.json

**File**: `.claude/settings.json`

Remove old PreToolUse/PostToolUse hooks, add new session hooks:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/track-session.sh"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/process-session.sh"
          }
        ]
      }
    ]
  },
  "enabledPlugins": {
    "beads@beads-marketplace": true
  }
}
```text

**Important:** Remove these sections if present:

- `"PreToolUse": [...]`
- `"PostToolUse": [...]`

### Success Criteria

#### Automated Verification

- [ ] Hook scripts are executable: `test -x .claude/hooks/track-session.sh`
- [ ] Hook scripts are executable: `test -x .claude/hooks/process-session.sh`
- [ ] Settings JSON is valid: `jq . .claude/settings.json > /dev/null`
- [ ] No PreToolUse hooks: `jq '.hooks | has("PreToolUse")' .claude/settings.json` returns `false`
- [ ] SessionStart configured: `jq '.hooks.SessionStart' .claude/settings.json | grep track-session`

#### Manual Verification

- [ ] Start new Claude session and verify session logged:

  ```bash
  tail -1 ~/.claude/traces/sessions.jsonl | jq .
  ```

- [ ] Exit Claude session and verify traces generated:

  ```bash
  cat ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | \
    jq 'select(.metrics.input_tokens > 0)' | head -3
  ```

- [ ] Verify traces have token usage and cost data
- [ ] Verify no errors in Claude Code output (Ctrl+O for verbose mode)

---

## Phase 5: Delete Old Per-Tool Hook Code

### Overview

Remove all unused per-tool hook implementation code and update documentation.

### Changes Required

#### 1. Delete Old Command Implementation

**File**: `cmd/nova-go/main.go`

Remove:

```go
// DELETE: Old trace command registration
rootCmd.AddCommand(newTraceCommand())
```text

Delete entire function:

```go
// DELETE: func newTraceCommand() *cobra.Command { ... }
// DELETE: func runTrace(cmd *cobra.Command, args []string) error { ... }
// DELETE: func buildTrace(hookEvent map[string]interface{}) map[string]interface{} { ... }
// DELETE: func determineEventType() string { ... }
```text

#### 2. Delete Hook Parser Package

Delete entire directory:

```bash
rm -rf internal/hook/
```text

Files removed:

- `internal/hook/parser.go`
- `internal/hook/parser_test.go`
- `internal/hook/types.go`

#### 3. Delete Old Trace Builder

**File**: `internal/trace/builder.go`

Delete entire file (no longer needed - transcript parser replaced it):

```bash
rm internal/trace/builder.go
rm internal/trace/builder_test.go
```text

Keep `internal/trace/types.go` if it defines TraceEvent used by transcript parser.

#### 4. Update Documentation

**File**: `README.md`

Update quick start section:

```markdown
## Quick Start

# Build and install
make build
make install

# Configure hooks (done automatically)
# Traces are generated at session end

# View traces
cat ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq .

# View sessions
cat ~/.claude/traces/sessions.jsonl | jq .
```text

**File**: `thoughts/shared/specs/claude-trace/02-hook-specification.md`

Add deprecation notice at top:

```markdown
> **⚠️ DEPRECATED:** This specification describes the old per-tool-use hook architecture
> which has been replaced by session-based transcript parsing. See the updated architecture
> in the main README and `nova-trace-refactor/plan.md`.
```text

#### 5. Update Build Scripts

**File**: `Makefile`

Ensure targets still work after deletions:

```makefile
build:
 @echo "Building nova-go..."
 go build -v -ldflags "-s -w" -o bin/nova-go ./cmd/nova-go

test:
 @echo "Running tests..."
 go test -v -race ./...

clean:
 rm -rf bin/
```text

### Success Criteria

#### Automated Verification

- [ ] Build succeeds after deletions: `make build`
- [ ] All tests pass: `make test`
- [ ] No references to old code: `grep -r "newTraceCommand" . --exclude-dir=.git` returns nothing
- [ ] No references to hook parser: `grep -r "internal/hook" . --exclude-dir=.git` returns nothing
- [ ] Lint passes: `golangci-lint run`
- [ ] Binary size check: `ls -lh bin/nova-go` (should be smaller)

#### Manual Verification

- [ ] Verify deleted files gone: `ls internal/hook/` returns "no such file"
- [ ] Verify `nova-go trace` command removed: `./bin/nova-go trace` returns error
- [ ] Verify new commands work: `./bin/nova-go track-session --help`
- [ ] Verify new commands work: `./bin/nova-go process-transcript --help`
- [ ] Start new Claude session and verify everything still works
- [ ] Check traces have full metrics (token counts, costs)

---

## Testing Strategy

### Unit Tests

**Parser Tests** (`internal/transcript/parser_test.go`):

- Parse real transcript samples
- Extract tool uses from content arrays
- Extract token usage from message.usage
- Handle malformed JSON lines gracefully
- Handle empty transcripts
- Handle compacted transcripts

**Pricing Tests** (`internal/transcript/pricing_test.go`):

- Calculate costs for Sonnet 4.5
- Calculate costs for Opus 4.5
- Calculate costs for Haiku 3.5
- Handle cache tokens correctly
- Extract model family from full model strings

**Integration Tests** (`cmd/nova-go/*_test.go`):

- Test track-session command end-to-end
- Test process-transcript command end-to-end
- Verify sessions.jsonl format
- Verify traces JSONL format

### Manual Testing Steps

1. **Install and configure:**

   ```bash
   make build && make install
   # Hooks already configured in .claude/settings.json
   ```

2. **Start new Claude session:**

   ```bash
   claude
   > "implement a simple hello world function"
   > /exit
   ```

3. **Verify live tracking works during session:**

   ```bash
   # While Claude is running, check live stats
   watch -n 1 'cat ~/.claude/traces/session-*-live.json | jq .'
   # Should see token counts incrementing in real-time
   ```

4. **Verify session logged:**

   ```bash
   tail -1 ~/.claude/traces/sessions.jsonl | jq .
   # Should show: {session_id, transcript_path, started_at, ended_at}
   ```

5. **Verify traces generated at session end:**

   ```bash
   cat ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | \
     jq 'select(.metrics.input_tokens > 0)'
   ```

6. **Verify metrics present:**
   - Live stats: input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd
   - Detailed traces: per-tool metrics
   - Cost calculations match between live and final

7. **Test error handling:**

   ```bash
   # Simulate missing transcript file
   echo '{"session_id":"bad","transcript_path":"/nonexistent"}' | \
     ./bin/nova-go process-transcript
   # Should fail gracefully, not crash
   ```

## Performance Considerations

**Session-Based Benefits:**

- Only 2 hook invocations per session (start + end)
- No per-tool overhead during session
- Transcript parsing happens async at session end
- User doesn't wait for trace processing

**Potential Issues:**

- Large transcript files (100+ MB) may take time to parse
- SessionEnd hook has 10-minute default timeout (should be sufficient)
- If parsing fails, no traces generated (log error but don't block)

**Optimizations (if needed):**

- Stream parse transcript instead of loading all into memory
- Skip non-assistant entries early
- Parallel processing of multiple tool uses

## References

- Original per-tool hook spec: `thoughts/shared/specs/claude-trace/02-hook-specification.md`
- Current implementation: `cmd/nova-go/main.go`, `internal/hook/*`, `internal/trace/*`
- Transcript samples: `docs/sample-transcript-path.md`
- Real transcript example: `~/.claude/projects/.../62157f1e-5efa-409b-b873-0f2461137911.jsonl`
- Claude Code hooks docs: <https://code.claude.com/docs/en/hooks>
