# Program Nova - Execution Engine + Dashboard

Program Nova reads a CASCADE.md file (a hierarchical task breakdown), executes worker agents to complete tasks, and provides a real-time web dashboard for observability.

## Directory Structure

```
program_nova/
├── cascade_state.json         # Shared state file (written by engine, read by dashboard)
├── logs/                      # Worker log files
│   ├── F1.log
│   ├── F2.log
│   └── ...
├── engine/                    # Execution engine
│   ├── orchestrator.py        # Main loop: parse cascade, resolve deps, spawn workers
│   ├── worker.py              # Worker management: spawn, monitor, capture output
│   ├── parser.py              # CASCADE.md parser → task graph + hierarchy
│   ├── state.py               # Read/write cascade_state.json with file locking
│   └── update_task.py         # CLI tool for workers to report status
├── dashboard/                 # Web dashboard
│   ├── server.py              # FastAPI backend: serves API + static files
│   ├── static/                # Frontend assets
│   │   ├── index.html         # Single-page app with drill-down views
│   │   ├── styles.css         # Styling
│   │   └── app.js             # Frontend logic: polling, rendering, navigation
│   └── rollup.py              # Compute rollup status/duration/tokens/cost
└── milestones.yaml            # Milestone definitions (trigger tasks + messages)
```

## Cascade State JSON Schema

The `cascade_state.json` file is the central primitive that connects the execution engine and the dashboard. It uses the following schema:

```json
{
  "project": {
    "name": "string",
    "cascade_file": "path to CASCADE.md",
    "started_at": "ISO timestamp or null",
    "completed_at": "ISO timestamp or null"
  },
  "tasks": {
    "<task_id>": {
      "status": "pending | in_progress | completed | failed",
      "worker_id": "string or null",
      "pid": "integer or null (OS process ID of the worker)",
      "started_at": "ISO timestamp or null",
      "completed_at": "ISO timestamp or null",
      "duration_seconds": "integer",
      "current_step": "string or null (last reported activity)",
      "token_usage": {
        "input_tokens": "integer",
        "output_tokens": "integer",
        "cache_read_tokens": "integer",
        "cache_creation_tokens": "integer"
      },
      "error": "string or null (failure reason if failed)",
      "commit_sha": "string or null",
      "files_changed": ["array of file paths"]
    }
  }
}
```

### Rules

- **File location**: Project root, named `cascade_state.json`
- **Writer**: Only the execution engine writes to this file
- **Reader**: The dashboard only reads it
- **Live duration**: For in-progress tasks, live duration is computed by the dashboard as `now - started_at`
- **Token usage**: Cumulative and updated as the worker progresses
- **Thread safety**: File locking (via `fcntl`) prevents corruption from concurrent access

## State Management (state.py)

The `state.py` module provides thread-safe read/write access to `cascade_state.json` using file locking.

### Usage Example

```python
from program_nova.engine.state import StateManager, TaskStatus

# Initialize state manager
sm = StateManager("cascade_state.json")

# Create initial state
sm.initialize(
    project_name="My Project",
    cascade_file="/path/to/CASCADE.md"
)

# Start a task
sm.update_task(
    task_id="F1",
    status=TaskStatus.IN_PROGRESS,
    worker_id="worker-1",
    pid=12345,
    started_at="2024-01-01T12:00:00Z"
)

# Update token usage
sm.update_task_tokens(
    task_id="F1",
    input_tokens=1000,
    output_tokens=500,
    cache_read_tokens=200
)

# Complete task
sm.complete_task(
    task_id="F1",
    completed_at="2024-01-01T12:05:00Z",
    duration_seconds=300,
    commit_sha="abc123",
    files_changed=["src/main.py"]
)

# Read current state
state = sm.read_state()
```

### Key Features

- **File locking**: Uses `fcntl.LOCK_EX` for exclusive writes and `fcntl.LOCK_SH` for shared reads
- **Atomic updates**: Read-modify-write operations are atomic
- **Thread-safe**: Multiple threads/processes can safely access the state file
- **Type-safe**: Uses `TaskStatus` enum for status values

## Testing

Run the test suite:

```bash
python3 -m pytest program_nova/engine/test_state.py -v
```

The test suite includes:
- Basic CRUD operations
- File locking under concurrent access
- Project-level timestamp management
- Task completion and failure handling
- Token usage tracking
