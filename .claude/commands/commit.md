# Commit Changes

You are tasked with creating git commits for the changes made during this session.

## Process

1. **Create pre-commit verification workflow:**

   ```bash
   bd mol wisp mol-commit --var msg=""
   ```

   Save the wisp ID for later cleanup.

2. **Execute the workflow:**

   ```bash
   # See current position
   bd mol current <wisp-id>

   # Work through each step
   bd ready                              # See what's ready
   bd update <step-id> --status in_progress  # Claim step
   # Run the command shown in step description
   bd close <step-id>                    # Close and advance
   ```

3. **Handle failures:**
   If a step fails:

   ```bash
   bd update <step-id> --notes "Failed: <error details>"
   ```

   Fix the error, re-run the command, then close the step.

4. **When `execute-commit` step is ready:**
   - Review what changed (already done in `verify-changes` step)
   - Plan your commit(s) - identify which files belong together
   - Draft clear commit messages in imperative mood
   - Present plan to user: "I plan to create [N] commit(s). Shall I proceed?"

5. **Execute upon confirmation:**
   - Use `git add` with specific files (never use `-A` or `.`)
   - Create commits with your planned messages
   - Show result: `git log --oneline -n [number]`
   - Close the step: `bd close <execute-commit-id>`
   - Clean up: `bd mol burn <wisp-id>`

## Handling Step Failures

- Step stays `in_progress` until fixed (blocks dependents)
- Add notes with `bd update <id> --notes "Failed: ..."`
- Fix the issue, re-run command, then `bd close`

## Important

- Write commit messages as if the user wrote them
- Keep commits focused and atomic when possible
- All pre-commit checks must pass before committing
- Use `bd mol progress <wisp-id>` to check overall progress
