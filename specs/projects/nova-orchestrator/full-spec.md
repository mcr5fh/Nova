# Nova Orchestrator Implementation Plan

## Overview

Build a meta-orchestrator skill (`/nova:plan`) that guides users through a complete planning workflow: problem definition → solution architecture → solution critique → implementation plan. The orchestrator auto-detects existing artifacts and routes to appropriate sub-skills.

## New Project-Based File Organization

All artifacts for a project live in a single directory:

```
specs/projects/{slug}/
├── problem.md           # Problem statement (from /problem:plan)
├── solution.md          # Solution architecture (from /solution-architect:plan)
├── critique.md          # Edge case analysis (from /solution-critic:plan)
└── full-spec.md         # Final implementation plan (from /create-plan)
```

**Benefits:**
- All project context in one place
- Easy to see project completeness at a glance
- Simpler artifact detection for orchestrator

**Migration:** Existing skills (`problem:plan`, `solution-architect:plan`, `create-plan`) will need updates to use the new paths.

## Components to Build

### 1. Nova Orchestrator (`/nova:*`)
- **Files to create:**
  - `.claude/commands/nova/plan.md` - Main orchestrator
  - `.claude/commands/nova/resume.md` - Resume interrupted sessions
  - `.claude/commands/nova/help.md` - Documentation
  - `.claude/commands/nova/cleanup.md` - Clean up state files

### 2. Solution Critic (`/solution-critic:*`)
- **Files to create:**
  - `.claude/commands/solution-critic/plan.md` - Edge case analyzer
  - `.claude/commands/solution-critic/resume.md` - Resume capability
  - `.claude/commands/solution-critic/help.md` - Documentation
  - `.claude/commands/solution-critic/cleanup.md` - Clean up state files

### 3. Self-Improvement Integration
- **Files to modify:**
  - `.claude/commands/full_loop.md` - Add nova + solution-critic to analysis scope
- **Files to create:**
  - `.claude/commands/nova/automatic_updater.md` - Self-improvement for nova
  - `.claude/commands/solution-critic/automatic_updater.md` - Self-improvement for critic

### 4. Weights & Biases Integration
- **Files to create:**
  - `program_nova/wandb_logger.py` - W&B logging utility for skills
- **Files to modify:**
  - All skill `plan.md` files - Add W&B logging at skill completion

---

## Phase 1: Nova Orchestrator Core

### `.claude/commands/nova/plan.md`

**Frontmatter:**
```yaml
description: "Start an end-to-end planning session"
argument-hint: "FEATURE_NAME"
allowed-tools: ["AskUserQuestion", "Read", "Write", "Glob"]
```

**State file:** `.claude/nova-{slug}.json`
```json
{
  "slug": "{slug}",
  "startedAt": "{timestamp}",
  "currentPhase": "discovery|problem|solution|critique|plan|complete",
  "projectDir": "specs/projects/{slug}/",
  "artifacts": {
    "problem": null,      // specs/projects/{slug}/problem.md
    "solution": null,     // specs/projects/{slug}/solution.md
    "critique": null,     // specs/projects/{slug}/critique.md
    "fullSpec": null      // specs/projects/{slug}/full-spec.md
  },
  "phaseHistory": [],     // track phase transitions
  "conversationSummary": ""
}
```

**Workflow Logic:**

1. **Session Start:**
   - Create/load state file
   - Create project directory if needed: `specs/projects/{slug}/`
   - Scan for existing artifacts:
     - `specs/projects/{slug}/problem.md`
     - `specs/projects/{slug}/solution.md`
     - `specs/projects/{slug}/critique.md`
     - `specs/projects/{slug}/full-spec.md`
   - Determine starting phase based on what exists

2. **Phase: Discovery** (if no problem spec)
   - Conversational assessment of readiness
   - Questions to determine if problem is clear
   - If unclear → recommend `/problem:plan {slug}`
   - If clear → skip to solution phase

3. **Phase: Problem** (if problem needed)
   - Instruct user: "Run `/problem:plan {slug}` to define the problem"
   - Wait for user to return
   - Verify `specs/projects/{slug}/problem.md` exists
   - Summarize problem and ask if ready to proceed

4. **Phase: Solution** (if no solution spec)
   - Instruct user: "Run `/solution-architect:plan {slug}` to design the solution"
   - Wait for user to return
   - Verify `specs/projects/{slug}/solution.md` exists
   - Summarize solution and ask if ready for critique

5. **Phase: Critique** (if no critique)
   - Instruct user: "Run `/solution-critic:plan {slug}` to validate edge cases"
   - Wait for user to return
   - Verify `specs/projects/{slug}/critique.md` exists
   - Present critique summary

