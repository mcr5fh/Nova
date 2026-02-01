# Resume Handoff - Continue Work from Handoff Documents

## Purpose

Enables continuation of work from handoff documents with critical context, learnings, and next steps.

## Initial Response Patterns

**With Handoff Path Parameter:**

- Skip default message and immediately read the handoff document completely
- Read any linked research or plan documents from `thoughts/shared/plans` or `thoughts/shared/research`
- Begin analysis and propose course of action

**With Ticket Number (e.g., HYBRD-XXXX):**

- Locate most recent handoff in `thoughts/shared/handoffs/HYBRD-XXXX/`
- If zero files exist: inform user handoff cannot be found
- If multiple files exist: select most recent based on `YYYY-MM-DD_HH-MM-SS` timestamp
- Proceed with reading and analysis

**No Parameters:**
Display: "I'll help you resume work from a handoff document. Let me find available handoffs." with tips for invoking with paths or ticket numbers.

## Four-Step Process

**Step 1: Read and Analyze**

- Read entire handoff without limit/offset parameters
- Extract: tasks/statuses, recent changes, learnings, artifacts, action items, notes
- Spawn parallel research tasks for artifacts and context using codebase agents
- Wait for all sub-tasks to complete
- Read critical files from learnings and recent changes sections

**Step 2: Synthesize and Present**

- Present comprehensive analysis including:
  - Original task statuses with current verification
  - Validate key learnings against current codebase state
  - Verify recent changes still exist or have been modified
  - Review all artifacts and their implications
  - List recommended next actions with potential issues identified
- Request user confirmation before proceeding

**Step 3: Create Action Plan**

- Convert handoff action items into structured todos using TodoWrite
- Add newly discovered tasks
- Prioritize based on dependencies
- Present task list and seek approval

**Step 4: Begin Implementation**

- Start with first approved task
- Reference handoff learnings throughout
- Apply documented patterns and approaches
- Update progress as tasks complete
- Capture new learnings in the ticket’s `## Notes` (or a learnings subsection) so future handoffs carry forward patterns and pitfalls

## Key Guidelines

- **Be Thorough:** Read entire handoff first; verify all mentioned changes; check for regressions; read all artifacts
- **Be Interactive:** Present findings before starting; get buy-in; allow course corrections; adapt to current state
- **Leverage Wisdom:** Emphasize learnings section; apply patterns; avoid repeated mistakes; build on solutions
- **Track Continuity:** Maintain task continuity via TodoWrite; reference handoff in commits; document deviations
- **Validate Before Acting:** Never assume handoff state matches current state; verify file references; check for breaking changes

## Common Scenarios

1. **Clean Continuation:** All changes present, no conflicts—proceed with recommendations
2. **Diverged Codebase:** Some changes missing/modified—reconcile differences and adapt plan
3. **Incomplete Work:** Tasks marked in-progress—complete unfinished work first
4. **Stale Handoff:** Significant time passed—re-evaluate strategy

## Example Flow

User invokes with handoff path → Read and analyze → Spawn research tasks → Present findings → User confirms → Create todos → Begin implementation
