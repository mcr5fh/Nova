# Ralph Implementation - Autonomous Ticket Implementation

## Overview

Autonomously implements the highest-priority small ticket from local ticket files, working in the current branch without worktrees.

## Part I: Ticket Selection

**If a ticket is mentioned:**

- Look for the ticket file in `thoughts/shared/tickets/HYBRD-xxxx.md`
- Read the ticket and all sections to understand implementation requirements

**If no ticket is mentioned:**

1. Look for tickets in `thoughts/shared/tickets/` directory
2. Read each ticket file to find highest priority item by checking the `Status`, `Size`, and `Priority` fields
3. Select the highest priority XS, S, or M issue with status "ready for dev" (exit if none exist)
4. Read the ticket file completely

## Part II: Implementation Workflow

**Initial setup:**

1. Update the ticket file's `Status` field to "in dev"
2. Identify the linked implementation plan from the ticket's `Linked Documents` section
3. If no plan exists, update ticket status to "needs spec" and exit

**Implementation:**

1. Read the implementation plan completely
2. Use `/implement_plan` command with the plan file path
3. Track progress using TodoWrite AND update the ticket's `## Progress` section
4. Upon completion: commit changes, update ticket status to "implemented"

**Key guidance:** Focus on ONE item only—the highest priority XS, S, or M sized issue. Use TodoWrite to track tasks. Work autonomously without manual approval gates. All tracking is within the ticket file itself.

## Part III: Completion

Update the ticket file with:

- Status changed to "implemented"
- Completion timestamp in `Updated` field
- Commit hash in `## Progress` section
- Any notes about implementation in `## Notes` section
