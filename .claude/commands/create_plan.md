# Implementation Plan

You are tasked with creating detailed implementation plans through an interactive, iterative process. You should be skeptical, thorough, and work collaboratively with the user to produce high-quality technical specifications.

## Initial Response

When this command is invoked:

1. **Check if a feature name or path was provided as a parameter**:
   - If a feature name provided (e.g., `/create_plan workout-streaming`), use that feature name
   - If a specs path provided (e.g., `/create_plan thoughts/shared/specs/workout-streaming/research-api.md`), infer feature name from path (`workout-streaming`)
   - If a ticket/other file path provided (e.g., `/create_plan thoughts/allison/tickets/eng_1234.md`), read the file FULLY and prompt for feature name

1. **If no feature name provided or inferable**, respond with:

```text
I'll help you create a detailed implementation plan.

**What feature is this plan for?**
- Provide a kebab-case name (e.g., `workout-streaming`, `terra-sync-refactor`)
- If this relates to an existing feature spec, I'll incorporate existing research

Tip: You can also invoke this command with a ticket file directly: `/create_plan thoughts/allison/tickets/eng_1234.md`
For deeper analysis, try: `/create_plan think deeply about thoughts/allison/tickets/eng_1234.md`
```text

Then wait for the user's input.

1. **Check for existing specs**:
   - Run `ls thoughts/shared/specs/` to find existing features
   - If matches exist, present them: "I found these existing specs: [list]. Use one of these or create new?"

## Process Steps

### Step 1: Context Gathering & Initial Analysis

1. **Read all mentioned files immediately and FULLY**:
   - Ticket files (e.g., `thoughts/allison/tickets/eng_1234.md`)
   - Research documents
   - Related implementation plans
   - Any JSON/data files mentioned
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: DO NOT spawn sub-tasks before reading these files yourself in the main context
   - **NEVER** read files partially - if a file is mentioned, read it completely

2. **Spawn initial research tasks to gather context**:
   Before asking the user any questions, use specialized agents to research in parallel:

   - Use the **codebase-locator** agent to find all files related to the ticket/task
   - Use the **codebase-analyzer** agent to understand how the current implementation works
   - If relevant, use the **thoughts-locator** agent to find any existing thoughts documents about this feature
   - If ticket files exist in thoughts/, use the **thoughts-locator** agent to find relevant tickets

   These agents will:
   - Find relevant source files, configs, and tests
   - Identify the specific directories to focus on based on the project architecture
   - Trace data flow and key functions
   - Return detailed explanations with file:line references

3. **Read all files identified by research tasks**:
   - After research tasks complete, read ALL files they identified as relevant
   - Read them FULLY into the main context
   - This ensures you have complete understanding before proceeding

4. **Analyze and verify understanding**:
   - Cross-reference the ticket requirements with actual code
   - Identify any discrepancies or misunderstandings
   - Note assumptions that need verification
   - Determine true scope based on codebase reality

1. **Present informed understanding and focused questions**:

   ```text
   Based on the ticket and my research of the codebase, I understand we need to [accurate summary].

   I've found that:
   - [Current implementation detail with file:line reference]
   - [Relevant pattern or constraint discovered]
   - [Potential complexity or edge case identified]

   Questions that my research couldn't answer:
   - [Specific technical question that requires human judgment]
   - [Business logic clarification]
   - [Design preference that affects implementation]
   ```

   Only ask questions that you genuinely cannot answer through code investigation.

### Step 1.5: Incorporate Existing Research

After confirming feature name:

1. **Check for existing research**:
   - Look for `thoughts/shared/specs/<feature>/research-*.md` files
   - Read all found research documents FULLY

1. **Summarize available context**:

   ```text
   I found existing research for this feature:
   - research-terra-api.md - [brief summary]
   - research-db-schema.md - [brief summary]

   I'll incorporate these findings into the plan.
   ```

3. **Skip redundant research** that's already documented in existing research files

---

### Step 2: Research & Discovery

After getting initial clarifications:

