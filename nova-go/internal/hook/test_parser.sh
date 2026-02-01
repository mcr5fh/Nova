#!/bin/bash
# Manual integration test for hook parser

set -e

echo "Testing hook parser..."
echo

# Get the script directory and navigate to project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Create a simple Go program to test the parser in the project directory
cat > "$PROJECT_ROOT/cmd/test_parser_temp.go" <<'EOF'
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"github.com/mattruiters/nova/nova-go/internal/hook"
)

func main() {
	input, err := hook.ParseInput(os.Stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	output, _ := json.MarshalIndent(input, "", "  ")
	fmt.Println(string(output))
}
EOF

# Build the test program
cd "$PROJECT_ROOT"
go build -o /tmp/test_parser "$PROJECT_ROOT/cmd/test_parser_temp.go"

echo "Test 1: Valid PreToolUse event"
echo '{"session_id":"abc123","hook_event_name":"PreToolUse","tool_name":"Read","cwd":"/tmp"}' | /tmp/test_parser
echo

echo "Test 2: Valid PostToolUse event with tool output"
echo '{"session_id":"xyz789","hook_event_name":"PostToolUse","tool_name":"Bash","tool_output":{"exit_code":0},"cwd":"/home"}' | /tmp/test_parser
echo

echo "Test 3: Valid UserPromptSubmit event"
echo '{"session_id":"test456","hook_event_name":"UserPromptSubmit","prompt":"hello world","cwd":"/workspace"}' | /tmp/test_parser
echo

echo "Test 4: Missing session_id (should fail)"
if echo '{"hook_event_name":"PreToolUse"}' | /tmp/test_parser 2>&1; then
	echo "ERROR: Should have failed but didn't"
	exit 1
else
	echo "✓ Correctly rejected invalid input"
fi
echo

echo "Test 5: Missing hook_event_name (should fail)"
if echo '{"session_id":"test"}' | /tmp/test_parser 2>&1; then
	echo "ERROR: Should have failed but didn't"
	exit 1
else
	echo "✓ Correctly rejected invalid input"
fi
echo

# Cleanup
rm -f /tmp/test_parser "$PROJECT_ROOT/cmd/test_parser_temp.go"

echo "All tests passed!"