6. **Phase: Plan** (final)
   - Instruct user: "Run `/create-plan {slug}` to generate implementation plan"
   - Wait for user to return
   - Verify `specs/projects/{slug}/full-spec.md` exists
   - Mark complete, delete state file

**Key Behaviors:**
- Always show current phase and progress
- `/progress` command shows full status
- `/skip` command to skip a phase (with warning)
- Auto-detect when sub-skill completes by checking for artifacts

---

## Phase 2: Solution Critic Skill

### `.claude/commands/solution-critic/plan.md`

**Frontmatter:**
```yaml
description: "Analyze a solution spec for edge cases and ambiguities"
argument-hint: "SOLUTION_NAME"
allowed-tools: ["AskUserQuestion", "Read", "Write", "Glob"]
```

**State file:** `.claude/solution-critic-{slug}.json`
```json
{
  "slug": "{slug}",
  "startedAt": "{timestamp}",
  "solutionSpec": null,  // loaded content
  "dimensions": {
    "edge_case_completeness": { "coverage": "not_started", "evidence": [] },
    "failure_mode_handling": { "coverage": "not_started", "evidence": [] },
    "ambiguity_resolution": { "coverage": "not_started", "evidence": [] },
    "dependency_risks": { "coverage": "not_started", "evidence": [] },
    "scalability_concerns": { "coverage": "not_started", "evidence": [] },
    "security_considerations": { "coverage": "not_started", "evidence": [] }
  },
  "discoveredIssues": [],  // issues found during analysis
  "resolvedIssues": [],    // issues with user decisions
  "conversationSummary": ""
}
```

**Six Dimensions:**

| Dimension | Threshold | Focus |
|-----------|-----------|-------|
| Edge Case Completeness | strong | Are all edge cases from spec addressed? Any missing? |
| Failure Mode Handling | strong | What happens when things go wrong? |
| Ambiguity Resolution | strong | Any vague requirements that need decisions? |
| Dependency Risks | partial | External dependencies that could fail? |
| Scalability Concerns | partial | Will this work at scale? |
| Security Considerations | partial | Any security implications? |

**Interview Flow:**

1. **Load Phase:**
   - Read `specs/projects/{slug}/solution.md`
   - Parse edge cases table
   - Identify implementation diagram paths

2. **Analysis Phase:**
   - Walk through each edge case: "Is this handling sufficient?"
   - For each diagram path: "What could go wrong here?"
   - Surface ambiguities: "The spec says X, but what about Y?"

3. **Decision Phase:**
   - For each issue found, ask user for decision
   - Record decision in `resolvedIssues[]`
   - Update dimension coverage

4. **Output Phase:**
   - Generate `specs/projects/{slug}/critique.md`:

```markdown
# Solution Critique: {title}

> Analyzed from: `specs/projects/{slug}/solution.md`

## Summary
[Brief summary of critique findings]

## Resolved Decisions

| Issue | Category | User Decision | Rationale |
|-------|----------|---------------|-----------|
| [issue] | [dimension] | [decision] | [why] |

## Edge Case Enhancements

| Original Case | Enhancement | Severity |
|---------------|-------------|----------|
| [from spec] | [additional handling] | [level] |

## Risk Assessment

### High Priority
- [Critical issues to address in implementation]

### Medium Priority
- [Important but not blocking]

### Low Priority
- [Nice to have considerations]

## Recommendations for Implementation

1. [Specific recommendation with rationale]
2. [Another recommendation]

## Confidence Assessment
- Edge Cases: HIGH|MEDIUM|LOW
- Failure Handling: HIGH|MEDIUM|LOW
- Overall Robustness: HIGH|MEDIUM|LOW

---
*Generated by solution-critic*
```

---

## Phase 3: Support Files

### `.claude/commands/nova/help.md`
```yaml
description: "Explain the nova workflow"
allowed-tools: []
```
Documents the full workflow, phases, commands, and tips.

### `.claude/commands/nova/resume.md`
```yaml
description: "Resume an interrupted nova session"
allowed-tools: ["Read", "Write", "Glob", "AskUserQuestion"]
```
Loads state file and continues from last phase.

### `.claude/commands/nova/cleanup.md`
```yaml
description: "Clean up all nova state files"
allowed-tools: ["Glob", "Bash"]
```
Removes `.claude/nova-*.json` files.

### Similar files for `solution-critic/` (help, resume, cleanup)

---

## Phase 4: Self-Improvement Integration

### Modify `.claude/commands/full_loop.md`

Add nova and solution-critic to the analysis scope:
- Include nova orchestration failures in analysis
- Include solution-critic edge case discovery failures
- Track when orchestrator routing was suboptimal

### Create `.claude/commands/nova/automatic_updater.md`