1. **If the user corrects any misunderstanding**:
   - DO NOT just accept the correction
   - Spawn new research tasks to verify the correct information
   - Read the specific files/directories they mention
   - Only proceed once you've verified the facts yourself

2. **Create a research todo list** using TodoWrite to track exploration tasks

3. **Spawn parallel sub-tasks for comprehensive research**:
   - Create multiple Task agents to research different aspects concurrently
   - Use the right agent for each type of research:

   **For deeper investigation:**
   - **codebase-locator** - To find more specific files (e.g., "find all files that handle [specific component]")
   - **codebase-analyzer** - To understand implementation details (e.g., "analyze how [system] works")
   - **codebase-pattern-finder** - To find similar features we can model after

   **For historical context:**
   - **thoughts-locator** - To find any research, plans, or decisions about this area
   - **thoughts-analyzer** - To extract key insights from the most relevant documents

   **For related tickets:**
   - **linear-searcher** - To find similar issues or past implementations

   Each agent knows how to:
   - Find the right files and code patterns
   - Identify conventions and patterns to follow
   - Look for integration points and dependencies
   - Return specific file:line references
   - Find tests and examples

1. **Wait for ALL sub-tasks to complete** before proceeding

1. **Present findings and design options**:

   ```text
   Based on my research, here's what I found:

   **Current State:**
   - [Key discovery about existing code]
   - [Pattern or convention to follow]

   **Design Options:**
   1. [Option A] - [pros/cons]
   2. [Option B] - [pros/cons]

   **Open Questions:**
   - [Technical uncertainty]
   - [Design decision needed]

   Which approach aligns best with your vision?
   ```

### Step 2.5: Check for Architectural Decisions

Before creating the plan structure, determine if any architectural decisions need to be documented as ADRs:

1. **Apply the ADR forcing function**:

   Ask yourself: Does this decision meet 2+ of these criteria?

   ```text
   [ ] Multiple valid alternatives were seriously considered
   [ ] Decision has cross-cutting impact (affects 3+ modules/components)
   [ ] Reversing it would be painful (3+ days of work to undo)
   [ ] Likely to be questioned by new contributors ("why did we...?")
   [ ] Involves significant trade-offs (security vs. performance, complexity vs. flexibility)
   ```

2. **If YES to 2+ criteria**:

   ```text
   This decision warrants an ADR. Before we continue with the implementation plan,
   I recommend we document this architectural decision.

   The decision: [Brief description]

   Options considered:
   1. [Option A] - [key trade-offs]
   2. [Option B] - [key trade-offs]

   Shall I create an ADR first? (See docs/adr/README.md for the process)
   ```

   **Pause planning** and either:
   - Create the ADR yourself using `adrs new --format madr "Decision Title"`
   - Wait for user to create the ADR
   - Get explicit approval to skip ADR and continue

3. **If NO (0-1 criteria)**:
   - Continue to Step 3
   - Document the technical choice in the plan itself
   - No separate ADR needed

**Why this matters:**

- ADRs capture the "why" behind architectural choices
- Implementation plans reference ADRs for context
- Future maintainers understand trade-offs made
- See [docs/adr/README.md](../docs/adr/README.md) for full ADR guidance

### Step 3: Plan Structure Development

Once aligned on approach:

1. **Create initial plan outline**:

   ```text
   Here's my proposed plan structure:

   ## Overview
   [1-2 sentence summary]

   ## Implementation Phases:
   1. [Phase name] - [what it accomplishes]
   2. [Phase name] - [what it accomplishes]
   3. [Phase name] - [what it accomplishes]

   Does this phasing make sense? Should I adjust the order or granularity?
   ```

2. **Get feedback on structure** before writing details

### Step 4: Detailed Plan Writing

After structure approval:

1. **Write the plan** to `thoughts/shared/specs/<feature>/plan.md`
   - Create the directory if it doesn't exist
2. **Use this template structure**:

