# Session Metadata Enhancement Implementation Plan

## Overview

Enhance session trace storage to only capture human sessions with metadata (user_type, duration) written as the first line in each session file. Automated sessions are skipped entirely.

## Current State Analysis

### Existing Implementation

**SessionStart Hook** (`track_session.go`):

- Writes to `sessions.jsonl` registry with `started_at` timestamp
- Used for all sessions (human and automated)

**SessionEnd Hook** (`process_transcript.go`):

- Parses transcript and generates traces
- Writes to `session-{session-id}.jsonl`
- Appends end entry to `sessions.jsonl`
- Processes all sessions regardless of type

**Current File Structure:**

```plaintext
~/.nova/repos/Nova/ruiters-spike/traces/
├── sessions.jsonl                                          ← Registry of all sessions
├── session-66df6080-b3aa-4c73-bcb6-5afbd497172e.jsonl    ← Traces only
├── session-908f4de-6fce-4389-82e8-7ef59781faa5.jsonl
└── ...
```

**sessions.jsonl entries:**

```jsonl
{"session_id":"abc123","source":"startup","started_at":"2026-01-31T21:37:23Z","transcript_path":"..."}
{"ended_at":"2026-01-31T21:37:26Z","session_id":"abc123"}
```

### Key Discoveries

**SessionEnd Hook Input:**

```json
{
  "session_id": "4ec3c9d0-bd05-4020-9db4-151c03e644e9",
  "transcript_path": "/Users/mattruiters/.claude/projects/.../session.jsonl",
  "cwd": "/Users/mattruiters/Code/Projects/NovaHack/Nova",
  "hook_event_name": "SessionEnd",
  "reason": "prompt_input_exit"  // or "other" for automated
}
```

**User Type Detection:**

- `reason: "prompt_input_exit"` → Human interactive session
- `reason: "other"` → Automated session (`claude -p`)

### Current Limitations

1. **No filtering**: Both human and automated sessions stored
2. **Separate registry**: `sessions.jsonl` separate from trace files
3. **No metadata in trace files**: Session info not self-contained
4. **UUID-only filenames**: Can't sort files chronologically

## Desired End State

### New File Structure

```
~/.nova/repos/Nova/ruiters-spike/traces/
├── session-1738368000-66df6080-b3aa-4c73-bcb6-5afbd497172e.jsonl
├── session-1738368123-908f4de-6fce-4389-82e8-7ef59781faa5.jsonl
└── session-1738368456-cc4c574b-8aef-4049-a266-ccf82693f106.jsonl
```

**Only human sessions** - automated sessions not written to disk.

### Enhanced Session File Format

Each file contains session metadata as the first line, followed by traces:

```jsonl
{"session_id":"abc123","user_type":"human","duration_seconds":42,"started_at":"2026-01-31T21:37:23Z","ended_at":"2026-01-31T21:37:26Z"}
{"session_id":"abc123","trace_id":"...","tool_name":"Read","metrics":{...}}
{"session_id":"abc123","trace_id":"...","tool_name":"Bash","metrics":{...}}
```

### Verification

```bash
# List sessions chronologically (epoch prefix enables sorting)
ls -1 ~/.nova/repos/Nova/*/traces/session-*.jsonl | sort

# Extract metadata from all sessions
for f in ~/.nova/repos/Nova/*/traces/session-*.jsonl; do
  head -1 "$f" | jq '{session_id, user_type, duration_seconds}'
done

# Verify only human sessions exist
for f in ~/.nova/repos/Nova/*/traces/session-*.jsonl; do
  head -1 "$f" | jq -r .user_type
done | sort -u
# Should only output: "human"
```

## What We're NOT Doing

- ❌ Storing automated sessions (skip entirely)
- ❌ Separate `sessions.jsonl` registry (metadata in session files)
- ❌ SessionStart hook (only need SessionEnd)
- ❌ Historical data migration
- ❌ Backwards compatibility with old format
- ❌ Real-time session monitoring

## Implementation Approach

**Single Phase: Enhance SessionEnd Processing**

Modify `process_transcript.go` to:

1. Extract `reason` field from hook input
2. Skip processing if `reason != "prompt_input_exit"`
3. Parse transcript to get start/end timestamps
4. Calculate duration
5. Write to `session-{epoch}-{session-id}.jsonl` with metadata as first line
6. Remove `sessions.jsonl` registry writes

---

## Phase 1: Modify SessionEnd Handler

### Overview

Update `process_transcript.go` to filter for human sessions only and write enhanced session files with metadata.

### Changes Required

#### 1. Extract reason field and filter

**File**: `cmd/nova-go/process_transcript.go:24-36`

