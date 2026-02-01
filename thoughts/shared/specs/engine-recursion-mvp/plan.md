# engine-recursion-mvp Implementation Plan

## Overview

Build a bare-bones Go orchestration engine ("nova-go" CLI) that can recursively decompose tasks into a tree, size tasks with T‑shirt sizes, and execute leaf tasks via Claude CLI in yolo mode. Nova accepts specs as input and can return messages to users for interaction. Beads CLI (`bd`) is the source of truth for tasks, dependencies, and labels. The MVP enforces only max attempts/retries and writes minimal trace artifacts to disk (JSONL). No public API.

## Current State Analysis

- Repo contains no Go module or engine code yet.
- BAML usage guidance exists in `docs/baml-instructions.md`.
- No existing CI/lint/test scaffolding in this repo.

## Desired End State

A developer can run `nova-go` locally with a spec. The CLI plans, sizes, and executes a task tree using:
- Anthropic Sonnet for planning/sizing/verification (via BAML)
- Claude CLI for leaf task execution (yolo mode with `--dangerously-skip-permissions`)

Tasks are recursively decomposed until size is **XS only**, then executed via Claude CLI. The Go engine verifies completion via BAML and marks beads status accordingly. Tasks, dependencies, and labels are managed via beads CLI (`bd create`, `bd dep add`, `bd update`). Retries are enforced. A minimal trace log and run summary are emitted to disk. All code is covered by unit tests, linted, and protected by pre-commit hooks.

### Key Discoveries:
- BAML requires `baml-cli generate` after any `.baml` changes. (`docs/baml-instructions.md`)
- System already models planner/worker roles. (`claude.md`)
- Beads CLI (`bd`) provides full CRUD + dependency management: `bd create`, `bd dep add`, `bd update`, `bd ready`
- Leaf execution uses Claude CLI in yolo mode, not BAML functions
- Only XS tasks are executable; S/M/L/XL must be decomposed

## What We're NOT Doing

- No public HTTP API or server.
- No DAG support (single parent only, but siblings can execute in parallel).
- No advanced tracing/analytics or storage backends (only simple JSONL files).
- No alternative persistence beyond beads CLI and run artifacts on disk.
- No web UI (REPL/TUI only).
- No advanced concurrency (siblings execute in parallel when no deps between them, but kept simple).

## Implementation Approach

- Use Go best practices: `cmd/`, `internal/`, `pkg/` only if needed, explicit interfaces, small packages.
- Beads CLI (`bd`) is the authoritative task store; engine shells out to `bd create`, `bd dep add`, `bd update --status`, `bd ready`.
- Define a core `engine` package that manages recursion, sizing, and execution orchestration.
- Use BAML for planning/sizing/verification LLM calls (Sonnet).
- Use Claude CLI for leaf task execution: `claude --dangerously-skip-permissions -p "<task prompt>"`.
- Go engine controls task lifecycle: marks beads status based on verification results.
- Keep tracing minimal: append-only JSONL events per run, plus a `run.json` summary.
- TDD: write tests for sizing/decomposition, retry logic, and execution ordering before implementation.

## System Flow

### Task Lifecycle

1. **Initial Input**: User provides spec to nova-go CLI
2. **Root Task Creation**: `bd create "Root Task" --description "<spec>"` → creates bd-xxx
3. **Planning**: BAML `PlanTask()` → generates subtask specs
4. **Subtask Creation**: For each subtask:
   - `bd create "<subtask title>" --parent bd-xxx` → creates bd-yyy
   - `bd dep add bd-yyy bd-zzz` (if subtask depends on sibling bd-zzz)
5. **Sizing**: BAML `SizeTask()` for each subtask → returns TaskSize
6. **Recursion**: If size > XS, repeat from step 3 for that subtask
7. **Execution** (when size == XS):
   - Check deps: `bd ready --parent bd-xxx`
   - Execute: `claude --dangerously-skip-permissions -p "<task prompt>"`
   - Capture output and files changed
8. **Verification**: BAML `VerifyTaskComplete()` → returns VerificationResult
9. **Status Update**:
   - If verified: `bd update bd-yyy --status completed`
   - If failed: retry or escalate, keep status open
10. **Parallel Execution**: Sibling XS tasks with no mutual deps execute concurrently

### Beads CLI Commands Used

```bash
# Create tasks
bd create "Task title" --description "..." --parent bd-parent-id

# Manage dependencies
bd dep add bd-blocked bd-blocker  # bd-blocked depends on bd-blocker
bd dep list bd-xxx                # show deps for task

# Update status
bd update bd-xxx --status completed
bd update bd-xxx --status in_progress

# Query ready tasks
bd ready --parent bd-xxx          # tasks ready to execute under parent

# Add labels (for size)
bd label add bd-xxx size:XS
```

