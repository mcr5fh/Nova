# Fractal Task Orchestrator Brainstorm

## Problem framing

- LLMs are unreliable and expensive for medium/large tasks.
- Need a system that decomposes work into small, reliable leaf tasks that can be delegated to smaller/cheaper models.
- The system must recurse/iterate, recover from blocks, and escalate to a human when needed.
- Observability is required: bird's-eye status (red/yellow/green) with drill-down into task trees.

## High-level idea

- The system is code-first: LLMs propose next steps, but execution and state are controlled by deterministic orchestration.
- Entry point: `spec.md`.
- A planner LLM decides size/complexity and whether to recurse.
- Leaf tasks are executed by workers (small models) with bounded retries.
- If blocked, an escalation agent routes to either a fixer LLM or a human.
- Human guidance is injected back into the worker prompt and the task reattempts.
- Tree collapses upward as leaf tasks complete and are validated.

## Core loop (fractal)

1. Read `spec.md` into a root task.
2. Planner step:
   - Estimate size (T-shirt sizing).
   - Decide: split vs. execute.
3. If split: create child tasks and recurse.
4. If execute: assign to worker with `n` attempts.
5. If blocked: escalation -> fixer LLM or human.
6. Human response is appended to task context.
7. Continue until all leaves are green; roll-up completion to parents.

## Control flow (ASCII sketch)

```text
              +--------------------+
spec.md ----> |  Orchestrator      |
              |  (state machine)   |
              +---------+----------+
                        |
                        v
               +-------------------+
               | Planner LLM       |
               | size + split?     |
               +----+---------+----+
                    |         |
           split? yes         no
                    |         |
                    v         v
         +----------------+  +------------------+
         | Create tasks   |  | Worker LLM       |
         | in Beads       |  | (n attempts)     |
         +-------+--------+  +--------+---------+
                 |                    |
                 v                    v
         +----------------+   success? yes
         | Recurse on     |--------+----------------+
         | child tasks    |        |                |
         +----------------+        v                |
                             +------------+         |
                             | Validate   |         |
                             +-----+------+         |
                                   |                |
                              pass? yes             |
                                   |                |
                                   v                |
                           +---------------+         |
                           | Mark done in  |<--------+
                           | Beads         |
                           +-------+-------+
                                   |
                                   v
                              roll-up

             blocked / fail
                    |
                    v
             +--------------+
             | Escalation   |
             | Router LLM   |
             +----+----+----+
                  |    |
            fix? yes    no
                  |    |
                  v    v
           +-----------+     +----------------+
           | Fixer LLM |     | Human feedback |
           +-----+-----+     +--------+-------+
                 |                  |
                 v                  v
             inject guidance back into worker
```text

## Architectural sketch

- **Planner** (LLM): task sizing, decomposition, routing.
- **Worker** (small model): executes leaf tasks.
- **Validator** (LLM or deterministic checks): evaluates outputs.
- **Escalation router** (LLM): decides fix vs. human.
- **Human-in-the-loop**: provides guidance or constraints.
- **Orchestrator** (code): owns state machine, retries, timeouts, cost budget, tool calls.
- **Telemetry**: traces, status dashboard, task tree view.

## Possible frameworks to borrow ideas from

These are not necessarily required to use, but useful reference points for patterns:

- OpenAI Agents SDK: handoffs, guardrails, tracing/observability. citeturn4search1turn4search7
- OpenAI Swarm (educational): handoffs, lightweight agent orchestration; replaced by Agents SDK. citeturn0search0turn4search2
- LangGraph: stateful graphs, cycles, persistence, human-in-the-loop; integrates with LangSmith for observability. citeturn3search1
- AutoGen: multi-agent conversation framework; AutoGen Studio adds UI + profiling. citeturn2search1turn2search3
- CrewAI hierarchical process: explicit manager agent for task delegation and validation. citeturn1search0turn1search1

## Data model (proposal)

- `Task`
  - `id`, `parent_id`, `children[]`
  - `spec` (text or reference to file)
  - `size` (XS/S/M/L/XL)
  - `status` (queued, running, blocked, escalated, needs_human, failed, done)
  - `attempts`, `max_attempts`
  - `assigned_worker`, `worker_model`
  - `inputs`, `outputs`, `artifacts[]`
  - `validation` (pass/fail + reason)
  - `telemetry` (tokens, cost, tool calls)

## Task sizing heuristics (ideas)

- Token-based estimate of spec length + required context.
- Complexity tags: number of files, external APIs, tests.
- Risk signals: ambiguous requirements, missing inputs.
- If size > S or risk high, recurse.

## Leaf task sizing (small-model friendly)

- Target 10–30 minutes of human-level effort.
- 1–2 files touched, ≤150 LOC changed, ≤2 tests added/updated.
- One clear acceptance criterion (e.g., “new endpoint returns 200 with schema X”).
- No ambiguous product decisions; dependencies already identified.
- Rationale: small models fail when juggling multiple artifacts or open-ended decisions.

## Additional recommendations

- Task types: start with backend or frontend code changes only; expand to full-stack once stable.
- Budget: enforce per-task token budget + global budget; pause recursion when budget is tight and ask for reprioritization.
- Escalation channel: keep it inside the CLI first; add Slack/email later.
- “Done” definition: deterministic checks first (tests/lint/compile); optional LLM review only if tests are weak.
- Tool allow-list: strict allow-list per task initially; expand later to reduce flakiness.
- State storage: JSON event log + SQLite for querying; migrate to Postgres later if needed.

