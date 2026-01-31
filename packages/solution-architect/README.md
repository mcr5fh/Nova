# Solution Architect

A conversational AI agent that helps identify **what to build** to solve a problem.

## Overview

Solution Architect sits between problem definition and implementation planning:

- **Upstream:** Takes a validated problem statement (ideally from [problem-advisor](../problem-advisor))
- **Your Job:** Figure out WHAT to build—the solution concept, user value, scope, and success criteria
- **Downstream:** Hands off to implementation planning (figuring out HOW to build it)

**Pipeline Position:**
```
problem-advisor → solution-architect → implementation
```

## Installation

```bash
npm install solution-architect
```

Or run directly:
```bash
npx solution-architect start
```

## Usage

### CLI

```bash
# Start a new session
solution-architect start

# Load a problem statement from problem-advisor
solution-architect start --load ./my-problem.json

# With a specific model
solution-architect start --model claude-sonnet-4-20250514
```

### Environment Variables

- `ANTHROPIC_API_KEY` - Your Anthropic API key (required)

### Commands

During a session, you can use these commands:

| Command | Description |
|---------|-------------|
| `/progress` | Show dimension coverage status |
| `/eject` | Generate best-effort output with warnings about gaps |
| `/export [format]` | Export as `markdown` (default) or `json` |
| `/save <name>` | Save to `specs/solutions/<name>.md` |
| `/load <path>` | Load problem statement from file |
| `/help` | Show available commands |

You can also say things like "save as User Dashboard" to save your solution spec.

## How It Works

### The 4 Dimensions

Solution Architect evaluates your solution across 4 dimensions (all require "strong" coverage):

| Dimension | Goal | Example |
|-----------|------|---------|
| **Solution Clarity** | Single-sentence description of the solution | "A CLI tool that interviews users to nail down problem statements" |
| **User Value** | Clear user journey and value proposition | "Product managers run it before writing specs—they get a validated problem statement in 15 mins" |
| **Scope Boundaries** | What's in and out of scope | "Does NOT help with implementation. v1 is CLI only, no web UI" |
| **Success Criteria** | How we'll know it works | "Users can take the output directly to implementation without backtracking" |

### Coverage Levels

- **not_started** - No relevant information provided
- **weak** - Some mention but vague/unclear
- **partial** - Decent clarity but missing specifics
- **strong** - Clear, specific, and actionable

### Loading Problem Statements

The power of Solution Architect comes from loading validated problem statements:

```bash
# From problem-advisor JSON export
solution-architect start --load ./problem.json

# From problem-advisor Markdown export
solution-architect start --load ./problem.md

# Or load during a session
/load ./problem.json
```

When loaded, the problem context is shown and used throughout the conversation:

```
📄 Problem loaded from: ./problem.json

"Enterprise customers lose 4+ hours/week manually reconciling data"

What solution do you have in mind for this problem?
```

### Frontend Design Iteration

When designing UI solutions, Solution Architect offers ASCII mockup iterations:

```
Architect: Since this involves a UI, would it help if I sketched out
a couple of layout options?

Option A - Sidebar navigation:
┌──────────────────────────────────────┐
│ Logo    [Search]         [User Menu] │
├────────┬─────────────────────────────┤
│ Nav    │                             │
│ ───    │     Main Content Area       │
│ Home   │                             │
│ Dash   │                             │
└────────┴─────────────────────────────┘

Option B - Top navigation:
┌──────────────────────────────────────┐
│ Logo  [Home] [Dash] [Tasks] [User]   │
├──────────────────────────────────────┤
│                                      │
│         Main Content Area            │
│                                      │
└──────────────────────────────────────┘

Which direction feels right for your users?
```

### UX Flow Diagrams

When all dimensions reach "strong" coverage, Solution Architect generates an ASCII flow diagram showing the user journey:

```
┌─────────────────┐
│  User starts    │
│  the tool       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Answers        │
│  interview Qs   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Reviews        │
│  generated spec │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Exports to     │
│  implementation │
└─────────────────┘
```

## Output Format

When all dimensions meet their thresholds:

```
═══════════════════════════════════════════════════════════════
                      SOLUTION SPECIFICATION
═══════════════════════════════════════════════════════════════

PROBLEM CONTEXT:
  Enterprise customers lose 4+ hours/week manually reconciling data
  Who: Finance teams at 50-500 employee B2B SaaS companies

SOLUTION: An automated sync service that continuously reconciles
CRM and billing data with conflict detection and resolution

USER VALUE: Finance teams connect both systems once, then get
real-time sync with alerts only when human judgment is needed.
Saves 4+ hours/week and eliminates month-end reconciliation panic.

SCOPE:
  Included:
    • Two-way sync between CRM and billing
    • Conflict detection with smart resolution rules
    • Dashboard showing sync status and exceptions
  Excluded:
    • Custom integrations beyond CRM/billing
    • Historical data migration
    • Mobile app

SUCCESS CRITERIA:
  • Reduces reconciliation time by 80%+
  • Zero data discrepancies at month-end
  • Users check dashboard < 5 mins/day

USER FLOW:
┌─────────────────┐
│  Connect        │
│  systems        │
└────────┬────────┘
         │
         ▼
   ... (flow diagram)

───────────────────────────────────────────────────────────────
Confidence: HIGH
═══════════════════════════════════════════════════════════════
```

## Programmatic API

```typescript
import { SolutionArchitect } from 'solution-architect';

const architect = new SolutionArchitect({
  llmProvider: 'anthropic',
  modelId: 'claude-sonnet-4-20250514',
  apiKey: process.env.ANTHROPIC_API_KEY,
  streamResponses: true,
});

const { id, state } = architect.startSession();

// Load a problem statement
await architect.loadProblem(id, './problem.json');

// Chat returns an async generator for streaming
for await (const chunk of architect.chat(id, 'I want to build an auto-sync tool')) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.text);
  }
}

// Export when ready
const { content } = await architect.export(id, 'markdown');
```

## Exports

### Markdown
```bash
/export markdown
```

Creates a structured document with Problem Context, Solution, User Value, Scope, Success Criteria, and User Flow diagram.

### JSON
```bash
/export json
```

Creates a machine-readable format:

```json
{
  "solutionSummary": "...",
  "userValue": "...",
  "scope": {
    "included": ["..."],
    "excluded": ["..."],
    "futureConsiderations": ["..."]
  },
  "successCriteria": ["..."],
  "userFlow": "...",
  "confidence": "high",
  "problemContext": {
    "problem": "...",
    "who": "..."
  },
  "metadata": {
    "sessionId": "...",
    "exportedAt": "...",
    "version": "1.0.0"
  }
}
```

### Save to Project

```bash
/save My Solution Name
```

Saves to `specs/solutions/my-solution-name.md` with an Implementation section placeholder.

## Complete Pipeline Example

```bash
# Step 1: Define the problem
cd my-project
npx problem-advisor start
# ... interview session ...
/export json > specs/problems/data-sync.json

# Step 2: Design the solution
npx solution-architect start --load specs/problems/data-sync.json
# ... interview session ...
/save Data Sync Service

# Step 3: Implementation planning (coming soon)
# The solution spec at specs/solutions/data-sync-service.md
# can be used for implementation planning
```

## License

MIT
