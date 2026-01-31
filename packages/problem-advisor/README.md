# Problem Advisor

A conversational AI agent that helps sharpen vague problem statements into clear, testable hypotheses.

## Overview

Problem Advisor acts as a challenger—pushing back on vague language, solution-speak, and unvalidated assumptions to help you articulate problems worth solving.

**Pipeline Position:** This is the first step in the product development pipeline:
```
problem-advisor → solution-architect → implementation
```

## Installation

```bash
npm install problem-advisor
```

Or run directly:
```bash
npx problem-advisor start
```

## Usage

### CLI

```bash
# Start a new session
problem-advisor start

# With a specific model
problem-advisor start --model claude-sonnet-4-20250514

# With explicit API key
problem-advisor start --api-key sk-ant-...
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
| `/save` | Save session for later |
| `/help` | Show available commands |

You can also say things like "save as Customer Onboarding" to save your problem statement.

## How It Works

### The 6 Dimensions

Problem Advisor evaluates your problem statement across 6 dimensions:

| Dimension | Goal | Threshold |
|-----------|------|-----------|
| **Problem Clarity** | Single-sentence customer pain point | strong |
| **Customer Context** | Specific user segment + situational context | strong |
| **Severity & Frequency** | Quantified frequency and impact level | partial |
| **Root Cause** | Fundamental reason the problem exists | partial |
| **Business Impact** | Quantified revenue/cost/strategic impact | strong |
| **Validation** | Concrete validation approach | partial |

### Coverage Levels

- **not_started** - No relevant information provided
- **weak** - Some mention but vague/unclear
- **partial** - Decent clarity but missing specifics
- **strong** - Clear, specific, and actionable

### Example Session

```
You: Users are frustrated with our onboarding

Advisor: "Frustrated" is pretty vague—what specifically is happening
that's causing friction? Are they dropping off somewhere, getting
confused, or something else?

You: They're abandoning during the account setup, especially when
connecting their payment method

Advisor: That's more specific. Who are these users—is this happening
across all customer segments, or is there a particular group where
this is concentrated?

...
```

## Output Format

When all dimensions meet their thresholds, Problem Advisor generates a structured problem statement:

```
═══════════════════════════════════════════════════════
                   PROBLEM STATEMENT
═══════════════════════════════════════════════════════

PROBLEM: Enterprise customers lose 4+ hours/week manually
reconciling data between their CRM and billing systems

WHO: Finance teams at 50-500 employee B2B SaaS companies,
during month-end close

FREQUENCY/SEVERITY: Weekly during reconciliation, blocks
team for 1-2 days each month

BUSINESS IMPACT: Costs $200K/year in labor, primary driver
of 15% enterprise churn

VALIDATION: Interview 10 finance managers, ask if they'd
pay $X/month to eliminate this task

───────────────────────────────────────────────────────
Confidence: HIGH
═══════════════════════════════════════════════════════
```

## Programmatic API

```typescript
import { ProblemAdvisor } from 'problem-advisor';

const advisor = new ProblemAdvisor({
  llmProvider: 'anthropic',
  modelId: 'claude-sonnet-4-20250514',
  apiKey: process.env.ANTHROPIC_API_KEY,
  streamResponses: true,
});

const { id, state } = advisor.startSession();

// Chat returns an async generator for streaming
for await (const chunk of advisor.chat(id, 'Users hate our checkout')) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.text);
  }
}

// Export when ready
const { content } = advisor.export(id, 'markdown');
```

## Exports

Problem Advisor can export in two formats:

### Markdown
```bash
/export markdown
```

Creates a structured document with sections for Problem, Who, Frequency & Severity, Business Impact, and Validation.

### JSON
```bash
/export json
```

Creates a machine-readable format that can be loaded by `solution-architect`:

```json
{
  "problem": "...",
  "who": "...",
  "frequencySeverity": "...",
  "businessImpact": "...",
  "validation": "...",
  "confidence": "high",
  "gaps": [],
  "metadata": {
    "sessionId": "...",
    "exportedAt": "...",
    "version": "1.0.0"
  }
}
```

## Next Steps

Once you have a validated problem statement, use [solution-architect](../solution-architect) to design what to build:

```bash
# Export from problem-advisor
/export json > my-problem.json

# Load into solution-architect
solution-architect start --load my-problem.json
```

## License

MIT
