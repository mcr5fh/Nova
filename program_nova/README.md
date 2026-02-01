# Program Nova - Developer Documentation

This document is for developers working on Nova internals. For user documentation, see:
- [README.md](../README.md) - User guide and quick start
- [QUICKSTART.md](../QUICKSTART.md) - Step-by-step tutorial
- [SERVICES.md](../SERVICES.md) - Service management

## Overview

Program Nova is the execution engine and dashboard for the Nova task orchestration system. It reads CASCADE.md files (hierarchical task breakdowns), executes worker agents to complete tasks, and provides a real-time web dashboard for observability.

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

## Installation for Development

```bash
# Clone the repository
git clone https://github.com/yourusername/Nova.git
cd Nova

# Install in development mode
uv pip install -e .

# Or with pip
pip install -e .
```

## Testing

Run the test suite:

```bash
# Run all tests
uv run pytest program_nova/ -v

# Run specific test file
uv run pytest program_nova/engine/test_state.py -v

# Run with coverage
uv run pytest program_nova/ --cov=program_nova --cov-report=html
```

The test suite includes:
- Basic CRUD operations
- File locking under concurrent access
- Project-level timestamp management
- Task completion and failure handling
- Token usage tracking

## Development Workflow

### Running Services Locally

For development, run services interactively (not as daemons):

```bash
# Terminal 1: Run orchestrator
python -m program_nova.engine.orchestrator

# Terminal 2: Run dashboard
python -m program_nova.dashboard.server

# Terminal 3: Make changes and test
nova status
```

### Code Style

This project follows PEP 8 style guidelines. Before submitting changes:

```bash
# Format code
black program_nova/

# Check types
mypy program_nova/

# Run linter
ruff check program_nova/
```

### Adding New Features

1. Write tests first (TDD approach)
2. Implement the feature
3. Run tests to verify
4. Update documentation
5. Submit pull request

## Architecture Details

### State File Thread Safety

The StateManager uses file locking to ensure thread-safe access:

```python
# Exclusive write lock
with open(self.state_file, 'r+') as f:
    fcntl.flock(f.fileno(), fcntl.LOCK_EX)
    # ... modify state ...
    fcntl.flock(f.fileno(), fcntl.LOCK_UN)

# Shared read lock
with open(self.state_file, 'r') as f:
    fcntl.flock(f.fileno(), fcntl.LOCK_SH)
    # ... read state ...
    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
```

### Worker Process Management

Workers are spawned as separate processes:

```python
# Spawn worker
process = subprocess.Popen(
    ["python", "-m", "worker_agent", task_id],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

# Monitor with non-blocking reads
while process.poll() is None:
    output = process.stdout.readline()
    # Process output...
```

### Dashboard Real-Time Updates

The dashboard uses polling to update task status:

```javascript
// Poll every 2 seconds
setInterval(() => {
    fetch('/api/state')
        .then(response => response.json())
        .then(data => updateUI(data));
}, 2000);
```

## Contributing

See the main [README.md](../README.md) for contribution guidelines.
