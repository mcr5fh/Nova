# Claude Trace System - Implementation Plan

**Version:** 1.0
**Status:** Draft
**Last Updated:** 2026-01-31

## Overview

This document outlines a phased implementation approach for the Claude trace system, prioritizing quick wins and iterative development. Each phase delivers working functionality that can be used immediately.

---

## Guiding Principles

1. **Build vertically, not horizontally** - Complete end-to-end features before adding breadth
2. **Start simple, add complexity** - Basic JSONL → Simple dashboard before advanced analytics
3. **Real-time from day one** - SSE is easy to add upfront, harder to retrofit
4. **Use it while building it** - Dog-food the tool throughout development
5. **Incremental value** - Each phase should be immediately useful

---

## Phase 1: MVP Hook & JSONL Storage (Week 1)

**Goal:** Capture trace data to files. Nothing more.

### Deliverables

- ✅ Go binary that reads stdin JSON
- ✅ Parses Claude hook events
- ✅ Writes to `.claude/traces/*.jsonl`
- ✅ Installed in `.claude/hooks/`
- ✅ Basic testing with manual JSON input

### Implementation Steps

1. **Setup Go Project** (1 hour)

   ```bash
   mkdir claude-trace && cd claude-trace
   go mod init github.com/yourusername/claude-trace
   ```

2. **Create Basic Structure** (2 hours)
   - `cmd/claude-trace/main.go` - Entry point
   - `internal/hook/parser.go` - Parse stdin JSON
   - `internal/storage/writer.go` - Write JSONL

3. **Implement Hook Logic** (3 hours)
   - Read JSON from stdin
   - Build TraceEvent struct
   - Generate span_id, trace_id
   - Write to daily JSONL file

4. **Build & Install** (1 hour)

   ```bash
   make build
   make install-local
   ```

5. **Configure Hook** (30 minutes)
   - Add to `.claude/settings.json`
   - Test with manual JSON input

6. **Verify** (30 minutes)

   ```bash
   cat ~/.claude/traces/traces-$(date +%Y-%m-%d).jsonl | jq
   ```

### Success Criteria

- [ ] Binary compiles without errors
- [ ] Hook fires on Claude tool usage
- [ ] JSONL file created with valid trace events
- [ ] Manual testing shows expected data

### Skip for MVP

- ❌ Beads integration (add in Phase 2)
- ❌ Token counting (add in Phase 3)
- ❌ Cost calculation (add in Phase 3)
- ❌ SQLite indexing (add in Phase 2)

---

## Phase 2: Trace Server + SQLite (Week 2)

**Goal:** Query traces via REST API. Real-time updates via SSE.

### Deliverables

- ✅ Go HTTP server with Chi router
- ✅ SQLite database with indexed traces
- ✅ File watcher for JSONL → SQLite
- ✅ REST API for querying traces
- ✅ SSE endpoint for live streaming
- ✅ Basic HTML page to test SSE

### Implementation Steps

1. **Setup Server Project** (1 hour)

   ```bash
   mkdir claude-trace-server && cd claude-trace-server
   go mod init github.com/yourusername/claude-trace-server
   ```

2. **Implement SQLite Storage** (3 hours)
   - Create schema with indexes
   - WAL mode for concurrent reads
   - Insert/query functions

3. **Build File Watcher** (2 hours)
   - Use `fsnotify` to watch JSONL directory
   - Parse new lines
   - Insert into SQLite
   - Broadcast to SSE broker

4. **Implement Event Broker** (2 hours)
   - Channel-based fan-out pattern
   - Subscribe/unsubscribe clients
   - Broadcast events to all connected clients

5. **Create HTTP Server** (3 hours)
   - Chi router setup
   - REST endpoints (`/api/traces`, `/api/tasks/*`, etc.)
   - SSE handler (`/api/stream`)
   - CORS for local dev

6. **Test SSE with curl** (30 minutes)

   ```bash
   curl -N http://localhost:8080/api/stream
   ```

