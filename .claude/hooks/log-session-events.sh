#!/bin/bash
# Simple hook to log SessionEnd events to .debug/ for inspection

# Log directory
LOG_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.debug/session-events"
mkdir -p "$LOG_DIR"

# Read the event JSON from stdin
EVENT_JSON=$(cat)

# Generate timestamp-based filename
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
LOG_FILE="$LOG_DIR/session-end-${TIMESTAMP}.json"

# Write event to timestamped file
echo "$EVENT_JSON" | jq '.' > "$LOG_FILE" 2>/dev/null || echo "$EVENT_JSON" > "$LOG_FILE"

exit 0