```go
// BEFORE:
func runProcessTranscript(cmd *cobra.Command, args []string) error {
 // Read hook input from stdin
 var input map[string]interface{}
 if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil {
  return fmt.Errorf("parse stdin: %w", err)
 }

 sessionID, _ := input["session_id"].(string)
 transcriptPath, _ := input["transcript_path"].(string)

 if sessionID == "" || transcriptPath == "" {
  return fmt.Errorf("missing required fields: session_id=%q, transcript_path=%q", sessionID, transcriptPath)
 }

// AFTER:
func runProcessTranscript(cmd *cobra.Command, args []string) error {
 // Read hook input from stdin
 var input map[string]interface{}
 if err := json.NewDecoder(os.Stdin).Decode(&input); err != nil {
  return fmt.Errorf("parse stdin: %w", err)
 }

 sessionID, _ := input["session_id"].(string)
 transcriptPath, _ := input["transcript_path"].(string)
 reason, _ := input["reason"].(string)

 if sessionID == "" || transcriptPath == "" {
  return fmt.Errorf("missing required fields: session_id=%q, transcript_path=%q", sessionID, transcriptPath)
 }

 // Only process human sessions
 if reason != "prompt_input_exit" {
  fmt.Fprintf(os.Stderr, "Skipping automated session %s (reason=%s)\n", sessionID, reason)
  return nil
 }
```

#### 2. Update storage writer to use epoch-prefixed filename

**File**: `internal/storage/writer.go:222-236`

Currently:

```go
func (w *Writer) openSessionFile() error {
 // Session file: session-<uuid>.jsonl
 filename := fmt.Sprintf("session-%s.jsonl", w.sessionID)
 filePath := filepath.Join(w.traceDir, filename)
 // ...
}
```

Change to:

```go
func (w *Writer) openSessionFile() error {
 // Session file: session-{epoch}-{uuid}.jsonl
 epoch := time.Now().Unix()
 filename := fmt.Sprintf("session-%d-%s.jsonl", epoch, w.sessionID)
 filePath := filepath.Join(w.traceDir, filename)
 // ...
}
```

#### 3. Write metadata as first line before traces

**File**: `cmd/nova-go/process_transcript.go:38-83`

```go
// BEFORE:
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

 writer, err := storage.NewWriter(tracesDir, sessionID)
 if err != nil {
  return fmt.Errorf("create writer: %w", err)
 }
 defer func() { _ = writer.Close() }()

 for _, trace := range traces {
  // Convert TraceEvent to map for storage writer
  traceMap := map[string]interface{}{
   "session_id": trace.SessionID,
   "trace_id":   trace.TraceID,
   "span_id":    trace.SpanID,
   "timestamp":  trace.Timestamp,
   "event_type": trace.EventType,
   "tool_name":  trace.ToolName,
   "metrics": map[string]interface{}{
    "input_tokens":                trace.Metrics.InputTokens,
    "output_tokens":               trace.Metrics.OutputTokens,
    "cache_creation_input_tokens": trace.Metrics.CacheCreationInputTokens,
    "cache_read_input_tokens":     trace.Metrics.CacheReadInputTokens,
    "cost_usd":                    trace.Metrics.CostUSD,
   },
   "tags": trace.Tags,
  }

  if len(trace.ToolInput) > 0 {
   traceMap["tool_input"] = trace.ToolInput
  }

  if err := writer.Write(traceMap); err != nil {
   fmt.Fprintf(os.Stderr, "write trace error: %v\n", err)
  }
 }

 // Update sessions registry with end time
 if err := updateSessionEndTime(sessionID); err != nil {
  fmt.Fprintf(os.Stderr, "update session end time error: %v\n", err)
 }

// AFTER:
 // Parse transcript and generate traces
 parser := transcript.NewParser()
 traces, err := parser.Parse(transcriptPath, sessionID)
 if err != nil {
  return fmt.Errorf("parse transcript: %w", err)
 }

 // Calculate session duration from traces
 var startedAt, endedAt time.Time
 if len(traces) > 0 {
  startedAt = traces[0].Timestamp
  endedAt = traces[len(traces)-1].Timestamp
 }
 duration := int(endedAt.Sub(startedAt).Seconds())

 // Write traces to storage
 tracesDir, err := paths.GetTraceDir()
 if err != nil {
  return fmt.Errorf("get trace dir: %w", err)
 }

 writer, err := storage.NewWriter(tracesDir, sessionID)
 if err != nil {
  return fmt.Errorf("create writer: %w", err)
 }
 defer func() { _ = writer.Close() }()

 // Write session metadata as first line
 metadata := map[string]interface{}{
  "session_id":       sessionID,
  "user_type":        "human",
  "duration_seconds": duration,
  "started_at":       startedAt.Format(time.RFC3339),
  "ended_at":         endedAt.Format(time.RFC3339),
 }
 if err := writer.Write(metadata); err != nil {
  return fmt.Errorf("write metadata: %w", err)
 }

 // Write traces
 for _, trace := range traces {
  // Convert TraceEvent to map for storage writer
  traceMap := map[string]interface{}{
   "session_id": trace.SessionID,
   "trace_id":   trace.TraceID,
   "span_id":    trace.SpanID,
   "timestamp":  trace.Timestamp,
   "event_type": trace.EventType,
   "tool_name":  trace.ToolName,
   "metrics": map[string]interface{}{
    "input_tokens":                trace.Metrics.InputTokens,
    "output_tokens":               trace.Metrics.OutputTokens,
    "cache_creation_input_tokens": trace.Metrics.CacheCreationInputTokens,
    "cache_read_input_tokens":     trace.Metrics.CacheReadInputTokens,
    "cost_usd":                    trace.Metrics.CostUSD,
   },
   "tags": trace.Tags,
  }

  if len(trace.ToolInput) > 0 {
   traceMap["tool_input"] = trace.ToolInput
  }

  if err := writer.Write(traceMap); err != nil {
   fmt.Fprintf(os.Stderr, "write trace error: %v\n", err)
  }
 }
```

