# Review Five - Iterative Self-Review Command

You are tasked with performing Jeffrey Emanuel's "Rule of Five" iterative code review process. This technique produces dramatically better results by forcing 5 review passes over work, with each pass taking a different perspective.

## Philosophy

LLMs solve problems breadth-first - broad strokes first, then refinement. Like humans, they need multiple passes for proofreading, refining, and polishing. The first output is never the best output.

**Key Insight:** It typically takes 4-5 iterations before the work truly converges. Most developers stop after 1 review (if any), but the 3rd, 4th, and 5th passes find increasingly important architectural and design issues.

## Usage

```
/review_five [target]
```

**Targets:**

- No argument: Reviews staged changes or recent modifications in current session
- File path(s): Reviews specific files
- `--diff`: Reviews git diff (unstaged changes)
- `--staged`: Reviews staged changes
- `--pr`: Reviews changes in current PR branch vs main
- `--plan <path>`: Reviews an implementation plan
- `--design <description>`: Reviews a design/architecture

## The Five Passes

### Pass 1: Correctness & Bugs (The Obvious Stuff)

**Focus:** Find bugs that would cause runtime failures

- Logic errors and off-by-one mistakes
- Null/undefined handling
- Type mismatches
- Missing error handling
- Incorrect conditionals
- Resource leaks
- Race conditions

**Prompt yourself:** "What would break in production?"

### Pass 2: Code Quality & Standards (The Craftsmanship Pass)

**Focus:** Code that works but could be better

- Naming clarity (variables, functions, classes)
- Code duplication
- Function length and complexity
- Missing or excessive comments
- Inconsistent patterns with codebase
- Performance issues (N+1 queries, unnecessary loops)
- Security vulnerabilities (OWASP top 10)

**Code Smells Checklist:**

- **Duplicated logic** - Same pattern appearing 3+ times (extract to helper)
- **Magic numbers/strings** - Hardcoded values that should be named constants
- **Inconsistent abstractions** - Some things use constants, others hardcode same values
- **Long parameter lists** - Functions taking 5+ parameters (consider objects/builders)
- **Feature envy** - Code that uses another class's data more than its own
- **Shotgun surgery** - One change requires touching many unrelated files
- **Primitive obsession** - Using primitives instead of small domain objects
- **Dead code** - Unused variables, unreachable branches, commented-out code
- **Speculative generality** - Abstractions built for hypothetical future needs
- **Inappropriate intimacy** - Classes that know too much about each other's internals
- **Message chains** - Long chains like `a.b().c().d()` (Law of Demeter violations)
- **Data clumps** - Same group of parameters passed together repeatedly
- **Divergent change** - One class modified for multiple unrelated reasons (SRP violation)
- **Parallel inheritance** - Creating subclass in one hierarchy requires subclass in another
- **Lazy class** - Class that doesn't do enough to justify its existence
- **Refused bequest** - Subclass doesn't use inherited methods (wrong inheritance)

**Prompt yourself:** "Would I be embarrassed if a senior engineer reviewed this?"

### Pass 3: Edge Cases & Robustness (The Adversarial Pass)

**Focus:** What happens when things go wrong?

- Empty inputs, null values, boundary conditions
- Network failures, timeouts
- Malformed data, unexpected types
- Concurrent access, race conditions
- Large inputs, memory constraints
- Partial failures, rollback scenarios

**Prompt yourself:** "How would a malicious user or Murphy's Law break this?"

### Pass 4: Architecture & Design (The Zoom-Out Pass)

**Focus:** Does this fit into the larger system?

- Does this belong in this file/module/service?
- Are the abstractions at the right level?
- Will this scale? Will it be maintainable?
- Does this create unwanted coupling?
- Are we following existing patterns or creating new ones?
- Does this introduce technical debt?
- Is the API/interface intuitive?

**Prompt yourself:** "Will the team thank me or curse me for this design in 6 months?"

### Pass 5: Strategic & Existential (The "Are We Solving the Right Problem?" Pass)

**Focus:** Challenge fundamental assumptions

- Are we actually solving the user's problem?
- Is this the simplest solution possible?
- Are we over-engineering or under-engineering?
- What are we NOT doing that we should be?
- Are there better existing solutions we should use instead?
- Does this align with the project's direction?
- What would we do differently if starting from scratch?

**Prompt yourself:** "If I had to defend this approach to a skeptical architect, what would they challenge?"

## Beads Integration

As you discover issues during the review, **file beads immediately** to track them. This ensures issues are captured in the project's issue tracking system and won't be forgotten.

### Severity to Priority Mapping

| Review Severity | Beads Priority | Type |
|-----------------|----------------|------|
| 🔴 Critical | P0 (priority=0) | bug |
| 🟠 Important | P1 (priority=1) | bug or task |
| 🟡 Minor | P2 (priority=2) | task |
| 🔵 Suggestion | P3 (priority=3) | task or feature |

### Filing Beads

After completing each pass, create beads for any issues found:

```bash
# Critical bug found
bd create --title="[Review] Fix null pointer in auth handler" --type=bug --priority=0

# Important code quality issue
bd create --title="[Review] Refactor duplicate validation logic" --type=task --priority=1

# Minor improvement
bd create --title="[Review] Rename ambiguous variable 'data'" --type=task --priority=2

# Suggestion for future
bd create --title="[Review] Consider caching strategy for API calls" --type=task --priority=3
```

### Beads Conventions for Reviews

