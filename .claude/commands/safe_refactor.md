# Safe Refactor - Propose Incremental Refactorings

You are tasked with creating safe, incremental refactoring plans for code hot spots. Your plans must prioritize preserving behavior while improving code structure, with clear rollback strategies at each step.

## Philosophy

> "Agents tend to accrete code without automatic refactoring, your vibe-coded source files will tend to grow to thousands of lines. So you should tell it regularly to break things up, and then run dedicated sessions to implement the refactoring!"

Refactoring is essential maintenance, but it must be done safely. Each refactoring step should:

1. Be small enough to understand completely
2. Have clear before/after verification
3. Be independently testable
4. Be reversible if something goes wrong

## Usage

```
/safe_refactor [target] [options]
```

**Targets:**

- File path: Specific file to refactor (e.g., `backend/src/hercules/services/workout.py`)
- Directory: Refactor a module or component (e.g., `backend/src/hercules/api/`)
- `--health-report`: Use the most recent health check report to select hot spots
- `--bead <id>`: Refactor the issue described in a specific bead

**Options:**

- `--scope=<mini|standard|major>`: Size of refactoring to propose
  - `mini`: Single-file, <30 min changes
  - `standard`: Multi-file, 1-2 hour changes (default)
  - `major`: System-level, multi-session refactoring
- `--focus=<smell>`: Focus on specific code smell
  - `extract-class`, `extract-method`, `split-file`, `consolidate`, `rename`, `simplify`
- `--no-plan`: Skip writing plan file, just present recommendations

## Refactoring Catalog

### Safe Refactorings (Low Risk)

These can be done with high confidence:

| Pattern | Description | Risk | Time |
|---------|-------------|------|------|
| **Rename** | Rename variable, function, class for clarity | Very Low | 5-15 min |
| **Extract Variable** | Name a complex expression | Very Low | 5 min |
| **Extract Method** | Move code block to named function | Low | 15-30 min |
| **Inline Method** | Replace single-use method with its body | Low | 10 min |
| **Move Method** | Relocate method to more appropriate class | Low | 15-30 min |
| **Extract Class** | Split class with multiple responsibilities | Medium | 30-60 min |
| **Split File** | Break large file into focused modules | Medium | 30-90 min |
| **Consolidate Duplicates** | Merge duplicate code into single location | Medium | 30-60 min |
| **Introduce Parameter Object** | Group related parameters | Low | 20-40 min |
| **Remove Dead Code** | Delete unused functions/classes | Low | 10-30 min |

### Riskier Refactorings (Require Extra Care)

These need more verification:

| Pattern | Description | Risk | Time |
|---------|-------------|------|------|
| **Change Signature** | Modify function parameters | Medium-High | 30-60 min |
| **Replace Inheritance** | Convert inheritance to composition | High | 1-3 hours |
| **Restructure Data** | Change data model/schema | High | 2-4 hours |
| **Extract Service** | Pull logic into separate service | High | 2-4 hours |
| **Consolidate Services** | Merge redundant services | Very High | 4+ hours |

## Execution Process

### Step 1: Understand the Target

1. **If file path provided:**
   - Read the entire file
   - Identify its role in the system
   - Find all imports and usages

2. **If health report or bead:**
   - Read the health report/bead
   - Identify the specific issues to address
   - Prioritize by impact and safety

3. **Gather context using sub-agents:**

```
Spawn in parallel:

Agent 1 (codebase-analyzer): Analyze [target file] to understand:
- What responsibilities does this code have?
- What are the main public interfaces?
- What are the dependencies?
- What would break if we changed this?

Agent 2 (codebase-locator): Find all usages of [target]:
- Where is this imported?
- Where are its functions/classes used?
- What tests exist for it?

Agent 3 (codebase-pattern-finder): Find similar refactorings in the codebase:
- Have we split similar files before?
- What patterns do we follow for this type of code?
- Are there examples of the target structure?
```

### Step 2: Diagnose the Problem

Present a clear diagnosis:

```
## Refactoring Analysis: [target]

### Current State
- **File Size:** X lines
- **Responsibilities:** [list of things this code does]
- **Dependencies:** [what it imports]
- **Dependents:** [what imports it]
- **Test Coverage:** [coverage status]

### Issues Identified
1. **[Code Smell Name]** - [description]
   - Location: `file:line`
   - Impact: [why this matters]

2. **[Code Smell Name]** - [description]
   - Location: `file:line`
   - Impact: [why this matters]

### Proposed Refactoring
**Type:** [Extract Class / Split File / etc.]
**Scope:** [mini/standard/major]
**Risk Level:** [Low/Medium/High]
**Estimated Effort:** [time range]

Does this diagnosis match your understanding? Any priorities I should know about?
```

### Step 3: Design the Refactoring Plan

Use the **refactor-planner** agent for comprehensive analysis:

```
Use refactor-planner agent to create a detailed refactoring plan for [target]:

Context:
- Issues identified: [list from diagnosis]
- Scope: [mini/standard/major]
- Constraints: [any user-specified constraints]

Requirements:
- Break into small, independently testable steps
- Each step must maintain all existing behavior
- Include rollback strategy for each step
- Identify all files that need updating
- Specify verification criteria for each step
```

### Step 4: Present the Safe Refactoring Plan

Structure the plan with safety as the primary concern:

