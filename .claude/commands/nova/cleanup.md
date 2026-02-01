---
description: "Clean up all nova state files"
allowed-tools: ["Read", "Write", "Glob", "AskUserQuestion"]
---

# Cleanup Nova State

This command removes Nova orchestration state files from `.claude/`.

## Find State Files

Use Glob to find all `.claude/nova-*.json` files.

If no state files exist, inform the user:
"No Nova state files found. Nothing to clean up."

## Confirm Cleanup

If state files exist, list them and use AskUserQuestion to confirm:

"Found the following Nova session state files:
{list of files with their slugs and current phases}

These represent interrupted sessions that haven't been completed. Deleting them will lose any progress tracking (but NOT the artifacts in specs/projects/).

Note: This only removes the orchestration state files. Any artifacts created (problem.md, solution.md, critique.md, full-spec.md) in `specs/projects/` are preserved."

Options:
- "Delete all state files"
- "Keep them"

## Perform Cleanup

If the user confirms deletion:
1. Delete each state file by writing empty content to it
2. Report: "Cleaned up {N} Nova session state file(s). Artifacts in specs/projects/ are preserved."

If the user chooses to keep them:
"State files preserved. Use `/nova:resume` to continue a session."
