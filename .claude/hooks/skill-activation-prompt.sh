#!/bin/bash
set -e

# shellcheck disable=SC2154
cd "$CLAUDE_PROJECT_DIR/.claude/hooks"
cat | npx tsx skill-activation-prompt.ts
