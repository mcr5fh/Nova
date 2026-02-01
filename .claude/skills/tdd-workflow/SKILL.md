---
name: tdd-workflow
description: Test-Driven Development workflow guidance. Explains how to use failing tests as verification harnesses for code changes. Covers Red-Green-Refactor cycle, writing tests first, bug fixes with TDD, feature development, and ensuring tests fail before implementing changes. Triggers on TDD, test-driven, failing test, red-green, test first keywords.
---

# TDD Workflow

## Purpose

Guide developers through Test-Driven Development (TDD), emphasizing **failing tests as the verification harness** that proves code changes work correctly.

## When to Use This Skill

- Starting new feature development
- Fixing bugs (write failing test first!)
- Refactoring existing code
- When asked about TDD or test-first approaches
- Ensuring code correctness through tests

---

## The Core Principle

> **A test that has never failed provides no guarantee it can detect failure.**

The failing test is not just a step in the process - it IS the verification mechanism. If you write code and a test without ever seeing the test fail, you have no proof the test actually validates your code.

---

## The Red-Green-Refactor Cycle

### 1. RED: Write a Failing Test

```
┌─────────────────────────────────────────────────┐
│  WRITE TEST → RUN TEST → SEE IT FAIL (RED)     │
│                                                 │
│  The failure message tells you:                 │
│  - The test is actually running                 │
│  - The test detects the missing/broken behavior │
│  - What "success" will look like                │
└─────────────────────────────────────────────────┘
```

**Why This Matters:**

- Confirms the test is properly connected
- Validates the test assertion is meaningful
- Documents expected behavior BEFORE implementation
- Creates a "safety net" you can trust

### 2. GREEN: Write Minimal Code to Pass

```
┌─────────────────────────────────────────────────┐
│  WRITE CODE → RUN TEST → SEE IT PASS (GREEN)   │
│                                                 │
│  Rules:                                         │
│  - Write ONLY enough code to pass the test      │
│  - Don't anticipate future requirements         │
│  - Resist the urge to "clean up" yet            │
└─────────────────────────────────────────────────┘
```

**Why Minimal Code:**

- Every line of code is a liability
- Less code = fewer bugs
- Ensures tests drive design, not assumptions

### 3. REFACTOR: Improve Without Changing Behavior

```
┌─────────────────────────────────────────────────┐
│  REFACTOR → RUN TEST → STILL GREEN             │
│                                                 │
│  Safe improvements:                             │
│  - Extract methods/functions                    │
│  - Rename for clarity                           │
│  - Remove duplication                           │
│  - Improve structure                            │
└─────────────────────────────────────────────────┘
```

**The Test Harness Guarantees:**

- Behavior remains unchanged
- Refactoring didn't break anything
- You can confidently restructure code

---

## TDD for Bug Fixes

**The most powerful application of TDD is bug fixing.**

### The Bug Fix Workflow

```
1. REPRODUCE: Understand the bug
   └── What input causes the problem?
   └── What is the incorrect output?
   └── What should happen instead?

2. RED: Write a test that exposes the bug
   └── Test should FAIL with current code
   └── Test should pass when bug is fixed
   └── This proves you've captured the bug

3. GREEN: Fix the bug
   └── Make the minimal change to pass
   └── Run the test - it should pass now

4. VERIFY: The test guards against regression
   └── This bug can NEVER return undetected
   └── The test documents what was wrong
```

### Example: Bug Fix TDD

**Bug:** User signup allows empty email

```python
# Step 1: Write failing test
def test_signup_rejects_empty_email():
    with pytest.raises(ValidationError) as exc:
        signup_user(email="", password="valid123")
    assert "email required" in str(exc.value)

# Step 2: Run test - it FAILS (no validation exists)
# FAILED: signup_user did not raise ValidationError

# Step 3: Add the fix
def signup_user(email: str, password: str) -> User:
    if not email:
        raise ValidationError("email required")
    # ... rest of signup logic

# Step 4: Run test - it PASSES
# The bug is fixed AND can never return
```

---

## TDD for New Features

### Feature Development Workflow

```
1. DEFINE: What should the feature do?
   └── List concrete behaviors
   └── Define inputs and expected outputs

2. SLICE: Break into testable increments
   └── Each slice = one test case
   └── Start with simplest case

3. ITERATE: Red-Green-Refactor for each slice
   └── Write test → See fail → Write code → See pass
   └── Repeat for each behavior
```

### Example: New Feature TDD

**Feature:** Calculate user's workout streak

