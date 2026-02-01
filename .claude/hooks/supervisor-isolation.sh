#!/bin/bash
# Supervisor isolation hook for tv dismiss commands
# Used as a Claude Code PreToolUse hook
# Blocks attempts to dismiss workers belonging to other supervisors

# Read JSON input from stdin
input=$(cat)

# Extract the bash command from the JSON input
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# If no command, allow (not a Bash tool call)
if [ -z "$command" ]; then
  exit 0
fi

# Check if this is a tv dismiss command
if ! echo "$command" | grep -qE '^[[:space:]]*tv[[:space:]]+dismiss[[:space:]]+'; then
  exit 0  # Not a tv dismiss command, allow
fi

# Extract worker_id from the command
# Matches: tv dismiss <worker_id> or tv dismiss all
worker_id=$(echo "$command" | sed -E 's/^[[:space:]]*tv[[:space:]]+dismiss[[:space:]]+([^[:space:]]+).*/\1/')

# Check if TV_SUPERVISOR_ID is set
if [ -z "$TV_SUPERVISOR_ID" ]; then
  exit 0  # Standalone mode, no supervisor isolation needed
fi

# Special case: 'dismiss all' is handled by the application layer
# We only check individual worker dismissals at the hook level
if [ "$worker_id" = "all" ]; then
  exit 0
fi

# Query tmux for sessions matching the worker pattern
# Pattern: tv-worker-{supervisor_id}-{worker_id}
# List all tmux sessions and find matching ones
matching_sessions=$(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep -E "^tv-worker-.*-${worker_id}$" || true)

# If no matching session found, allow (will fail naturally in the application)
if [ -z "$matching_sessions" ]; then
  exit 0
fi

# Parse supervisor_id from the session name
# Format: tv-worker-{supervisor_id}-{worker_id}
# Find the last dash to split supervisor_id and worker_id (supervisor_id may contain dashes)
without_prefix=$(echo "$matching_sessions" | head -n1 | sed 's/^tv-worker-//')
# Extract everything before the last dash as supervisor_id
session_supervisor_id=$(echo "$without_prefix" | sed -E 's/-[^-]+$//')

# Check if supervisor IDs match
if [ "$session_supervisor_id" = "$TV_SUPERVISOR_ID" ]; then
  exit 0  # Supervisor IDs match, allow the command
fi

# Supervisor IDs don't match - block the command
cat <<EOF
{
  "decision": "block",
  "reason": "Worker '$worker_id' belongs to supervisor '$session_supervisor_id', not '$TV_SUPERVISOR_ID'. Supervisors can only dismiss their own workers."
}
EOF

exit 1
