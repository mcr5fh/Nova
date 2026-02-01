# Code Health Check - Find Hot Spots

You are tasked with conducting a comprehensive code health audit to identify "hot spots" - areas of technical debt, code smells, and poor code health that need attention. This is a critical maintenance activity for keeping a codebase healthy.

## Philosophy

> "If you are vibe coding, you need to spend at least 30-40% of your time, queries, and money on code health. That's how you make sure your code is OK."

Code health reviews should be done regularly (at least weekly) to prevent invisible technical debt from accumulating. This command helps you systematically find problems before they slow down development.

## Usage

```
/code_health [target] [options]
```

**Targets:**

- No argument: Analyzes the entire codebase
- Directory path: Analyzes specific directory (e.g., `backend/src/hercules/`)
- `--backend`: Focus on Python backend code
- `--frontend`: Focus on React Native frontend code
- `--recent`: Focus on files changed in the last 30 days

**Options:**

- `--quick`: Fast scan using static analysis tools only (no deep agent analysis)
- `--deep`: Thorough analysis with all sub-agents (default)
- `--no-beads`: Skip filing beads (just report findings)

## What We Look For

### Code Smells (The Usual Suspects)

- **Long methods/functions** (>50 lines)
- **Large files** (>500 lines) that need breaking up
- **High cyclomatic complexity** (deeply nested conditionals)
- **Duplicated code** - same pattern appearing 3+ times
- **Feature envy** - code using another class's data more than its own
- **God classes/modules** - doing too many things
- **Primitive obsession** - using primitives instead of domain objects
- **Long parameter lists** (>5 parameters)
- **Data clumps** - same group of parameters passed together repeatedly
- **Shotgun surgery** - one change requires touching many unrelated files

### Dead Code & Cruft

- Unused functions, classes, variables (vulture)
- Commented-out code blocks
- Unreachable code branches
- Old debug statements (console.log, print, debugger)
- Stale TODO/FIXME comments
- Build artifacts and temp files
- Outdated documentation

### Architecture & Organization

- Files in the wrong place
- Misleading names
- Inconsistent patterns across similar components
- Circular dependencies
- Tight coupling between unrelated modules
- Over-engineered subsystems (YAGNI violations)
- Redundant/duplicate systems (multiple loggers, multiple state stores, etc.)

### Testing & Quality

- Low or missing test coverage
- Untested edge cases
- Flaky tests
- Missing error handling
- Type errors and inconsistencies
- Security vulnerabilities (OWASP top 10)

### Technical Debt Indicators

- `# TODO:` and `# FIXME:` comments
- `# HACK:` and workarounds
- Suppressed linter warnings (`# noqa`, `// eslint-disable`)
- Type casts and `any` types
- Outdated dependencies

## Execution Process

### Step 1: Determine Scope

Based on the arguments provided:

- Parse the target directories/files
- Determine if this is a quick scan or deep analysis
- Set up the scope for sub-agents

```
I'll perform a [quick/deep] code health check on [target].

Scope:
- Backend: [yes/no] - [directories]
- Frontend: [yes/no] - [directories]
- Focus: [all/recent changes/specific area]
```

### Step 2: Run Static Analysis Tools (Quick Pass)

Run these tools to get quantitative metrics:

**For Python (backend/):**

```bash
# Find unused code
cd backend && poetry run vulture src/ --min-confidence 80

# Type checking issues
cd backend && poetry run mypy . --show-error-codes 2>&1 | head -100

# Linting issues
cd backend && poetry run ruff check . --statistics

# Security vulnerabilities
cd backend && poetry run bandit -c pyproject.toml -r src/ -f txt 2>&1 | tail -50
```

**For TypeScript (frontend/):**

```bash
# Linting issues
cd frontend && npm run lint 2>&1 | head -100

# Type checking (if available)
cd frontend && npx tsc --noEmit 2>&1 | head -100
```

**For Both:**

```bash
# Find large files (>500 lines)
find backend/src frontend/app frontend/components -name "*.py" -o -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | sort -rn | head -20

# Find TODO/FIXME comments
grep -rn "TODO\|FIXME\|HACK\|XXX" backend/src frontend/app frontend/components 2>/dev/null | head -30

# Find recent changes (for --recent flag)
git log --since="30 days ago" --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20
```

### Step 3: Deep Analysis with Sub-Agents (if not --quick)

Spawn parallel sub-agents for thorough investigation:

**Agent 1: Large File Analysis**

```
Use codebase-locator to find all files > 300 lines, then use codebase-analyzer
to identify which ones have multiple responsibilities that could be split.
Focus on: [target directories]
Return: File paths, line counts, suggested split points
```

**Agent 2: Duplication Detection**

```
Use codebase-pattern-finder to identify duplicated patterns:
- Similar function implementations across files
- Copy-pasted code blocks
- Redundant utility functions
- Multiple implementations of the same concept
Focus on: [target directories]
Return: Duplicate locations, suggested consolidation
```

**Agent 3: Architecture Smells**

```
Use codebase-analyzer to identify:
- Circular dependencies between modules
- God classes/modules with too many responsibilities
- Inconsistent patterns (e.g., some services use repos, others don't)
- Over-engineered abstractions
Focus on: [target directories]
Return: Problematic patterns with file:line references
```

**Agent 4: Test Coverage Gaps**

```
Use codebase-locator to find:
- Source files without corresponding test files
- Complex functions without test coverage
- Edge cases mentioned in code but not tested
Focus on: [target directories]
Return: Untested files and functions
```

**Agent 5: Naming & Organization Review**

```
Use codebase-locator to identify:
- Files that might be in the wrong directory
- Misleading or unclear names
- Inconsistent naming conventions
- Dead/orphaned files
Focus on: [target directories]
Return: Suggested moves and renames
```

