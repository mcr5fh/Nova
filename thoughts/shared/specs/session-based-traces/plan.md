# Session-Based Trace Storage Implementation Plan

## Overview

Refactor trace storage from per-day files (`traces-YYYY-MM-DD.jsonl`) to per-session files (`session-<uuid>.jsonl`). This makes session-based analysis, cost tracking, and cleanup much simpler.

## Current State Analysis

### Existing Architecture

**File Structure:**

```plaintext
~/.nova/repos/Nova/ruiters-spike/traces/
├── sessions.jsonl              ← All session start/end events (append-only log)
└── traces-2026-01-31.jsonl    ← ALL tool events from ALL sessions on Jan 31
```

**Key Files:**

- `internal/storage/writer.go:67` - Daily rotation logic (`traces-YYYY-MM-DD.jsonl`)
- `cmd/nova-go/process_transcript.go:51-82` - SessionEnd handler writes traces
- `cmd/nova-go/track_session.go:46-67` - SessionStart handler logs to `sessions.jsonl`
- `internal/paths/trace_path.go:15-32` - Determines trace directory from git context

**Current Flow:**

1. SessionStart → Log to `sessions.jsonl`
2. SessionEnd → Parse transcript → Write traces to daily file `traces-YYYY-MM-DD.jsonl`
3. All sessions on same day write to same file

### Key Discoveries

- Storage writer uses daily rotation based on date
- Writer opens/closes files automatically via `rotateFile()` method
- SessionID already available in both hooks
- `sessions.jsonl` serves as session registry

## Desired End State

### New Architecture

**File Structure:**

```plaintext
~/.nova/repos/Nova/ruiters-spike/traces/
├── sessions.jsonl                                          ← Session registry (unchanged)
├── session-80877dc8-2bdf-48bf-b161-33518f41403e.jsonl    ← All events for session 1
├── session-4c6b4351-b676-4d85-b384-40003f3ef633.jsonl    ← All events for session 2
└── session-51d6e7fe-f526-473e-9d76-7d8aedfcc473.jsonl    ← All events for session 3
```

**New Flow:**

1. SessionStart → Log to `sessions.jsonl` (no change)
2. SessionEnd → Parse transcript → Write traces to `session-<uuid>.jsonl`
3. Each session has its own isolated file

**Benefits:**

- ✅ Easy per-session analysis (single file to read)
- ✅ Simple cost calculation per session
- ✅ Straightforward cleanup (delete old session files)
- ✅ Better isolation (no mixing of session data)
- ✅ Simpler file locking (no concurrent session writes to same file)

### Verification

```bash
# 1. Session registry still works
cat ~/.nova/repos/Nova/ruiters-spike/traces/sessions.jsonl | jq .

# 2. Per-session trace files exist
ls ~/.nova/repos/Nova/ruiters-spike/traces/session-*.jsonl

# 3. Each session file contains only that session's events
SESSION_ID="80877dc8-2bdf-48bf-b161-33518f41403e"
cat ~/.nova/repos/Nova/ruiters-spike/traces/session-${SESSION_ID}.jsonl | \
  jq '.session_id' | sort -u
# Should output only: "80877dc8-2bdf-48bf-b161-33518f41403e"

# 4. Traces include full metrics
cat ~/.nova/repos/Nova/ruiters-spike/traces/session-${SESSION_ID}.jsonl | \
  jq '.metrics' | head -3
```

## What We're NOT Doing

- ❌ Backwards compatibility with daily files
- ❌ Migration tool for existing traces
- ❌ Reading from both formats during transition
- ❌ Aggregation files (daily/monthly rollups)
- ❌ Compression or archival automation

## Implementation Approach

This refactor consists of three main changes:

1. **Update Storage Writer** - Change from date-based to session-based file naming
2. **Update Session Handlers** - Pass session ID to writer
3. **Update Tests** - Reflect new file naming conventions

All changes maintain the same JSONL format and session registry structure.

---

## Phase 1: Refactor Storage Writer

### Overview

Update `internal/storage/writer.go` to write per-session files instead of per-day files.

### Changes Required

#### 1. Update Writer Struct

**File**: `internal/storage/writer.go:13-18`

