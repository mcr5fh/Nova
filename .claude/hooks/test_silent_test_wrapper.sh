#!/bin/bash

# Unit tests for silent-test-wrapper.sh command detection
# Run with: ./.claude/hooks/test_silent_test_wrapper.sh

set -e

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Copy of detect_command_type function from silent-test-wrapper.sh for testing
# Keep in sync with the main hook file
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

# Test helper
assert_detection() {
    local command="$1"
    local expected="$2"
    local test_name="$3"

    TESTS_RUN=$((TESTS_RUN + 1))
    local actual
    actual=$(detect_command_type "$command")

    if [ "$actual" = "$expected" ]; then
        printf "${GREEN}✓${NC} %s\n" "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        printf "${RED}✗${NC} %s\n" "$test_name"
        printf "  Command:  %s\n" "$command"
        printf "  Expected: %s\n" "$expected"
        printf "  Actual:   %s\n" "$actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo "========================================"
echo "Testing silent-test-wrapper.sh detection"
echo "========================================"
echo ""

# ========================================
# pytest detection
# ========================================
echo "--- pytest detection ---"
assert_detection "pytest" "test:pytest" "bare pytest"
assert_detection "pytest backend/src/tests/" "test:pytest" "pytest with path"
assert_detection "pytest -x backend/src/tests/" "test:pytest" "pytest with flags"
assert_detection "poetry run pytest" "test:pytest" "poetry run pytest"
assert_detection "poetry run pytest -x" "test:pytest" "poetry run pytest with flags"

# ========================================
# jest detection
# ========================================
echo ""
echo "--- jest detection ---"
assert_detection "jest" "test:jest" "bare jest"
assert_detection "jest --bail" "test:jest" "jest with flags"
assert_detection "npx jest" "test:jest" "npx jest"
assert_detection "npm test" "test:jest" "npm test"
assert_detection "npm run test" "test:jest" "npm run test"
assert_detection "npm run test:unit" "test:jest" "npm run test:unit"

# ========================================
# xcodebuild detection
# ========================================
echo ""
echo "--- xcodebuild detection ---"
assert_detection "xcodebuild test -scheme MyApp" "test:xcodebuild" "xcodebuild test"
assert_detection "xcodebuild -scheme MyApp test" "test:xcodebuild" "xcodebuild with scheme before test"
assert_detection "xcodebuild -workspace MyApp.xcworkspace -scheme MyApp test" "test:xcodebuild" "xcodebuild full command"

# ========================================
# lint detection - python
# ========================================
echo ""
echo "--- python lint detection ---"
assert_detection "ruff check ." "lint:python" "ruff check"
assert_detection "poetry run ruff check ." "lint:python" "poetry run ruff"
assert_detection "ruff format --check ." "lint:python" "ruff format check"
assert_detection "pylint src/" "lint:python" "pylint"
assert_detection "flake8 src/" "lint:python" "flake8"

# ========================================
# lint detection - typecheck
# ========================================
echo ""
echo "--- typecheck detection ---"
assert_detection "mypy ." "lint:typecheck" "mypy"
assert_detection "poetry run mypy ." "lint:typecheck" "poetry run mypy"
assert_detection "pyrefly check" "lint:typecheck" "pyrefly"
assert_detection "poetry run pyrefly check" "lint:typecheck" "poetry run pyrefly"
assert_detection "pyright" "lint:typecheck" "pyright"
assert_detection "tsc --noEmit" "lint:typecheck" "tsc --noEmit"
assert_detection "npx tsc --noEmit" "lint:typecheck" "npx tsc --noEmit"
assert_detection "npm run typecheck" "lint:typecheck" "npm run typecheck"

# ========================================
# lint detection - eslint
# ========================================
echo ""
echo "--- eslint detection ---"
assert_detection "eslint ." "lint:eslint" "eslint"
assert_detection "eslint src/" "lint:eslint" "eslint with path"
assert_detection "npx eslint ." "lint:eslint" "npx eslint"
assert_detection "npm run lint" "lint:eslint" "npm run lint"
assert_detection "npm lint" "lint:eslint" "npm lint"

# ========================================
# non-matching commands
# ========================================
echo ""
echo "--- non-matching commands ---"
assert_detection "git status" "none" "git status"
assert_detection "ls -la" "none" "ls"
assert_detection "cat file.txt" "none" "cat"
assert_detection "npm install" "none" "npm install"
assert_detection "poetry install" "none" "poetry install"
assert_detection "echo test" "none" "echo"
assert_detection "xcodebuild build" "none" "xcodebuild build (not test)"
assert_detection "tsc" "none" "tsc without --noEmit"

# ========================================
# Summary
# ========================================
echo ""
echo "========================================"
printf "Tests: %s run, ${GREEN}%s passed${NC}, ${RED}%s failed${NC}\n" "$TESTS_RUN" "$TESTS_PASSED" "$TESTS_FAILED"
echo "========================================"

if [ "$TESTS_FAILED" -gt 0 ]; then
    exit 1
fi
exit 0