- **Prefix titles with `[Review]`** to identify issues from code reviews
- **Include file:line reference** in the description when applicable
- **Group related issues** - if multiple issues stem from the same root cause, create one bead
- **Link dependencies** - if one fix depends on another, use `bd dep add`
- **Skip trivial issues** - don't create beads for typos or formatting that can be fixed immediately

## Execution Process

### Step 1: Identify the Target

Determine what to review based on arguments:

```bash
# If --pr, get diff against main
git diff main...HEAD

# If --staged, get staged changes
git diff --cached

# If --diff, get unstaged changes
git diff

# If file paths, read those files
# If no args, look at recent session work or staged changes
```

### Step 2: Execute Each Pass

For each of the 5 passes:

1. **State the pass number and focus area clearly**
2. **Review the code through that specific lens**
3. **Document findings with:**
   - Severity: 🔴 Critical | 🟠 Important | 🟡 Minor | 🔵 Suggestion
   - Location: `file:line` or general area
   - Issue: Clear description
   - Recommendation: Specific fix or improvement
4. **File beads for actionable issues** (see Beads Integration section above)
   - Create beads immediately after documenting each finding
   - Use `bd create` with appropriate priority and type
   - Note the bead ID next to the finding for reference
5. **Explicitly note if no issues found** ("Pass N complete - no issues identified")

### Step 3: Track Convergence

After each pass, assess:

- **New issues found this pass:** Count
- **Severity of new issues:** Are we still finding critical issues?
- **Convergence indicator:** "Still finding significant issues" vs "Mostly polish items" vs "Converged - no new substantive issues"

### Step 4: Generate Final Report

After all passes, generate a comprehensive report using this template:

```markdown
# Rule of Five Review Report

## Target
[What was reviewed]

## Summary
- **Total Issues Found:** X
- **Critical:** X | **Important:** X | **Minor:** X | **Suggestions:** X
- **Convergence:** Achieved at Pass N / Not achieved

## Pass-by-Pass Results

### Pass 1: Correctness & Bugs
[Findings or "No issues identified"]

### Pass 2: Code Quality & Standards
[Findings or "No issues identified"]

### Pass 3: Edge Cases & Robustness
[Findings or "No issues identified"]

### Pass 4: Architecture & Design
[Findings or "No issues identified"]

### Pass 5: Strategic & Existential
[Findings or "No issues identified"]

## Prioritized Action Items

### Must Fix (Before Merge)
1. [Critical/Important issues]

### Should Fix (Soon)
1. [Important/Minor issues worth addressing]

### Consider (Future)
1. [Suggestions and improvements]

## Convergence Assessment

[Did the review converge? What pass stopped finding significant issues?
Is the code ready for production?]

## Beads Created

| Bead ID | Priority | Title | Pass |
|---------|----------|-------|------|
| beads-xxx | P0 | [Review] Issue title | 1 |
| beads-yyy | P1 | [Review] Another issue | 2 |

**Total beads filed:** X
**Run `bd list --status=open` to see all tracked issues**
```

### Step 5: Sync Beads

After the review is complete, run:

```bash
bd sync
```

This ensures all issues are committed and pushed to the remote for team visibility.

## Important Guidelines

### Do

- ✅ Be genuinely critical - find real issues, not just nitpicks
- ✅ Each pass should have a distinct perspective
- ✅ Later passes should find DIFFERENT types of issues
- ✅ Trust the process - the 4th and 5th passes often find the most important issues
- ✅ Declare convergence honestly when you stop finding substantive issues
- ✅ File beads immediately when you find actionable issues
- ✅ Include file:line references in bead descriptions

### Don't

- ❌ Rush through passes just to complete them
- ❌ Repeat the same issues across multiple passes
- ❌ Be artificially critical just to find something
- ❌ Skip passes because earlier ones found nothing
- ❌ Declare convergence prematurely to finish faster
- ❌ File beads for trivial issues that can be fixed immediately
- ❌ Forget to sync beads at the end (`bd sync`)

### Convergence Signals

**Not Converged:**

- Still finding 🔴 Critical or 🟠 Important issues
- Each pass reveals new categories of problems
- Fundamental design concerns emerging

**Converged:**

- Only 🟡 Minor or 🔵 Suggestion items
- Issues are polish, not substance
- You genuinely believe it's as good as it can get
- Typical: Passes 4-5 find mostly the same or no issues

## Adapting the Process

### For Smaller Changes (< 100 lines)

- May converge in 3 passes
- Combine passes 4 & 5 if changes are localized
- Still do at least 3 distinct passes

### For Larger Changes (> 500 lines)

- All 5 passes are essential
- Consider breaking into logical chunks
- May need additional focused passes on complex areas

### For Plans/Designs (not code)

Adapt the passes:

1. **Completeness:** Does the plan cover everything needed?
2. **Clarity:** Can someone execute this without ambiguity?
3. **Risks:** What could go wrong? What's missing?
4. **Alternatives:** Are there better approaches?
5. **Alignment:** Does this solve the actual problem?

## Example Invocations

```bash
# Review your current work
/review_five

# Review specific files
/review_five src/api/auth.ts src/api/users.ts

# Review staged changes before commit
/review_five --staged

# Review a PR before requesting review
/review_five --pr

# Review an implementation plan
/review_five --plan specs/05-new-feature.md
```

## Remember

> "It typically takes 4-5 iterations before the agent will say something like, 'I think this is about as good as we can make it.' At that point it has converged. And that, folks, is the first point at which you can begin to moderately trust the output the agent has produced."

The goal is not to perform a ritual, but to actually find and fix issues through genuinely different perspectives. Trust the process, even when it feels redundant - that's where the magic happens.
