# Context Map

## Core Concepts
- `brainstorm.md` - System architecture and problem framing
- `spec.md` - Entry point specification (when created)

## Documentation
- `docs/baml-instructions.md` - BAML usage patterns and conventions

## Task Management
- Uses Beads (`bd`) for task hierarchy and state
- See brainstorm.md for orchestrator integration

## Agent System
- Planner: Task sizing and decomposition
- Worker: Leaf task execution (small models)
- Validator: Output verification
- Escalation: Routing to fixer or human

## Key Directories
- `.claude/agents/` - Agent definitions
- `.claude/commands/` - Command definitions
- `thoughts/` - Working notes and analysis