```python
# Slice 1: No workouts = streak of 0
def test_streak_with_no_workouts():
    user = create_test_user()
    assert calculate_streak(user) == 0

# Run → FAIL (function doesn't exist)
# Implement → PASS

# Slice 2: One workout today = streak of 1
def test_streak_with_workout_today():
    user = create_test_user()
    add_workout(user, date=today())
    assert calculate_streak(user) == 1

# Run → FAIL (returns 0 for all cases)
# Implement → PASS

# Slice 3: Consecutive days increase streak
def test_streak_consecutive_days():
    user = create_test_user()
    add_workout(user, date=today())
    add_workout(user, date=yesterday())
    assert calculate_streak(user) == 2

# Run → FAIL
# Implement → PASS

# Continue for edge cases...
```

---

## The Failing Test Requirement

### Why Tests MUST Fail First

| Without Seeing Failure | With Seeing Failure |
|------------------------|---------------------|
| Test might not run | Confirmed test runs |
| Assertion might be wrong | Assertion verified |
| Test might pass accidentally | Test detects real behavior |
| No confidence in test | Full confidence in test |

### Common Mistakes to Avoid

**WRONG: Write code and test together**

```python
# Writing both at once - did the test ever fail?
def add(a, b):
    return a + b

def test_add():
    assert add(1, 2) == 3  # Did this ever fail? Unknown!
```

**RIGHT: Test first, then code**

```python
# Step 1: Write test
def test_add():
    assert add(1, 2) == 3

# Step 2: Run test → NameError: 'add' not defined (FAIL - good!)

# Step 3: Write minimal implementation
def add(a, b):
    return a + b

# Step 4: Run test → PASS (now we trust it)
```

---

## TDD Best Practices

### 1. Assertions: Same Object vs Separate Actions

**GOOD: Multiple assertions on the same object (validations)**

```python
# Checking multiple attributes of a single created object is fine
def test_user_creation_sets_all_fields():
    user = User(email="TEST@Example.COM", name="John")
    assert user.email == "test@example.com"  # email lowercased
    assert user.name == "John"                # name preserved
    assert user.id is not None                # id generated
```

**SEPARATE: Different actions need different tests**

```python
# Action 1: Creating a user
def test_user_creation():
    user = User(email="test@example.com", name="John")
    assert user.email == "test@example.com"
    assert user.name == "John"

# Action 2: Updating a user (separate action = separate test)
def test_user_update_changes_name():
    user = User(email="test@example.com", name="John")
    user.update(name="Jane")
    assert user.name == "Jane"

# Action 3: Deleting a user (separate action = separate test)
def test_user_delete_marks_inactive():
    user = User(email="test@example.com", name="John")
    user.delete()
    assert user.is_active is False
```

**Rule of thumb:** If it's validating the result of ONE action, multiple assertions are fine. If there are multiple actions, use multiple tests.

### 2. Test Behavior, Not Implementation

```python
# GOOD: Tests what matters to users
def test_checkout_calculates_total():
    cart = Cart([Item(price=10), Item(price=20)])
    assert cart.total == 30

# AVOID: Tests internal details
def test_checkout_uses_reduce():
    cart = Cart([Item(price=10)])
    assert hasattr(cart, '_calculate_with_reduce')
```

### 3. Descriptive Test Names

```python
# GOOD: Name describes scenario and expectation
def test_expired_subscription_denies_premium_features():
    ...

# AVOID: Vague names
def test_subscription():
    ...
```

### 4. Arrange-Act-Assert Pattern

```python
def test_workout_completion_awards_xp():
    # Arrange
    user = create_user(xp=100)
    workout = create_workout(xp_reward=50)

    # Act
    complete_workout(user, workout)

    # Assert
    assert user.xp == 150
```

---

## Quick Reference

### TDD Checklist

- [ ] Write test for desired behavior
- [ ] Run test and **confirm it fails**
- [ ] Note the failure message (this is your target)
- [ ] Write minimal code to pass
- [ ] Run test and confirm it passes
- [ ] Refactor if needed (test still passes)
- [ ] Commit with test and implementation together

### Red-Green-Refactor Mantra

```
RED:    Write a test that fails
GREEN:  Make it pass (minimal code)
REFACTOR: Clean up (tests still pass)
REPEAT: Next behavior
```

### When to Use TDD

| Scenario | TDD Approach |
|----------|--------------|
| Bug fix | Write test exposing bug → Fix → Test passes |
| New feature | Write test for first slice → Implement → Repeat |
| Refactoring | Ensure tests exist → Refactor → Tests still pass |
| Legacy code | Add tests for area you'll change → Then change |

---

## Related Resources

- **Backend Testing**: `poetry run pytest` - Python test runner
- **Frontend Testing**: `npm run test` - Jest test runner
- **CLAUDE.md**: Unit test standards (no if statements in tests)

---

**Remember:** A passing test that never failed is just optimistic documentation. The failing test is your proof.
