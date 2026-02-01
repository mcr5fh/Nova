# Solution Alignment Framework - Brainstorming

**Date:** 2026-01-31
**Status:** Ideation
**Goal:** Design an agent orchestration framework for solution alignment, MVP definition, and assumption validation

---

## Problem Statement

We need a framework to:

1. **Align on solution approach** before writing code
2. **Define MVP scope** and the first "trace round" (minimal end-to-end flow)
3. **Enumerate and validate assumptions** - confirm or deny them systematically
4. **Manage context** across Claude sessions without bloating
5. **Ensure continuity** when switching between sessions

### Why Not Just Use Ralph?

Ralph is excellent for *executing* work (research → plan → implement), but we need something *before* Ralph that:

- Defines what solution we're building
- Validates it will actually work end-to-end
- Learns from the first trace and refines
- Creates the tickets Ralph will execute

---

## Key Concepts from Research

### From Recent LLM Agent Memory Research (2025)

- **Memory Blocks Architecture** (MemGPT): Structured context into functional units
- **A-MEM (Agentic Memory)**: Dynamic knowledge networks using Zettelkasten principles
- **Multi-Layered Memory**: L0 (data) → L1 (abstraction) → L2 (personalized reasoning)
- **Session Management**: Automatic context handling with continuity across sessions

### From Existing Ralph System

- **Ticket-based persistence**: Tickets are the memory substrate
- **Phase-based workflow**: research → plan → implement → validate
- **Handoff mechanism**: Creates handoffs at 75% context (150K tokens)
- **Autonomous operation**: Runner that picks up work and continues

### From MVP/Iteration Research

- **Build-Measure-Learn**: Core feedback loop
- **Assumption validation**: Key to reducing risk
- **Trace-based thinking**: Validate end-to-end flow first

---

## Gas Town Insights Applied to Solution Alignment

### What Gas Town Teaches Us

#### 1. Context Persistence is Non-Negotiable

- Gas Town's core insight: agents are ephemeral, context must persist
- Our framework: Solution definitions, assumptions, and learnings must outlive any single Claude session
- Implementation: Use Beads-style Git-backed storage for all solution artifacts

#### 2. Structured Data > Natural Language

- Gas Town: Agents work better with JSONL/TOML than markdown prose
- Our framework: Assumption tracking needs parseable structure
- **Key Decision**: Use structured markdown (parseable by regex/YAML frontmatter) or adopt JSONL for assumptions

#### 3. The Hook Pattern for Work Persistence

- Gas Town: Each agent has a "hook" (Git worktree) with assigned work that survives crashes
- Our framework: Solution phases should have "hooks" - when an agent picks up SOL-001, it checks the solution state
- GUPP principle applies: "If there's unvalidated assumptions in your solution, YOU MUST VALIDATE THEM"

#### 4. Operational Model Not SDLC

- Gas Town: Don't simulate human organizations (analyst → PM → architect)
- Our framework: Focus on the *process* of assumption validation, not simulating roles
- We're orchestrating a *validation workflow*, not a team structure

#### 5. Beads Integration is Natural

- Gas Town: Beads serves as agent external memory (agents "like it" and use it "eagerly")
- Ralph: Already uses thoughts/shared/tickets/ with beads-like structure
- Our framework: Can extend beads or use similar pattern for solutions/assumptions

### Gas Town vs Our Framework

| Aspect | Gas Town | Solution Alignment Framework |
|--------|----------|------------------------------|
| **Focus** | Execution at scale (20-30+ agents) | Solution definition & validation |
| **Stage** | Stage 7-8 (10+ agents) | Pre-execution (Stage 4-6) |
| **Goal** | Parallel implementation throughput | Reduce assumptions before building |
| **Memory** | Beads (tasks), Git worktrees | Solutions, assumptions, traces |
| **Workflow** | Work assignment → execution → merge | Define → assume → trace → learn → iterate |
| **Cost Model** | $100/hr token burn acceptable | Must be cost-efficient (pre-build) |
| **Output** | Merged code, PRs | Validated solution design + tickets |

### Why We're Not Just Using Gas Town

Gas Town assumes:

- You know what to build
- The solution is validated
- You need parallel execution speed
- Cost is secondary to throughput

We need something that:

- Helps define what to build
- Validates the solution BEFORE scaling up
- Focuses on learning, not speed
- Minimizes wasted work from wrong assumptions

**The Stack Integration**:

```text
Solution Alignment (our framework)
         ↓
    Creates validated design + tickets
         ↓
Ralph (or Gas Town) picks up tickets
         ↓
    Executes implementation
```text

