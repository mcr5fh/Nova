#!/bin/bash

# Unit tests for supervisor-isolation.sh hook
# Run with: ./.claude/hooks/test_supervisor_isolation.sh

set -e

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Path to the hook script
HOOK_SCRIPT="./.claude/hooks/supervisor-isolation.sh"

# Cleanup function to remove test sessions
cleanup_test_sessions() {
    tmux kill-session -t tv-worker-sup-a-test1 2>/dev/null || true
    tmux kill-session -t tv-worker-sup-b-test2 2>/dev/null || true
}

# Test helper
run_test() {
    local test_name="$1"
    local expected_exit="$2"
    local should_contain_block="$3"
    local json_input="$4"
    local env_supervisor_id="$5"

    TESTS_RUN=$((TESTS_RUN + 1))

    # Run the hook with the JSON input
    local output
    local exit_code
    if [ -n "$env_supervisor_id" ]; then
        output=$(export TV_SUPERVISOR_ID="$env_supervisor_id"; echo "$json_input" | bash "$HOOK_SCRIPT" 2>&1) || exit_code=$?
    else
        output=$(unset TV_SUPERVISOR_ID; echo "$json_input" | bash "$HOOK_SCRIPT" 2>&1) || exit_code=$?
    fi
    exit_code=${exit_code:-0}

    local test_passed=true

    # Check exit code
    if [ "$exit_code" -ne "$expected_exit" ]; then
        test_passed=false
    fi

    # Check if output contains "block" if expected
    if [ "$should_contain_block" = "yes" ]; then
        if ! echo "$output" | grep -q '"decision".*:.*"block"'; then
            test_passed=false
        fi
    elif [ "$should_contain_block" = "no" ]; then
        if echo "$output" | grep -q '"decision".*:.*"block"'; then
            test_passed=false
        fi
    fi

    if [ "$test_passed" = true ]; then
        printf "${GREEN}✓${NC} %s\n" "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        printf "${RED}✗${NC} %s\n" "$test_name"
        printf "  Expected exit: %s, Actual: %s\n" "$expected_exit" "$exit_code"
        if [ "$should_contain_block" = "yes" ]; then
            printf "  Expected output to contain block decision\n"
        fi
        printf "  Output: %s\n" "$output"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo "========================================"
echo "Testing supervisor-isolation.sh"
echo "========================================"
echo ""

# Cleanup before starting
cleanup_test_sessions

# ========================================
# Test 1: Allows non-dismiss commands
# ========================================
echo "--- Test 1: Allows non-dismiss commands ---"
json_input='{"tool_input": {"command": "tv list"}}'
run_test "allows tv list command" 0 "no" "$json_input" "sup-a"

json_input='{"tool_input": {"command": "tv spawn \"task\""}}'
run_test "allows tv spawn command" 0 "no" "$json_input" "sup-a"

# ========================================
# Test 2: Allows standalone mode
# ========================================
echo ""
echo "--- Test 2: Allows standalone mode (no TV_SUPERVISOR_ID) ---"
# Create a test session
tmux new-session -d -s tv-worker-sup-a-test1 "sleep 3600"

json_input='{"tool_input": {"command": "tv dismiss test1"}}'
run_test "allows dismiss when TV_SUPERVISOR_ID unset" 0 "no" "$json_input" ""

# Cleanup
cleanup_test_sessions

# ========================================
# Test 3: Allows dismissing own worker
# ========================================
echo ""
echo "--- Test 3: Allows dismissing own worker ---"
# Create a test session for supervisor sup-a
tmux new-session -d -s tv-worker-sup-a-test1 "sleep 3600"

json_input='{"tool_input": {"command": "tv dismiss test1"}}'
run_test "allows dismiss of own worker" 0 "no" "$json_input" "sup-a"

# Cleanup
cleanup_test_sessions

# ========================================
# Test 4: Blocks dismissing other supervisor's worker
# ========================================
echo ""
echo "--- Test 4: Blocks dismissing other supervisor's worker ---"
# Create a test session for supervisor sup-b
tmux new-session -d -s tv-worker-sup-b-test2 "sleep 3600"

json_input='{"tool_input": {"command": "tv dismiss test2"}}'
run_test "blocks dismiss of other supervisor's worker" 1 "yes" "$json_input" "sup-a"

# Cleanup
cleanup_test_sessions

# ========================================
# Test 5: Allows dismiss all
# ========================================
echo ""
echo "--- Test 5: Allows 'dismiss all' ---"
json_input='{"tool_input": {"command": "tv dismiss all"}}'
run_test "allows dismiss all command" 0 "no" "$json_input" "sup-a"

# ========================================
# Test 6: Allows dismiss when no matching session exists
# ========================================
echo ""
echo "--- Test 6: Allows dismiss when no matching session exists ---"
json_input='{"tool_input": {"command": "tv dismiss nonexistent"}}'
run_test "allows dismiss of nonexistent worker" 0 "no" "$json_input" "sup-a"

# ========================================
# Summary
# ========================================
echo ""
echo "========================================"
printf "Tests: %s run, ${GREEN}%s passed${NC}, ${RED}%s failed${NC}\n" "$TESTS_RUN" "$TESTS_PASSED" "$TESTS_FAILED"
echo "========================================"

# Final cleanup
cleanup_test_sessions

if [ "$TESTS_FAILED" -gt 0 ]; then
    exit 1
fi
exit 0
