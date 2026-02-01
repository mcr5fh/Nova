# Ralph Research - Autonomous Ticket Research

## Overview

Autonomously conducts research for the highest-priority ticket marked as "needs research".

## Part I: Ticket Selection

**If a ticket is mentioned:**

- Look for the ticket file in `thoughts/shared/tickets/HYBRD-xxxx.md`
- Read ticket to understand research needs

**If no ticket is mentioned:**

1. Look for tickets in `thoughts/shared/tickets/` directory
2. Read each ticket file to find highest priority item by checking `Status`, `Size`, and `Priority` fields
3. Select the highest priority XS, S, or M issue with status "needs research" (exit if none exist)
4. Read the ticket file completely

## Part II: Research Execution

**Initial Steps:**

1. Update the ticket file's `Status` field to "research in progress"
2. Read linked documents for context
3. Request clarification if insufficient information exists

**Conduct Research:**

- Use `/research_codebase` command for codebase investigation
- Use WebSearch for external solutions if needed
- Search for relevant implementations using codebase-locator agent
- Examine similar features
- Document findings unbiased—focus on current systems
- Create research document: `thoughts/shared/research/YYYY-MM-DD_HYBRD-XXXX_description.md`

**Synthesis:**

- Summarize key findings and technical decisions
- Identify potential implementation approaches
- Note risks or concerns
- Update ticket file's `Linked Documents` section to include the research path
- Update ticket file's `Status` field to "research complete"

## Part III: Completion

Print confirmation message with:

- Ticket number and title
- Research topic
- Key findings summary
- Research document path
