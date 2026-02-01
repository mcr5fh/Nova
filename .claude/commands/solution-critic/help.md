---
description: "Explain the solution critic workflow"
---

# Solution Critic

The Solution Critic analyzes solution specifications for edge cases, failure modes, ambiguities, and risks before implementation begins. It sits between solution architecture and implementation planning.

## How It Works

The critic tracks **6 dimensions** of solution robustness:

| Dimension | Goal | Threshold |
|-----------|------|-----------|
| **Edge Case Completeness** | All edge cases addressed, none missing | Strong |
| **Failure Mode Handling** | Clear error handling and recovery paths | Strong |
| **Ambiguity Resolution** | Vague requirements clarified | Strong |
| **Dependency Risks** | External dependencies identified and mitigated | Partial |
| **Scalability Concerns** | Solution works at expected scale | Partial |
| **Security Considerations** | Security implications addressed | Partial |

As you resolve issues, each dimension's coverage progresses: `not_started` -> `weak` -> `partial` -> `strong`

When all dimensions meet their thresholds, the critic will offer to generate the final critique document.

## Input

The critic expects a solution spec at:
- `specs/projects/{slug}/solution.md` (preferred)
- `specs/solutions/{slug}.md` (legacy location)

Run `/solution-architect:plan {slug}` first if no solution spec exists.

## Output

The final critique includes:
- Resolved decisions with rationale
- Edge case enhancements
- Risk assessment (prioritized)
- Implementation recommendations
- Confidence assessment by dimension

## Commands

- `/solution-critic:plan <name>` - Start analyzing a solution spec
- `/solution-critic:resume` - Resume an interrupted analysis
- `/solution-critic:cleanup` - Clean up analysis state files
- `/solution-critic:help` - Show this help

## In-Session Commands

During an analysis, you can also use:
- `/progress` - Show dimension coverage status
- `/issues` - List all discovered and resolved issues
- `/eject` - Generate best-effort critique with warnings about gaps
- `/skip [dimension]` - Skip a dimension (with warning)

## Tips

- Have a complete solution spec before starting critique
- Be honest about edge cases—they'll surface during implementation anyway
- Consider failure modes for external dependencies
- Think about what happens at scale
- Security issues are easier to fix in design than in code
