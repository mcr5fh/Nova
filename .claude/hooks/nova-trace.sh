#!/bin/bash
set -e

# Nova trace hook - captures all hook events and writes them to JSONL traces
# This hook can be used for PreToolUse, PostToolUse, or UserPromptSubmit

# Get the project directory
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Path to nova-go binary (prefer local build, fallback to installed)
NOVA_GO_BIN="$PROJECT_DIR/bin/nova-go"
if [[ ! -x "$NOVA_GO_BIN" ]]; then
    NOVA_GO_BIN="$(command -v nova-go 2>/dev/null || echo "")"
fi

# Exit silently if nova-go is not available
if [[ ! -x "$NOVA_GO_BIN" ]]; then
    exit 0
fi

# Read hook event from stdin and pass to nova-go trace
cat | "$NOVA_GO_BIN" trace

# Exit cleanly
exit 0