#### 4. Remove sessions.jsonl registry code

**File**: `cmd/nova-go/process_transcript.go:95-119`

```go
// DELETE entire updateSessionEndTime function
// DELETE the call to updateSessionEndTime
```

#### 5. Remove or deprecate track_session.go

**Option A**: Delete `cmd/nova-go/track_session.go` entirely
**Option B**: Make it a no-op for backwards compatibility

Since we're not doing backwards compatibility (per "What We're NOT Doing"), delete it:

```bash
rm cmd/nova-go/track_session.go
```

And remove the command registration from `cmd/nova-go/main.go`.

### Success Criteria

#### Automated Verification

- [x] Code compiles: `go build ./cmd/nova-go`
- [x] No references to updateSessionEndTime: `grep -r "updateSessionEndTime" cmd/`
- [x] track_session removed: `test ! -f cmd/nova-go/track_session.go && echo "OK"`

#### Manual Verification

- [ ] Test with human session:

```bash
# Start Claude session
claude
> "read README"
> /exit

# Check file created with epoch prefix
ls ~/.nova/repos/Nova/*/traces/session-*.jsonl | tail -1

# Verify metadata is first line
head -1 ~/.nova/repos/Nova/*/traces/session-*.jsonl | tail -1 | jq .
# Should show: {"session_id":"...","user_type":"human","duration_seconds":...}

# Verify traces follow
tail -n +2 ~/.nova/repos/Nova/*/traces/session-*.jsonl | tail -1 | head -3 | jq .tool_name
```

- [ ] Test with automated session:

```bash
# Run automated session
claude -p "say hello"

# Verify NO new file created (automated sessions skipped)
# Count files before and after - should be same
```

- [ ] Verify epoch sorting:

```bash
# Create multiple human sessions
claude; # do work; /exit
sleep 2
claude; # do work; /exit

# List files - should be in chronological order
ls -1 ~/.nova/repos/Nova/*/traces/session-*.jsonl | tail -2
```

---

## Testing Strategy

### Integration Tests

**Human Session Test:**

1. Run human session with multiple tool calls
2. Verify file created: `session-{epoch}-{uuid}.jsonl`
3. Verify metadata line has correct user_type, duration
4. Verify trace lines follow metadata

**Automated Session Filtering Test:**

1. Run automated session (`claude -p`)
2. Verify no file created
3. Verify stderr shows "Skipping automated session"

**Chronological Sorting Test:**

1. Run 3 human sessions with 2 second delays
2. List files - verify epoch values increase
3. Verify `ls -1 ... | sort` shows chronological order

### Edge Cases

- Empty transcript (no traces) - should still write metadata line
- Very short session (< 1 second) - duration_seconds should be 0
- Missing reason field - should skip (treat as automated)

## Performance Considerations

### Benefits

- **Fewer files**: Only human sessions stored (~50-70% reduction if many automated sessions)
- **Faster lookups**: Epoch prefix enables chronological scanning
- **Self-contained**: No need to correlate with separate registry

### Storage Impact

- Average session file: 10-50 KB (metadata + traces)
- 1000 human sessions ≈ 10-50 MB

## Migration Notes

**Clean break approach:**

- Old files (`session-{uuid}.jsonl`) remain in place
- New files use `session-{epoch}-{uuid}.jsonl` format
- `sessions.jsonl` registry no longer updated
- User can manually delete old files if desired

## References

- Current implementation: `cmd/nova-go/process_transcript.go`
- Storage writer: `internal/storage/writer.go`
- Transcript parser: `internal/transcript/parser.go`
- Related spec: `thoughts/shared/specs/session-based-traces/plan.md`