---

## Core System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    SOLUTION ALIGNMENT LAYER                  │
│                    (Pre-Ralph / Pre-Ticket)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────┐
        │     1. SOLUTION DEFINITION PHASE      │
        │  • Understand problem/requirements     │
        │  • Enumerate possible approaches       │
        │  • Select solution direction           │
        │  • Document high-level architecture    │
        └───────────────────────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────┐
        │     2. ASSUMPTION ENUMERATION         │
        │  • List all assumptions explicitly     │
        │  • Categorize by risk/uncertainty      │
        │  • Identify what MUST be validated     │
        │  • Track assumption status             │
        └───────────────────────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────┐
        │     3. TRACE ROUND DEFINITION         │
        │  • Define minimal end-to-end flow      │
        │  • Identify critical path through      │
        │    system                              │
        │  • Specify what "done" looks like      │
        │  • Create trace validation criteria    │
        └───────────────────────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────┐
        │     4. MVP SCOPE LOCK                 │
        │  • Freeze MVP scope boundary           │
        │  • Create implementation tickets       │
        │  • Set success criteria                │
        │  • Define learning objectives          │
        └───────────────────────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────┐
        │     5. TRACE IMPLEMENTATION           │
        │  • Build minimal trace                 │
        │  • Validate end-to-end                 │
        │  • Collect learnings                   │
        │  • Update assumptions                  │
        └───────────────────────────────────────┘
                              │
                              ▼
        ┌───────────────────────────────────────┐
        │     6. REFINEMENT / ITERATION         │
        │  • Review learnings from trace         │
        │  • Update solution definition          │
        │  • Re-enumerate assumptions            │
        │  • Plan next iteration                 │
        └───────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  HAND OFF TO    │
                    │  RALPH SYSTEM   │
                    │  (Full tickets) │
                    └─────────────────┘
```text

---

## File Structure (Beads-Inspired Pattern)

### Option A: Extended Beads Integration

```text
.beads/
├── issues.jsonl           # Existing beads (tickets)
└── solutions.jsonl        # New: Solution tracking
    # Each line: {"id":"sol-abc12", "status":"defining", "phase":"trace-1", ...}

thoughts/shared/
├── solutions/              # Solution definitions (detailed docs)
│   └── sol-abc12/
│       ├── definition.md   # Solution approach
│       ├── assumptions.jsonl  # Structured assumption tracking
│       ├── trace-01.md     # Trace round 1 spec
│       ├── trace-02.md     # Trace round 2 spec
│       └── learnings.md    # Accumulated learnings
└── handoffs/
    └── solution-alignment/
        └── YYYY-MM-DD_HH-MM-SS_sol-abc12_phase.md
```text

### Option B: Standalone System (Similar to Ralph)

```text
thoughts/shared/
├── solutions/              # Git-backed solution tracking
│   ├── SOL-001.md         # All-in-one: definition, status, current phase
│   ├── SOL-002.md
│   └── ...
├── assumptions/           # Structured assumption files
│   ├── SOL-001_assumptions.jsonl  # Parseable by agents
│   └── ...
├── traces/                # Trace round definitions & results
│   ├── SOL-001_trace-01/
│   │   ├── spec.md        # What to build
│   │   ├── results.md     # What we learned
│   │   └── assumptions-tested.txt
│   └── ...
└── handoffs/
    └── solution-alignment/
        └── YYYY-MM-DD_HH-MM-SS_SOL-XXX_phase.md
