# Ralph Planning - Autonomous Implementation Planning with Decomposition

## Overview

Autonomously creates implementation plans for tickets marked as "ready for spec". For Large and XL tickets, automatically decomposes them into Medium or smaller subtasks with individual research and plans.

## Part I: Ticket Selection

**If a ticket is mentioned:**

- Look for the ticket file in `thoughts/shared/tickets/HYBRD-xxxx.md`
- Read all ticket content to understand requirements

**If no ticket is mentioned:**

1. Look for tickets in `thoughts/shared/tickets/` directory
2. Read each ticket file to find highest priority item by checking `Status`, `Size`, and `Priority` fields
3. Select the highest priority XS/S/M/L/XL issue with status "ready for spec" (exit if none exist)
4. Read the ticket file completely

## Part II: Planning Workflow

### Step 1: Assess Ticket Size

**If ticket size is XS, S, or M:**

1. Update the ticket file's `Status` field to "plan in progress"
2. Use `/create_plan` command with the ticket file path
3. Follow the planning process
4. Save plan to `thoughts/shared/plans/YYYY-MM-DD_HYBRD-XXXX_description.md`
5. Update ticket file's `Linked Documents` section to include the plan path
6. Update ticket file's `Status` field to "plan complete"
7. Go to Part III (Completion)

**If ticket size is XL:**

1. Update ticket file's `Status` back to "needs breakdown"
2. Add note: "This ticket is too large for automated decomposition. Please manually break it down into L or smaller tickets."
3. Exit with message to user explaining the ticket needs manual decomposition
4. Do NOT attempt to auto-decompose XL tickets

**If ticket size is L:**
Proceed to Step 2 (Decomposition Workflow)

### Step 2: Decomposition Workflow (for L tickets only)

1. **Update ticket status:**
   - Set `Status` to "decomposing into subtasks"
   - Add note: "Large ticket being broken down into smaller pieces"

2. **Analyze and decompose the ticket:**
   - Read the ticket description, acceptance criteria, and technical context
   - Identify logical components or phases of the work
   - Break down into subtasks that are Medium or smaller
   - Each subtask should be independently implementable
   - Aim for subtasks that build on each other logically

3. **Create subtask tickets:**
   For each identified subtask:
   - Create new ticket file: `thoughts/shared/tickets/HYBRD-XXX-Y.md`
     (where Y is subtask number: 1, 2, 3...)
   - Set appropriate size (target M or smaller)
   - Set `Status` to "needs research"
   - Set same priority as parent ticket
   - In description, note: "Subtask of HYBRD-XXX"
   - Link back to parent ticket

4. **Run research for each subtask:**
   - Use TodoWrite to track research for each subtask
   - For each subtask, spawn a parallel `/research_codebase` task
   - Each research should focus on:
     - Existing patterns for this component
     - Files that will need to be modified
     - Dependencies and integration points
     - Potential risks or complexities
   - Wait for all research tasks to complete
   - Save research to `thoughts/shared/research/YYYY-MM-DD_HYBRD-XXX-Y_description.md`
   - Update each subtask ticket with link to research

5. **Create implementation plans for each subtask:**
   - Use TodoWrite to track planning for each subtask
   - For each subtask with completed research:
     - Use `/create_plan` with the subtask ticket file
     - Create plan: `thoughts/shared/plans/YYYY-MM-DD_HYBRD-XXX-Y_description.md`
     - Update subtask ticket status to "plan complete"
     - Update subtask ticket with link to plan

6. **Create master coordination plan:**
   - Create an overview plan for the parent ticket
   - Document the decomposition strategy
   - List all subtasks in dependency order
   - Include integration strategy
   - Note any cross-cutting concerns
   - Save as: `thoughts/shared/plans/YYYY-MM-DD_HYBRD-XXX_master-plan.md`

7. **Update parent ticket:**
   - Set `Status` to "decomposed - see subtasks"
   - Add `## Subtasks` section listing all subtask tickets
   - Link to master coordination plan
   - Note: "This large ticket has been broken down. Implement subtasks in order."

## Part III: Completion Message

**For XS/S/M tickets:**
Print formatted summary:

- Ticket identifier and title
- Plan file location
- Implementation phases overview
- Next steps (ready for implementation)

**For L tickets:**
Print formatted summary:

- Parent ticket identifier and title
- Number of subtasks created
- List of subtask ticket IDs with sizes
- Master plan location
- Research documents created
- Individual plan locations
- Next steps: "Subtasks are ready for implementation. Ralph can now pick them up autonomously."

**For XL tickets:**
Print message:

- Ticket identifier and title
- Explanation: "This ticket is too large (XL) for automated decomposition."
- Action required: "Please manually break this down into multiple L or smaller tickets."
- Guidance: "Consider logical boundaries: separate backend/frontend, break into phases, or split by features."
- Status updated: "needs breakdown"

## Key Principles

- **Logical Decomposition**: Break work along natural boundaries (backend/frontend, phases, features)
- **Independence**: Subtasks should be implementable in isolation where possible
- **Progressive**: Earlier subtasks should enable later ones (e.g., database schema before API endpoints)
- **Right-Sized**: Target M or smaller for subtasks so Ralph can handle them
- **Research-Driven**: Each subtask gets its own codebase research to inform planning
- **Thorough**: Each subtask gets a complete implementation plan, not just a TODO list
