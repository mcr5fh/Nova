# Sample Claude Code Hook Input (Raw)

These are examples of the **raw JSON input** that Claude Code sends to hook handlers via stdin. This is what `nova-go trace` receives BEFORE processing.

## Hook Input Structure

Claude Code sends this structure for all hooks (PreToolUse, PostToolUse, UserPromptSubmit):

```typescript
{
  session_id: string;           // Claude session ID
  transcript_path: string;       // Path to session transcript
  cwd: string;                   // Current working directory
  permission_mode: string;       // "ask" | "yolo" | "read-only"
  hook_event_name: string;       // "PreToolUse" | "PostToolUse" | "UserPromptSubmit"

  // Tool-specific fields (PreToolUse, PostToolUse only)
  tool_name?: string;            // "Bash" | "Read" | "Write" | "Edit" | etc.
  tool_use_id?: string;          // Unique tool invocation ID
  tool_input?: object;           // Tool parameters
  tool_output?: object;          // Tool result (PostToolUse only)

  // User prompt (UserPromptSubmit only)
  prompt?: string;               // User's input text
}
```

---

## Example 1: PostToolUse - Bash Command

This is sent AFTER a bash command executes:

```json
{
  "session_id": "b32ac98b-8104-4265-b9fc-a6dce4ecc447",
  "transcript_path": "/Users/mattruiters/.claude/sessions/b32ac98b-8104-4265-b9fc-a6dce4ecc447/transcript.jsonl",
  "cwd": "/Users/mattruiters/Code/Projects/NovaHack/Nova",
  "permission_mode": "yolo",
  "hook_event_name": "PostToolUse",
  "tool_name": "Bash",
  "tool_use_id": "toolu_01A2B3C4D5E6F7",
  "tool_input": {
    "command": "bd show Nova-c3n.8",
    "description": "Check QA task status"
  },
  "tool_output": {
    "exit_code": 0,
    "stdout": "○ Nova-c3n.8 · QA: Verify nova-go trace MVP implementation   [● P2 · IN_PROGRESS]\nOwner: Ruiters · Type: task\nCreated: 2026-01-31 · Updated: 2026-01-31\n\nDESCRIPTION\nValidate: 1) Build succeeds, 2) Manual stdin test works...",
    "stderr": ""
  }
}
```

**Key fields:**

- `tool_output.exit_code` - Command exit status
- `tool_output.stdout` - Command standard output
- `tool_output.stderr` - Command standard error
- `tool_input.command` - Full command that was executed
- `tool_input.description` - Optional description from Claude

---

## Example 2: PostToolUse - Read File

This is sent AFTER Claude reads a file:

```json
{
  "session_id": "b32ac98b-8104-4265-b9fc-a6dce4ecc447",
  "transcript_path": "/Users/mattruiters/.claude/sessions/b32ac98b-8104-4265-b9fc-a6dce4ecc447/transcript.jsonl",
  "cwd": "/Users/mattruiters/Code/Projects/NovaHack/Nova",
  "permission_mode": "yolo",
  "hook_event_name": "PostToolUse",
  "tool_name": "Read",
  "tool_use_id": "toolu_01H8I9J0K1L2",
  "tool_input": {
    "file_path": "/Users/mattruiters/Code/Projects/NovaHack/Nova/cmd/nova-go/main.go"
  },
  "tool_output": {
    "content": "package main\n\nimport (\n\t\"encoding/json\"\n\t\"fmt\"\n\t\"io\"\n\t\"os\"\n\t\"path/filepath\"\n\n\t\"github.com/google/uuid\"\n\t\"github.com/mattruiters/nova/internal/storage\"\n\t\"github.com/spf13/cobra\"\n)\n\nfunc main() {\n\tif err := newRootCommand().Execute(); err != nil {\n\t\tfmt.Fprintf(os.Stderr, \"Error: %v\\n\", err)\n\t\tos.Exit(1)\n\t}\n}\n...",
    "line_count": 143,
    "file_size": 2847
  }
}
```

**Key fields:**

- `tool_input.file_path` - Absolute path to file read
- `tool_output.content` - File contents (may be truncated)
- `tool_output.line_count` - Number of lines read
- `tool_output.file_size` - Size in bytes

