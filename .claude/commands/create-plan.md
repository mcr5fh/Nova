# Implementation Plan

You are tasked with translating solution architect specifications into detailed implementation plans. The solution spec defines WHAT to build; your job is to define HOW to build it with specific code-level details.

## Initial Response

When this command is invoked:

1. **Check if a solution spec path was provided**:
   - If path provided (e.g., `/create-plan specs/projects/web-voice-planner/solution.md`), read that spec
   - If just a feature name provided (e.g., `/create-plan web-voice-planner`), look in `specs/projects/{slug}/solution.md`

2. **If no spec provided**, respond with:

```
I'll help you create a detailed implementation plan from a solution spec.

**Which solution spec should I translate?**

Available specs:
[List directories from specs/projects/ that contain solution.md]

Provide the spec name or path.
```

Then wait for the user's input.

3. **Verify the spec exists** and read it FULLY before proceeding.

## Process Steps

### Step 1: Understand the Solution Spec

1. **Read the solution spec COMPLETELY**:
   - Use the Read tool WITHOUT limit/offset parameters
   - Extract: Summary, Scope, Success Criteria, Technical Constraints, Edge Cases, UX Flow, Implementation Diagram
   - **NEVER** proceed without reading the full spec

2. **Summarize your understanding**:
   ```
   I've read the solution spec for [feature name].

   **What we're building:**
   - [1-2 sentence summary]

   **Key constraints:**
   - [Technical constraint from spec]
   - [Scope boundary from spec]

   **Success looks like:**
   - [Success criteria from spec]

   Does this match your understanding before I dive into the codebase?
   ```

### Step 2: Codebase Research

After confirming understanding:

1. **Use the Explore agent to research the codebase**:
   Spawn parallel exploration tasks to understand:
   - Current project structure and patterns
   - Relevant existing code to integrate with or extend
   - Testing patterns used in this project
   - Similar features that can serve as models

   Example:
   ```
   Task(subagent_type="Explore", prompt="Find all files related to [component]. I need to understand the existing patterns for [feature area].")
   ```

2. **Read key files identified** into main context

3. **Present findings**:
   ```
   Based on my research, here's what I found:

   **Relevant existing code:**
   - [File:line reference] - [what it does]
   - [Pattern to follow]

   **Integration points:**
   - [Where new code will connect]
   - [Dependencies to consider]

   **Design decision needed:**
   - [Option A] - [pros/cons]
   - [Option B] - [pros/cons]

   Which approach aligns best with your vision?
   ```

### Step 3: Plan Structure Development

Once aligned on approach:

1. **Create initial plan outline**:
   ```
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

1. **Write the plan** to `specs/projects/<slug>/full-spec.md`
   - Create `specs/projects/<slug>/` directory if it doesn't exist
2. **Use this template structure**:

```markdown
# [Feature Name] Implementation Plan

> Generated from: `specs/projects/<slug>/solution.md`

## Overview

[Brief description of what we're implementing and why - sourced from solution spec]

## Solution Spec Reference

**Summary:** [From spec]
**Success Criteria:** [From spec]
**Scope:** [In/out of scope from spec]

## Current State Analysis

[What exists now in the codebase, what's missing, key constraints discovered]

### Key Discoveries:
- [Important finding with file:line reference]
- [Pattern to follow]
- [Constraint to work within]

## Desired End State

[Specification of the desired end state after this plan is complete, and how to verify it]

## What We're NOT Doing

[Explicitly list out-of-scope items from the solution spec to prevent scope creep]

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
```

### Success Criteria:

#### Automated Verification:
- [ ] Unit tests pass: `uv run pytest program_nova -v`
- [ ] Type checking passes (if applicable)
- [ ] New functionality works: [specific test command]

---

## Phase 2: [Descriptive Name]

[Similar structure...]

---

## Edge Cases (from Solution Spec)

| Scenario | Severity | Implementation Approach |
|----------|----------|------------------------|
| [From spec] | [From spec] | [How we'll handle it in code] |

## Testing Strategy

### Unit Tests:
- [What to test]
- [Key edge cases from spec]

### Integration Tests:
- [End-to-end scenarios]

## Beads Issues to Create

After plan approval, create these issues:
- [ ] `bd add "[Phase 1 title]" --label implementation`
- [ ] `bd add "[Phase 2 title]" --label implementation`
- [ ] `bd add "[Testing task]" --label testing`

## References

- Solution spec: `specs/projects/<slug>/solution.md`
- Similar implementation: `[file:line]`
```

### Step 5: Review and Iterate

1. **Present the draft plan location**:
   ```
   I've created the implementation plan at:
   `specs/projects/<slug>/full-spec.md`

   Please review it and let me know:
   - Are the phases properly scoped?
   - Are the success criteria specific enough?
   - Any technical details that need adjustment?
   - Missing edge cases from the solution spec?
   ```

2. **Iterate based on feedback** until the user is satisfied

3. **After approval**, offer to create beads issues:
   ```
   Plan approved! Should I create the beads issues for tracking?
   ```

## Important Guidelines

1. **Respect the Solution Spec**:
   - The spec is the source of truth for WHAT to build
   - Your job is HOW to build it
   - Don't expand scope beyond the spec
   - Reference the spec's edge cases and success criteria

2. **Be Skeptical**:
   - Question vague requirements
   - Identify potential issues early
   - Don't assume - verify with code

3. **Be Interactive**:
   - Don't write the full plan in one shot
   - Get buy-in at each major step
   - Allow course corrections

4. **Be Thorough**:
   - Read solution spec COMPLETELY before planning
   - Research actual code patterns using Explore agents
   - Include specific file paths and line numbers
   - Write measurable automated verification criteria

5. **Be Practical**:
   - Focus on incremental, testable changes
   - Consider the edge cases from the solution spec
   - Include "what we're NOT doing" from spec's excluded items

6. **No Open Questions in Final Plan**:
   - If you encounter open questions during planning, STOP
   - Research or ask for clarification immediately
   - The implementation plan must be complete and actionable

7. **Do NOT plan for backwards compatibility unless explicitly stated**
   - Any changes should and must be completely updated
   - Any code that used the old implementation/signature must be updated, including tests

8. **Plan for high quality code**
   - Ensure types are annotated
   - Trust the type system - no `getattr` or `hasattr`
   - Only use fallback logic if explicitly requested

## Project-Specific Commands

This project uses:
- **Package manager**: `uv`
- **Run tests**: `uv run pytest program_nova -v`
- **Issue tracking**: `bd` (beads) - `bd ready`, `bd add`, `bd close`
- **CLI**: `nova` command for orchestrator operations

## Example Interaction Flow

```
User: /create-plan web-voice-planner
Assistant: Let me read that solution spec...

[Reads specs/projects/web-voice-planner/solution.md fully]

I've read the solution spec for Web Voice Planner.

**What we're building:**
A voice-enabled web app for PMs to have spoken conversations with solution-architect...

**Key constraints:**
- OpenAI Whisper for STT, OpenAI TTS
- Greenfield project, no legacy code
- Session persistence required

**Success looks like:**
- Engineers can implement with minimal back-and-forth
- Edge cases captured upfront in spec

Does this match your understanding?

[Interactive process continues...]
```
