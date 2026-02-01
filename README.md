# Nova

Nova is a monorepo containing:

1. **nova-go/** - Session-based trace collector for Claude Code interactions
2. **program_nova/** - Python task orchestration system with real-time dashboard

---

## Nova Go (Trace Collector)

Located in `nova-go/`. Session-based trace collection for Claude Code interactions with integrated token tracking and cost calculation.

### Features

- ✅ Live token tracking during sessions
- ✅ Detailed end-of-session breakdown with tool uses + token data
- ✅ Token counts (input, output, cache read, cache write)
- ✅ Cost calculation based on model pricing
- ✅ Reduced hook overhead (only at session boundaries)

### Quick Start

```bash
cd nova-go
make build
make install

# Hooks are automatically configured in .claude/settings.json
# View traces
cat ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq .
```

See [nova-go/README.md](nova-go/README.md) for details.

---

## Program Nova (Task Orchestrator)

Located in `program_nova/`. A task orchestration system that reads hierarchical task breakdowns (CASCADE.md), executes worker agents, and provides real-time observability.

### Quick Start

```bash
# Install with uv (recommended)
uv pip install -e .

# Create a new project
cd /path/to/your/project
nova init
nano CASCADE.md

# Start the orchestrator and dashboard
nova start

# View the dashboard
open http://localhost:8000
```

### How It Works

Nova works like git: install once, use anywhere.

1. **CASCADE.md** - Define your hierarchical task breakdown
2. **Orchestrator** - Executes tasks based on dependencies
3. **Dashboard** - Real-time web UI at http://localhost:8000
4. **Services run from your current directory**

### Commands

```bash
nova init              # Create CASCADE.md template
nova start             # Start orchestrator + dashboard
nova stop              # Stop all services
nova restart           # Restart all services
nova status            # Check service status
nova logs orchestrator # View orchestrator logs
```

See [QUICKSTART.md](QUICKSTART.md) and [SERVICES.md](SERVICES.md) for details.

---

## Documentation

- [AGENTS.md](AGENTS.md) - Agent instructions and session completion protocol
- [QUICKSTART.md](QUICKSTART.md) - Program Nova step-by-step guide
- [SERVICES.md](SERVICES.md) - Service management and systemd configuration
- [nova-go/](nova-go/) - Go trace collector documentation
- [program_nova/README.md](program_nova/README.md) - Python orchestrator API reference

## License

MIT