```text

### Recommendation: Option A (Beads Integration)

#### Why:

- Beads already provides Git-backed JSONL persistence
- Agents already know how to use beads
- Natural integration: Solutions → create tickets for Ralph
- Consistent tooling across the stack

#### Structure:

- **solutions.jsonl**: Lightweight state (ID, status, phase, current assumptions)
- **thoughts/shared/solutions/[id]/**: Detailed documents (human-readable)
- Agents read JSONL for status, read markdown for details

---

## Assumption Tracking System

### Why JSONL Format (Gas Town Insight)

Gas Town proved agents work better with **structured data** (JSONL, TOML) than markdown prose:

- ✓ Parseable by agents without regex
- ✓ Queryable (e.g., "show all UNKNOWN critical assumptions")
- ✓ Updateable atomically (add line to JSONL)
- ✓ Git-friendly (line-based diffs)

### Assumption JSONL Format

Each assumption is one line in `assumptions.jsonl`:

```jsonl
{"id":"asm-001","text":"API X supports Y operation","status":"UNKNOWN","impact":"BLOCKER","trace":"trace-01","created":"2026-01-31T10:00:00Z"}
{"id":"asm-002","text":"Performance requirement Z achievable","status":"TESTING","impact":"HIGH","trace":"trace-01","created":"2026-01-31T10:05:00Z"}
{"id":"asm-003","text":"Database supports required query patterns","status":"VALIDATED","impact":"HIGH","trace":"trace-01","tested":"2026-01-31T12:00:00Z","evidence":"Tested in trace-01, works as expected"}
{"id":"asm-004","text":"Third-party service has 99.9% uptime","status":"ASSUMED","impact":"MEDIUM","created":"2026-01-31T10:10:00Z"}
```text

### Assumption Schema

```typescript
{
  id: string;           // "asm-001" (unique within solution)
  text: string;         // Human-readable assumption
  status: "UNKNOWN" | "TESTING" | "VALIDATED" | "INVALIDATED" | "ASSUMED";
  impact: "BLOCKER" | "HIGH" | "MEDIUM" | "LOW";
  trace?: string;       // Which trace will test this (e.g., "trace-01")
  created: string;      // ISO timestamp
  tested?: string;      // ISO timestamp when validated/invalidated
  evidence?: string;    // What proved/disproved this
  pivot?: string;       // If invalidated, what needs to change
}
```text

### Assumption States

- **UNKNOWN**: Not yet investigated (default)
- **TESTING**: Currently being validated in a trace
- **VALIDATED**: ✓ Confirmed true through trace execution
- **INVALIDATED**: ✗ Proven false (may require solution pivot)
- **ASSUMED**: Accepting without validation (documented risk)

### Human-Readable View

Agents can generate markdown views from JSONL for humans:

```markdown
# Assumptions for sol-abc12: [Solution Name]

## Critical (BLOCKER/HIGH impact, unvalidated)
- [ ] **asm-001**: API X supports Y operation
      Status: UNKNOWN → Will test in trace-01
      Impact: BLOCKER

## Validated ✓
- [x] **asm-003**: Database supports required query patterns
      Status: VALIDATED
      Evidence: Tested in trace-01, works as expected

## Accepted Risks
- [ ] **asm-004**: Third-party service has 99.9% uptime
      Status: ASSUMED
      Impact: MEDIUM
```text

---

## Trace Round Concept

A **trace round** is:

- The minimal end-to-end execution path through the system
- Builds just enough to validate the critical path works
- Focuses on integration points and key assumptions
- Results in learnings that refine the solution

### Example Trace Round

```text
Trace-01: "User can submit form and see result"

Critical Path:
1. Frontend renders form ────────> Validates: UI framework works
2. User submits data    ────────> Validates: Input handling
3. API receives request ────────> Validates: Network layer
4. Backend processes    ────────> Validates: Core logic
5. Database stores      ────────> Validates: Persistence
6. API returns response ────────> Validates: Response format
7. Frontend displays    ────────> Validates: UI update

Assumptions Tested:
- ASM-001: API schema correct
- ASM-003: Database queries work
- ASM-007: Frontend state management

Out of Scope (for this trace):
- Authentication
- Error handling
- Edge cases
- Performance optimization
```text

---

## CLI Design (Beads-Style + Gas Town Principles)

### Core Commands

```bash
# Initialize: Start a new solution
bd solution init "Feature Name"
# Creates sol-abc12 in solutions.jsonl + directory structure
# Status: "defining"

# Define: Articulate solution approach
bd solution define sol-abc12
# Agent guides through: problem, approaches, selected direction, architecture
# Updates: thoughts/shared/solutions/sol-abc12/definition.md
# Status: "defining" → "assumptions"

# Enumerate: List all assumptions
bd solution assume sol-abc12
# Interactive assumption enumeration with impact/risk rating
# Creates: thoughts/shared/solutions/sol-abc12/assumptions.jsonl
# Status: "assumptions" → "tracing"

# Trace: Define minimal end-to-end flow
bd solution trace sol-abc12 --round 1
# Defines trace-01 spec (critical path, validation criteria)
# Creates: thoughts/shared/solutions/sol-abc12/trace-01.md
# Status: "tracing"

# Build: Implement the trace
bd solution build sol-abc12 --trace 1
# GUPP principle: Reads trace-01.md, MUST implement it
# No confirmation gates, autonomous execution
# Updates assumptions.jsonl with test results
# Status: "tracing" → "learning"