---

## Example 3: PostToolUse - Write File

This is sent AFTER Claude writes a file:

```json
{
  "session_id": "b32ac98b-8104-4265-b9fc-a6dce4ecc447",
  "transcript_path": "/Users/mattruiters/.claude/sessions/b32ac98b-8104-4265-b9fc-a6dce4ecc447/transcript.jsonl",
  "cwd": "/Users/mattruiters/Code/Projects/NovaHack/Nova",
  "permission_mode": "yolo",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_use_id": "toolu_01M3N4O5P6Q7",
  "tool_input": {
    "file_path": "/Users/mattruiters/Code/Projects/NovaHack/Nova/internal/trace/types.go",
    "content": "package trace\n\nimport \"time\"\n\n// TraceEvent represents a single hook event captured during Claude execution\ntype TraceEvent struct {\n\tSessionID  string    `json:\"session_id\"`\n\tTimestamp  time.Time `json:\"timestamp\"`\n\tEventType  string    `json:\"event_type\"`\n\t// ... more fields\n}\n"
  },
  "tool_output": {
    "success": true,
    "bytes_written": 847,
    "file_existed": false
  }
}
```

**Key fields:**

- `tool_input.file_path` - Where file was written
- `tool_input.content` - Full file contents
- `tool_output.success` - Whether write succeeded
- `tool_output.bytes_written` - Size of data written
- `tool_output.file_existed` - Whether file was overwritten

---

## Example 4: PreToolUse - Bash Command

This is sent BEFORE a bash command executes:

```json
{
  "session_id": "b32ac98b-8104-4265-b9fc-a6dce4ecc447",
  "transcript_path": "/Users/mattruiters/.claude/sessions/b32ac98b-8104-4265-b9fc-a6dce4ecc447/transcript.jsonl",
  "cwd": "/Users/mattruiters/Code/Projects/NovaHack/Nova",
  "permission_mode": "yolo",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_use_id": "toolu_01R2S3T4U5V6",
  "tool_input": {
    "command": "make build",
    "description": "Build the nova-go binary"
  }
}
```

**Note:** PreToolUse has NO `tool_output` - the tool hasn't executed yet!

---

## Example 5: UserPromptSubmit

This is sent when the user submits a prompt:

```json
{
  "session_id": "b32ac98b-8104-4265-b9fc-a6dce4ecc447",
  "transcript_path": "/Users/mattruiters/.claude/sessions/b32ac98b-8104-4265-b9fc-a6dce4ecc447/transcript.jsonl",
  "cwd": "/Users/mattruiters/Code/Projects/NovaHack/Nova",
  "permission_mode": "yolo",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "please break up the work for the claude hook I want to create and implement it"
}
```

**Key fields:**

- `prompt` - The user's input text
- NO tool_name, tool_input, or tool_output

---

## What Nova-Go Trace Does With This

Our `nova-go trace` command:

1. **Receives** this JSON via stdin
2. **Parses** into `HookInput` struct
3. **Builds** a `TraceEvent` with:
   - Generated `span_id` (UUID)
   - Mapped `event_type` (pre_tool_use, post_tool_use, user_prompt)
   - Preserved tool info (name, input, output)
   - Empty `metrics` (MVP - no token counting yet)
4. **Writes** to `.claude/traces/traces-YYYY-MM-DD.jsonl`

## What We're NOT Capturing (Yet)

**Phase 2 features:**

- Token counting (input_tokens, output_tokens)
- Cost estimation (cost_usd)
- Duration metrics (start/end timestamps)
- Beads task context (task_id from `.beads/issues/`)
- File operation counters (files_read, files_written)

See `thoughts/shared/specs/claude-trace/02-hook-specification.md` lines 63-89.

---

## Testing

You can test the hook handler manually:

```bash
# Test with sample PostToolUse event
cat docs/sample-claude-hook-input.json | ./bin/nova-go trace

# Check the trace was written
tail -1 .claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq .
```

---

## Hook Configuration

In `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/nova-trace.sh"
      }]
    }],
    "PostToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/nova-trace.sh"
      }]
    }]
  }
}
```

The `nova-trace.sh` script pipes stdin to `nova-go trace`.