```markdown
# [Feature/Task Name] Implementation Plan

## Overview

[Brief description of what we're implementing and why]

## Current State Analysis

[What exists now, what's missing, key constraints discovered]

## Desired End State

[A Specification of the desired end state after this plan is complete, and how to verify it]

### Key Discoveries:
- [Important finding with file:line reference]
- [Pattern to follow]
- [Constraint to work within]

## What We're NOT Doing

[Explicitly list out-of-scope items to prevent scope creep]

## Implementation Approach

[High-level strategy and reasoning]

## Phase 1: [Descriptive Name]

### Overview
[What this phase accomplishes]

### Changes Required:

#### 1. [Component/File Group]
**File**: `path/to/file.ext`
**Changes**: [Summary of changes]

```[language]
// Specific code to add/modify
```text

### Success Criteria

#### Automated Verification

- [ ] Migration applies cleanly: `make migrate`
- [ ] Unit tests pass: `make test-component`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `make lint`
- [ ] Integration tests pass: `make test-integration`

#### Manual Verification

- [ ] Feature works as expected when tested via UI
- [ ] Performance is acceptable under load
- [ ] Edge case handling verified manually
- [ ] No regressions in related features

---

## Phase 2: [Descriptive Name]

[Similar structure with both automated and manual success criteria...]

---

## Testing Strategy

### Unit Tests

- [What to test]
- [Key edge cases]

### Integration Tests

- [End-to-end scenarios]

### Manual Testing Steps

1. [Specific step to verify feature]
2. [Another verification step]
3. [Edge case to test manually]

## Performance Considerations

[Any performance implications or optimizations needed]

## Migration Notes

[If applicable, how to handle existing data/systems]

## References

- Original ticket: `thoughts/allison/tickets/eng_XXXX.md`
- Related research: `thoughts/shared/specs/<feature>/research-*.md`
- Related ADRs: `docs/adr/NNNN-decision-title.md` (if applicable)
- Similar implementation: `[file:line]`

```text

### Step 5: Sync and Review

1. **Save the plan:**
   - The plan is now saved at `thoughts/shared/specs/<feature>/plan.md`

1. **Present the draft plan location**:

   ```text
   I've created the initial implementation plan at:
   `thoughts/shared/specs/<feature>/plan.md`

   Please review it and let me know:

   - Are the phases properly scoped?
   - Are the success criteria specific enough?
   - Any technical details that need adjustment?
   - Missing edge cases or considerations?
   ```

1. **Iterate based on feedback** - be ready to:
   - Add missing phases
   - Adjust technical approach
   - Clarify success criteria (both automated and manual)
   - Add/remove scope items
   - The changes will be automatically saved

1. **Continue refining** until the user is satisfied

## Important Guidelines

1. **Be Skeptical**:
   - Question vague requirements
   - Identify potential issues early
   - Ask "why" and "what about"
   - Don't assume - verify with code

2. **Be Interactive**:
   - Don't write the full plan in one shot
   - Get buy-in at each major step
   - Allow course corrections
   - Work collaboratively

3. **Be Thorough**:
   - Read all context files COMPLETELY before planning
   - Research actual code patterns using parallel sub-tasks
   - Include specific file paths and line numbers
   - Write measurable success criteria with clear automated vs manual distinction
   - automated steps should use project-specific commands from CLAUDE.md (poetry run, npm run, etc.)

4. **Be Practical**:
   - Focus on incremental, testable changes
   - Consider migration and rollback
   - Think about edge cases
   - Include "what we're NOT doing"

5. **Track Progress**:
   - Use TodoWrite to track planning tasks
   - Update todos as you complete research
   - Mark planning tasks complete when done

6. **No Open Questions in Final Plan**:
   - If you encounter open questions during planning, STOP
   - Research or ask for clarification immediately
   - Do NOT write the plan with unresolved questions
   - The implementation plan must be complete and actionable
   - Every decision must be made before finalizing the plan

7. **Check for Architectural Decisions**:
   - During planning, identify decisions that meet the ADR criteria (Step 2.5)
   - If a decision is cross-cutting or involves significant trade-offs, pause to create an ADR
   - ADRs should be written BEFORE the implementation plan
   - Plans should reference ADRs for architectural context
   - See [docs/adr/README.md](../docs/adr/README.md) for the forcing function checklist