Pattern follows `solution-architect/automatic_updater.md`:
- Query nova-related findings from nova.db
- Filter for relevant improvements:
  - Phase transition logic
  - Artifact detection accuracy
  - User guidance quality
- Make targeted edits to `nova/plan.md` and `nova/help.md`

### Create `.claude/commands/solution-critic/automatic_updater.md`

Similar pattern:
- Query solution-critic findings
- Filter for relevant improvements:
  - Edge case discovery patterns
  - Question quality improvements
  - Dimension threshold adjustments
- Make targeted edits to critic skills

---

## Phase 5: Weights & Biases Integration

### Overview

Log comprehensive metrics at the end of each skill completion. W&B tracks three categories:

1. **Session Metrics** - Workflow progress and timing
2. **Quality Signals** - Edge cases, decisions, confidence scores
3. **Self-Improvement Loop** - Automatic updater activity

### W&B Logger Module

**File:** `program_nova/wandb_logger.py`

```python
import wandb
from datetime import datetime
from pathlib import Path
import json

class NovaWandbLogger:
    """Logs Nova skill metrics to Weights & Biases."""

    PROJECT_NAME = "nova-planning"

    @classmethod
    def log_skill_completion(cls, skill_name: str, slug: str, state: dict):
        """Log metrics when a skill completes."""
        run = wandb.init(
            project=cls.PROJECT_NAME,
            name=f"{skill_name}/{slug}",
            tags=[skill_name, slug],
            config={"skill": skill_name, "slug": slug}
        )

        # Session metrics
        run.log({
            "session/duration_seconds": cls._calc_duration(state),
            "session/phase": state.get("currentPhase", skill_name),
            "session/slug": slug,
        })

        # Dimension coverage (if applicable)
        if "dimensions" in state:
            for dim_name, dim_data in state["dimensions"].items():
                coverage_score = cls._coverage_to_score(dim_data["coverage"])
                run.log({
                    f"dimensions/{dim_name}/coverage": coverage_score,
                    f"dimensions/{dim_name}/evidence_count": len(dim_data.get("evidence", [])),
                })

        # Quality signals
        if "discoveredIssues" in state:
            run.log({"quality/issues_discovered": len(state["discoveredIssues"])})
        if "resolvedIssues" in state:
            run.log({"quality/issues_resolved": len(state["resolvedIssues"])})

        run.finish()

    @classmethod
    def log_automatic_update(cls, skill_name: str, findings_count: int,
                             changes_made: list, files_modified: list):
        """Log when automatic updater makes changes."""
        run = wandb.init(
            project=cls.PROJECT_NAME,
            name=f"auto-update/{skill_name}/{datetime.now().isoformat()}",
            tags=["automatic-update", skill_name],
        )

        run.log({
            "updater/findings_processed": findings_count,
            "updater/changes_made": len(changes_made),
            "updater/files_modified": len(files_modified),
        })

        # Log change details as table
        if changes_made:
            table = wandb.Table(columns=["change_type", "description"])
            for change in changes_made:
                table.add_data(change.get("type"), change.get("description"))
            run.log({"updater/changes": table})

        run.finish()

    @staticmethod
    def _coverage_to_score(coverage: str) -> float:
        """Convert coverage level to numeric score."""
        return {
            "not_started": 0.0,
            "weak": 0.25,
            "partial": 0.5,
            "strong": 1.0,
        }.get(coverage, 0.0)

    @staticmethod
    def _calc_duration(state: dict) -> float:
        """Calculate session duration in seconds."""
        if "startedAt" not in state:
            return 0.0
        start = datetime.fromisoformat(state["startedAt"])
        return (datetime.now() - start).total_seconds()
```

### Integration Points

Each skill logs to W&B at completion. Add to the **Output Phase** of each skill:

**In `problem/plan.md`:**
```
After writing specs/projects/{slug}/problem.md:
- Run: `uv run python -c "from program_nova.wandb_logger import NovaWandbLogger; NovaWandbLogger.log_skill_completion('problem', '{slug}', <state>)"`
```

**In `solution-architect/plan.md`:**
```
After writing specs/projects/{slug}/solution.md:
- Log dimensions: solution_clarity, user_value, scope_boundaries, success_criteria, technical_constraints, edge_cases
```

**In `solution-critic/plan.md`:**
```
After writing specs/projects/{slug}/critique.md:
- Log dimensions + discovered/resolved issues count
- Log confidence assessment scores
```

**In `nova/plan.md`:**
```
After full workflow completes:
- Log overall workflow metrics (phases completed, total time, artifacts generated)
```

**In automatic_updater skills:**
```
After making edits:
- Log findings processed, changes made, files modified
```

### W&B Dashboard Panels

Create dashboard with:

1. **Session Overview**
   - Completions per skill over time
   - Average session duration by skill
   - Slugs/projects tracked

