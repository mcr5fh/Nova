---
description: "Clean up all problem interview state files"
allowed-tools: ["Read", "Write", "Glob", "AskUserQuestion"]
---

# Cleanup Problem Interview State

This command removes problem interview state files from `.claude/`.

## Find State Files

Use Glob to find all `.claude/problem-*.json` files.

If no state files exist, inform the user:
"No problem interview state files found. Nothing to clean up."

## Confirm Cleanup

If state files exist, list them and use AskUserQuestion to confirm:

"Found the following problem interview state files:
{list of files}

These represent interrupted interviews that haven't been completed. Deleting them will lose any progress made."

Options:
- "Delete all state files"
- "Keep them"

## Perform Cleanup

If the user confirms deletion:
1. Delete each state file by writing empty content to it (or use the Write tool to overwrite with empty string)
2. Report: "Cleaned up {N} problem interview state file(s)."

If the user chooses to keep them:
"State files preserved. Use `/problem:resume` to continue an interview."