7. **Create Simple HTML Test Page** (1 hour)

   ```html
   <script>
   const es = new EventSource('http://localhost:8080/api/stream');
   es.addEventListener('trace', e => console.log(JSON.parse(e.data)));
   </script>
   ```

### Success Criteria

- [ ] Server starts on port 8080
- [ ] SQLite database created and indexed
- [ ] File watcher detects new JSONL lines
- [ ] REST API returns traces
- [ ] SSE streams events in real-time
- [ ] curl test shows live events

### Skip for Phase 2

- ❌ Aggregated task metrics (add in Phase 3)
- ❌ Advanced query filters (add in Phase 4)
- ❌ Authentication (add in Phase 5)

---

## Phase 3: Basic Frontend Dashboard (Week 3)

**Goal:** Visualize traces in a web dashboard with live updates.

### Deliverables

- ✅ Vite + React + TypeScript project
- ✅ SSE hook for real-time updates
- ✅ React Query for data fetching
- ✅ Simple trace list with filtering
- ✅ Basic metrics display (count, last updated)
- ✅ Tailwind CSS styling

### Implementation Steps

1. **Setup React Project** (1 hour)

   ```bash
   npm create vite@latest claude-trace-dashboard -- --template react-ts
   cd claude-trace-dashboard
   npm install
   ```

2. **Install Dependencies** (30 minutes)

   ```bash
   npm install @tanstack/react-query zustand tailwindcss
   npx tailwindcss init -p
   ```

3. **Create API Client** (2 hours)
   - Type-safe fetch wrapper
   - Endpoints for `/api/traces`, `/api/stream`

4. **Implement useSSE Hook** (2 hours)
   - EventSource wrapper
   - Auto-reconnection
   - React Query cache updates

5. **Build Trace List Component** (3 hours)
   - Table with recent traces
   - Filter by session, task, tool
   - Show timestamp, tool name, duration

6. **Create Dashboard Layout** (2 hours)
   - Header with connection status
   - Sidebar for filters
   - Main content area

7. **Add Real-Time Indicator** (1 hour)
   - Green dot when connected
   - Event counter
   - "New trace" badge on updates

8. **Test End-to-End** (1 hour)
   - Start hook, server, frontend
   - Trigger Claude tool usage
   - Verify live updates appear

### Success Criteria

- [ ] Dashboard loads at <http://localhost:3000>
- [ ] SSE connection established automatically
- [ ] New traces appear without refresh
- [ ] Filters work correctly
- [ ] Connection status shows accurately

### Skip for Phase 3

- ❌ Mermaid task tree (add in Phase 4)
- ❌ Recharts analytics (add in Phase 4)
- ❌ Advanced visualizations (add in Phase 5)

---

## Phase 4: Beads Integration + Task Hierarchy (Week 4)

**Goal:** Link traces to Beads tasks. Show hierarchical task tree.

### Deliverables

- ✅ Hook reads `.beads/issues/*.json`
- ✅ Task context in trace events
- ✅ Aggregated task metrics in server
- ✅ Mermaid.js task tree visualization
- ✅ Drill-down navigation

### Implementation Steps

1. **Extend Hook with Beads Reader** (2 hours)
   - Read `.beads/issues/*.json`
   - Find current task (status = "in_progress")
   - Add `task_id`, `task_status` to trace events

2. **Update Server Schema** (1 hour)
   - Add `task_hierarchy` table
   - Create aggregation queries

3. **Build Task Aggregator** (3 hours)
   - Group spans by `task_id`
   - Sum metrics (tokens, cost, duration)
   - Build parent/child relationships

4. **Add Task Endpoints** (2 hours)
   - `GET /api/tasks/:task_id` - Single task
   - `GET /api/tasks/:task_id/tree` - Hierarchy

5. **Implement Mermaid Component** (4 hours)
   - Parse task tree
   - Generate Mermaid diagram syntax
   - Render with mermaid.js
   - Add click handlers for drill-down

6. **Create Task Detail Page** (2 hours)
   - Show task metrics
   - List all spans for task
   - Link to parent/children

### Success Criteria

