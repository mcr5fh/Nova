---
description: "Explain the solution architect workflow"
---

# Solution Architect v2

The Solution Architect helps you design WHAT to build after a problem has been defined. It sits between problem definition and implementation planning.

## How It Works

The architect tracks **6 dimensions** of a well-defined solution:

| Dimension | Goal | Threshold |
|-----------|------|-----------|
| **Solution Clarity** | Single-sentence description of what we're building | Strong |
| **User Value** | Clear user journey and value proposition | Strong |
| **Scope Boundaries** | Explicit in-scope and out-of-scope items | Strong |
| **Success Criteria** | Measurable indicators of success | Strong |
| **Technical Constraints** | Technology, systems, and integration requirements | Partial |
| **Edge Cases** | Failure modes and boundary conditions | Partial |

As you answer questions, each dimension's coverage progresses: `not_started` -> `weak` -> `partial` -> `strong`

When all dimensions meet their thresholds, the architect will offer to generate the final solution specification.

## v2 Enhancements

- Codebase-aware design suggestions
- Automatic edge case discovery
- Implementation diagrams (Mermaid)
- Effort estimation (T-shirt sizing)

## Output

The final solution spec includes:
- Solution summary
- User value proposition
- Scope (included/excluded/future)
- Success criteria
- Technical constraints
- Edge cases with recommendations
- Implementation diagram (Mermaid)
- Effort estimate (T-shirt sizing)

## Commands

- `/solution-architect:plan <name>` - Start a new solution specification interview
- `/solution-architect:resume` - Resume an interrupted interview
- `/solution-architect:cleanup` - Clean up interview state files
- `/solution-architect:help` - Show this help

## In-Session Commands

During an interview, you can also use:
- `/progress` - Show dimension coverage status
- `/eject` - Generate best-effort output with warnings about gaps
- `/export [format]` - Export as JSON or Markdown
- `/save [name]` - Save to specs/projects/<name>/solution.md
- `/load <path>` - Load problem statement from file
- `/context` - Show current codebase context

## Tips

- Start with a clear problem statement (use `/problem:plan` first if needed)
- Be specific about WHO uses the solution and WHAT value they get
- Explicitly define what's in scope and out of scope
- Think about how you'll measure success
- Consider technical constraints and integrations
- Identify edge cases and failure modes
