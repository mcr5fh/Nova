---
description: "Resume an interrupted problem interview"
allowed-tools: ["AskUserQuestion", "Read", "Write", "Glob"]
---

# Resume Problem Interview

Check for existing problem interview state files.

## Find Existing Sessions

Use Glob to find all `.claude/problem-*.json` files.

If no state files exist, inform the user:
"No interrupted problem interviews found. Use `/problem:plan <name>` to start a new one."

If one state file exists, automatically resume it.

If multiple state files exist, use AskUserQuestion to let the user choose which one to resume.

## Resume Session

1. Read the state file to restore context
2. Display current progress:

```
Resuming problem interview: {slug}

Current Progress:
- Problem Clarity: {coverage} {checkmark if meets threshold}
- Customer & Context: {coverage} {checkmark if meets threshold}
- Severity & Frequency: {coverage} {checkmark if meets threshold}
- Root Cause: {coverage} {checkmark if meets threshold}
- Business Impact: {coverage} {checkmark if meets threshold}
- Validation: {coverage} {checkmark if meets threshold}

Key evidence gathered so far:
{summary of evidence from each dimension}
```

3. Identify which dimension to focus on next (first one not meeting threshold in priority order)
4. Continue the interview using the same rules as `/problem:plan`

## Dimension Thresholds (for reference)
- problem_clarity: strong
- customer_context: strong
- business_impact: strong
- severity_frequency: partial
- root_cause: partial
- validation: partial

## Interview Rules (same as plan)

1. **Use AskUserQuestion for EVERY question**
2. Ask **ONE focused question at a time**
3. When the user gives a good answer, **explicitly acknowledge what was good**
4. If the user jumps to solutions, redirect to the underlying problem
5. Keep responses concise (2-4 sentences typical)
6. **Update the state file** after each exchange

Continue until all thresholds are met, then offer to generate the final problem statement.
