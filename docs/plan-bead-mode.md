# Plan: Bead Mode for Program Nova

## Overview

Add "bead mode" to Program Nova, allowing the execution engine and dashboard to use a **bead epic** as the task source instead of a CASCADE.md file.

**Key difference from cascade mode:**
- **Cascade mode**: Tasks defined in CASCADE.md → state in cascade_state.json
- **Bead mode**: Tasks are bead children of an epic → state IS the bead database

## User Flow

1. User opens dashboard
2. Dashboard shows list of bead epics (`bd list --type=epic`)
3. User **selects an epic** to execute
4. Orchestrator spawns workers for ready children (same as cascade)
5. Workers update bead status + store metrics in notes
6. Dashboard shows progress by querying beads

## What Changes

| Component | Cascade Mode | Bead Mode |
|-----------|--------------|-----------|
| Task source | `CASCADE.md` | Bead epic children |
| Dependencies | Parsed from CASCADE.md | `bd graph` (pre-computed) |
| State storage | `cascade_state.json` | Bead status + notes |
| Dashboard reads | JSON file | `bd` CLI |
| Project selection | Hardcoded file path | **User selects epic in UI** |

## What Stays The Same

- Workers still spawn `claude` CLI with `--output-format json`
- Workers still parse logs for token usage
- Orchestrator still monitors workers and handles completion
- Dashboard still shows progress, tree view, dependency graph

## Implementation

### Phase 1: Epic Selection UI

**File**: `program_nova/dashboard/static/index.html`

Add mode toggle and epic selector to header:
```html
<div class="mode-selector">
    <label><input type="radio" name="mode" value="cascade" checked> Cascade</label>
    <label><input type="radio" name="mode" value="bead"> Bead</label>
</div>

<div id="epic-selector" style="display: none;">
    <select id="epic-select">
        <option value="">Select an epic...</option>
    </select>
    <button id="start-btn">Start</button>
</div>
```

**File**: `program_nova/dashboard/static/app.js`

```javascript
async function fetchEpics() {
    const response = await fetch('/api/beads/epics');
    const epics = await response.json();
    // Populate dropdown
}

function startExecution(epicId) {
    fetch('/api/beads/start', {
        method: 'POST',
        body: JSON.stringify({ epic_id: epicId })
    });
}
```

### Phase 2: Beads API Endpoints

**File**: `program_nova/dashboard/server.py`

```python
@app.get("/api/beads/epics")
async def list_epics():
    """List all bead epics available for execution."""
    result = subprocess.run(
        ["bd", "list", "--type=epic", "--json"],
        capture_output=True, text=True
    )
    return json.loads(result.stdout)

@app.post("/api/beads/start")
async def start_epic(epic_id: str):
    """Start execution of an epic's children."""
    # Start orchestrator in bead mode
    app.state.orchestrator = BeadOrchestrator(epic_id)
    app.state.orchestrator.start()
    return {"status": "started", "epic_id": epic_id}

@app.get("/api/beads/status/{epic_id}")
async def get_epic_status(epic_id: str):
    """Get status for bead mode (same format as /api/status)."""
    result = subprocess.run(
        ["bd", "graph", epic_id, "--json"],
        capture_output=True, text=True
    )
    graph = json.loads(result.stdout)
    return transform_to_dashboard_format(graph)
```

### Phase 3: Bead Orchestrator

**File**: `program_nova/engine/bead_orchestrator.py`

```python
class BeadOrchestrator:
    """Orchestrator that uses beads as task source."""

    def __init__(self, epic_id: str):
        self.epic_id = epic_id
        self.active_workers: Dict[str, Worker] = {}

    def get_tasks(self) -> Dict[str, dict]:
        """Get tasks from bead children."""
        result = subprocess.run(
            ["bd", "graph", self.epic_id, "--json"],
            capture_output=True, text=True
        )
        graph = json.loads(result.stdout)

        tasks = {}
        for issue in graph["issues"]:
            if issue["id"] != self.epic_id:  # Skip the epic itself
                tasks[issue["id"]] = {
                    "description": issue.get("description") or issue["title"],
                    "depends_on": graph["layout"]["Nodes"][issue["id"]].get("DependsOn") or []
                }
        return tasks

    def get_ready_tasks(self) -> List[str]:
        """Get tasks ready to execute (open + no blockers)."""
        result = subprocess.run(
            ["bd", "ready", "--json"],
            capture_output=True, text=True
        )
        ready = json.loads(result.stdout)
        # Filter to only children of our epic
        return [b["id"] for b in ready if b["id"].startswith(self.epic_id)]

    def start_worker(self, bead_id: str):
        """Start worker for a bead task."""
        # Mark bead as in_progress
        subprocess.run(["bd", "update", bead_id, "--status=in_progress"])

        # Get task description
        result = subprocess.run(
            ["bd", "show", bead_id, "--json"],
            capture_output=True, text=True
        )
        bead = json.loads(result.stdout)[0]
        description = bead.get("description") or bead["title"]

        # Spawn worker (same as cascade mode)
        worker = Worker(task_id=bead_id, task_description=description)
        command = [
            "claude",
            "--model", "sonnet",
            "--dangerously-skip-permissions",
            "--print",
            "--output-format", "json",
            description,
        ]
        worker.start(command)
        self.active_workers[bead_id] = worker

    def complete_task(self, bead_id: str, worker: Worker):
        """Mark bead complete and store metrics."""
        token_usage = worker.get_token_usage()
        duration = worker.get_duration()
        cost = compute_cost(token_usage)

        # Store metrics as JSON in notes
        metrics_json = json.dumps({
            "token_usage": token_usage,
            "cost_usd": cost,
            "duration_seconds": duration
        })

        # Update bead with notes containing metrics
        subprocess.run([
            "bd", "update", bead_id,
            f"--notes=Metrics: {metrics_json}"
        ])

        # Close the bead
        subprocess.run(["bd", "close", bead_id])
```

