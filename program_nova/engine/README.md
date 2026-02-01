# Worker Module

The `worker.py` module provides subprocess management for spawning, monitoring, and tracking Claude Code agents as they execute tasks.

## Features

- **Subprocess Management**: Spawn Claude Code agents as OS subprocesses
- **Log Capture**: Automatically capture stdout/stderr to `logs/<task_id>.log`
- **Process Monitoring**: Check if workers are alive, get exit codes, terminate gracefully
- **Token Usage Tracking**: Parse and accumulate token usage from agent output
- **Status Tracking**: Track worker lifecycle (pending → running → completed/failed)

## Quick Start

```python
from worker import Worker, WorkerStatus

# Create a worker for a task
worker = Worker(task_id="F1", task_description="Implement core types")

# Start the worker with a command
worker.start(command=["claude", "code", "--task", "Implement core types"])

# Monitor execution
while worker.is_alive():
    print(f"Worker running... PID: {worker.pid}")
    time.sleep(1)

# Wait for completion
exit_code = worker.wait()

# Get results
if worker.status == WorkerStatus.COMPLETED:
    print("Task completed successfully!")
    tokens = worker.get_token_usage()
    print(f"Used {tokens['input_tokens']} input tokens")
else:
    print("Task failed!")

# Read the log
with open(worker.log_path, "r") as f:
    print(f.read())
```

## API Reference

### Worker Class

#### Constructor

```python
Worker(task_id: str, task_description: str)
```

Creates a new worker instance.

**Parameters:**
- `task_id`: Unique identifier (e.g., "F1", "P3")
- `task_description`: Human-readable task description

**Attributes:**
- `task_id`: The task identifier
- `task_description`: Task description
- `status`: Current status (WorkerStatus enum)
- `pid`: Process ID (int or None)
- `log_path`: Path to log file (Path object)

#### Methods

##### start(command: List[str]) -> None

Spawns the subprocess and begins log capture.

**Parameters:**
- `command`: Command and arguments to execute

**Side effects:**
- Creates log file at `logs/<task_id>.log`
- Sets status to RUNNING
- Begins capturing stdout/stderr

**Example:**
```python
worker.start(command=["echo", "hello"])
```

##### is_alive() -> bool

Check if the process is still running.

**Returns:** True if running, False if exited

##### get_exit_code() -> Optional[int]

Get the process exit code.

**Returns:** Exit code (0=success, non-zero=failure) or None if still running

##### wait(timeout: Optional[float] = None) -> int

Wait for process completion.

**Parameters:**
- `timeout`: Maximum wait time in seconds (None = forever)

**Returns:** Exit code

**Side effects:**
- Updates status based on exit code
- Closes log file
- Parses token usage from logs

##### terminate() -> None

Gracefully terminate the process.

Sends SIGTERM and waits for exit. If process doesn't exit within 5 seconds, sends SIGKILL.

**Side effects:**
- Sets status to FAILED
- Closes log file

##### get_token_usage() -> Dict[str, int]

Get accumulated token usage metrics.

**Returns:** Dictionary with keys:
- `input_tokens`
- `output_tokens`
- `cache_read_tokens`
- `cache_creation_tokens`

##### get_status_dict() -> Dict

Get complete worker status as a dictionary.

**Returns:** Dictionary with all worker state suitable for JSON serialization

### WorkerStatus Enum

- `PENDING`: Worker created but not started
- `RUNNING`: Worker process is executing
- `COMPLETED`: Worker finished successfully (exit code 0)
- `FAILED`: Worker failed (non-zero exit) or was terminated

## Token Usage Tracking

The worker automatically parses token usage from log output. It looks for lines matching:

```
Token usage: input=1234, output=567, cache_read=890, cache_creation=123
```

Multiple token usage reports are accumulated. This format matches Claude Code's output format.

## Log Files

All worker output is captured to `logs/<task_id>.log`. The log includes:
- All stdout from the process
- All stderr (merged into stdout)
- Real-time updates as the worker runs

Log files are line-buffered for immediate visibility of progress.

## Testing

Run the test suite:

```bash
uv run pytest test_worker.py -v
```

Run example usage:

```bash
uv run python example_worker_usage.py
```

## Integration with Orchestrator

The Worker module is designed to be used by the orchestrator module, which:
1. Parses CASCADE.md to get task definitions
2. Resolves dependencies
3. Creates Worker instances for ready tasks
4. Starts workers with appropriate commands
5. Monitors progress and updates shared state
6. Handles failures and retries

Example orchestrator usage:

```python
from worker import Worker

# Create worker for a ready task
worker = Worker(
    task_id="F1",
    task_description="Implement core types and interfaces"
)

# Build command for Claude Code
command = [
    "claude", "code",
    "--task", worker.task_description,
    "--context", "program_nova project"
]

# Start execution
worker.start(command)

# Update shared state with worker info
state["tasks"][worker.task_id] = {
    "status": worker.status.value,
    "pid": worker.pid,
    "started_at": datetime.now().isoformat(),
    # ... other fields
}

# Monitor and update state periodically
while worker.is_alive():
    state["tasks"][worker.task_id]["token_usage"] = worker.get_token_usage()
    write_state(state)
    time.sleep(2)

# Finalize
worker.wait()
state["tasks"][worker.task_id].update({
    "status": worker.status.value,
    "completed_at": datetime.now().isoformat(),
    "token_usage": worker.get_token_usage(),
    "exit_code": worker.get_exit_code(),
})
write_state(state)
```

## File Structure

```
program_nova/
├── engine/
│   ├── __init__.py
│   ├── worker.py              # Main worker module
│   ├── test_worker.py         # Test suite
│   ├── example_worker_usage.py  # Usage examples
│   └── README.md              # This file
└── logs/                      # Worker log files
    ├── F1.log
    ├── F2.log
    └── ...
```

## Design Decisions

1. **Subprocess over threads**: Workers are OS processes, not threads. This provides true parallelism and isolation.

2. **Log files over in-memory buffers**: Logs are written to disk immediately for observability and debugging.

3. **Polling over events**: The orchestrator polls worker status rather than using callbacks. Simpler and sufficient for this use case.

4. **Token parsing from logs**: Rather than API integration, we parse token usage from standard output. This works with any Claude Code version.

5. **Status enum**: Clear state machine (pending → running → completed/failed) makes orchestration logic simple.
