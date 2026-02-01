# Beads CLI Reference for Nova Integration

This document describes the Beads CLI commands used by the Nova orchestration engine.

## Overview

Beads (`bd`) is a lightweight issue tracker with first-class dependency support. Nova uses Beads as the source of truth for task hierarchy, dependencies, and status tracking.

## Core Commands Used by Nova

### Task Creation

```bash
# Create a root task
bd create "Task title" \
  --description "Detailed description" \
  --type task

# Create a subtask with parent
bd create "Subtask title" \
  --description "Subtask description" \
  --parent bd-xxx \
  --type task

# Create with dependencies
bd create "Task with deps" \
  --description "..." \
  --deps "bd-abc,bd-def"
```

**Flags:**
- `--description` / `-d`: Task description
- `--parent`: Parent bead ID for hierarchical tasks
- `--type` / `-t`: Issue type (task, bug, feature, epic, etc.)
- `--deps`: Comma-separated list of dependency IDs
- `--priority` / `-p`: Priority (0-4, 0=highest)
- `--labels` / `-l`: Comma-separated labels
- `--json`: Output in JSON format (used by Nova for parsing)

**Returns:** Bead ID (e.g., `bd-a3f8e9`)

### Dependency Management

```bash
# Add a blocking dependency
# "bd-blocker blocks bd-blocked"
bd dep add bd-blocked bd-blocker

# Alternative shorthand
bd dep bd-blocker --blocks bd-blocked

# List dependencies for a task
bd dep list bd-xxx

# Show dependency tree
bd dep tree bd-xxx
```

**Dependency semantics:**
- `bd dep add bd-blocked bd-blocker`: bd-blocked depends on (waits for) bd-blocker
- A task can only execute after all its blockers are completed

### Status Updates

```bash
# Mark task as in progress
bd update bd-xxx --status in_progress

# Mark task as completed
bd update bd-xxx --status completed

# Mark task as open (for retries)
bd update bd-xxx --status open

# Update with JSON output for parsing
bd update bd-xxx --status completed --json
```

**Status values:**
- `open`: Ready to be worked on (default)
- `in_progress`: Currently being executed
- `completed`: Successfully finished
- `blocked`: Has unmet dependencies (automatically managed by `bd`)

### Querying Ready Tasks

```bash
# Find all ready tasks (no blockers, open or in_progress)
bd ready

# Find ready tasks under a specific parent
bd ready --parent bd-xxx

# With JSON output
bd ready --parent bd-xxx --json

# Include task details
bd ready --parent bd-xxx --limit 10
```

**Useful flags:**
- `--parent`: Filter to descendants of a bead
- `--assignee` / `-a`: Filter by assignee
- `--label` / `-l`: Filter by labels
- `--limit` / `-n`: Maximum results (default 10)
- `--unassigned` / `-u`: Show only unassigned tasks
- `--json`: JSON output for programmatic parsing

### Label Management

```bash
# Add size label
bd label add bd-xxx size:XS

# Add multiple labels
bd label add bd-xxx size:XS type:implementation

# Remove a label
bd label remove bd-xxx size:S

# List labels for a task
bd label list bd-xxx
```

**Common labels for Nova:**
- `size:XS`, `size:S`, `size:M`, `size:L`, `size:XL`: Task size
- `agent:planner`, `agent:worker`, `agent:verifier`: Which agent handled the task
- `retry:1`, `retry:2`, etc.: Retry attempts

### Retrieving Task Details

```bash
# Show full task details
bd show bd-xxx

# With JSON output (for parsing)
bd show bd-xxx --json

# List tasks with filters
bd list --parent bd-xxx --json
```

## JSON Output Format

When using `--json` flag, Beads outputs structured data that Nova can parse:

```json
{
  "id": "bd-a3f8e9",
  "title": "Implement feature X",
  "description": "Full description here",
  "status": "open",
  "priority": 2,
  "labels": ["size:XS", "type:implementation"],
  "parent": "bd-parent",
  "dependencies": ["bd-dep1", "bd-dep2"],
  "created_at": "2026-01-31T12:00:00Z",
  "updated_at": "2026-01-31T12:30:00Z"
}
```

## Nova Integration Patterns

### Task Decomposition Flow

