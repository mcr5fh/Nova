---
description: Run a retrospective to identify patterns and improve The Village
---

# Village Retrospective

You are conducting a retrospective to analyze recent work and identify patterns that can improve The Village. Your goal is to learn from experience and create actionable improvements.

## Process

### 1. Review Recent Work

```bash
# See recently closed work
bd list --status=closed --limit=20

# See open work
bd list --status=open

# Check for blocked work
bd blocked
```

Look for patterns:
- What types of tasks succeeded/failed?
- Which beads took longer than expected?
- Are there recurring blockers?
- Any tasks that keep getting reopened?

### 2. Review Worker Execution (if logs available)

```bash
# Check recent worker logs
ls -lt ~/.village/logs/worker-*.log 2>/dev/null | head -5

# If logs exist, sample a few for patterns
# Look for: timeouts, repeated tool use, context churn, successes
```

### 3. Identify Patterns

Group observations into categories:

**Successes ✓**
- What went well and why?
- Which task types have high success rates?
- What patterns should we replicate?

**Struggles ✗**
- What was difficult or failed?
- Where did workers get stuck?
- What took longer than expected?

**Surprises**
- Unexpected findings or behaviors
- New insights about the system

### 4. Create Village-Retrospective Beads for Systemic Issues

For each systemic issue found, create a bead with the village-retrospective watermark:

```bash
# Create the bead
bd create --title="[Clear issue title]" --type=bug|task --priority=0-4

# Add village-retrospective label (THE WATERMARK)
bd label add beads-xxx village-retrospective
```

**When to create a village-retrospective bead:**
- Issue affects multiple tasks or workers
- Pattern appears 3+ times
- Likely to recur without intervention
- Could prevent future failures

**Don't create beads for:**
- One-off issues
- Already tracked problems
- Vague observations without clear action

### 5. Update Learnings

Add concrete insights to `thoughts/worker-learnings.md`:

```markdown
### [Task Type]
- [Date] [Bead ID if relevant]: [Specific learning or pattern]
```

Focus on actionable advice for future work.

### 6. Create Retrospective Document

Copy the template and fill it out:

```bash
# Create from template
cp thoughts/retrospectives/template.md thoughts/retrospectives/$(date +%Y-%m-%d).md

# Edit the file with your findings
```

Include:
- Period covered
- Work completed (bead IDs + brief outcomes)
- Patterns observed (successes/struggles/surprises)
- Action items (village-retrospective beads created)
- Key learnings

### 7. Summary

Present findings to the user:

```
## Retrospective Complete

**Period:** [Date range or "Last N beads"]
**Document:** thoughts/retrospectives/YYYY-MM-DD.md

### Key Findings

**Successes:**
- [Pattern 1]
- [Pattern 2]

**Issues Identified:**
- [Pattern 1] → Created beads-xxx (village-retrospective)
- [Pattern 2] → Created beads-yyy (village-retrospective)

### Metrics (if available)
- Beads reviewed: N
- Village-retrospective beads created: N
- Success patterns: N
- Struggle patterns: N

### Updated
- thoughts/worker-learnings.md - Added [N] insights
- thoughts/retrospectives/YYYY-MM-DD.md - Full retrospective

### Village-Retrospective Beads Created
[List with bd show links]

Would you like me to:
1. Dive deeper into any specific pattern?
2. Create additional beads for issues found?
3. Update documentation based on learnings?
```

## Important Guidelines

### Do

- ✅ Focus on patterns (3+ occurrences), not one-offs
- ✅ Be specific with examples (bead IDs, file references)
- ✅ Create actionable village-retrospective beads
- ✅ Update worker-learnings.md with concrete advice
- ✅ Look for both positive patterns (replicate) and negative (fix)
- ✅ Use the village-retrospective label for all beads you create

### Don't

- ❌ Create beads for vague observations
- ❌ Forget to add village-retrospective label to created beads
- ❌ Focus only on negatives (capture successes too)
- ❌ Create beads for already-tracked issues
- ❌ Make recommendations without evidence

## Village Watermark

**Always add the `village-retrospective` label to beads created during retrospectives.**

This distinguishes systematic analysis (retrospective) from ad-hoc user requests. Over time, you can track:
- Which village-retrospective beads lead to improvements?
- What patterns keep recurring?
- Are retrospectives finding real issues?

```bash
# Check all retrospective-identified work
bd list --label=village-retrospective

# See which are still open
bd list --label=village-retrospective --status=open
```

## Examples of Good Patterns

### Success Pattern
"Tasks with 'test' in title have 90% success rate and complete in <30min. Pattern: Clear verification step + focused scope."

### Struggle Pattern
"Refactor tasks affecting >5 files have 40% timeout rate. Pattern: No chunking strategy, workers try to do everything at once."

### Actionable Improvement
"Create bead: 'Workers need chunking guidance for large refactors' → Update worker prompt template to suggest breaking into subtasks when file_count > 5"

## Remember

This is about **learning and improving**, not just listing problems. The goal is to make The Village better at spawning effective workers and completing work.

Regular retrospectives (weekly or after major milestones) compound improvements over time.