```go
// OLD:
type Writer struct {
 traceDir    string
 currentDate string
 file        *os.File
 mu          sync.Mutex
}

// NEW:
type Writer struct {
 traceDir  string
 sessionID string  // Track which session this writer is for
 file      *os.File
 mu        sync.Mutex
}
```

#### 2. Update Constructor

**File**: `internal/storage/writer.go:20-31`

```go
// OLD:
func NewWriter(traceDir string) (*Writer, error) {
 if err := os.MkdirAll(traceDir, 0755); err != nil {
  return nil, fmt.Errorf("failed to create trace directory: %w", err)
 }

 w := &Writer{
  traceDir: traceDir,
 }

 return w, nil
}

// NEW:
func NewWriter(traceDir string, sessionID string) (*Writer, error) {
 if err := os.MkdirAll(traceDir, 0755); err != nil {
  return nil, fmt.Errorf("failed to create trace directory: %w", err)
 }

 w := &Writer{
  traceDir:  traceDir,
  sessionID: sessionID,
 }

 return w, nil
}
```

#### 3. Update Write Method

**File**: `internal/storage/writer.go:34-55`

```go
// OLD:
func (w *Writer) Write(data interface{}) error {
 w.mu.Lock()
 defer w.mu.Unlock()

 today := time.Now().Format("2006-01-02")

 // Check if we need to rotate to a new file
 if w.file == nil || w.currentDate != today {
  if err := w.rotateFile(today); err != nil {
   return fmt.Errorf("failed to rotate file: %w", err)
  }
 }

 // Encode and write the JSON line
 encoder := json.NewEncoder(w.file)
 if err := encoder.Encode(data); err != nil {
  return fmt.Errorf("failed to encode JSON: %w", err)
 }

 return nil
}

// NEW:
func (w *Writer) Write(data interface{}) error {
 w.mu.Lock()
 defer w.mu.Unlock()

 // Open file if not already open
 if w.file == nil {
  if err := w.openSessionFile(); err != nil {
   return fmt.Errorf("failed to open session file: %w", err)
  }
 }

 // Encode and write the JSON line
 encoder := json.NewEncoder(w.file)
 if err := encoder.Encode(data); err != nil {
  return fmt.Errorf("failed to encode JSON: %w", err)
 }

 return nil
}
```

#### 4. Replace rotateFile with openSessionFile

**File**: `internal/storage/writer.go:57-79`

```go
// DELETE rotateFile method entirely

// ADD new openSessionFile method:
func (w *Writer) openSessionFile() error {
 // Session file: session-<uuid>.jsonl
 filename := fmt.Sprintf("session-%s.jsonl", w.sessionID)
 filePath := filepath.Join(w.traceDir, filename)

 file, err := os.OpenFile(filePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
 if err != nil {
  return fmt.Errorf("failed to open trace file: %w", err)
 }

 w.file = file

 return nil
}
```

#### 5. Close Method (No Changes)

**File**: `internal/storage/writer.go:81-91`

```go
// No changes needed - Close remains the same
func (w *Writer) Close() error {
 w.mu.Lock()
 defer w.mu.Unlock()

 if w.file != nil {
  return w.file.Close()
 }

 return nil
}
```

### Success Criteria

#### Automated Verification

- [ ] Build succeeds: `go build ./internal/storage/...`
- [ ] Writer compiles: `go build ./cmd/nova-go/...`
- [ ] No unused imports: `goimports -l internal/storage/writer.go`

#### Manual Verification

- [ ] Test new writer manually:

```bash
# Create test writer with session ID
go run -c '
package main
import (
    "github.com/mattruiters/nova/internal/storage"
    "log"
)
func main() {
    w, _ := storage.NewWriter("/tmp/test-traces", "test-session-123")
    w.Write(map[string]string{"test": "data"})
    w.Close()
}
'

# Verify file created
ls /tmp/test-traces/session-test-session-123.jsonl
```

---

## Phase 2: Update Session Handlers

### Overview

Update SessionEnd handler to pass session ID to writer and write to per-session file.

### Changes Required

#### 1. Update process_transcript.go

**File**: `cmd/nova-go/process_transcript.go:46-84`

