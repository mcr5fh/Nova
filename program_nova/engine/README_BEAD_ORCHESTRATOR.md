# Bead Orchestrator

## Overview

The `BeadOrchestrator` class provides an alternative task management system for Program Nova that uses beads (issues from the beads system) instead of CASCADE.md files. This allows for dynamic, database-backed task tracking with built-in dependency management.

## Key Differences from Cascade Orchestrator

| Feature | Cascade Orchestrator | Bead Orchestrator |
|---------|---------------------|-------------------|
| Task Source | CASCADE.md file | Bead epic children |
| Dependencies | Parsed from file | From bead graph (bd graph) |
| State Storage | cascade_state.json | Bead database (status + notes) |
| Task Listing | Static file parsing | Dynamic query (bd ready) |
| Metrics Storage | JSON state file | Bead notes field |

## Usage

### Basic Setup

```python
from program_nova.engine import BeadOrchestrator

# Initialize with an epic ID
orch = BeadOrchestrator("Nova-gyd")

# Get all tasks from the epic
tasks = orch.get_tasks()

# Get tasks ready to execute (no blockers)
ready_tasks = orch.get_ready_tasks()

# Start a worker for a task
orch.start_worker("Nova-gyd.1")

# Complete a task and store metrics
orch.complete_task("Nova-gyd.1", worker)
```

### Task Structure

The `get_tasks()` method returns a dictionary where:
- Keys are bead IDs (e.g., "Nova-gyd.1")
- Values contain:
  - `description`: Task description or title (fallback to title if description is empty)
  - `depends_on`: List of bead IDs this task depends on

Example:
```python
{
    "Nova-gyd.1": {
        "description": "Implement feature X",
        "depends_on": []
    },
    "Nova-gyd.2": {
        "description": "Write tests for X",
        "depends_on": ["Nova-gyd.1"]
    }
}
```

### Ready Tasks

The `get_ready_tasks()` method filters tasks that:
1. Are in "open" status
2. Have no blocking dependencies
3. Belong to the specified epic

It only returns bead IDs that start with the epic ID prefix.

### Worker Lifecycle

#### Starting a Worker

When you call `start_worker(bead_id)`:
1. Marks the bead as `in_progress` in the database
2. Fetches the bead details for the task description
3. Records the start time for duration tracking
4. Creates a Worker instance with the bead ID and description
5. Spawns the Claude subprocess with appropriate flags
6. Tracks the worker in `active_workers`

#### Completing a Task

When you call `complete_task(bead_id, worker)`:
1. Retrieves token usage from the worker
2. Calculates task duration from start time
3. Computes cost from token usage
4. Stores metrics as JSON in bead notes
5. Closes the bead (marks as completed)
6. Cleans up tracking data

### Metrics Storage Format

Metrics are stored in the bead's notes field as JSON:

```
Metrics: {"token_usage": {"input_tokens": 1234, "output_tokens": 567, "cache_read_tokens": 890, "cache_creation_tokens": 12}, "cost_usd": 0.0523, "duration_seconds": 45.5}
```

This format can be parsed with a regex: `Metrics: ({.*})`

## Cost Calculation

The `compute_cost_from_tokens()` function calculates costs using Sonnet 4.5 pricing:

- Input tokens: $3.00 per million
- Output tokens: $15.00 per million
- Cache read tokens: $0.30 per million
- Cache creation tokens: $3.75 per million

Example:
```python
from program_nova.engine import compute_cost_from_tokens

token_usage = {
    "input_tokens": 1000,
    "output_tokens": 500,
    "cache_read_tokens": 0,
    "cache_creation_tokens": 0,
}
cost = compute_cost_from_tokens(token_usage)
# Returns: 0.0105 USD
```

## Integration with Beads CLI

The orchestrator uses these beads commands:

- `bd graph <epic-id> --json` - Get task graph with dependencies
- `bd ready --json` - Get ready-to-execute tasks
- `bd show <bead-id> --json` - Get task details
- `bd update <bead-id> --status=in_progress` - Mark task as started
- `bd update <bead-id> --notes=...` - Store metrics
- `bd close <bead-id>` - Mark task as complete

## Testing

Comprehensive tests are available in `test_bead_orchestrator.py`:

```bash
pytest program_nova/engine/test_bead_orchestrator.py -v
```

Test coverage includes:
- Cost computation
- Task retrieval and filtering
- Worker spawning
- Task completion with metrics
- Edge cases (empty descriptions, cache tokens, etc.)

## Example Workflow

```python
# 1. Create orchestrator for an epic
orch = BeadOrchestrator("Nova-features")

# 2. Get ready tasks
ready = orch.get_ready_tasks()  # ["Nova-features.1", "Nova-features.3"]

# 3. Start workers (respecting max_workers limit)
for task_id in ready[:3]:  # Limit concurrent workers
    orch.start_worker(task_id)

# 4. Monitor workers
for task_id, worker in list(orch.active_workers.items()):
    if not worker.is_alive():
        exit_code = worker.wait()
        if exit_code == 0:
            orch.complete_task(task_id, worker)
        else:
            # Handle failure
            pass
        del orch.active_workers[task_id]

# 5. Repeat until all tasks complete
```

## Architecture Notes

- **Stateless Design**: The orchestrator doesn't maintain persistent state. All state is in the bead database.
- **Duration Tracking**: Start times are tracked in-memory in `task_start_times` dict. This means duration is only accurate if the orchestrator isn't restarted mid-execution.
- **Subprocess Management**: Uses the same Worker class as the cascade orchestrator for consistency.
- **Error Handling**: Currently minimal - failures should be handled at a higher level (e.g., in a main loop).

## Future Enhancements

Potential improvements:
- Store start time in bead notes for crash resilience
- Add failure handling and retry logic
- Support for pausing/resuming execution
- Integration with dashboard for real-time monitoring
- Parallel epic execution