# Learn: Capture learnings from trace
bd solution learn sol-abc12 --trace 1
# Reviews: What worked? What failed? What assumptions changed?
# Updates: learnings.md, assumptions.jsonl
# Decision point: iterate (new trace) or finalize (create tickets)
# Status: "learning" → "tracing" or "finalizing"

# Finalize: Lock design, create implementation tickets
bd solution finalize sol-abc12
# Freezes solution scope
# Creates HYBRD tickets in thoughts/shared/tickets/
# Status: "finalizing" → "complete"
```text

### Query Commands

```bash
# Status: Check solution progress
bd solution status sol-abc12
# Shows: phase, assumptions (validated/unknown/invalidated), traces complete

# List: Show all solutions
bd solution list
# Lists: all solutions with status, priority, phase

# Show: Full solution details
bd solution show sol-abc12
# Displays: definition, assumptions table, trace history, learnings
```text

### Hook-Based Work Assignment (Gas Town Pattern)

```bash
# Pick: Agent picks up next work (autonomous mode)
bd solution pick
# Finds highest priority solution with pending work
# GUPP principle: If there's work, agent MUST do it
# - Status "assumptions" → runs assume
# - Status "tracing" + no trace spec → runs trace
# - Status "tracing" + trace spec → runs build
# - Status "learning" → runs learn
# Returns: Solution ID it's working on

# Resume: Continue after handoff
bd solution resume [handoff-file]
# Reads handoff, loads solution context, continues from last phase
```text

### Integration with Ralph

```bash
# After bd solution finalize sol-abc12 creates tickets:
/ralph_runner
# Ralph picks up HYBRD tickets and executes them
```text

---

## Context Management Strategy

### Why Context Bloat Happens

- Long conversations accumulate unnecessary details
- Agent re-reads entire solution history
- Token count grows with each iteration

### How to Avoid It

1. **Phase-based memory**: Each phase has its own focused context
   - Definition phase: only needs requirements
   - Trace phase: only needs trace spec + implementation
   - Learning phase: only needs trace results

2. **Structured documents**: Like beads/Ralph
   - Documents are the memory
   - Agent reads what it needs
   - Updates documents atomically

3. **Handoff mechanism**: At context limits
   - Save current state to handoff doc
   - Start fresh session
   - Resume from handoff with minimal context

4. **Assumption-driven**: Focus on unknowns
   - Only discuss unvalidated assumptions
   - Validated assumptions become "ground truth"
   - Reduces repeated discussion

---

## The Complete Stack Architecture

```text
┌────────────────────────────────────────────────────────────────┐
│                    PERSISTENCE LAYER (Beads)                    │
│  • solutions.jsonl (solution state)                             │
│  • issues.jsonl (tickets for execution)                         │
│  • Git-backed, JSONL format, agent-friendly                     │
└────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌────────────────────────────────┐  ┌─────────────────────────┐
│  SOLUTION ALIGNMENT LAYER      │  │   EXECUTION LAYER       │
│  (Pre-Build Validation)        │  │   (Build & Deploy)      │
│                                │  │                         │
│  Agent: Solution Architect     │  │   Agent: Ralph Runner   │
│                                │  │                         │
│  Commands:                     │  │   Commands:             │
│  • bd solution init            │  │   • /ralph_runner       │
│  • bd solution define          │  │   • /ralph_research     │
│  • bd solution assume          │  │   • /ralph_plan         │
│  • bd solution trace           │  │   • /ralph_impl         │
│  • bd solution build (trace)   │  │                         │
│  • bd solution learn           │  │   Workflow:             │
│  • bd solution finalize        │  │   • Research codebase   │
│                                │  │   • Create plans        │
│  Workflow:                     │  │   • Implement features  │
│  1. Define solution approach   │  │   • Test & validate     │
│  2. Enumerate assumptions      │  │                         │
│  3. Build minimal trace        │  │   Input:                │
│  4. Validate end-to-end        │  │   • HYBRD tickets       │
│  5. Learn & iterate            │  │     from finalized      │
│  6. Finalize → create tickets  │  │     solutions           │
│                                │  │                         │
│  Output:                       │  │   Output:               │
│  • Validated solution design   │  │   • Implemented code    │
│  • Tested assumptions          │  │   • Merged PRs          │
│  • HYBRD tickets ──────────────┼──┼─> • Deployed features   │
└────────────────────────────────┘  └─────────────────────────┘

                         ┌─────────────────┐
                         │  GAS TOWN       │
                         │  (Optional)     │
                         │  Multi-agent    │
                         │  parallel       │
                         │  execution at   │
                         │  scale          │
                         │  (Stage 7-8)    │
                         └─────────────────┘