```go
// OLD:
func runProcessTranscript(cmd *cobra.Command, args []string) error {
 // ... stdin parsing ...

 // Parse transcript and generate traces
 parser := transcript.NewParser()
 traces, err := parser.Parse(transcriptPath, sessionID)
 if err != nil {
  return fmt.Errorf("parse transcript: %w", err)
 }

 // Write traces to storage
 tracesDir, err := paths.GetTraceDir()
 if err != nil {
  return fmt.Errorf("get trace dir: %w", err)
 }

 writer, err := storage.NewWriter(tracesDir)  // ← OLD: No session ID
 if err != nil {
  return fmt.Errorf("create writer: %w", err)
 }
 defer func() { _ = writer.Close() }()

 for _, trace := range traces {
  // ... convert trace ...
  if err := writer.Write(traceMap); err != nil {
   fmt.Fprintf(os.Stderr, "write trace error: %v\n", err)
  }
 }

 // ... rest of function ...
}

// NEW:
func runProcessTranscript(cmd *cobra.Command, args []string) error {
 // ... stdin parsing ...

 // Parse transcript and generate traces
 parser := transcript.NewParser()
 traces, err := parser.Parse(transcriptPath, sessionID)
 if err != nil {
  return fmt.Errorf("parse transcript: %w", err)
 }

 // Write traces to storage
 tracesDir, err := paths.GetTraceDir()
 if err != nil {
  return fmt.Errorf("get trace dir: %w", err)
 }

 writer, err := storage.NewWriter(tracesDir, sessionID)  // ← NEW: Pass session ID
 if err != nil {
  return fmt.Errorf("create writer: %w", err)
 }
 defer func() { _ = writer.Close() }()

 for _, trace := range traces {
  // ... convert trace ...
  if err := writer.Write(traceMap); err != nil {
   fmt.Fprintf(os.Stderr, "write trace error: %v\n", err)
  }
 }

 // ... rest of function ...
}
```

### Success Criteria

#### Automated Verification

- [ ] Build succeeds: `go build ./cmd/nova-go/...`
- [ ] No compile errors: `go build -v ./...`

#### Manual Verification

- [ ] Test with real session:

```bash
# Simulate SessionEnd hook
echo '{"session_id":"test-session-abc","transcript_path":"'$HOME'/.claude/projects/.../session.jsonl"}' | \
  ./bin/nova-go process-transcript

# Verify session file created
ls ~/.nova/repos/Nova/*/traces/session-test-session-abc.jsonl

# Verify traces written
cat ~/.nova/repos/Nova/*/traces/session-test-session-abc.jsonl | jq . | head -10
```

---

## Phase 3: Update Tests

### Overview

Update storage writer tests to expect per-session files instead of daily files.

### Changes Required

#### 1. Update TestWriter_Write

**File**: `internal/storage/writer_test.go:12-56`

```go
// OLD:
func TestWriter_Write(t *testing.T) {
 tmpDir := t.TempDir()

 writer, err := NewWriter(tmpDir)
 if err != nil {
  t.Fatalf("Failed to create writer: %v", err)
 }
 defer writer.Close()

 // ... write test data ...

 // Verify file was created with today's date
 today := time.Now().Format("2006-01-02")
 expectedFile := filepath.Join(tmpDir, "traces-"+today+".jsonl")  // ← OLD

 if _, err := os.Stat(expectedFile); os.IsNotExist(err) {
  t.Fatalf("Expected file %s does not exist", expectedFile)
 }

 // ... verify content ...
}

// NEW:
func TestWriter_Write(t *testing.T) {
 tmpDir := t.TempDir()
 sessionID := "test-session-123"

 writer, err := NewWriter(tmpDir, sessionID)  // ← NEW: Pass session ID
 if err != nil {
  t.Fatalf("Failed to create writer: %v", err)
 }
 defer writer.Close()

 // ... write test data ...

 // Verify file was created with session ID
 expectedFile := filepath.Join(tmpDir, "session-"+sessionID+".jsonl")  // ← NEW

 if _, err := os.Stat(expectedFile); os.IsNotExist(err) {
  t.Fatalf("Expected file %s does not exist", expectedFile)
 }

 // ... verify content ...
}
```

