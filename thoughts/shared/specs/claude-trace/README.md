# Nova Trace System - Specification Overview

This directory contains the complete specification for the Nova trace system, which combines observability (nova-trace) and orchestration (nova-go) into a unified Go project.

## 📖 Reading Order

**New to the project? Start here:**

1. **[05-unified-architecture.md](./05-unified-architecture.md)** ⭐ **START HERE**
   - System overview: How nova-trace and nova-go work together
   - Shared project structure and integration points
   - Unified trace event model
   - Build and installation instructions
   - This is your map for understanding how everything fits together

2. **[01-data-contracts.md](./01-data-contracts.md)**
   - Core data models and interfaces
   - API contracts (REST + SSE)
   - Storage formats (JSONL, SQLite)
   - Hook input/output contracts
   - Read this to understand the data structures

3. **[02-hook-specification.md](./02-hook-specification.md)**
   - nova-trace implementation (observability binary)
   - Hook integration with Claude Code
   - Trace capture and storage
   - Read this to understand how tool usage is captured

4. **[03-trace-server-specification.md](./03-trace-server-specification.md)** (Future Phase)
   - Aggregation server implementation
   - REST API endpoints
   - Real-time SSE streaming
   - Read this for the analytics/query layer

5. **[04-frontend-specification.md](./04-frontend-specification.md)** (Future Phase)
   - React dashboard implementation
   - Visualization components
   - Real-time updates
   - Read this for the UI layer

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Nova System                          │
│                  Single Binary: nova-go                 │
├─────────────────────────────────────────────────────────┤
│  Commands:                                              │
│    ├─ trace       (Hook handler - observability)       │
│    ├─ implement   (Orchestrator - execution)           │
│    ├─ serve       (HTTP server - analytics)            │
│    └─ [future commands]                                 │
├─────────────────────────────────────────────────────────┤
│              Shared Infrastructure                      │
│  • Trace Events    • Beads Integration   • Metrics     │
└─────────────────────────────────────────────────────────┘
```

**nova-go** (Single Unified CLI):
- `trace` - Hook handler (called by Claude Code)
  - Captures tool usage during Claude CLI execution
  - Writes trace events to JSONL files
  - Enriches events with Beads task context
  - Runs as Claude Code hook (PreToolUse/PostToolUse)

- `implement` - Task orchestrator
  - Recursive task decomposition with BAML
  - Claude CLI execution in yolo mode
  - Task verification and status management
  - Emits orchestration events to trace format

- `serve` - Trace server
  - REST API for querying traces
  - Real-time SSE streaming
  - SQLite-backed aggregation

**Shared Components**:
- `internal/trace/` - Unified event model and storage
- `internal/beads/` - Task integration (reader + CLI)
- `internal/metrics/` - Token counting and cost tracking

## 📦 Components

| Component | Status | Description |
|-----------|--------|-------------|
| nova-go trace | MVP Ready | Hook handler for observability |
| nova-go implement | MVP Ready | Orchestration engine |
| nova-go serve | MVP Ready | HTTP API and SSE streaming |
| Shared trace system | MVP Ready | Unified events and storage |
| Frontend dashboard | Future | Visualization UI |

## 🎯 Current MVP Scope

**What's Included:**
- ✅ nova-trace hook binary (observability)
- ✅ nova-go orchestrator (recursive execution)
- ✅ Unified trace event model
- ✅ JSONL storage with daily rotation
- ✅ Beads integration for task context
- ✅ Basic cost/token tracking

**What's Future:**
- ⏳ SQLite indexing for fast queries
- ⏳ Aggregation server with REST API
- ⏳ Real-time SSE streaming
- ⏳ React dashboard with visualizations
- ⏳ Advanced analytics and reporting

## 🚀 Quick Start

```bash
# 1. Build and install
make build
make install

# 2. Run type checks and tests
make check    # Type check + lint
make test     # Run tests

# 3. Configure Claude Code hooks
# Edit .claude/settings.json:
# "command": "nova-go trace"

# 4. Implement a task
nova-go implement --spec my-task.md

# 5. Start trace server (optional, for analytics)
nova-go serve --port 8080

# 6. Watch traces in real-time
tail -f runs/<run-id>/trace.jsonl | jq
```

## 🔧 Development

```bash
# Format code
make fmt

# Type check + lint (fast)
make check

# Run tests
make test

# Pre-commit checks (format + check + test)
make pre-commit
```

## 📚 Related Documentation

- [Engine Recursion MVP](../engine-recursion-mvp/plan.md) - Detailed nova-go implementation plan
- [BAML Instructions](../../../../docs/baml-instructions.md) - BAML usage guide
- [Brainstorm](../../../../brainstorm.md) - System architecture and design

## 🤝 Contributing

When updating these specs:
1. Maintain the unified architecture as the source of truth
2. Keep data contracts in sync across all components
3. Update all reference sections when adding new specs
4. Include code examples for complex concepts
5. Add version numbers and last updated dates

## 📝 Document Metadata

| Document | Version | Status | Last Updated |
|----------|---------|--------|--------------|
| 01-data-contracts.md | 1.0 | Draft | 2026-01-31 |
| 02-hook-specification.md | 1.0 | Draft | 2026-01-31 |
| 03-trace-server-specification.md | 1.0 | Draft | 2026-01-31 |
| 04-frontend-specification.md | 1.0 | Draft | 2026-01-31 |
| 05-unified-architecture.md | 1.0 | Draft | 2026-01-31 |

---

**Questions or feedback?** Update the specs and commit your changes!