- [ ] Hook captures task context from Beads
- [ ] Task metrics aggregated correctly
- [ ] Mermaid diagram renders task tree
- [ ] Clicking nodes navigates to task detail
- [ ] Parent/child relationships shown

---

## Phase 5: Token Metrics & Cost Analytics (Week 5)

**Goal:** Track token usage and estimate costs.

### Deliverables

- ✅ Token counting (heuristic-based)
- ✅ Cost estimation from pricing tables
- ✅ Recharts visualizations (cost over time, token distribution)
- ✅ Tool usage breakdown
- ✅ Session summary statistics

### Implementation Steps

1. **Implement Token Counter** (2 hours)
   - Heuristic: ~4 chars per token
   - Count input/output from tool usage
   - Store in metrics

2. **Add Pricing Tables** (1 hour)
   - Claude model pricing (Sonnet, Opus, Haiku)
   - Cache pricing
   - Compute cost from tokens

3. **Update Hook Metrics** (1 hour)
   - Calculate tokens and cost
   - Add to trace event

4. **Build Analytics Queries** (2 hours)
   - Cost over time
   - Token distribution by tool
   - Top expensive operations

5. **Create Recharts Components** (4 hours)
   - CostChart (line chart)
   - TokenChart (bar chart)
   - ToolUsageChart (pie chart)

6. **Add Session Summary** (2 hours)
   - Total cost, tokens, duration
   - Task breakdown
   - Status counts

### Success Criteria

- [ ] Tokens counted for each trace
- [ ] Costs estimated accurately
- [ ] Charts render with real data
- [ ] Session summary shows totals

---

## Phase 6: Polish & Production Features (Week 6+)

**Goal:** Production-ready observability tool.

### Deliverables

- ✅ Dark mode
- ✅ Export to CSV/JSON
- ✅ Advanced filtering UI
- ✅ Keyboard shortcuts
- ✅ Performance optimizations
- ✅ Documentation
- ✅ Docker compose setup

### Implementation Steps

1. **Add Dark Mode** (2 hours)
   - Tailwind dark: classes
   - Theme toggle
   - Persist preference

2. **Export Functionality** (2 hours)
   - Export traces to CSV
   - Export metrics to JSON
   - Download button

3. **Advanced Filters** (3 hours)
   - Date range picker
   - Multi-select for tools
   - Status checkboxes
   - Save filter presets

4. **Keyboard Shortcuts** (2 hours)
   - `/` to focus search
   - `r` to refresh
   - `Escape` to close modals

5. **Performance Tuning** (3 hours)
   - Virtual scrolling for long lists
   - React.memo for expensive components
   - Code splitting

6. **Write Documentation** (4 hours)
   - README with quickstart
   - Architecture diagram
   - API documentation
   - Troubleshooting guide

7. **Docker Compose** (2 hours)
   - Hook + Server + Frontend
   - Volume mounts for traces
   - Single `docker-compose up`

### Success Criteria

- [ ] Dark mode works seamlessly
- [ ] Export generates valid files
- [ ] Filters persist across sessions
- [ ] Keyboard shortcuts documented
- [ ] Dashboard handles 10K+ traces smoothly
- [ ] Full docs published

---

## Timeline Summary

| Phase | Duration | Cumulative | Key Milestone |
|-------|----------|------------|---------------|
| 1: MVP Hook | 1 week | 1 week | Traces captured to JSONL |
| 2: Server + SQLite | 1 week | 2 weeks | REST API + SSE streaming |
| 3: Basic Frontend | 1 week | 3 weeks | Live dashboard working |
| 4: Task Hierarchy | 1 week | 4 weeks | Mermaid visualizations |
| 5: Analytics | 1 week | 5 weeks | Cost tracking complete |
| 6: Polish | 2+ weeks | 7+ weeks | Production ready |

**Total to MVP:** 3 weeks
**Total to Full Featured:** 5-7 weeks

---

## Risk Mitigation

### Risk: Hook Performance Impact

**Mitigation:**