#### 2. Update TestWriter_CreateDirectoryIfMissing

**File**: `internal/storage/writer_test.go:58-79`

```go
// OLD:
writer, err := NewWriter(traceDir)

// NEW:
writer, err := NewWriter(traceDir, "test-session")
```

#### 3. Remove TestWriter_DailyRotation

**File**: `internal/storage/writer_test.go:81-120`

```go
// DELETE entire test - no longer relevant with per-session files
```

#### 4. Update TestWriter_MultipleEntries

**File**: `internal/storage/writer_test.go:122-162`

```go
// OLD:
writer, err := NewWriter(tmpDir)
// ... writes ...
today := time.Now().Format("2006-01-02")
filePath := filepath.Join(tmpDir, "traces-"+today+".jsonl")

// NEW:
sessionID := "test-session-multi"
writer, err := NewWriter(tmpDir, sessionID)
// ... writes ...
filePath := filepath.Join(tmpDir, "session-"+sessionID+".jsonl")
```

#### 5. Add New Test for Session Isolation

**File**: `internal/storage/writer_test.go` (add new test)

```go
func TestWriter_SessionIsolation(t *testing.T) {
 tmpDir := t.TempDir()

 // Create two writers for different sessions
 session1 := "session-aaa"
 session2 := "session-bbb"

 writer1, err := NewWriter(tmpDir, session1)
 if err != nil {
  t.Fatalf("Failed to create writer1: %v", err)
 }
 defer writer1.Close()

 writer2, err := NewWriter(tmpDir, session2)
 if err != nil {
  t.Fatalf("Failed to create writer2: %v", err)
 }
 defer writer2.Close()

 // Write to both sessions
 if err := writer1.Write(map[string]interface{}{"session": 1}); err != nil {
  t.Fatalf("Failed to write to session1: %v", err)
 }

 if err := writer2.Write(map[string]interface{}{"session": 2}); err != nil {
  t.Fatalf("Failed to write to session2: %v", err)
 }

 // Verify separate files exist
 file1 := filepath.Join(tmpDir, "session-"+session1+".jsonl")
 file2 := filepath.Join(tmpDir, "session-"+session2+".jsonl")

 if _, err := os.Stat(file1); os.IsNotExist(err) {
  t.Fatalf("Session 1 file does not exist")
 }

 if _, err := os.Stat(file2); os.IsNotExist(err) {
  t.Fatalf("Session 2 file does not exist")
 }

 // Verify files are different
 content1, _ := os.ReadFile(file1)
 content2, _ := os.ReadFile(file2)

 if string(content1) == string(content2) {
  t.Error("Session files should contain different data")
 }
}
```

### Success Criteria

#### Automated Verification

- [ ] All tests pass: `go test ./internal/storage/... -v`
- [ ] Test coverage maintained: `go test ./internal/storage/... -cover`
- [ ] No race conditions: `go test ./internal/storage/... -race`

#### Manual Verification

- [ ] Run tests with verbose output: `go test -v ./internal/storage/...`
- [ ] Verify test file cleanup: `ls /tmp/ | grep -i trace` (should be empty)

---

## Phase 4: Integration Testing

### Overview

End-to-end testing with real Claude sessions to verify the complete flow.

### Testing Steps

#### 1. Build and Install

```bash
# From project root
make build
make install

# Verify installation
which nova-go
nova-go --version
```

#### 2. Test SessionStart Hook

```bash
# Manually trigger SessionStart
echo '{"session_id":"manual-test-001","transcript_path":"/tmp/fake-transcript.jsonl","source":"startup"}' | \
  nova-go track-session

# Verify session logged
cat ~/.nova/repos/Nova/*/traces/sessions.jsonl | tail -1 | jq .
# Should show: {"session_id":"manual-test-001","started_at":"...","transcript_path":"...","source":"startup"}
```

#### 3. Test SessionEnd Hook with Real Transcript

