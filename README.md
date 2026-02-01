# Nova

A task orchestration system that reads hierarchical task breakdowns (CASCADE.md), executes worker agents to complete tasks, and provides real-time observability through a web dashboard.

## Quick Start

### 1. Install Nova

```bash
# Clone the repository
git clone https://github.com/yourusername/Nova.git
cd Nova

# Install with uv (recommended)
uv pip install -e .

# Or with pip
pip install -e .
```

This installs the `nova` command globally. You can now use it from any directory, just like `git`.

### 2. Create a New Project

Navigate to any directory where you want to run Nova:

```bash
cd /path/to/your/project

# Initialize a CASCADE.md template
nova init

# Edit CASCADE.md to define your tasks
nano CASCADE.md
```

### 3. Run Nova

```bash
# Start the orchestrator and dashboard
nova start

# View the dashboard
open http://localhost:8000

# Check service status
nova status

# View logs
nova logs orchestrator --follow
nova logs dashboard --follow

# Stop services
nova stop
```

## How It Works

Nova works like git: install once, use anywhere. Just navigate to a project directory and run `nova` commands.

1. **CASCADE.md** - Define your hierarchical task breakdown in any project directory
2. **Orchestrator** - Executes tasks based on dependencies and parallel execution rules
3. **Dashboard** - Real-time web UI shows task progress, logs, and metrics at http://localhost:8000
4. **Services run from your current directory** - All files (CASCADE.md, state, logs) are in your project directory

## Commands

```bash
nova init              # Create CASCADE.md template in current directory
nova start             # Start orchestrator + dashboard
nova start orchestrator # Start only orchestrator
nova start dashboard   # Start only dashboard
nova stop              # Stop all services
nova restart           # Restart all services
nova status            # Check service status
nova logs orchestrator # View orchestrator logs
nova logs dashboard -f # Follow dashboard logs
```

## CASCADE.md Format

The CASCADE.md file defines a hierarchical task structure:

```markdown
# My Project

## L1: Application

### L2: Foundation
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | Setup Project | Initialize project structure | - |
| F2 | Add Dependencies | Install required packages | F1 |

### L2: Core Features
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| C1 | Implement Feature | Add main functionality | F2 |
| C2 | Add Tests | Write unit tests | C1 |
```

- **L1** sections group related work (e.g., Application, Documentation)
- **L2** sections contain task tables
- **Dependencies** ensure tasks run in the correct order
- **Parallel execution** happens automatically when dependencies allow

## Project Structure

When you run Nova in a project directory, it creates:

```
your-project/
├── CASCADE.md              # Your task definitions (you create this)
├── cascade_state.json      # Current execution state (auto-generated)
└── logs/                   # Task-specific logs (auto-generated)
    ├── orchestrator.log
    ├── dashboard.log
    └── F1.log, F2.log, ...
```

## Requirements

- Python 3.8+
- systemd (for daemon mode)
- Modern web browser (for dashboard)

## Documentation

- [SERVICES.md](SERVICES.md) - Detailed service management and systemd configuration
- [QUICKSTART.md](QUICKSTART.md) - Step-by-step guide for new users
- [program_nova/README.md](program_nova/README.md) - Developer documentation and API reference

## Examples

### Starting a New Software Project

```bash
mkdir my-app
cd my-app
nova init
# Edit CASCADE.md with your tasks
nova start
```

### Running in an Existing Project

```bash
cd existing-project
nova init
# Edit CASCADE.md to define refactoring tasks
nova start
```

### Development Workflow

```bash
# Make changes to CASCADE.md
nano CASCADE.md

# Restart to pick up changes
nova restart

# Monitor in real-time
open http://localhost:8000
nova logs orchestrator -f
```

## Architecture

- **Orchestrator** (`program_nova/engine/orchestrator.py`) - Main execution loop
- **Worker** (`program_nova/engine/worker.py`) - Spawns and monitors task processes
- **Parser** (`program_nova/engine/parser.py`) - Parses CASCADE.md into task graph
- **State Manager** (`program_nova/engine/state.py`) - Thread-safe state file operations
- **Dashboard** (`program_nova/dashboard/server.py`) - FastAPI web server + frontend

## License

MIT