## Self-improving loop ideas (Signals-inspired)

- Add a parallel “session analysis” pipeline that periodically reviews completed runs and emits structured “friction” and “delight” signals, not raw logs. citeturn0view0
- Use facet extraction (task intent, languages, frameworks, tool outcomes) to enable aggregate analysis without reading full conversations. citeturn0view0
- Cluster summaries/embeddings to discover new recurring failure modes; promote them into first-class categories (new facets/friction types). citeturn0view0
- Define thresholds on friction rates or severity; when crossed, auto-file improvement tasks in Beads and route to the orchestrator. citeturn0view0
- Correlate friction with system logs (tool failures, timeouts) to prioritize fixes that reduce user pain. citeturn0view0
- Keep humans in the loop for PR review/approval, but automate the path from “pattern detected” to “fix proposed.” citeturn0view0
- Add privacy-preserving abstractions: store only abstracted citations and aggregate stats for analysis. citeturn0view0

## Decomposition strategy

- Decompose by artifacts (files/modules), by dependency (core -> edges), or by user stories.
- Stop splitting when:
  - Inputs are concrete.
  - Output artifacts are scoped and testable.
  - Estimated run time is short.

## Worker contract

- Worker operates in a sandboxed workspace and can only do one atomic task.
- Must emit:
  - Output summary
  - Files changed
  - Tests run
  - Confidence + unresolved questions

## Validation & gating

- Deterministic checks: lint, tests, compile, schema validation.
- LLM review: verify requirements met, no regression.
- If validation fails, return to worker with concrete failure context.

## Escalation logic

- Escalate when:
  - `attempts >= max_attempts`
  - deterministic failure is non-actionable
  - requirements ambiguity persists
- Escalation router decides:
  - Fixer LLM: if missing knowledge or reasoning correction is likely
  - Human: if requirements ambiguity or external decision needed
- Human guidance is stored and injected into next attempt context.

## Observability design

- Task tree graph view: nodes colored R/Y/G.
- Drill-down per task: prompt, tool calls, artifacts, costs, timings.
- Timeline view: replays LLM decisions and handoffs.
- Budget view: per task and total cost.
- Trace log: structured events to enable replay and auditing.

## Minimal tracer (bare bones)

- Keep Beads as the source of truth for task structure/status; avoid duplicating parent/child in telemetry.
- Store only per-attempt telemetry: tokens, duration, cost, model, attempt number, and a short summary.
- Persist as JSONL (append-only) with `run_id`, `task_id`, `timestamp`, `event_type`.
- Add a tiny SQLite index later if queries become painful; don’t start there.

## Beads integration (bd as source of truth)

- Use Beads (`bd`) as the canonical task tracker for hierarchy, dependencies, and status.
- Keep a separate orchestrator telemetry store (JSONL/SQLite) for prompts, tool calls, retries, costs, and artifacts.
- Join telemetry to Beads tasks via `task_id` to avoid duplicating core task state.
- Status mapping: Beads `open/in_progress/closed` plus notes for `blocked`; hard blocks can be modeled as unmet deps.
- Orchestrator writes to Beads for task creation, dependency updates, and status changes; telemetry remains append-only.

## Tool call philosophy

- All tool calls are explicit; no hidden agent steps.
- Orchestrator decides which tool set each agent can access.
- Tools include:
  - `read_file`, `write_file`, `run_tests`
  - `search_web` (for explicit research tasks)
  - `ask_human` (opens a human feedback channel)

## Minimal viable prototype (MVP)

1. Read `spec.md`.
2. Planner LLM -> produce task tree (depth-limited).
3. Execute leaves with small model + max attempts.
4. If blocked, send a human prompt and wait.
5. Track and render task tree status in a simple UI (CLI + JSON or basic web).

## Open questions

- How do we define size thresholds that are robust across domains?
- What does the “worker” prompt template look like to ensure narrow scope?
- How do we store and re-use human interventions as policy?
- What is the right retry strategy (linear vs. exponential backoff)?
- How do we prevent recursive decomposition from exploding task count?
- What are hard safety boundaries for tools and code execution?

## Risks and mitigations (initial)

- Decomposition errors (over/under-splitting): enforce hard stop rules, cap depth/nodes, and require concrete acceptance criteria for leaves.
- Hidden dependencies: require explicit dependency declaration in planner output; block execution until deps are satisfied.
- Spec ambiguity: detect “missing info” signals and escalate early; store human clarifications as reusable policy snippets.
- Weak validation: prioritize deterministic checks (tests/lint/compile) and fail tasks on missing or flaky tests.
- State drift between Beads and telemetry: treat Beads as source of truth; use idempotent updates and periodic reconciliation.
- Escalation spam or delays: tune thresholds; add a “cooldown” and auto-summarize context for humans.
- Cost/latency creep: enforce per-task and global budgets; pause recursion when nearing limits.
- Tooling errors misread as failure: classify infra/tool errors separately and retry with backoff.
- Security boundary creep: strict tool allow-lists and sandboxing; explicit approval for sensitive operations.

## Next steps (if useful)

- Decide MVP storage format: JSON file, SQLite, or event log.
- Draft planner and worker prompts.
- Pick an observability stack: logs + simple web UI, or trace visualization.
- Define a minimal “task schema” and a small test harness.