2. **Dimension Coverage Heatmap**
   - Coverage scores across dimensions
   - Compare problem vs solution vs critic coverage

3. **Quality Metrics**
   - Edge cases discovered per session
   - Decision resolution rate
   - Confidence score distribution

4. **Self-Improvement Loop**
   - Automatic updates over time
   - Changes per update
   - Files modified frequency

---

## File Summary

### New Files (Nova Orchestrator)
| File | Purpose |
|------|---------|
| `.claude/commands/nova/plan.md` | Main orchestrator |
| `.claude/commands/nova/resume.md` | Resume sessions |
| `.claude/commands/nova/help.md` | Documentation |
| `.claude/commands/nova/cleanup.md` | Cleanup state |
| `.claude/commands/nova/automatic_updater.md` | Self-improvement |

### New Files (Solution Critic)
| File | Purpose |
|------|---------|
| `.claude/commands/solution-critic/plan.md` | Edge case analyzer |
| `.claude/commands/solution-critic/resume.md` | Resume sessions |
| `.claude/commands/solution-critic/help.md` | Documentation |
| `.claude/commands/solution-critic/cleanup.md` | Cleanup state |
| `.claude/commands/solution-critic/automatic_updater.md` | Self-improvement |

### New Files (W&B Integration)
| File | Purpose |
|------|---------|
| `program_nova/wandb_logger.py` | W&B logging utility for all skills |

### Files to Modify (New Project Structure)
| File | Change |
|------|--------|
| `.claude/commands/problem/plan.md` | Output to `specs/projects/{slug}/problem.md` |
| `.claude/commands/problem/resume.md` | Update artifact paths |
| `.claude/commands/solution-architect/plan.md` | Output to `specs/projects/{slug}/solution.md` |
| `.claude/commands/solution-architect/resume.md` | Update artifact paths |
| `.claude/commands/create-plan.md` | Output to `specs/projects/{slug}/full-spec.md` |
| `.claude/commands/full_loop.md` | Add nova/critic to analysis |

**Total: 11 new files, 6 modified files**

---

## Verification

1. **Test Project Structure Migration:**
   ```
   /problem:plan test-feature
   ```
   - Verify creates `specs/projects/test-feature/problem.md`
   - Verify state file references new path

2. **Test Nova Orchestrator:**
   ```
   /nova:plan test-feature
   ```
   - Verify state file created at `.claude/nova-test-feature.json`
   - Verify project directory created at `specs/projects/test-feature/`
   - Verify artifact detection works
   - Verify phase transitions

3. **Test Solution Critic:**
   ```
   /solution-critic:plan web-voice-planner
   ```
   - Verify it loads `specs/projects/web-voice-planner/solution.md`
   - Verify edge case analysis works
   - Verify output to `specs/projects/web-voice-planner/critique.md`

4. **Test Resume:**
   - Start `/nova:plan test`, interrupt
   - Run `/nova:resume`
   - Verify state restored

5. **Test Full Loop:**
   - Run a session through nova
   - Export JSONL
   - Run `/full_loop`
   - Verify nova findings are captured

6. **Test W&B Integration:**
   - Run `/problem:plan test-wandb`
   - Verify session metrics appear in W&B dashboard
   - Run `/solution-critic:plan` on existing solution
   - Verify dimension coverage and quality signals logged
   - Trigger automatic update
   - Verify updater metrics logged

---

## Implementation Order

1. **Migrate existing skills to new project structure:**
   - Update `problem/plan.md` → output to `specs/projects/{slug}/problem.md`
   - Update `solution-architect/plan.md` → output to `specs/projects/{slug}/solution.md`
   - Update `create-plan.md` → output to `specs/projects/{slug}/full-spec.md`

2. **Create W&B logger module:**
   - Create `program_nova/wandb_logger.py`
   - Add `wandb` to project dependencies
   - Test basic logging works

3. **Create Nova orchestrator:**
   - Create `nova/` directory
   - Create `plan.md` (main orchestrator)
   - Create support files (help, resume, cleanup)
   - Add W&B logging at workflow completion

4. **Create Solution Critic:**
   - Create `solution-critic/` directory
   - Create `plan.md` (edge case analyzer)
   - Create support files (help, resume, cleanup)
   - Add W&B logging at critique completion

5. **Add self-improvement:**
   - Create automatic_updater for both nova and solution-critic
   - Modify full_loop.md to include nova/critic analysis
   - Add W&B logging for automatic updates

6. **Add W&B logging to existing skills:**
   - Update `problem/plan.md` with logging
   - Update `solution-architect/plan.md` with logging

7. **Test end-to-end workflow:**
   - Verify W&B dashboard receives metrics
   - Verify all phases log correctly