### Step 4: Synthesize Findings

After all tools and agents complete, compile findings into categories:

1. **Critical (🔴)** - Security issues, major bugs, blocking problems
2. **High Priority (🟠)** - Large files needing refactoring, significant duplication
3. **Medium Priority (🟡)** - Code smells, minor duplication, naming issues
4. **Low Priority (🔵)** - Suggestions, nice-to-haves, cleanup tasks

### Step 5: File Beads (unless --no-beads)

For each actionable finding, create a bead:

```bash
# Critical security issue
bd create --title="[Health] Fix SQL injection in user_queries.py" --type=bug --priority=0

# Large file needing refactoring
bd create --title="[Health] Split workout_service.py (800+ lines)" --type=task --priority=1

# Code smell
bd create --title="[Health] Remove duplicated validation in api/" --type=task --priority=2

# Cleanup task
bd create --title="[Health] Remove unused imports in models/" --type=task --priority=3
```

**Beads Conventions:**

- Prefix titles with `[Health]` to identify code health issues
- Include file:line references in descriptions
- Group related issues into single beads when appropriate
- Set dependencies if issues must be fixed in order
- Skip trivial issues that can be fixed in <5 minutes

### Step 6: Generate Health Report

Save report to `thoughts/shared/health/YYYY-MM-DD-code-health-report.md`:

```markdown
---
date: [ISO timestamp]
scope: [target directories]
scan_type: [quick/deep]
total_issues: [count]
beads_created: [count]
---

# Code Health Report - [Date]

## Executive Summary

**Overall Health Score:** [Good/Fair/Needs Attention/Critical]

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Code Smells | X | X | X | X |
| Dead Code | X | X | X | X |
| Architecture | X | X | X | X |
| Testing | X | X | X | X |
| Security | X | X | X | X |

**Top 5 Hot Spots:**
1. `path/to/file.py` - [reason] (X issues)
2. `path/to/file.ts` - [reason] (X issues)
3. ...

## Static Analysis Results

### Vulture (Unused Code)
[Summary and key findings]

### Type Checking
[Summary and key findings]

### Linting
[Summary and key findings]

### Security (Bandit)
[Summary and key findings]

## Deep Analysis Findings

### Large Files Needing Refactoring
| File | Lines | Responsibilities | Suggested Action |
|------|-------|------------------|------------------|
| ... | ... | ... | ... |

### Duplicated Code
| Pattern | Locations | Suggested Consolidation |
|---------|-----------|------------------------|
| ... | ... | ... |

### Architecture Issues
[Detailed findings with file:line references]

### Test Coverage Gaps
| File/Function | Complexity | Test Status | Risk |
|---------------|------------|-------------|------|
| ... | ... | ... | ... |

### Naming & Organization
| Current | Suggested | Reason |
|---------|-----------|--------|
| ... | ... | ... |

## Beads Created

| Bead ID | Priority | Title |
|---------|----------|-------|
| hyb-xxx | P0 | [Health] ... |
| hyb-yyy | P1 | [Health] ... |

## Recommended Actions

### Immediate (This Week)
1. [Critical/security issues]

### Short Term (This Month)
1. [High priority refactoring]

### Ongoing Maintenance
1. [Regular cleanup tasks]

## Comparison to Previous Health Check

[If previous report exists, compare trends]
- New issues found: X
- Issues resolved since last check: X
- Recurring issues: [list]
```

### Step 7: Present Summary to User

```
## Code Health Check Complete

**Scope:** [target]
**Scan Type:** [quick/deep]
**Report:** thoughts/shared/health/YYYY-MM-DD-code-health-report.md

### Summary
- **Total Issues Found:** X
- **Critical:** X | **High:** X | **Medium:** X | **Low:** X
- **Beads Created:** X

### Top Hot Spots Requiring Attention
1. 🔴 `file.py:123` - [brief description]
2. 🟠 `file.ts:456` - [brief description]
3. ...

### Quick Wins (Fix in <30 min)
1. [Easy cleanup task]
2. [Simple refactoring]

Would you like me to:
1. Create a refactoring plan for any of these hot spots? (use /safe_refactor)
2. Dive deeper into a specific area?
3. Run the health check on a different scope?
```

## Important Guidelines

### Do

- ✅ Run health checks regularly (weekly recommended)
- ✅ Focus on actionable findings, not theoretical concerns
- ✅ Prioritize issues that slow down development
- ✅ File beads so issues don't get lost
- ✅ Track trends over time
- ✅ Be creative - ask "what else could be wrong?"

### Don't

- ❌ Get overwhelmed - prioritize ruthlessly
- ❌ File beads for trivial issues
- ❌ Ignore the same issues repeatedly
- ❌ Skip the deep analysis for important code areas
- ❌ Forget to sync beads after the check

### Interpretation Guide

**Good Health Indicators:**

- Few critical/high issues
- Consistent patterns across codebase
- Good test coverage
- Decreasing issue count over time

**Warning Signs:**

- Multiple large files (>500 lines)
- Redundant systems (multiple loggers, state stores)
- Growing number of TODO/FIXME comments
- Increasing type errors
- Files that change together but aren't related

## Follow-Up Commands

After running a health check:

- `/safe_refactor [file]` - Create safe refactoring plan for a hot spot
- `/review_five [file]` - Deep review of specific problematic code
- `bd ready` - See which health issues are ready to work on
- `bd list --status=open` - See all tracked health issues

## Remember

> "As long as I continue to find serious problems with reviews, I need to do more reviews."

The goal is to find problems early, before they become blocking issues. Regular health checks keep the codebase maintainable and agents working efficiently.
