# Create Handoff - Document Work for Session Transfer

## Overview

Creates handoff documents for transferring work between sessions, with concise yet thorough documentation.

## File Structure & Metadata

**Location pattern:** `thoughts/shared/handoffs/HYBRD-XXXX/YYYY-MM-DD_HH-MM-SS_HYBRD-XXXX_description.md`

Key elements:

- Date format: YYYY-MM-DD
- Time format: 24-hour (HH-MM-SS)
- Ticket reference: HYBRD-XXXX (use "general" if none)
- Description: kebab-case format

Examples:

- With ticket: `thoughts/shared/handoffs/HYBRD-123/2026-01-07_14-30-00_HYBRD-123_workout-template-generation.md`
- Without ticket: `thoughts/shared/handoffs/general/2026-01-07_14-30-00_general_refactor-api-client.md`

**For ralph_runner handoffs:**

- Location: `thoughts/shared/handoffs/ralph-session/YYYY-MM-DD_HH-MM-SS_HYBRD-XXX_ralph-session.md`
- Include ticket ID in filename so you know which ticket Ralph was working on
- If between tickets: use `YYYY-MM-DD_HH-MM-SS_general_ralph-session.md`

## YAML Frontmatter Template

Required metadata:

- `date`: ISO format with timezone
- `author`: Developer name
- `git_commit`: Current commit hash from `git rev-parse HEAD`
- `branch`: Current branch name from `git branch --show-current`
- `repository`: "ruiters-ralph" or repo name
- `topic`: Feature/task name
- `tags`: [implementation, strategy, component names]
- `status`: complete
- `last_updated`: YYYY-MM-DD format
- `last_updated_by`: Author name
- `type`: implementation_handoff

## Document Sections

**Task(s):** Describe work completed, in-progress, or planned with phase references and relevant plan/research documents.

**Critical References:** List 2-3 most important specification or architecture documents (optional).

**Recent changes:** Document modifications using `file:line` syntax.

**Learnings:** Share patterns, bug insights, and critical information for knowledge transfer.

**Artifacts:** Exhaustive list of produced/updated files and documents needed to resume work.

**Action Items & Next Steps:** Specific tasks for the next agent/session.

**Other Notes:** Contextual information, codebase locations, or additional learnings.

## Completion Process

Present the handoff file path and suggest using `/resume_handoff` to continue work.

## Key Principles

- Prioritize comprehensive information over brevity
- Maintain precision for both high-level objectives and lower-level details
- Avoid extensive code snippets; use `file:line` references instead
- Document WHY decisions were made, not just WHAT was done
