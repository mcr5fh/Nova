# Nova Quick Start Guide

Get started with Nova in 5 minutes.

## What is Nova?

Nova is a task orchestration system that:
- Reads hierarchical task breakdowns from CASCADE.md files
- Executes worker agents to complete tasks automatically
- Provides a real-time web dashboard for monitoring progress

Think of it like a smart build system that can execute any type of task, not just compilation.

## Installation (Once)

Install Nova once, use it anywhere:

```bash
# Clone the repository
git clone https://github.com/yourusername/Nova.git
cd Nova

# Install with uv (recommended)
uv pip install -e .

# Verify installation
nova --help
```

The `nova` command is now available globally, just like `git`.

## Your First Project (5 Minutes)

### Step 1: Create a Project Directory

```bash
mkdir my-first-nova-project
cd my-first-nova-project
```

### Step 2: Initialize CASCADE.md

```bash
nova init
```

This creates a CASCADE.md template:

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

### Step 3: Edit Tasks (Optional)

For now, you can use the default template, or customize it:

```bash
nano CASCADE.md
```

Key concepts:
- **Task ID**: Unique identifier (e.g., F1, F2, C1)
- **Task Name**: Brief description
- **What Changes**: Detailed description of what the task should accomplish
- **Depends On**: Task IDs that must complete first (use `-` if no dependencies)

### Step 4: Start Nova

```bash
nova start
```

This starts two services:
- **Orchestrator**: Executes tasks in the background
- **Dashboard**: Web UI at http://localhost:8000

### Step 5: Monitor Progress

Open your browser:

```bash
open http://localhost:8000
```

Or watch logs in real-time:

```bash
nova logs orchestrator --follow
```

### Step 6: Check Status

```bash
nova status
```

Expected output:
```
● nova-orchestrator.service - Nova Orchestrator
   Active: active (running)

● nova-dashboard.service - Nova Dashboard
   Active: active (running)
```

### Step 7: Stop Services

When you're done:

```bash
nova stop
```

## Next Steps

### Example: Software Development Project

Create a real CASCADE.md for a web application:

```markdown
# My Web App

## L1: Backend

### L2: API Setup
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| API1 | Initialize FastAPI | Create main.py with FastAPI app | - |
| API2 | Add Database | Set up SQLAlchemy models and migrations | API1 |
| API3 | Create Auth | Implement JWT authentication | API2 |

### L2: Endpoints
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| EP1 | User CRUD | Add user creation and retrieval endpoints | API3 |
| EP2 | Product CRUD | Add product management endpoints | API3 |
| EP3 | Order Processing | Implement order creation and tracking | EP1,EP2 |

## L1: Frontend

### L2: React Setup
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| FE1 | Initialize React | Create React app with TypeScript | - |
| FE2 | Add Routing | Set up React Router | FE1 |
| FE3 | API Client | Create axios client with auth | FE2 |

### L2: Pages
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| PG1 | Login Page | Build login form with validation | FE3 |
| PG2 | Products Page | Display product catalog | FE3 |
| PG3 | Cart Page | Implement shopping cart UI | PG2 |

## L1: Testing

### L2: Tests
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| T1 | Backend Tests | Write unit tests for API endpoints | EP3 |
| T2 | Frontend Tests | Write component tests | PG3 |
| T3 | E2E Tests | Add Playwright end-to-end tests | T1,T2 |
```

### Using Nova with Multiple Projects

Nova works like git - install once, use everywhere:

```bash
# Project 1
cd ~/projects/web-app
nova init
nano CASCADE.md
nova start
# Work happens...
nova stop

# Project 2 (Nova already installed)
cd ~/projects/api-service
nova init
nano CASCADE.md
nova start
# Work happens...
nova stop
```

Each project has its own CASCADE.md and state.

### Monitoring Live Progress

While Nova runs:

1. **Dashboard** (http://localhost:8000) - Visual task tree with real-time updates
2. **Logs** - `nova logs orchestrator -f` for detailed execution logs
3. **Status** - `nova status` to check if services are running

### Understanding Task Dependencies

Dependencies ensure correct execution order:

```markdown
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | Setup | Initialize project | - |
| F2 | Database | Add database | F1 |
| F3 | Auth | Add authentication | F2 |
| F4 | Tests | Write tests | F3 |
```

Execution order: F1 → F2 → F3 → F4 (sequential)

Parallel execution happens automatically:

```markdown
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | Setup | Initialize project | - |
| F2 | Backend | Add backend | F1 |
| F3 | Frontend | Add frontend | F1 |
| F4 | Tests | Write tests | F2,F3 |
```

Execution: F1 → (F2 and F3 in parallel) → F4

## Common Commands Reference

```bash
nova init                  # Create CASCADE.md template
nova start                 # Start orchestrator + dashboard
nova start orchestrator    # Start only orchestrator
nova start dashboard       # Start only dashboard
nova stop                  # Stop all services
nova restart               # Restart all services
nova status                # Check service status
nova logs orchestrator     # View orchestrator logs
nova logs dashboard -f     # Follow dashboard logs
```

## Troubleshooting

### CASCADE.md Not Found

```
Error: CASCADE.md not found in current directory
```

Solution: Run `nova init` to create a template, or navigate to a directory with CASCADE.md.

### Services Won't Start

```bash
# Check systemd status
nova status

# View detailed logs
nova logs orchestrator
nova logs dashboard
```

### Dashboard Not Loading

1. Check if dashboard is running: `nova status`
2. Verify port 8000 isn't in use: `lsof -i :8000`
3. Check logs: `nova logs dashboard`

### Permission Errors

Ensure the project directory is writable:

```bash
chmod 755 .
mkdir -p logs
chmod 755 logs
```

## Further Reading

- [README.md](README.md) - Project overview and architecture
- [SERVICES.md](SERVICES.md) - Advanced service management and systemd configuration
- [program_nova/README.md](program_nova/README.md) - Developer documentation and API reference

## Getting Help

- Check logs: `nova logs orchestrator` or `nova logs dashboard`
- Review CASCADE.md syntax in the examples above
- Read [SERVICES.md](SERVICES.md) for advanced configuration
