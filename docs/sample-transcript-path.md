# Real Transcript Path Example

From our current session (ID: `62157f1e-5efa-409b-b873-0f2461137911`):

```text
/Users/mattruiters/.claude/projects/-Users-mattruiters-Code-Projects-NovaHack-Nova/62157f1e-5efa-409b-b873-0f2461137911.jsonl
```text

## Path Structure

```text
~/.claude/projects/<encoded-project-path>/<session-id>.jsonl
```text

Where:

- `<encoded-project-path>` = URL-safe encoding of absolute project path
  - Example: `/Users/mattruiters/Code/Projects/NovaHack/Nova`
  - Becomes: `-Users-mattruiters-Code-Projects-NovaHack-Nova`

- `<session-id>` = UUID v4 session identifier
  - Example: `62157f1e-5efa-409b-b873-0f2461137911`

## What Hooks Receive

When a hook fires, Claude Code sends this path in the `transcript_path` field:

```json
{
  "session_id": "62157f1e-5efa-409b-b873-0f2461137911",
  "transcript_path": "/Users/mattruiters/.claude/projects/-Users-mattruiters-Code-Projects-NovaHack-Nova/62157f1e-5efa-409b-b873-0f2461137911.jsonl",
  "cwd": "/Users/mattruiters/Code/Projects/NovaHack/Nova",
  "permission_mode": "yolo",
  "hook_event_name": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "bd show Nova-c3n" },
  "tool_response": { "exit_code": 0, "stdout": "..." }
}
```text

## Transcript Format

The transcript is a JSONL file (one JSON object per line) containing the conversation history.

**Each entry has:**

- Message exchanges (user, assistant)
- Tool calls and results
- Usage statistics (tokens, costs)

## Phase 2: Parsing for Metrics

To extract token usage and costs for our trace system, Phase 2 will:

1. **Read transcript path** from hook input
2. **Parse JSONL** entries
3. **Find usage events** (token counts)
4. **Calculate costs** based on model pricing
5. **Enrich trace events** with metrics

Example pseudocode:

```python
def enrich_with_usage(hook_input):
    transcript_path = hook_input['transcript_path']

    # Read and parse transcript
    with open(transcript_path) as f:
        entries = [json.loads(line) for line in f]

    # Find most recent usage entry
    usage = [e for e in entries if e.get('type') == 'usage'][-1]

    return {
        'input_tokens': usage['input_tokens'],
        'output_tokens': usage['output_tokens'],
        'cost_usd': calculate_cost(usage, model='sonnet-4.5')
    }
```text

## File Size

This session's transcript is currently **125 KB** with ongoing conversation.
