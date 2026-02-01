---
description: "Clean up all solution architect interview state files"
allowed-tools: ["Read", "Write", "Glob", "AskUserQuestion"]
---

# Cleanup Solution Architect State

This command removes solution specification interview state files from `.claude/`.

## Find State Files

Use Glob to find all `.claude/solution-architect-*.json` files.

If no state files exist, inform the user:
"No solution interview state files found. Nothing to clean up."

## Confirm Cleanup

If state files exist, list them and use AskUserQuestion to confirm:

"Found the following solution interview state files:
{list of files with their slugs}

These represent interrupted interviews that haven't been completed. Deleting them will lose any progress made."

Options:
- "Delete all state files"
- "Keep them"

## Perform Cleanup

If the user confirms deletion:
1. Delete each state file by writing empty content to it
2. Report: "Cleaned up {N} solution interview state file(s)."

If the user chooses to keep them:
"State files preserved. Use `/solution-architect:resume` to continue an interview."