```text

### Integration Flow

#### 1. Solution Alignment Phase (Our Framework)

```text
Problem → Define → Assumptions → Trace-1 → Learn → Iterate → Finalize
                                   ↓                           ↓
                            Update assumptions          Create tickets
                            (validated/invalidated)     (HYBRD-XXX)
```text

#### 2. Execution Phase (Ralph or Gas Town)

```text
HYBRD tickets → Research → Plan → Implement → Test → Merge
```text

### Handoff Points

| From | To | Trigger | Artifacts Passed |
|------|-----|---------|------------------|
| Solution Alignment | Ralph | `bd solution finalize` | HYBRD tickets in thoughts/shared/tickets/ |
| Ralph | Next Solution | Tickets complete | Learning log, deployed features |
| Solution Alignment | Gas Town | Large-scale parallelization needed | HYBRD tickets + convoy bundles |

### Key Differences from Gas Town Alone

**Gas Town** (Yegge's framework):

- Focus: Parallel execution at scale
- Input: Known solution, defined tickets
- Cost: $100/hr acceptable for speed
- Stage: 7-8 (10+ agents)

**Solution Alignment** (our framework):

- Focus: Validate solution before scaling
- Input: Problem, requirements, uncertainties
- Cost: Minimize waste from wrong assumptions
- Stage: 4-6 (1-3 agents, thoughtful iteration)

**Together**:

- Solution Alignment reduces risk before building
- Gas Town/Ralph maximizes speed during building
- Net result: Fast execution of validated solutions

---

## Concrete Example Walkthrough

### Scenario: "Add Real-Time Collaboration to Document Editor"

#### Step 1: Initialize

```bash
$ bd solution init "Real-time collaboration for doc editor"
Created: sol-a7x3q
Status: defining
```text

#### Step 2: Define Solution

```bash
bd solution define sol-a7x3q
```text

Agent guides through:

- Problem: Multiple users can't edit same document simultaneously
- Approaches considered: WebSockets, Server-Sent Events, Polling, CRDT
- Selected: WebSockets + operational transform
- Architecture: Client ↔ WebSocket server ↔ Redis (state) ↔ DB

#### Step 3: Enumerate Assumptions

```bash
bd solution assume sol-a7x3q
```text

Agent interactively builds assumptions.jsonl:

```jsonl
{"id":"asm-001","text":"WebSocket library supports room-based broadcasting","status":"UNKNOWN","impact":"BLOCKER"}
{"id":"asm-002","text":"Redis pub/sub latency <50ms at expected scale","status":"UNKNOWN","impact":"HIGH"}
{"id":"asm-003","text":"OT algorithm handles concurrent edits correctly","status":"UNKNOWN","impact":"BLOCKER"}
{"id":"asm-004","text":"Existing DB schema supports change history","status":"UNKNOWN","impact":"HIGH"}
{"id":"asm-005","text":"Frontend can handle real-time updates efficiently","status":"UNKNOWN","impact":"MEDIUM"}
```text

#### Step 4: Define Trace Round 1

```bash
bd solution trace sol-a7x3q --round 1
```text

Agent creates trace-01.md:

```markdown
# Trace-01: "Two users can see each other's edits in real-time"

Critical Path:
1. User A opens document
2. User B opens same document
3. User A types "Hello"
4. User B sees "Hello" appear in <50ms
5. User B types "World"
6. User A sees "World" appear in <50ms

Assumptions Tested:
- asm-001: WebSocket broadcasting (MUST WORK)
- asm-002: Redis latency (MEASURE)
- asm-003: OT algorithm (BASIC TEST)
- asm-005: Frontend updates (VISUAL VALIDATION)