---

## Phase 1: Repo Scaffolding + BAML Setup

### Overview

Create Go module scaffolding, BAML source layout, and wiring for code generation.

### Changes Required

#### 1. Go module and CLI entry
**File**: `go.mod`
**Changes**: Initialize Go module (module name: `nova`).

**File**: `cmd/nova-go/main.go`
**Changes**: CLI entry with basic flags and a `run` subcommand.

#### 2. BAML source layout
**File**: `baml_src/generators.baml`
**Changes**: Configure Go output, `baml-cli generate` target.

**File**: `baml_src/clients.baml`
**Changes**: Define Anthropic Sonnet (thinker) and Haiku (worker) clients.

#### 3. Scripts
**File**: `scripts/baml-generate.sh`
**Changes**: One-shot script to run `baml-cli generate` and format results if needed.

### Success Criteria

#### Automated Verification
- [ ] `baml-cli generate` produces `baml_client/` (or configured output dir)
- [ ] `go test ./...` passes (empty tests or scaffolding tests)

#### Manual Verification
- [ ] `nova-go --help` runs

---

## Phase 2: Beads Integration + Core Domain Model + BAML Contracts (TDD)

### Overview

Define task tree types, constraints, sizing, and BAML function contracts with tests.

### Changes Required

#### 1. Beads CLI adapter
**File**: `internal/beads/cli.go`
**Changes**: Shell adapter to execute `bd` commands:
- `CreateTask(title, desc, parent, deps) -> beadID`
- `AddDependency(blocked, blocker)`
- `UpdateStatus(id, status)`
- `GetReadyTasks() -> []beadID`
- `GetTask(id) -> Task`
- `AddLabel(id, label)`

**File**: `internal/beads/types.go`
**Changes**: Parse JSON output from `bd --json` commands, map to engine domain types.

#### 2. Domain types
**File**: `internal/engine/types.go`
**Changes**: Add `Task`, `TaskNode`, `TaskSize`, `TaskStatus`, `Run`, `Constraints`, `RetryPolicy`, `Result` types.

#### 3. BAML types + functions
**File**: `baml_src/types.baml`
**Changes**: Define types:
```baml
enum TaskSize {
  XL  // Epic-level, must decompose
  L   // Large, must decompose
  M   // Medium, must decompose
  S   // Small, must decompose
  XS  // Extra small - ONLY executable size
      // Target: 10-30 min, 1-2 files, ≤150 LOC, ≤2 tests, one clear acceptance
}

class TaskSpec {
  id          string
  title       string
  description string
  size        TaskSize?
  parent_id   string?
  deps        string[]
}

class SubtaskSpec {
  title       string
  description string
  deps        string[]  // sibling indices (0-based)
}

class Plan {
  reasoning   string
  subtasks    SubtaskSpec[]
}

class SizeResult {
  reasoning   string
  size        TaskSize
  confidence  string  // "high" | "medium" | "low"
}

class VerificationResult {
  is_complete     bool
  reasoning       string
  missing_items   string[]
  files_checked   string[]
}
```

**File**: `baml_src/functions.baml`
**Changes**: Functions:
- `PlanTask(task: TaskSpec, constraints: string) -> Plan`
- `SizeTask(task: TaskSpec) -> SizeResult` (with XS-only execution criteria)
- `VerifyTaskComplete(task: TaskSpec, files_changed: string[], execution_log: string) -> VerificationResult`

#### 4. Tests for domain rules
**File**: `internal/engine/types_test.go`
**Changes**: Tests for size ordering, tree shape, serialization.

**File**: `internal/engine/sizing_test.go`
**Changes**: Tests that tasks are repeatedly decomposed until size == XS (only XS is executable).

**File**: `internal/executor/claude_test.go`
**Changes**: Tests for Claude CLI execution (mocked subprocess calls).

### Success Criteria

#### Automated Verification
- [ ] `go test ./internal/engine -run TestSizing` passes
- [ ] `go test ./internal/beads` passes
- [ ] `baml-cli test` passes for any BAML tests added

#### Manual Verification
- [ ] BAML functions compile and generate Go client

---

## Phase 3: Engine Orchestration (Planner → Size → Execute)

### Overview

Implement recursive planning, sizing, and execution with retry enforcement.

### Changes Required

#### 1. Orchestration engine
**File**: `internal/engine/engine.go`
**Changes**: Implement:
- `Run(ctx, spec, constraints)` - main entry point
- `PlanAndSize(task)` - recursively decompose until XS
- `ExecuteXSTasks()` - execute leaf tasks in parallel when deps allow
- `ExecuteTask(task)` - shell out to Claude CLI in yolo mode
- `VerifyAndMarkComplete(task, output)` - verify via BAML, update bead status
- Retry logic per task with `max_attempts`