```bash
# 1. Create root task
ROOT_ID=$(bd create "Build feature X" --description "..." --json | jq -r '.id')

# 2. Create subtasks with dependencies
SUB1=$(bd create "Subtask 1" --parent $ROOT_ID --json | jq -r '.id')
SUB2=$(bd create "Subtask 2" --parent $ROOT_ID --deps $SUB1 --json | jq -r '.id')
SUB3=$(bd create "Subtask 3" --parent $ROOT_ID --deps $SUB1 --json | jq -r '.id')

# 3. Add size labels
bd label add $SUB1 size:XS
bd label add $SUB2 size:S  # needs further decomposition
bd label add $SUB3 size:XS

# 4. Query ready XS tasks
bd ready --parent $ROOT_ID --json | jq '.[] | select(.labels[] | contains("size:XS"))'
```

### Execution Lifecycle

```bash
# 1. Get ready XS tasks
READY=$(bd ready --parent $ROOT_ID --label size:XS --json)

# 2. Mark as in progress before execution
bd update bd-xxx --status in_progress

# 3. Execute task via Claude CLI
# (Nova executes: claude --dangerously-skip-permissions -p "...")

# 4. Verify completion via BAML

# 5. Mark as completed if verified
bd update bd-xxx --status completed

# 6. Or reopen for retry if failed
bd update bd-xxx --status open
bd label add bd-xxx retry:1
```

## Global Flags

All `bd` commands support these global flags:

- `--json`: Output in JSON format (essential for Nova)
- `--quiet` / `-q`: Suppress non-essential output
- `--verbose` / `-v`: Enable debug output
- `--db string`: Database path (auto-discovered by default)
- `--no-daemon`: Force direct storage mode
- `--readonly`: Read-only mode (for safe queries)

## Error Handling

**Common errors:**
- `issue not found`: Invalid bead ID
- `circular dependency`: Dependency cycle detected
- `database locked`: Another process has lock (retry with backoff)

**Recommendations:**
- Use `--json` for all programmatic access
- Check exit codes: 0 = success, non-zero = error
- Parse stderr for error messages
- Implement retries with exponential backoff for lock contention

## Performance Considerations

- Beads stores data in SQLite with JSONL sync
- Each write triggers auto-sync by default
- For bulk operations, consider `--no-auto-flush`
- Use `--readonly` flag for queries to avoid lock contention

## Example: Complete Nova Task Flow

```bash
#!/bin/bash
set -e

# Create root task from spec
ROOT=$(bd create "Implement authentication" \
  --description "Add OAuth2 login flow" \
  --type feature \
  --json | jq -r '.id')

echo "Created root task: $ROOT"

# Size root task (via BAML)
# ... BAML returns "L" size

# Decompose into subtasks (via BAML planning)
SUB1=$(bd create "Add OAuth2 client config" \
  --parent $ROOT \
  --description "Configure OAuth2 provider settings" \
  --json | jq -r '.id')

SUB2=$(bd create "Implement login endpoint" \
  --parent $ROOT \
  --deps $SUB1 \
  --description "Create /auth/login endpoint" \
  --json | jq -r '.id')

SUB3=$(bd create "Add callback handler" \
  --parent $ROOT \
  --deps $SUB2 \
  --description "Handle OAuth2 callback" \
  --json | jq -r '.id')

# Size subtasks
bd label add $SUB1 size:XS
bd label add $SUB2 size:XS
bd label add $SUB3 size:XS

# Execute ready XS tasks
for task in $SUB1 $SUB2 $SUB3; do
  # Check if ready (deps satisfied)
  READY=$(bd ready --json | jq -r --arg id "$task" '.[] | select(.id == $id) | .id')

  if [ -n "$READY" ]; then
    echo "Executing $task..."
    bd update $task --status in_progress

    # Execute via Claude CLI
    # claude --dangerously-skip-permissions -p "Execute task $task"

    # Verify and mark complete
    bd update $task --status completed
  fi
done

# Check completion
bd show $ROOT --json | jq '.status'
```

## References

- Full Beads documentation: Run `bd --help`
- Dependency management: `bd dep --help`
- Task creation: `bd create --help`
- Query operations: `bd ready --help`, `bd list --help`