- Benchmark hook latency (target: <100ms)
- Use buffered writes if needed
- Add timeout to all operations

### Risk: SSE Connection Stability

**Mitigation:**

- Browser auto-reconnects EventSource
- Server sends heartbeats every 30s
- Client UI shows connection status

### Risk: SQLite Write Bottleneck

**Mitigation:**

- Use WAL mode for concurrent reads
- Batch inserts if needed
- Consider migration to PostgreSQL in Phase 6

### Risk: Frontend Performance with Large Datasets

**Mitigation:**

- Implement virtual scrolling from Phase 3
- Pagination for REST API
- Limit SSE events to recent/filtered only

---

## Testing Strategy

### Unit Tests

- **Hook:** Parse stdin, build trace events
- **Server:** API handlers, broker logic
- **Frontend:** Components, hooks, utils

### Integration Tests

- **End-to-end:** Hook → Server → Frontend
- **SSE:** Connection, reconnection, event delivery
- **Database:** Queries, aggregations

### Manual Testing

- Use tool during development
- Dog-food the dashboard daily
- Track actual Claude usage

---

## Deployment Options

### Option 1: Local Development (Recommended for MVP)

```bash
# Terminal 1: Start server
cd claude-trace-server && ./bin/server

# Terminal 2: Start frontend
cd claude-trace-dashboard && npm run dev

# Hook already installed in .claude/hooks/
```text

### Option 2: Docker Compose (Production)

```yaml
version: '3.8'
services:
  server:
    build: ./claude-trace-server
    ports:
      - "8080:8080"
    volumes:
      - ~/.claude/traces:/traces

  frontend:
    build: ./claude-trace-dashboard
    ports:
      - "3000:80"
    depends_on:
      - server
```text

### Option 3: Single Binary (Future)

Embed frontend assets in Go binary for single-file distribution.

---

## Success Metrics

### Phase 1-2 (MVP)

- Traces captured without missing events
- <100ms hook latency
- <500ms API response time

### Phase 3-4 (Usable)

- Dashboard loads in <2 seconds
- Real-time updates within 100ms
- 95% uptime for SSE connections

### Phase 5-6 (Production)

- Handles 10K+ traces smoothly
- Cost estimates within 5% of actual
- Positive user feedback

---

## Beyond Phase 6 (Future Roadmap)

### Advanced Features

- **Alerts & Notifications** - Cost thresholds, error spikes
- **AI Insights** - Suggest optimizations based on trace patterns
- **Collaboration** - Share dashboards, annotate traces
- **Multi-tenancy** - Support multiple users/projects
- **Cloud Deployment** - SaaS version with managed infrastructure

### Integrations

- **GitHub Actions** - CI/CD trace analysis
- **Slack/Discord** - Cost/error notifications
- **DataDog/New Relic** - Export to existing observability platforms

### Scalability

- **ClickHouse** - Time-series database for massive scale
- **Redis Pub/Sub** - Distributed SSE across multiple servers
- **S3 Storage** - Archive old traces

---

## Getting Started

1. **Read Specifications:**
   - [01-data-contracts.md](./01-data-contracts.md)
   - [02-hook-specification.md](./02-hook-specification.md)
   - [03-trace-server-specification.md](./03-trace-server-specification.md)
   - [04-frontend-specification.md](./04-frontend-specification.md)

2. **Start with Phase 1:**
   - Clone/create `claude-trace` repo
   - Follow hook implementation guide
   - Test with manual JSON inputs

3. **Progress Through Phases:**
   - Complete each phase fully before moving on
   - Use the tool while building it
   - Iterate based on real usage

4. **Share Feedback:**
   - Document pain points
   - Suggest improvements
   - Contribute back to specs

---

## Conclusion

This phased approach ensures:

- ✅ **Working software at each stage**
- ✅ **Iterative value delivery**
- ✅ **Manageable complexity**
- ✅ **Real-world validation**

Start with Phase 1 and build from there. You'll have a usable trace dashboard within 3 weeks, with full analytics in 5-7 weeks.

Happy building! 🚀