```bash
# Create a minimal test transcript
cat > /tmp/test-transcript.jsonl << 'EOF'
{"type":"assistant","message":{"model":"claude-sonnet-4-5-20250929","content":[{"type":"tool_use","name":"Read","input":{"file_path":"test.txt"}}],"usage":{"input_tokens":100,"output_tokens":50,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}},"timestamp":"2026-01-31T20:00:00Z"}
EOF

# Trigger SessionEnd
echo '{"session_id":"manual-test-001","transcript_path":"/tmp/test-transcript.jsonl"}' | \
  nova-go process-transcript

# Verify session file created
ls ~/.nova/repos/Nova/*/traces/session-manual-test-001.jsonl

# Verify traces written
cat ~/.nova/repos/Nova/*/traces/session-manual-test-001.jsonl | jq .
```

#### 4. Test with Live Claude Session

```bash
# Start Claude Code session
claude

# Do some work...
> "read the README file"
> "list files in the current directory"
> /exit

# Check session file was created
ls -lh ~/.nova/repos/Nova/*/traces/session-*.jsonl | tail -1

# Verify traces include metrics
cat ~/.nova/repos/Nova/*/traces/session-*.jsonl | tail -1 | jq '.metrics'
```

#### 5. Verify No Daily Files Created

```bash
# Check that no traces-YYYY-MM-DD.jsonl files exist
ls ~/.nova/repos/Nova/*/traces/traces-*.jsonl 2>/dev/null && \
  echo "ERROR: Daily files still being created!" || \
  echo "SUCCESS: Only session files exist"
```

### Success Criteria

#### Automated Verification

- [ ] Build succeeds: `make build`
- [ ] Install succeeds: `make install`
- [ ] All unit tests pass: `go test ./... -v`
- [ ] Integration tests pass: `go test ./cmd/nova-go/... -v`

#### Manual Verification

- [ ] SessionStart creates entry in `sessions.jsonl`
- [ ] SessionEnd creates `session-<uuid>.jsonl` file
- [ ] Session files contain only traces for that session
- [ ] All traces include full metrics (tokens, cost)
- [ ] No `traces-YYYY-MM-DD.jsonl` files are created
- [ ] Multiple concurrent sessions create separate files
- [ ] Files have correct permissions (0644)

---

## Testing Strategy

### Unit Tests

**Storage Writer Tests** (`internal/storage/writer_test.go`):

- Create session file with correct naming
- Write multiple entries to same session file
- Handle directory creation for session files
- Test session isolation (different sessions → different files)
- Verify file permissions

**Parser Tests** (no changes needed):

- Existing transcript parser tests remain valid
- Session ID already passed through correctly

### Integration Tests

**End-to-End Session Flow** (`cmd/nova-go/*_test.go`):

- Test SessionStart → SessionEnd flow
- Verify session file contains all traces
- Test with multiple concurrent sessions
- Verify sessions.jsonl updated correctly

### Manual Testing Steps

1. **Clean slate test:**

   ```bash
   rm -rf ~/.nova/repos/Nova/*/traces/*
   # Start fresh Claude session
   # Verify only session files created
   ```

2. **Concurrent sessions test:**

   ```bash
   # Open 2 Claude windows simultaneously
   # Run commands in both
   # Verify separate session files
   ```

3. **Large session test:**

   ```bash
   # Run long Claude session with many tool calls
   # Verify file size is reasonable
   # Verify all traces present
   ```

## Performance Considerations

### Benefits of Per-Session Files

- **No file rotation overhead**: File opened once per session, not checked on every write
- **Better concurrency**: Different sessions write to different files (no contention)
- **Simpler locking**: Only one writer per session file

### Potential Issues

- **Many small files**: Long-lived projects may accumulate many session files
- **Directory listing**: `ls` may be slow with 1000+ session files

### Future Optimizations (Out of Scope)

- Archival system: Move old sessions to date-based subdirectories
- Compression: gzip old session files
- Cleanup command: `nova-go clean --older-than 30d`

## Migration Notes

**No migration needed** - Clean break approach:

- Old daily files remain in place but are not read
- New sessions create new per-session files
- Users can manually delete old `traces-YYYY-MM-DD.jsonl` files if desired

## References

- Existing implementation: `internal/storage/writer.go`
- Session handlers: `cmd/nova-go/track_session.go`, `cmd/nova-go/process_transcript.go`
- Previous refactor plan: `thoughts/shared/specs/nova-trace-refactor/plan.md`
- Transcript parser: `internal/transcript/parser.go`