8. **Do NOT plan for backwards compatibility unless explicitly stated**
   - Any changes should and must be completely updated.
   - Any code that used the old implementation/signature must be updated, including tests

9. **Plan for high quality code**
   - Ensure types are annotated so that we can enforce typing.
   - Trust the type systsem. Never use `getattr` or `hasattr`.
   - Only use fallback logic if the user has said so. Do NOT add fallback logic unless the user asked for it.

10. **Timezone handling for date fields**:

- When working with date-only fields (not datetimes), ALWAYS plan to store the user's timezone
- Include timezone columns in database schema changes for date fields
- Document how epoch seconds from frontend will be converted using user timezone
- Plan for proper round-trip conversion: epoch → user's local date → epoch
- Consider edge cases where dates cross timezone boundaries (e.g., 11pm PST → next day UTC)

## Success Criteria Guidelines

**Always separate success criteria into two categories:**

1. **Automated Verification** (can be run by execution agents):
   - Commands that can be run: `poetry run pytest -n auto`, `poetry run pyrefly`, `npm run lint`, etc.
   - Specific files that should exist
   - Code compilation/type checking
   - Automated test suites

2. **Manual Verification** (requires human testing):
   - UI/UX functionality
   - Performance under real conditions
   - Edge cases that are hard to automate
   - User acceptance criteria

**Format example:**

```markdown
### Success Criteria:

#### Automated Verification:
- [ ] Database migration runs successfully: `make migrate`
- [ ] All unit tests pass: `go test ./...`
- [ ] No linting errors: `golangci-lint run`
- [ ] API endpoint returns 200: `curl localhost:8080/api/new-endpoint`

#### Manual Verification:
- [ ] New feature appears correctly in the UI
- [ ] Performance is acceptable with 1000+ items
- [ ] Error messages are user-friendly
- [ ] Feature works correctly on mobile devices
```text

## Common Patterns

### For Database Changes

- Start with schema/migration
- Add store methods
- Update business logic
- Expose via API
- Update clients

### For New Features

- Research existing patterns first
- Start with data model
- Build backend logic
- Add API endpoints
- Implement UI last

### For Refactoring

- Document current behavior
- Plan incremental changes
- Ensure unit tests are also updated accordingly

## Sub-task Spawning Best Practices

When spawning research sub-tasks:

1. **Spawn multiple tasks in parallel** for efficiency
2. **Each task should be focused** on a specific area
3. **Provide detailed instructions** including:
   - Exactly what to search for
   - Which directories to focus on
   - What information to extract
   - Expected output format
4. **Be EXTREMELY specific about directories**:
   - If the ticket mentions "backend", specify `backend/` directory
   - If it mentions "frontend", specify `frontend/` directory
   - If it mentions "integration tests", specify `integ_tests/` directory
   - Use specific component or feature names when possible
   - Include the full path context in your prompts
5. **Specify read-only tools** to use
6. **Request specific file:line references** in responses
7. **Wait for all tasks to complete** before synthesizing
8. **Verify sub-task results**:
   - If a sub-task returns unexpected results, spawn follow-up tasks
   - Cross-check findings against the actual codebase
   - Don't accept results that seem incorrect

Example of spawning multiple tasks:

```python
# Spawn these tasks concurrently:
tasks = [
    Task("Research database schema", db_research_prompt),
    Task("Find API patterns", api_research_prompt),
    Task("Investigate UI components", ui_research_prompt),
    Task("Check test patterns", test_research_prompt)
]
```text

## Example Interaction Flow

```text
User: /implementation_plan
Assistant: I'll help you create a detailed implementation plan...

User: We need to add parent-child tracking for Claude sub-tasks. See thoughts/allison/tickets/eng_1478.md
Assistant: Let me read that ticket file completely first...

[Reads file fully]

Based on the ticket, I understand we need to track parent-child relationships for Claude sub-task events in the hld daemon. Before I start planning, I have some questions...

[Interactive process continues...]
```text
