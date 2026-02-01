# Orchestrator Module

The orchestrator is the main execution engine for Program Nova. It coordinates the entire cascade execution process: parsing the task graph, resolving dependencies, spawning workers, monitoring progress, and managing concurrency.

## Features

- **Dependency Resolution**: Uses DAG to determine which tasks are ready to execute
- **Concurrency Control**: Respects configurable max concurrent workers limit
- **Worker Management**: Spawns, monitors, and tracks worker processes
- **State Management**: Updates shared state file with task progress and metrics
- **Progress Monitoring**: Tracks token usage, duration, and completion status
- **Failure Handling**: Marks failed tasks and prevents downstream execution

## Quick Start

```python
from orchestrator import Orchestrator

# Create orchestrator
orchestrator = Orchestrator(
    cascade_file="CASCADE.md",
    state_file="cascade_state.json",
    max_workers=3
)

# Run the main execution loop
orchestrator.run()

# Get final status
summary = orchestrator.get_status_summary()
print(f"Completed: {summary['completed']}/{summary['total_tasks']}")
```

## Architecture

The orchestrator ties together three main components:

1. **Parser** (`parser.py`): Parses CASCADE.md into task graph and DAG
2. **State Manager** (`state.py`): Thread-safe read/write to cascade_state.json
3. **Worker** (`worker.py`): Subprocess management for task execution

## Main Loop

The orchestrator's `run()` method implements the core execution loop:

1. **Monitor Workers**: Check status of running workers, update state
2. **Handle Completions**: Process completed/failed workers, finalize state
3. **Resolve Ready Tasks**: Query DAG for tasks with satisfied dependencies
4. **Spawn Workers**: Start new workers (up to max_workers limit)
5. **Check Completion**: Exit if no active workers and no ready tasks
6. **Sleep**: Wait before next iteration (configurable check_interval)

```
┌─────────────────────────────────────────────────┐
│                Main Loop                        │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ 1. Monitor active workers                │  │
│  │    - Update token usage                  │  │
│  │    - Check if alive                      │  │
│  │    - Handle completions/failures         │  │
│  └──────────────────────────────────────────┘  │
│                     │                           │
│  ┌──────────────────────────────────────────┐  │
│  │ 2. Get ready tasks from DAG              │  │
│  │    - All dependencies completed?         │  │
│  │    - Not already started?                │  │
│  └──────────────────────────────────────────┘  │
│                     │                           │
│  ┌──────────────────────────────────────────┐  │
│  │ 3. Start workers (up to max_workers)     │  │
│  │    - Create Worker instance              │  │
│  │    - Spawn subprocess                    │  │
│  │    - Update state to in_progress         │  │
│  └──────────────────────────────────────────┘  │
│                     │                           │
│  ┌──────────────────────────────────────────┐  │
│  │ 4. Check if execution complete           │  │
│  │    - No active workers?                  │  │
│  │    - No ready tasks?                     │  │
│  │    - If yes, exit loop                   │  │
│  └──────────────────────────────────────────┘  │
│                     │                           │
│  ┌──────────────────────────────────────────┐  │
│  │ 5. Sleep (check_interval)                │  │
│  └──────────────────────────────────────────┘  │
│                     │                           │
│                     └──────────────────────────►│
└─────────────────────────────────────────────────┘
```

## API Reference

### Orchestrator Class

#### Constructor

```python
Orchestrator(
    cascade_file: str,
    state_file: str,
    max_workers: int = 3
)
```

