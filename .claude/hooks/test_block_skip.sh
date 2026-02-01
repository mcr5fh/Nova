#!/bin/bash
# Test script for block-no-verify.sh SKIP= blocking functionality

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/block-no-verify.sh"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

passed=0
failed=0

test_case() {
  local name="$1"
  local command="$2"
  local should_block="$3"

  # Create test input JSON
  local input
  input=$(cat <<EOF
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "$command"
  }
}
EOF
)

  # Run hook
  local result
  if echo "$input" | "$HOOK" > /dev/null 2>&1; then
    result="allowed"
  else
    result="blocked"
  fi

  # Check result
  if [[ "$should_block" == "yes" && "$result" == "blocked" ]]; then
    echo -e "${GREEN}✓${NC} $name (correctly blocked)"
    passed=$((passed + 1))
  elif [[ "$should_block" == "no" && "$result" == "allowed" ]]; then
    echo -e "${GREEN}✓${NC} $name (correctly allowed)"
    passed=$((passed + 1))
  else
    echo -e "${RED}✗${NC} $name (expected: $should_block, got: $result)"
    failed=$((failed + 1))
  fi
}

echo "Testing block-no-verify.sh SKIP= blocking..."
echo ""

# Test cases that should be BLOCKED
test_case "Block --no-verify" "git commit --no-verify -m 'test'" "yes"
test_case "Block --no-gpg-sign" "git commit --no-gpg-sign -m 'test'" "yes"
test_case "Block SKIP=block-no-verify" "SKIP=block-no-verify git commit -m 'test'" "yes"
test_case "Block SKIP=other" "SKIP=other git commit -m 'test'" "yes"
test_case "Block SKIP=multiple,values" "SKIP=multiple,values git commit -m 'test'" "yes"
test_case "Block SKIP with no value" "SKIP= git commit -m 'test'" "yes"

# Test cases that should be ALLOWED
test_case "Allow normal commit" "git commit -m 'test'" "no"
test_case "Allow git add" "git add ." "no"
test_case "Allow git status" "git status" "no"
test_case "Allow cargo test" "cargo test" "no"
test_case "Allow text with SKIP in it" "echo 'Do not SKIP this'" "no"

echo ""
echo "Results: ${GREEN}${passed} passed${NC}, ${RED}${failed} failed${NC}"

if [[ $failed -gt 0 ]]; then
  exit 1
fi