#### 2. BAML client integration
**File**: `internal/llm/baml_client.go`
**Changes**: Thin wrapper around generated BAML client for planning/sizing/verification.

#### 3. Claude CLI executor
**File**: `internal/executor/claude.go`
**Changes**: Shell executor for leaf tasks:
- Constructs prompt with task details
- Executes: `claude --dangerously-skip-permissions -p "<prompt>"`
- Captures stdout/stderr for verification
- Returns execution log and list of files changed

#### 4. CLI wiring (REPL/TUI)
**File**: `cmd/nova-go/main.go`
**Changes**:
- Accept spec as input (file or stdin)
- Interactive REPL/TUI mode for user messages
- Run engine with spec and constraints
- Handle user interaction prompts from execution
- Print run summary and link to trace artifacts

### Success Criteria

#### Automated Verification
- [ ] `go test ./...` passes
- [ ] Unit tests for recursion and retries pass

#### Manual Verification
- [ ] `nova-go --spec test.md` decomposes tasks recursively until all XS
- [ ] XS tasks execute via Claude CLI with correct prompts
- [ ] Verification runs after each task and marks beads status
- [ ] `bd list` shows task hierarchy with correct statuses and deps

---

## Phase 4: Minimal Tracing + Run Artifacts

### Overview

Add simple, append-only trace logging and run summaries.

### Changes Required

#### 1. Trace model
**File**: `internal/trace/events.go`
**Changes**: Define event structs: `RunStarted`, `TaskPlanned`, `TaskSized`, `TaskSplit`, `TaskExecutionStarted`, `TaskExecutionCompleted`, `TaskVerified`, `TaskSucceeded`, `TaskFailed`, `TaskRetried`, `BeadCreated`, `BeadStatusUpdated`.

#### 2. Trace writer
**File**: `internal/trace/writer.go`
**Changes**: Append JSONL events to `runs/<run-id>/trace.jsonl`.

#### 3. Run summary
**File**: `internal/trace/summary.go`
**Changes**: Write `runs/<run-id>/run.json` with final tree, sizes, and outcomes.

### Success Criteria

#### Automated Verification
- [ ] `go test ./internal/trace` passes

#### Manual Verification
- [ ] `runs/<run-id>/trace.jsonl` and `run.json` are created on a run

---

## Phase 5: Tooling, Linters, Pre-commit, CI

### Overview

Add linters, test automation, and pre-commit hooks.

### Changes Required

#### 1. Linting
**File**: `.golangci.yml`
**Changes**: Enable standard Go linters and static checks.

#### 2. Pre-commit hooks
**File**: `.pre-commit-config.yaml`
**Changes**: Hooks for `gofmt`, `golangci-lint`, `go test ./...`, `baml-cli generate`, `baml-cli test`.

#### 3. CI
**File**: `.github/workflows/ci.yml`
**Changes**: Run tests and lint on push/PR.

### Success Criteria

#### Automated Verification
- [ ] `pre-commit run --all-files` passes
- [ ] CI workflow passes on PR

#### Manual Verification
- [ ] New commit triggers lint/test locally before commit

---

## Testing Strategy

### Unit Tests
- Task sizing and recursive decomposition
- Retry logic per task
- Execution ordering (parents before children or only leaves)

### Integration Tests
- End-to-end run with stubbed BAML client
- Run artifacts generated correctly

### Manual Testing Steps
1. Create a test spec file with a medium-sized task
2. Run `nova-go --spec test-spec.md`
3. Confirm tasks are decomposed recursively until all are XS
4. Confirm XS tasks execute via Claude CLI
5. Confirm verification runs and marks beads as completed
6. Check `bd list` shows correct task hierarchy and statuses
7. Verify `runs/<run-id>/trace.jsonl` and `run.json` are created with full execution details

## Performance Considerations

- Recursion depth and node count are unbounded in MVP; avoid pathological prompts.
- Use buffered writer for trace JSONL to reduce overhead.

## Migration Notes

No migrations required.

## References

- **[Unified Architecture](../claude-trace/05-unified-architecture.md)** - How nova-go integrates with nova-trace for full observability
- BAML usage guide: `docs/baml-instructions.md`
- Beads CLI reference: `docs/beads-cli-reference.md`
- System roles: `claude.md`
- [Claude Trace Specs](../claude-trace/README.md) - Complete trace system documentation

## Open Questions

None. All clarifications resolved:
- Nova is REPL/TUI, accepts specs
- Beads CLI is used for task management (`bd create`, `bd dep`, `bd update`)
- Only XS tasks are executable (10-30 min, 1-2 files, ≤150 LOC)
- Leaf execution via Claude CLI in yolo mode
- Go engine verifies completion via BAML and controls bead status
- Sibling tasks can execute in parallel when no dependencies between them
