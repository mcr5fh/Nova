---
description: "Decompose a full-spec into beads (epic + atomic tasks with dependencies)"
argument-hint: "PATH_TO_FULL_SPEC"
---

# Cascade Beads

You decompose a `full-spec.md` into a beads epic with atomic, dependency-linked tasks. Each task = one logical change = one PR.

## Input

The path to a full-spec file is: `$ARGUMENTS`

If no path was provided, ask the user for the path to a `full-spec.md` file using AskUserQuestion.

## Workflow

### Step 1: Read the Full Spec

Read the file at `$ARGUMENTS` completely using the Read tool (no limit/offset). **Do not proceed until you have read the entire file.**

Extract:
- **Overview**: What is being built and why
- **Phases**: Each numbered phase and its purpose
- **Changes per phase**: The specific file changes, code snippets, and modifications in each phase
- **Success criteria**: How to verify each phase is complete
- **Edge cases**: From the edge cases table
- **What we're NOT doing**: Out-of-scope items

### Step 2: Decompose into Atomic Tasks

For each phase, break changes into atomic tasks. Each task should be:

- **One logical change** — a cohesive set of file changes that can be reviewed as a single PR
- **Self-contained** — after the task is done, the codebase is in a valid state
- **Testable** — has clear acceptance criteria

**Grouping rules:**
- A component file + its test file = 1 task (not 2)
- A config change that multiple files depend on = its own task, done first
- Documentation = its own task at the end of its phase
- If a phase has only one change group, it's one task

**For each task, define:**
1. **Title**: Short imperative sentence (e.g., "Add user authentication middleware")
2. **Description**: Which files to create/modify, what changes to make, acceptance criteria
3. **Priority**: P0 (critical path), P1 (important), P2 (nice-to-have)
4. **Phase**: Which phase it belongs to
5. **Dependencies**: Which other tasks must complete before this one can start

**Dependency rules:**
- The first task(s) in Phase N+1 block on the last task(s) in Phase N
- Within a phase, tasks are independent unless one produces something another consumes
- Foundation/config tasks block everything in their phase that depends on them

### Step 3: Present the Decomposition

Present the proposed decomposition to the user in this format:

```
## Proposed Beads Decomposition

**Epic:** [Epic title from the spec overview]

### Phase 1: [Phase Name]
| # | Task | Files | Deps | Priority |
|---|------|-------|------|----------|
| 1 | [title] | [files] | — | P0 |
| 2 | [title] | [files] | — | P1 |

### Phase 2: [Phase Name]
| # | Task | Files | Deps | Priority |
|---|------|-------|------|----------|
| 3 | [title] | [files] | #1, #2 | P0 |
| 4 | [title] | [files] | #3 | P1 |

**Total: N tasks across M phases**
```

Then use AskUserQuestion to ask:

**Question:** "Does this decomposition look right? Should I create these beads?"
**Options:**
1. "Create beads" — Proceed to create the epic and all tasks
2. "Adjust decomposition" — Let me suggest changes first

If the user wants adjustments, incorporate their feedback and re-present. Repeat until approved.

### Step 4: Create Beads

Once approved, create the epic and tasks using `bd` CLI commands via Bash.

**4a. Create the epic:**

```bash
bd create "Epic title from spec overview" --type=epic --silent
```

Capture the epic ID from stdout (e.g., `bd-a1b2c3`).

**4b. Create tasks sequentially:**

For each task in order, run:

```bash
bd create "Task title" --type=task --parent=EPIC_ID --deps="blocks:DEP_ID_1,blocks:DEP_ID_2" -d "Description with files and acceptance criteria" --priority=N --silent
```

- `--parent=EPIC_ID` — links to the epic
- `--deps="blocks:DEP_ID"` — only include if this task has dependencies on prior tasks. Omit `--deps` entirely if there are no dependencies.
- `--silent` — capture only the ID from stdout
- `--priority` — 0 for P0, 1 for P1, 2 for P2

Capture each task's ID so you can reference it as a dependency for later tasks.

**Important:** Map the task numbers from Step 3 to actual bead IDs as you create them. Task #1 gets ID X, task #2 gets ID Y, so when task #3 depends on #1, you use `--deps="blocks:X"`.

### Step 5: Verify and Report

After all tasks are created, run:

```bash
bd graph EPIC_ID
```

Show the graph output to the user and confirm the structure looks correct.

Then summarize:
```
✓ Created epic: EPIC_ID — "Epic title"
✓ Created N tasks across M phases
✓ Dependency graph verified

Run `bd graph EPIC_ID` anytime to see the full structure.
```

## Rules

1. **Read the full spec first** — never guess at content
2. **One task = one PR** — if a task would need 2 PRs, split it
3. **Respect phase ordering** — cross-phase deps always go forward
4. **Be interactive** — get approval before creating anything
5. **Capture all IDs** — you need them for dependency wiring
6. **Use --silent** — for scripting, only capture the ID
7. **Verify with graph** — always show the final dependency graph