### Phase 4: Dashboard Status Endpoint for Beads

**File**: `program_nova/dashboard/beads_adapter.py`

```python
def get_epic_status(epic_id: str) -> dict:
    """Get status in dashboard format from bead data."""

    # Get graph with layout
    result = subprocess.run(
        ["bd", "graph", epic_id, "--json"],
        capture_output=True, text=True
    )
    graph = json.loads(result.stdout)

    # Build hierarchy from layers
    hierarchy = {}
    tasks = {}
    task_definitions = {}

    for layer_idx, layer_beads in enumerate(graph["layout"]["Layers"]):
        layer_name = f"Layer {layer_idx}"
        hierarchy[layer_name] = {"All": []}

        for bead_id in layer_beads:
            if bead_id == epic_id:
                continue  # Skip epic itself

            hierarchy[layer_name]["All"].append(bead_id)

            # Find bead in issues
            bead = next(i for i in graph["issues"] if i["id"] == bead_id)

            # Parse metrics from notes if present
            metrics = parse_metrics_from_notes(bead.get("notes", ""))

            tasks[bead_id] = {
                "name": bead["title"],
                "status": map_bead_status(bead["status"]),
                "started_at": bead.get("updated_at"),  # Approximation
                "completed_at": bead.get("closed_at"),
                "duration_seconds": metrics.get("duration_seconds", 0),
                "token_usage": metrics.get("token_usage", {}),
            }

            node = graph["layout"]["Nodes"][bead_id]
            task_definitions[bead_id] = {
                "name": bead["title"],
                "branch": layer_name,
                "group": "All",
                "depends_on": node.get("DependsOn") or []
            }

    # Compute rollups
    rollups = compute_hierarchy_rollups(tasks, hierarchy)

    return {
        "project": {"name": graph["root"]["title"]},
        "tasks": tasks,
        "hierarchy": hierarchy,
        "task_definitions": task_definitions,
        "rollups": rollups,
    }

def map_bead_status(status: str) -> str:
    """Map bead status to dashboard status."""
    return {
        "open": "pending",
        "in_progress": "in_progress",
        "closed": "completed",
        "deferred": "pending"
    }.get(status, "pending")

def parse_metrics_from_notes(notes: str) -> dict:
    """Extract metrics JSON from bead notes."""
    if not notes:
        return {}

    # Look for "Metrics: {...}" pattern
    import re
    match = re.search(r'Metrics: ({.*})', notes)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    return {}
```

### Phase 5: Wire Up Mode Switching

**File**: `program_nova/dashboard/static/app.js`

```javascript
let appState = {
    mode: localStorage.getItem('dashboard-mode') || 'cascade',
    epicId: localStorage.getItem('selected-epic') || null,
    // ... existing fields
};

async function fetchStatus() {
    if (appState.mode === 'cascade') {
        return fetchCascadeStatus();  // Existing code
    } else {
        if (!appState.epicId) {
            return showEpicSelector();
        }
        return fetchBeadStatus(appState.epicId);
    }
}

async function fetchBeadStatus(epicId) {
    const response = await fetch(`/api/beads/status/${epicId}`);
    const data = await response.json();
    appState.data = data;
    renderCurrentView();
}
```

## Metrics Storage

Store metrics as JSON in bead notes field:

```
Metrics: {"token_usage": {"input_tokens": 1234, "output_tokens": 567, "cache_read_tokens": 890, "cache_creation_tokens": 12}, "cost_usd": 0.0523, "duration_seconds": 45}
```

**Parsing**: Extract with regex `Metrics: ({.*})` and JSON.parse

**Alternative**: Could use `bd comments add` for cleaner separation, but notes is simpler.

## File Changes Summary

| File | Change |
|------|--------|
| `dashboard/static/index.html` | Add mode toggle, epic selector |
| `dashboard/static/app.js` | Add mode handling, epic selection, bead status fetching |
| `dashboard/server.py` | Add `/api/beads/*` endpoints |
| `dashboard/beads_adapter.py` | **New** - Transform bead data to dashboard format |
| `engine/bead_orchestrator.py` | **New** - Orchestrator that uses beads |

## Testing

1. Create test epic with children: `bd create --type=epic --title="Test Epic"`
2. Add child tasks with dependencies
3. Switch to bead mode in dashboard
4. Select epic → should show tasks
5. Start execution → workers should run
6. Verify bead status updates
7. Verify metrics stored in notes
8. Verify dashboard shows progress

## Future Enhancements

- [ ] Better metrics storage (dedicated field or separate file)
- [ ] Resume interrupted execution
- [ ] Parallel epic execution
- [ ] Integration with `tv spawn` for village workers