**Parameters:**
- `cascade_file`: Path to CASCADE.md file
- `state_file`: Path to cascade_state.json (created if doesn't exist)
- `max_workers`: Maximum number of concurrent workers (default: 3)

**Side effects:**
- Parses CASCADE.md into task graph
- Initializes state file if it doesn't exist
- Creates all tasks in state as pending

#### Methods

##### get_ready_tasks() -> List[str]

Get list of tasks ready to execute.

A task is ready if:
- Status is pending (not started/completed/failed)
- All dependencies have status 'completed'
- Not already in active_workers

**Returns:** List of task IDs ready to start

##### start_worker(task_id: str) -> None

Start a worker for the given task.

**Side effects:**
- Creates Worker instance
- Spawns subprocess
- Updates state: status=in_progress, started_at, worker_id, pid
- Adds worker to active_workers tracking

##### monitor_workers() -> None

Monitor all active workers and update state.

For each worker:
- Update token usage in state
- Check if still alive
- If completed/failed, finalize task and remove from tracking

**Side effects:**
- Updates task state for all active workers
- Removes completed/failed workers from active_workers

##### run(check_interval: float = 2.0, max_iterations: Optional[int] = None) -> None

Main execution loop.

**Parameters:**
- `check_interval`: Seconds to wait between iterations (default: 2.0)
- `max_iterations`: Max loop iterations for testing (default: None = unlimited)

**Side effects:**
- Updates project start/end timestamps
- Spawns and monitors workers
- Updates state file continuously
- Runs until all tasks complete/fail or are blocked

##### get_status_summary() -> Dict

Get current execution status summary.

**Returns:** Dictionary with:
- `total_tasks`: Total number of tasks
- `completed`: Number of completed tasks
- `failed`: Number of failed tasks
- `in_progress`: Number of in-progress tasks
- `pending`: Number of pending tasks
- `active_workers`: Number of active workers

## Concurrency Control

The orchestrator respects the `max_workers` limit:

```python
available_slots = self.max_workers - len(self.active_workers)
ready_tasks = self.get_ready_tasks()

# Start workers for ready tasks (up to available slots)
for task_id in ready_tasks[:available_slots]:
    self.start_worker(task_id)
```

This ensures:
- Never more than `max_workers` run concurrently
- Tasks start in dependency order
- Resources are efficiently utilized

## Dependency Resolution

The orchestrator uses the DAG to resolve task dependencies:

```python
# Get ready tasks from DAG
completed_or_started = {
    tid: status
    for tid, status in task_status_map.items()
    if status in ["completed", "in_progress", "failed"]
}

ready = self.dag.get_ready_tasks(completed_or_started)
```

Tasks with failed dependencies are **not** marked as failed themselves - they remain pending but effectively blocked. This allows manual retry of failed tasks.

## Task Lifecycle

```
PENDING
   │
   │ orchestrator.start_worker(task_id)
   │
   ▼
IN_PROGRESS
   │
   │ worker completes
   │
   ├─────────────┬─────────────┐
   │             │             │
   ▼             ▼             ▼
COMPLETED    FAILED         (BLOCKED)
                            pending with
                            failed deps
```

## State Updates

The orchestrator continuously updates the state file:

**Task Start:**
```python
self.state_mgr.update_task(
    task_id,
    status=TaskStatus.IN_PROGRESS,
    worker_id=task_id,
    started_at=datetime.now(timezone.utc).isoformat(),
    pid=worker.pid
)
```

**During Execution:**
```python
self.state_mgr.update_task_tokens(
    task_id,
    input_tokens=usage["input_tokens"],
    output_tokens=usage["output_tokens"],
    cache_read_tokens=usage["cache_read_tokens"],
    cache_creation_tokens=usage["cache_creation_tokens"]
)
```

**Task Completion:**
```python
self.state_mgr.complete_task(
    task_id,
    completed_at=datetime.now(timezone.utc).isoformat(),
    duration_seconds=duration
)
```

**Task Failure:**
```python
self.state_mgr.fail_task(
    task_id,
    error=f"Worker exited with code {exit_code}"
)
```

## Testing

Run the test suite:

```bash
python3 -m pytest test_orchestrator.py -v
```

Run example usage:

```bash
python3 example_orchestrator_usage.py
```

## Command-Line Usage

The orchestrator can be run directly from the command line:

```bash
# Use CASCADE.md in current directory
python3 orchestrator.py

# Specify a different cascade file
python3 orchestrator.py /path/to/CASCADE.md
```

This will:
1. Parse the cascade file
2. Initialize cascade_state.json
3. Run the main execution loop
4. Print progress and final summary

## Integration with Dashboard

The orchestrator writes to `cascade_state.json`, which is read by the dashboard. The dashboard never modifies state - it's read-only.

This decoupling means:
- Dashboard can be restarted without affecting execution
- Multiple dashboard instances can read the same state
- State file is the single source of truth

## Error Handling

**File Not Found:**
```python
try:
    orchestrator = Orchestrator(cascade_file="missing.md", ...)
except FileNotFoundError:
    print("CASCADE file not found!")
```

**Cyclic Dependencies:**
```python
try:
    orchestrator = Orchestrator(cascade_file="bad_cascade.md", ...)
except ValueError as e:
    print(f"Invalid cascade: {e}")
```

**Worker Failure:**
- Failed tasks are marked in state with error message
- Downstream tasks remain pending (blocked)
- Execution continues with other independent tasks

**Keyboard Interrupt:**
```python
try:
    orchestrator.run()
except KeyboardInterrupt:
    # Terminate active workers
    for worker in orchestrator.active_workers.values():
        worker.terminate()
```

## Performance Considerations

**Check Interval:**
- Default: 2.0 seconds
- Lower = more responsive, higher CPU usage
- Higher = less responsive, lower CPU usage

**Max Workers:**
- Default: 3 concurrent workers
- Adjust based on available system resources
- Consider Claude Code rate limits

**State File I/O:**
- Uses file locking to prevent corruption
- Updated every check_interval for each active worker
- Polling (not event-driven) - simple and reliable

## Example: Custom Worker Command

By default, the orchestrator uses a placeholder command for testing. In production, you'd want to use actual Claude Code:

```python
# In orchestrator.py, modify start_worker():

# Build command for worker
command = [
    "claude", "code",
    "--task", task_description,
    "--context", f"Project: {self.cascade_data['project_name']}",
    "--branch", task_info["branch"],
    "--group", task_info["group"]
]

# Start the worker
worker.start(command)
```

## File Structure

```
program_nova/
├── engine/
│   ├── orchestrator.py           # Main orchestrator module
│   ├── test_orchestrator.py      # Test suite
│   ├── example_orchestrator_usage.py  # Usage example
│   ├── parser.py                 # CASCADE.md parser
│   ├── state.py                  # State management
│   └── worker.py                 # Worker subprocess management
└── cascade_state.json            # Shared state file (created on first run)
```

## Design Decisions

1. **Polling over events**: Simpler implementation, sufficient for this use case
2. **File-based state**: No database dependency, easy to inspect and debug
3. **Subprocess workers**: True parallelism, process isolation
4. **DAG for dependencies**: Efficient resolution, cycle detection
5. **Failed tasks don't cascade**: Allows manual retry without blocking everything
6. **Decoupled dashboard**: Read-only state file, can restart independently

## Next Steps

After implementing the orchestrator, the next components needed are:

1. **Dashboard Backend** (`dashboard/server.py`): FastAPI server with API endpoints
2. **Dashboard Frontend** (`dashboard/static/`): Web UI for visualization
3. **Milestones** (`milestones.yaml`): Declarative milestone definitions
4. **Rollup Logic** (`dashboard/rollup.py`): Aggregate stats for hierarchy

The orchestrator is now complete and ready to integrate with these components.
