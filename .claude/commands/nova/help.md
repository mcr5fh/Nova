---
description: "Explain the nova workflow"
---

# Nova Orchestrator

Nova is a meta-orchestrator that guides you through the complete planning workflow for any feature or project. It coordinates four specialized skills in sequence:

1. **Problem Definition** (`/problem:plan`) - Clarify what problem you're solving
2. **Solution Architecture** (`/solution-architect:plan`) - Design what to build
3. **Solution Critique** (`/solution-critic:plan`) - Validate edge cases and gaps
4. **Implementation Plan** (`/create-plan`) - Generate detailed implementation spec

## How It Works

Nova automatically:
- **Detects** existing artifacts to determine where to start
- **Routes** you to the right sub-skill at each phase
- **Tracks** progress across the full workflow
- **Resumes** from where you left off if interrupted

All artifacts for a project live in a single directory:

```
specs/projects/{slug}/
├── problem.md     # Problem statement
├── solution.md    # Solution architecture
├── critique.md    # Edge case analysis
└── full-spec.md   # Implementation plan
```

## Workflow Phases

| Phase | Artifact | Sub-Skill |
|-------|----------|-----------|
| Discovery | (assessment) | Nova itself |
| Problem | problem.md | /problem:plan |
| Solution | solution.md | /solution-architect:plan |
| Critique | critique.md | /solution-critic:plan |
| Plan | full-spec.md | /create-plan |

## Commands

- `/nova:plan <name>` - Start a new planning session
- `/nova:resume` - Resume an interrupted session
- `/nova:cleanup` - Clean up session state files
- `/nova:help` - Show this help

## In-Session Commands

During a Nova session, you can also use:
- `/progress` - Show full status with all artifacts
- `/skip` - Skip the current phase (with warning)

## Tips

- **Start early:** Use Nova before writing any code to ensure you understand the problem
- **Don't skip phases:** Each phase builds on the previous one
- **Use the artifacts:** The generated specs are designed to be used as implementation guides
- **Resume anytime:** Nova saves state, so you can interrupt and continue later

## Example Session

```
> /nova:plan user-auth

Nova Planning: user-auth
Phase: discovery

Progress:
[ ] Problem Definition
[ ] Solution Architecture
[ ] Solution Critique
[ ] Implementation Plan

Let's start by understanding the problem. Can you describe in 1-2 sentences what problem you're trying to solve?

> Users can't log in securely, we need proper authentication

That's a clear problem statement. Would you like to:
1. Define the problem formally with `/problem:plan user-auth`
2. Skip to designing the solution

> 1

Great, run `/problem:plan user-auth` to define the problem statement.

[User runs /problem:plan user-auth and completes it]

> done

Nova Planning: user-auth
Phase: solution

Progress:
[x] Problem Definition    specs/projects/user-auth/problem.md
[ ] Solution Architecture
[ ] Solution Critique
[ ] Implementation Plan

The problem is defined. Ready to design the solution? Run `/solution-architect:plan user-auth`.
```
