# Ralph Runner - Continuous Autonomous Operation

## Overview

Runs Ralph commands in a continuous loop, automatically selecting and executing work from the ticket directory. Monitors context usage and creates handoffs when approaching limits to enable seamless continuation.

## Usage

**Start Ralph:**

```bash
/ralph_runner
```

**Start Ralph with specific focus:**

```bash
/ralph_runner research    # Only run research tasks
/ralph_runner plan        # Only run planning tasks
/ralph_runner impl        # Only run implementation tasks
```

## Operation Flow

### Step 1: Initialize

1. Print banner: "Ralph Runner Starting - Autonomous Work Execution"
2. Check `thoughts/shared/tickets/` directory exists
3. Scan for available tickets
4. Print summary: "Found X tickets (Y ready for work)"

### Step 2: Work Loop

Repeat indefinitely:

1. **Scan for work:**
   - List all ticket files in `thoughts/shared/tickets/`
   - Parse each ticket's Status, Size, Priority
   - Filter to XS/S/M tickets in actionable states
   - Sort by priority (P0 > P1 > P2 > P3)

2. **Select next task:**
   - If no tickets found: Go to Step 3 (Idle/Exit)
   - If tickets found: Select highest priority ticket
   - Print: "Selected HYBRD-XXX: [title] (Size: [size], Priority: [priority], Status: [status])"

3. **Execute appropriate command:**
   Based on ticket status:
   - "needs research" → Run `/ralph_research` with ticket path
   - "ready for spec" → Run `/ralph_plan` with ticket path
   - "ready for dev" → Run `/ralph_impl` with ticket path

4. **Check context usage:**
   - After command completes, check conversation token count
   - If tokens > 150,000 (75% of 200K limit): Go to Step 4 (Context Management)
   - Otherwise: Continue to next iteration

5. **Brief pause:**
   - Print: "Work completed. Scanning for next task..."
   - Continue loop

### Step 3: Idle/Exit Handling

When no work is available:

1. Print summary:

   ```
   No actionable tickets found.

   Ticket Status:
   - X tickets in "needs breakdown" (XL tickets requiring manual decomposition)
   - Y tickets in "in dev" (currently being worked on)
   - Z tickets in "implemented" (completed)
   - W tickets in other states

   Ralph is idle. Waiting for tickets to be added or status updates.
   ```

2. Exit gracefully with code 0

**Ralph does NOT run indefinitely when idle.** The human should:

- Add new tickets to `thoughts/shared/tickets/`
- Update existing ticket statuses to make them actionable
- Run `/ralph_runner` again to resume work

### Step 4: Context Management & Handoff

When context usage exceeds 75% (150K tokens):

1. **Pause current work:**
   - Print: "Context limit approaching (150K+ tokens used). Creating handoff for continuity..."

2. **Create comprehensive handoff:**
   - Determine current ticket being worked on (e.g., HYBRD-123)
   - Run `/create_handoff` with current ticket context
   - Document:
     - Current ticket and its status
     - Work completed so far
     - Next steps/action items
     - All relevant file references
     - Key learnings from this session
   - Save handoff with ticket context in filename: `thoughts/shared/handoffs/ralph-session/YYYY-MM-DD_HH-MM-SS_HYBRD-XXX_ralph-session.md`
   - If no specific ticket (scanning/between tickets): use `YYYY-MM-DD_HH-MM-SS_general_ralph-session.md`

3. **Print continuation instructions:**

   ```
   Context limit reached. Handoff created at:
   thoughts/shared/handoffs/ralph-session/YYYY-MM-DD_HH-MM-SS_HYBRD-XXX_ralph-session.md

   To continue Ralph's work on HYBRD-XXX:
   1. Start a fresh conversation
   2. Run: /resume_handoff thoughts/shared/handoffs/ralph-session/YYYY-MM-DD_HH-MM-SS_HYBRD-XXX_ralph-session.md
   3. Run: /ralph_runner

   Ralph will pick up exactly where it left off.
   ```

4. **Exit gracefully** with code 0

### Step 5: Error Handling

If any command fails:

1. **Log the error:**
   - Update ticket's Progress section with error details
   - Add timestamp and error message

2. **Create error handoff:**
   - Document what was attempted
   - Include error message and stack trace
   - Note potential issues or blockers

3. **Mark ticket status:**
   - If implementation failed: status = "blocked - see notes"
   - Add note explaining the blocker

4. **Continue to next ticket:**
   - Don't exit Ralph entirely
   - Move on to next highest priority ticket
   - Print: "Error encountered with HYBRD-XXX. Moving to next ticket."

## Key Principles

- **One Ticket at a Time**: Ralph focuses on completing one ticket before moving to the next
- **Priority-Driven**: Always works on the highest priority actionable ticket
- **Context-Aware**: Monitors token usage and creates handoffs proactively
- **Resilient**: Continues working even if individual tickets fail
- **Transparent**: Prints clear status messages so humans understand what Ralph is doing
- **Clean Exits**: Never leaves work in an inconsistent state

## Resuming Ralph After Handoff

When Ralph creates a handoff due to context limits:

1. **Start fresh conversation** (clears context)
2. **Resume from handoff:**

   ```bash
   /resume_handoff thoughts/shared/handoffs/ralph-session/YYYY-MM-DD_HH-MM-SS_HYBRD-XXX_ralph-session.md
   ```

3. **Restart Ralph:**

   ```bash
   /ralph_runner
   ```

Ralph will:

- Read the handoff to understand where it left off
- Check if the previous ticket is complete
- If incomplete: finish it
- If complete: scan for next ticket
- Continue the work loop

## Monitoring Ralph

Humans can monitor Ralph's progress by:

1. **Watching ticket statuses:**

   ```bash
   ls -l thoughts/shared/tickets/*.md
   grep \"^**Status:**\" thoughts/shared/tickets/*.md
   ```

2. **Reading ticket Progress sections:**
   - Open any ticket to see work log, commits, current phase

3. **Checking handoffs:**

   ```bash
   ls -lt thoughts/shared/handoffs/ralph-session/
   # Shows files like: 2026-01-08_14-30-00_HYBRD-150_ralph-session.md
   ```

4. **Reviewing created artifacts:**
   - Plans in `thoughts/shared/plans/`
   - Research in `thoughts/shared/research/`

## Stopping Ralph

To stop Ralph gracefully:

1. **In Claude Code:** Simply stop the conversation or interrupt the current command
2. **Ralph will:**
   - Complete the current command if possible
   - Create a handoff if context is high
   - Exit cleanly

**Note:** Ralph does not run as a background daemon. It runs in the current Claude Code conversation and exits when:

- No more work is available
- Context limit is reached (after creating handoff)
- User interrupts the conversation
