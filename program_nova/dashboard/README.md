# Program Nova Dashboard

Web-based observability dashboard for Program Nova execution engine.

## Features

- **4-level drill-down navigation**: Project → Branches → Groups → Tasks
- **Real-time updates**: Polls backend every 2 seconds for live status
- **Live duration tracking**: In-progress tasks show real-time elapsed time
- **Status visualization**: Color-coded status badges (green=completed, yellow=in-progress, red=failed, gray=pending)
- **Milestone notifications**: Shows triggered milestones on project overview
- **Detailed task view**: Shows logs, token usage, cost, commits, and errors
- **Responsive design**: Works on desktop and mobile devices

## Running the Dashboard

### Start the server

```bash
python3 -m program_nova.dashboard.server
```

The dashboard will be available at: http://localhost:8000

### Configuration

The server can be configured with custom paths:

```python
from program_nova.dashboard.server import create_app

app = create_app(
    state_file="cascade_state.json",
    cascade_file="CASCADE.md",
    milestones_file="program_nova/milestones.yaml"
)
```

## API Endpoints

- `GET /` - Serve the dashboard HTML
- `GET /static/*` - Static files (CSS, JS)
- `GET /api/status` - Full project status with rollups
- `GET /api/tasks/{task_id}` - Individual task details
- `GET /api/tasks/{task_id}/logs` - Task log files

## Navigation

### L0: Project Overview
Shows all L1 branches with:
- Progress (completed/total tasks)
- Aggregate duration
- Total tokens used
- Estimated cost
- Triggered milestones

Click on a branch to drill down.

### L1: Branch Detail
Shows all L2 groups within the selected branch with:
- Group-level metrics
- Progress for each group

Click on a group to drill down.

### L2: Group Detail
Shows all tasks within the selected group in a table:
- Task ID and name
- Current status
- Duration (live for in-progress tasks)
- Token count
- Cost

Click on a task to drill down.

### L3: Task Detail
Shows complete information for a single task:
- Status and timing information
- Full token usage breakdown
- Cost calculation
- Worker information
- Commit SHA and changed files (if completed)
- Error messages (if failed)
- Live streaming logs (auto-refreshes for in-progress tasks)

Use the back button or breadcrumbs to navigate up the hierarchy.

## Status Colors

- **Green**: All tasks completed successfully
- **Yellow**: At least one task in progress
- **Red**: At least one task failed
- **Gray**: No tasks started yet (all pending)

## Development

### Run tests

```bash
# All dashboard tests
python3 -m pytest program_nova/dashboard/ -v

# Specific test files
python3 -m pytest program_nova/dashboard/test_static.py -v
python3 -m pytest program_nova/dashboard/test_integration.py -v
```

### File structure

```
dashboard/
├── server.py           # FastAPI backend
├── rollup.py          # Aggregate metrics computation
├── milestones.py      # Milestone evaluation
├── static/            # Frontend assets
│   ├── index.html     # Single-page application
│   ├── styles.css     # Styling
│   └── app.js         # Frontend logic
└── tests/             # Test suite
```

## Browser Compatibility

The dashboard uses modern JavaScript (ES6+) and CSS features. Recommended browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
