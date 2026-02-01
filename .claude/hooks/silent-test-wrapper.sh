#!/bin/bash

# PreToolUse hook that wraps test/lint commands with silent runner
# Intercepts Bash tool calls and modifies commands before execution

# Read hook input from stdin
hook_input=$(cat)

# Check if jq is available; if not, allow command unchanged
if ! command -v jq &> /dev/null; then
    exit 0
fi

# Extract the command from tool input (with error handling for malformed JSON)
command=$(echo "$hook_input" | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
description=$(echo "$hook_input" | jq -r '.tool_input.description // empty' 2>/dev/null) || description=""

# If no command, allow unchanged
if [[ -z "$command" ]]; then
    exit 0
fi

# Determine if this is a test or lint command and what type
detect_command_type() {
    local cmd="$1"

    # Test commands
    if [[ "$cmd" =~ (^|[[:space:]]|run[[:space:]])(pytest|py\.test)([[:space:]]|$) ]]; then
        echo "test:pytest"
        return
    fi

    if [[ "$cmd" =~ (^|[[:space:]])(jest|npx[[:space:]]+jest)([[:space:]]|$) ]]; then
        echo "test:jest"
        return
    fi

    if [[ "$cmd" =~ (^|[[:space:]])xcodebuild([[:space:]]|$).*test ]]; then
        echo "test:xcodebuild"
        return
    fi

    if [[ "$cmd" =~ npm[[:space:]]+(run[[:space:]]+)?test([[:space:]]|:|$) ]]; then
        echo "test:jest"  # Assume jest for npm test
        return
    fi


    # Lint commands
    if [[ "$cmd" =~ (^|[[:space:]]|run[[:space:]])(ruff|pylint|flake8)([[:space:]]|$) ]]; then
        echo "lint:python"
        return
    fi

    if [[ "$cmd" =~ (^|[[:space:]]|run[[:space:]])(mypy|pyrefly|pyright)([[:space:]]|$) ]]; then
        echo "lint:typecheck"
        return
    fi

    if [[ "$cmd" =~ (^|[[:space:]])(eslint|npx[[:space:]]+eslint)([[:space:]]|$) ]]; then
        echo "lint:eslint"
        return
    fi

    if [[ "$cmd" =~ npm[[:space:]]+(run[[:space:]]+)?lint([[:space:]]|:|$) ]]; then
        echo "lint:eslint"
        return
    fi

    if [[ "$cmd" =~ (^|[[:space:]])(tsc|npx[[:space:]]+tsc)([[:space:]]|$).*--noEmit ]]; then
        echo "lint:typecheck"
        return
    fi

    if [[ "$cmd" =~ npm[[:space:]]+(run[[:space:]]+)?typecheck([[:space:]]|:|$) ]]; then
        echo "lint:typecheck"
        return
    fi

    # Not a test/lint command
    echo "none"
}

# Generate a short description from the command if none provided
generate_description() {
    local cmd="$1"
    local type="$2"

    # If description was provided by agent, use it (but shorten if needed)
    if [[ -n "$description" && "$description" != "null" ]]; then
        # Truncate to 50 chars max
        echo "${description:0:50}"
        return
    fi

    # Generate from command
    case "$type" in
        test:pytest)    echo "pytest" ;;
        test:jest)      echo "jest tests" ;;
        test:xcodebuild) echo "swift tests" ;;
        lint:python)    echo "python lint" ;;
        lint:typecheck) echo "type check" ;;
        lint:eslint)    echo "eslint" ;;
        *)              echo "command" ;;
    esac
}

# Detect command type
cmd_type=$(detect_command_type "$command")

# If not a test/lint command, allow unchanged
if [[ "$cmd_type" == "none" ]]; then
    exit 0
fi

# Parse type category and specific type
category=$(echo "$cmd_type" | cut -d: -f1)
specific_type=$(echo "$cmd_type" | cut -d: -f2)

# Generate description
desc=$(generate_description "$command" "$cmd_type")

# Escape both command and description for embedding in bash string
# Replace single quotes with escaped version
escaped_command=$(echo "$command" | sed "s/'/'\\\\''/g")
escaped_desc=$(echo "$desc" | sed "s/'/'\\\\''/g")

# Resolve project directory at hook time
# Try CLAUDE_PROJECT_DIR first, then git root, then pwd as last resort
if [[ -n "$CLAUDE_PROJECT_DIR" ]]; then
    project_dir="$CLAUDE_PROJECT_DIR"
elif git rev-parse --show-toplevel &>/dev/null; then
    project_dir=$(git rev-parse --show-toplevel)
else
    project_dir=$(pwd)
fi

script_path="$project_dir/scripts/run_silent.sh"

# Verify the script exists; if not, allow command unchanged
if [[ ! -f "$script_path" ]]; then
    exit 0
fi

# Build the wrapped command with resolved path
if [[ "$category" == "test" ]]; then
    wrapped_command="source '$script_path' && run_silent_with_test_count '$escaped_desc' '$escaped_command' '$specific_type'"
else
    wrapped_command="source '$script_path' && run_silent_lint '$escaped_desc' '$escaped_command'"
fi

# Return JSON with modified command
# Using jq to properly escape the wrapped command for JSON
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": {
      "command": $(echo "$wrapped_command" | jq -R .)
    }
  }
}
EOF

exit 0