```markdown
## Safe Refactoring Plan: [Target]

### Overview
- **Goal:** [what we're trying to achieve]
- **Approach:** [high-level strategy]
- **Total Steps:** X
- **Estimated Time:** X hours
- **Risk Level:** [Low/Medium/High]

### Pre-Refactoring Checklist
- [ ] All tests pass: `[test command]`
- [ ] No uncommitted changes: `git status`
- [ ] Create backup branch: `git checkout -b backup/[refactor-name]`
- [ ] Understand all usages of affected code

### Step 1: [Name] (5-15 min)

**What:** [Clear description of the change]

**Why Safe:** [Explain why this step is low risk]

**Files Changed:**
- `path/to/file.py` - [what changes]

**Before:**
```python
# Current code
```

**After:**

```python
# Refactored code
```

**Verification:**

```bash
# Run tests
poetry run pytest path/to/tests -v

# Type check
poetry run mypy path/to/file.py

# Verify behavior (manual if needed)
[manual verification steps]
```

**Rollback:**

```bash
git checkout path/to/file.py
```

**Commit Point:** Yes - commit after this step

```bash
git add path/to/file.py
git commit -m "refactor: [description of step 1]"
```

---

### Step 2: [Name] (10-20 min)

[Same structure...]

---

### Step N: Final Cleanup

**What:** Remove any transitional code, update imports

**Files Changed:**

- [list all files touched]

**Final Verification:**

```bash
# Full test suite
poetry run pytest -n auto

# Type checking
poetry run mypy .

# Linting
poetry run ruff check .

# Manual smoke test
[key user flows to verify]
```

### Post-Refactoring Checklist

- [ ] All tests pass
- [ ] No type errors
- [ ] No linting errors
- [ ] Code review completed
- [ ] Update any affected documentation
- [ ] Close related beads: `bd close [bead-ids]`

### Rollback Plan (Full)

If something goes wrong after multiple steps:

```bash
# Option 1: Revert to backup branch
git checkout backup/[refactor-name]

# Option 2: Revert specific commits
git revert [commit-hash]

# Option 3: Interactive rebase to remove commits
git rebase -i [commit-before-refactoring]
```

### What We're NOT Changing

[Explicitly list things that are out of scope to prevent scope creep]

```

### Step 5: Save the Plan

Save to `thoughts/shared/refactoring/YYYY-MM-DD-[target-name]-refactor-plan.md`

```

I've created a safe refactoring plan at:
`thoughts/shared/refactoring/YYYY-MM-DD-[target-name]-refactor-plan.md`

### Summary

- **Steps:** X incremental changes
- **Estimated Time:** X hours
- **Risk Level:** [Low/Medium/High]
- **Commit Points:** X (can stop safely after each)

### The Plan

1. [Step 1 summary] (X min)
2. [Step 2 summary] (X min)
...

Would you like me to:

1. Start implementing the refactoring?
2. Adjust the scope or approach?
3. Add more verification steps?
4. Create a bead to track this refactoring?

```

## Safety Principles

### The Mikado Method

For complex refactorings, use the Mikado Method:
1. Try the change you want to make
2. If it breaks, note what broke
3. Revert
4. Fix the prerequisite first
5. Repeat until the original change works

### Characterization Tests

Before refactoring code without tests:
1. Write tests that capture current behavior
2. These tests prove the refactoring preserves behavior
3. Keep them even if behavior seems wrong (fix later)

### Parallel Implementation

For risky changes:
1. Create new implementation alongside old
2. Use feature flag to switch between them
3. Verify new implementation in production
4. Remove old implementation

### Strangler Fig Pattern

For large-scale rewrites:
1. Create new module/service
2. Redirect traffic incrementally
3. Eventually all traffic goes to new code
4. Remove old code

## Important Guidelines

### Do
- ✅ Always start with passing tests
- ✅ Make one logical change per step
- ✅ Commit after each successful step
- ✅ Verify after every change
- ✅ Keep rollback instructions current
- ✅ Document what you're NOT changing

### Don't
- ❌ Combine multiple refactorings in one step
- ❌ Skip verification steps
- ❌ Refactor and add features simultaneously
- ❌ Proceed if tests are failing
- ❌ Forget to update dependents
- ❌ Delete code before confirming it's unused

### Warning Signs (Stop and Reassess)

- Tests are failing and you don't know why
- More files affected than expected
- The "simple" refactoring is taking hours
- You're tempted to "fix" unrelated code
- You're not sure what the code does

## Scope Guidelines

### Mini Scope (~30 min)
- Single file changes
- Rename, extract method, remove dead code
- No signature changes
- 1-3 steps

### Standard Scope (1-2 hours)
- Multi-file changes
- Extract class, split file, consolidate
- May change signatures (update all callers)
- 3-8 steps

### Major Scope (Multi-session)
- System-level restructuring
- New modules/services
- Database schema changes
- Requires dedicated planning session
- 10+ steps, multiple PRs

## Examples

### Example 1: Split Large File

```

/safe_refactor backend/src/hercules/services/workout_service.py --scope=standard

```

Plan might include:
1. Identify logical groupings (CRUD, validation, AI processing)
2. Extract helper functions to `workout_helpers.py`
3. Extract validation to `workout_validators.py`
4. Update imports in dependent files
5. Clean up and verify

### Example 2: Consolidate Duplicates

```

/safe_refactor backend/src/hercules/api/ --focus=consolidate

```

Plan might include:
1. Identify duplicate validation patterns
2. Create shared validation module
3. Update one endpoint to use shared module
4. Verify, then update remaining endpoints
5. Remove duplicate code

### Example 3: From Health Report

```

/safe_refactor --health-report

```

Will read the latest health report and prioritize hot spots.

## Related Commands

- `/code_health` - Find hot spots to refactor
- `/review_five` - Deep review before/after refactoring
- `/create_plan` - For major refactorings needing full planning
- `bd ready` - See refactoring beads ready to work on

## Remember

> "The goal of refactoring is to make the code easier to understand and cheaper to modify without changing its observable behavior."

Safe refactoring is about making many small improvements, not heroic rewrites. Each step should be small enough that if something goes wrong, you know exactly what caused it.