Out of Scope:
- Authentication (use mock users)
- Conflict resolution edge cases
- History persistence
- >2 users
```text

#### Step 5: Build Trace

```bash
bd solution build sol-a7x3q --trace 1
```text

Agent implements minimal:

- WebSocket server (broadcasts messages)
- Redis pub/sub connection
- Simple OT algorithm (insert/delete only)
- Frontend listener (updates on message)
- Test harness (two browser tabs)

Results recorded in assumptions.jsonl:

```jsonl
{"id":"asm-001","text":"WebSocket library supports room-based broadcasting","status":"VALIDATED","impact":"BLOCKER","tested":"2026-01-31T14:00:00Z","evidence":"socket.io rooms work perfectly"}
{"id":"asm-002","text":"Redis pub/sub latency <50ms at expected scale","status":"VALIDATED","impact":"HIGH","tested":"2026-01-31T14:15:00Z","evidence":"Measured 12-18ms average"}
{"id":"asm-003","text":"OT algorithm handles concurrent edits correctly","status":"INVALIDATED","impact":"BLOCKER","tested":"2026-01-31T14:30:00Z","evidence":"Race condition when both users type simultaneously","pivot":"Need CRDT instead of OT"}
{"id":"asm-005","text":"Frontend can handle real-time updates efficiently","status":"VALIDATED","impact":"MEDIUM","tested":"2026-01-31T14:20:00Z","evidence":"Smooth at 10 updates/sec"}
```text

#### Step 6: Learn

```bash
bd solution learn sol-a7x3q --trace 1
```text

Agent captures learnings:

- ✓ WebSockets + Redis works great
- ✓ Latency is excellent
- ✗ OT algorithm insufficient → pivot to CRDT
- ✓ Frontend handles updates well

#### Decision: Iterate (asm-003 invalidated)

#### Step 7: Trace Round 2

```bash
bd solution trace sol-a7x3q --round 2
```text

Updated solution definition:

- Changed: OT → CRDT (Yjs library)
- New assumption: asm-006 "Yjs CRDT handles concurrent edits"

Trace-02 validates CRDT approach → ✓ ALL ASSUMPTIONS VALIDATED

#### Step 8: Finalize

```bash
bd solution finalize sol-a7x3q
```text

Agent creates tickets:

- HYBRD-101: Implement WebSocket server with Redis
- HYBRD-102: Integrate Yjs CRDT library
- HYBRD-103: Add real-time sync to document editor UI
- HYBRD-104: Add user presence indicators
- HYBRD-105: Write integration tests

#### Step 9: Hand to Ralph

```bash
/ralph_runner
```text

Ralph picks up HYBRD-101 through HYBRD-105 and executes them.

### Time & Cost Comparison

**Without Solution Alignment**:

- Build full system with OT → discover race conditions → rewrite with CRDT
- Time: 2-3 weeks of wasted implementation
- Cost: $1000+ in agent tokens building wrong solution

**With Solution Alignment**:

- Build trace in 2 hours → discover OT issue → pivot to CRDT in trace-02 (4 hours)
- Time: 6 hours validation, then build correct solution
- Cost: ~$50 in traces, saves $1000+ in avoided rework

## Implementation Decisions (Updated with Gas Town Insights)

### 1. Binary vs. Claude Skill? → **Extend Beads**

- **Recommendation**: Extend existing beads binary with `bd solution` commands
- Why:
  - ✓ Beads already Git-backed JSONL (perfect fit)
  - ✓ Agents already skilled with beads
  - ✓ Natural integration: solutions → issues
  - ✓ Consistent tooling across stack
- Implementation:
  - Add solutions.jsonl alongside issues.jsonl
  - Add `bd solution` command tree to beads CLI
  - Reuse beads infrastructure (Git commits, queries, etc.)

### 2. Assumption Format? → **JSONL (Gas Town Principle)**

- **Recommendation**: Use JSONL for assumptions, markdown for specs
- Why:
  - ✓ Gas Town proved agents work better with structured data
  - ✓ Queryable: "show UNKNOWN BLOCKER assumptions"
  - ✓ Parseable without regex
  - ✓ Git-friendly diffs
- Format: assumptions.jsonl (schema defined above)

### 3. Minimal First Version? → **MVP: init + assume + trace**

- **Phase 1 (MVP)**:
  - `bd solution init` - create solution
  - `bd solution assume` - enumerate assumptions (JSONL)
  - `bd solution trace` - define trace round
  - `bd solution status` - view progress
- **Phase 2**:
  - `bd solution build` - implement trace (GUPP principle)
  - `bd solution learn` - capture learnings
- **Phase 3**:
  - `bd solution finalize` - create tickets
  - `bd solution pick` - autonomous mode

### 4. Session Continuity? → **Handoff + JSONL State**

- **Recommendation**: Both (like Ralph + Gas Town)
- Mechanisms:
  1. **JSONL state** (solutions.jsonl): Agent reads current phase/status
  2. **Handoff docs**: At 75% context, create handoff with solution context
  3. **Git commits**: Every state change committed (automatic recovery)
- Resume pattern:

  ```bash
  bd solution pick  # Reads solutions.jsonl, finds work, continues
  # OR
  bd solution resume [handoff-file]  # After context limit
  ```

---

## Next Steps (Prioritized)

### Phase 1: Foundation (Week 1)

1. **Extend beads with `bd solution` commands**
   - Add solutions.jsonl schema
   - Implement `bd solution init`
   - Implement `bd solution status` / `bd solution list`
   - Test: Create a solution, verify Git commit, query state

2. **Define file formats**
   - Solutions directory structure: `thoughts/shared/solutions/[id]/`
   - JSONL schemas: solutions.jsonl, assumptions.jsonl
   - Markdown templates: definition.md, trace-XX.md, learnings.md

3. **Prototype assumption tracking**
   - Implement `bd solution assume [id]`
   - Interactive prompt: assumption text, impact, status
   - Output: assumptions.jsonl
   - Test: Add 5 assumptions, update one, query "show UNKNOWN BLOCKER"

### Phase 2: Trace Validation (Week 2)

4. **Implement trace definition**
   - `bd solution trace [id] --round N`
   - Agent guides: critical path, validation criteria, assumptions tested
   - Output: trace-XX.md

5. **Implement trace execution**
   - `bd solution build [id] --trace N`
   - GUPP principle: Reads spec, builds it, no confirmation
   - Updates: assumptions.jsonl (validated/invalidated)

6. **Implement learning capture**
   - `bd solution learn [id] --trace N`
   - Prompts: What worked? Failed? Pivots needed?
   - Output: learnings.md (append), updated definition if pivoted

### Phase 3: Integration (Week 3)

7. **Implement finalization**
   - `bd solution finalize [id]`
   - Generates: HYBRD tickets in thoughts/shared/tickets/
   - Links: Tickets reference solution, assumptions, traces

8. **Test end-to-end with real feature**
   - Pick a real feature from backlog
   - Run through full workflow
   - Measure: Time to validated design, assumptions reduced, tickets created

9. **Autonomous mode**
   - `bd solution pick`
   - Agent scans solutions.jsonl for pending work
   - GUPP: If work exists, do it (no confirmation)

### Phase 4: Polish (Week 4)

10. **Handoff mechanism**
    - At 75% context: auto-create handoff
    - `bd solution resume [handoff]`
    - Test: Long session → handoff → fresh session → resume

11. **Documentation & examples**
    - README with workflow diagram
    - 2-3 example walkthroughs
    - Integration guide for Ralph

12. **Metrics & refinement**
    - Track: Assumptions per solution, validation rate, time saved
    - Refine: Based on real usage patterns

---

## Open Questions

### Architecture

- [x] Should we integrate with beads? → **YES, extend beads**
- [x] JSONL vs markdown for assumptions? → **JSONL (Gas Town principle)**
- [ ] Should traces create Git branches or stay in main? → **TBD**
- [ ] How to handle trace cleanup (keep or delete)? → **TBD**

### Workflow

- [ ] Should `bd solution build` auto-run tests? → **Probably yes**
- [ ] When should finalization happen? Only after all assumptions validated? → **Configurable?**
- [ ] Can multiple people work on same solution? → **Not in Phase 1**
- [ ] Should there be a "review" phase before finalize? → **Maybe Phase 2 feature**

### Integration

- [ ] Does Ralph need changes to consume solution-generated tickets? → **Probably not**
- [ ] Should Gas Town be able to consume our tickets? → **Yes, but later**
- [ ] Can we reuse beads' epic/convoy concepts for multi-solution projects? → **Future enhancement**

### Metrics

- [ ] How do we measure "assumption reduction success"? → **% validated before finalize**
- [ ] What's a good assumption-to-ticket ratio? → **Learn from usage**
- [ ] Should we track time/cost savings? → **Yes, for justification**

### Edge Cases

- [x] What if trace invalidates BLOCKER assumption? → **Agent pivots, defines new trace**
- [ ] What if solution is too large for one agent? → **Decompose into sub-solutions?**
- [ ] What if assumptions conflict? → **Manual resolution needed**

---

## References

## Summary & Recommendation

### The Core Insight

Building software with AI agents has shifted from "can we build it?" to "should we build it this way?" The bottleneck is no longer implementation speed—it's **solution validation before scaling up**.

**Gas Town** (Yegge's framework) solves parallel execution at Stage 7-8 (10+ agents).
**Ralph** solves autonomous ticket execution (research → plan → implement).
**Beads** solves persistent memory across sessions.

**What's missing**: A framework that validates the solution approach *before* creating tickets, reducing wasted effort from invalid assumptions.

### What We're Building

**Solution Alignment Framework** - An extension to beads that adds:

```text
Problem → Define → Assumptions → Trace → Learn → Iterate → Tickets → Ralph/Gas Town
```text

**Key Innovation**: Assumption-driven development with trace validation

Instead of:

1. Define solution → 2. Build everything → 3. Discover it doesn't work → 4. Rewrite

We do:

1. Define solution → 2. Enumerate assumptions → 3. Build minimal trace → 4. Learn → 5. Iterate until validated → 6. Build full solution

### Why This Works

**Leverages Gas Town insights**:

- ✓ Context persistence (Git-backed JSONL)
- ✓ Structured data (assumptions.jsonl)
- ✓ GUPP principle (autonomous execution)
- ✓ Beads integration (natural fit)

**Addresses Gas Town gaps**:

- ✓ Pre-execution validation (before $100/hr burn)
- ✓ Assumption tracking (reduce risk)
- ✓ Learning capture (improve over time)

**Complements Ralph**:

- ✓ Generates validated tickets for Ralph
- ✓ Same persistence patterns
- ✓ Natural handoff points

### Expected Impact

**Time**: 80% reduction in wasted implementation (from building wrong solution)
**Cost**: $50 trace validation saves $1000+ in rework
**Quality**: Higher confidence in solution before scaling execution

### The Implementation Path

1. **Week 1**: Extend beads with `bd solution init/assume/status`
2. **Week 2**: Add trace definition and execution
3. **Week 3**: Integrate with Ralph via ticket generation
4. **Week 4**: Polish handoffs and autonomous mode

**First real test**: Pick a feature, run through workflow, measure results

### Recommendation

**Proceed with Phase 1 implementation**:

- Extend beads (don't build separate tool)
- Use JSONL for assumptions (Gas Town principle)
- Start with MVP commands (init, assume, status)
- Validate with real feature before building more

This is the missing piece between "what should we build?" and "let's build it fast."

---

### Research Sources

#### LLM Agent Memory & Context (2025-2026)

- [Memory Blocks Architecture (Letta)](https://www.letta.com/blog/memory-blocks)
- [A-MEM: Agentic Memory for LLM Agents](https://arxiv.org/abs/2502.12110)
- [AI Agent Orchestration Frameworks 2025](https://www.kubiya.ai/blog/ai-agent-orchestration-frameworks)

#### MVP & Iteration Patterns

- [Feedback Loops in MVP Development](https://designli.co/blog/how-feedback-loops-drive-mvp-development)

#### Gas Town (Steve Yegge, January 2026)

- [Welcome to Gas Town - Steve Yegge](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04)
- [GitHub - steveyegge/gastown](https://github.com/steveyegge/gastown)
- [Gas Town Decoded - Andrew Lilley Brinker](https://www.alilleybrinker.com/mini/gas-town-decoded/)
- [The Future of Coding Agents - Steve Yegge](https://steve-yegge.medium.com/the-future-of-coding-agents-e9451a84207c)
- [Yegge's Developer-Agent Evolution Model](https://justin.abrah.ms/blog/2026-01-08-yegge-s-developer-agent-evolution-model.html)

### Key Concepts from Gas Town

**Core Philosophy**: "AI agents are ephemeral. But work context should be permanent."

**GUPP Principle**: "If there is work on your hook, YOU MUST RUN IT" (no confirmation gates, ensures work persists across crashes)

**Beads as External Memory**:

- Git-backed JSONL providing structured external memory for agents
- Agents use it "naturally and smoothly" without training
- Query capabilities + version control

**Git Worktrees**: Isolated workspaces per agent (hooks) with automatic versioning

**MEOW Stack**: Layered workflow abstraction

- Beads (atomic tasks) → Epics (hierarchical collections)
- Molecules (instantiated workflows) → Protomolecules (templates)
- Formulas (TOML-defined workflows)

**Operational vs SDLC Model**: Coordinate systems (operational) vs simulate organizations (SDLC)

**Key Insight**: "Context management > model intelligence" for agent success

**Structured Data First**: Agents work best with explicit semantics (JSONL, TOML) over natural language

**8-Stage Evolution**: Gas Town targets Stage 7-8 (10+ agents, custom orchestration)

### Existing Systems Reference

- **Ralph**: Autonomous ticket execution (research → plan → implement)
- **Beads**: Git-backed issue tracker for multi-session work (250+ forks, 5000+ stars)
- **Gas Town**: Multi-agent workspace manager (Steve Yegge, Stage 7-8 orchestration)
- **LangGraph**: Multi-agent orchestration with diverse control flows
- **CrewAI**: Role-based agent crews for business processes
