---
name: ears-requirements
description: Write requirements and design specifications using EARS (Easy Approach to Requirements Syntax) format. Use when writing requirements, creating specifications, documenting system behavior, defining constraints, or converting informal descriptions to structured requirements. Covers EARS patterns (ubiquitous, event-driven, state-driven, optional, unwanted), requirement structure, and best practices for clear, testable requirements.
---

# EARS Requirements Writing

## Purpose

Guide for writing clear, structured requirements using EARS (Easy Approach to Requirements Syntax), a proven approach for creating unambiguous, testable system requirements.

## When to Use

Automatically activates when you mention:

- Writing requirements
- Creating specifications
- EARS format
- System behavior documentation
- Requirement patterns
- Converting descriptions to requirements
- Functional specifications

## What is EARS

EARS (Easy Approach to Requirements Syntax) is a structured approach to writing requirements developed by Alistair Mavin at Rolls-Royce. It uses five requirement patterns to create clear, unambiguous requirements.

**Reference**: See `EARS_REFERENCE.md` in this directory for the distilled core methodology from the official source.

## EARS Requirement Patterns

### 1. Ubiquitous Requirements

**Pattern**: `The <system> SHALL <action>`

**When to Use**: Always-active requirements with no conditions

**Examples**:

```
The system SHALL validate all user inputs before processing.
The training plan generator SHALL support plans from 4 to 52 weeks.
The API SHALL return responses within 500ms for 95% of requests.
```

**Key Aspects**:

- No conditions or triggers
- Always enforced
- System-wide behavior
- Use for fundamental rules

### 2. Event-Driven Requirements

**Pattern**: `WHEN <trigger event>, the <system> SHALL <action>`

**When to Use**: Requirements triggered by specific events

**Examples**:

```
WHEN a user submits a workout log, the system SHALL validate exercise names against the database.
WHEN the training phase changes to PEAK, the system SHALL increase workout intensity to 100%.
WHEN a user's 1RM benchmark is updated, the system SHALL recalculate all future workout weights.
```

**Key Aspects**:

- Triggered by specific events
- Clear cause and effect
- Single trigger per requirement
- Action happens in response to event

### 3. State-Driven Requirements

**Pattern**: `WHILE <in state>, the <system> SHALL <action>`

**When to Use**: Requirements that apply during specific system states

**Examples**:

```
WHILE a training plan is in PREPARATION phase, the system SHALL use 20% of the bounds range for interpolation.
WHILE processing a workout template, the system SHALL apply phase adjustment strategy to all bounded parameters.
WHILE in DELOAD phase, the system SHALL always use the lower bound for all exercises.
```

**Key Aspects**:

- Continuous behavior during a state
- State is a condition, not an event
- Behavior persists while state is active
- Use for ongoing requirements

### 4. Optional Feature Requirements

**Pattern**: `WHERE <optional feature is included>, the <system> SHALL <action>`

**When to Use**: Requirements for optional or configurable features

**Examples**:

```
WHERE warmup sets are enabled, the system SHALL generate 1-4 warmup sets based on working weight percentage.
WHERE the user has premium subscription, the system SHALL provide AI-powered workout recommendations.
WHERE custom exercise library is available, the system SHALL match user exercises against custom library first.
```

**Key Aspects**:

- Feature may or may not be present
- Requirement only applies if feature exists
- Use for optional capabilities
- Clear feature boundary

### 5. Unwanted Behavior Requirements

**Pattern**: `IF <unwanted condition>, THEN the <system> SHALL <action>`

**When to Use**: Error handling, edge cases, prevention

**Examples**:

```
IF a workout duration exceeds 3 hours, THEN the system SHALL display a warning to the user.
IF phase interpolation results in fewer than 1 rep, THEN the system SHALL round up to 1 rep minimum.
IF user 1RM benchmark is missing, THEN the system SHALL use bodyweight estimate or skip the exercise.
```

**Key Aspects**:

- Describes what should NOT happen
- Includes mitigation action
- Error handling and validation
- Edge case coverage

## Advanced Pattern: Complex Requirements

**Pattern**: `WHEN <event>, IF <condition>, THEN the <system> SHALL <action>`

**When to Use**: Requirements with both trigger and condition

**Examples**:

```
WHEN a training plan is generated, IF the user has fewer than 3 days available, THEN the system SHALL suggest a modified plan template.

WHEN calculating workout weight, IF the exercise is marked as perHand=true, THEN the system SHALL double the calculated weight value.

WHEN processing an interval workout, IF the segment type is DELOAD, THEN the system SHALL reduce repetitions by 50%.
```

## Writing Clear Requirements

### DO

✅ Use SHALL (mandatory), SHOULD (recommended), MAY (optional)
✅ Be specific and measurable
✅ One requirement per statement
✅ Use active voice
✅ Define clear conditions
✅ Include acceptance criteria
✅ Make requirements testable

### DON'T

❌ Use vague terms (e.g., "handle", "process", "deal with")
❌ Combine multiple requirements in one statement
❌ Use "etc.", "and/or", "TBD"
❌ Assume implicit knowledge
❌ Use passive voice
❌ Leave conditions undefined
❌ Write untestable requirements

## Strength Training Requirements Example

### ME (Maximum Effort) Workout Type

```
# Ubiquitous
The ME workout type SHALL target 1-5 reps at 90-100% of 1RM intensity.

# State-Driven
WHILE in PREPARATION phase, the ME workout SHALL use 5 reps at 90% intensity with 2 sets.
WHILE in BUILD phase, the ME workout SHALL use 3 reps at 92% intensity with 3 sets.
WHILE in PEAK phase, the ME workout SHALL use 2 reps at 95% intensity with 3 sets.
WHILE in DELOAD phase, the ME workout SHALL use 1 rep at 95% intensity with 1 set.

# Event-Driven
WHEN phase adjustment is applied to ME workout, the system SHALL prioritize intensity increase over volume increase.

# Unwanted
IF calculated reps exceed 5 for ME workout, THEN the system SHALL cap reps at 5 and log a warning.
```

### HYP (Hypertrophy) Workout Type

```
# Ubiquitous
The HYP workout type SHALL target 6-12 reps with 0-2 RIR (Reps In Reserve).

# State-Driven
WHILE in PREPARATION phase, the HYP workout SHALL use 10 reps with 3 sets.
WHILE in BUILD phase, the HYP workout SHALL use 10 reps with 4 sets.
WHILE in PEAK phase, the HYP workout SHALL use 12 reps with 4 sets.
WHILE in DELOAD phase, the HYP workout SHALL use 8 reps with 3 sets.

# Event-Driven
WHEN phase adjustment is applied to HYP workout, the system SHALL prioritize volume (sets) increase over intensity increase.

# Unwanted
IF calculated reps fall below 6 for HYP workout, THEN the system SHALL increase reps to minimum 6.
```

## Cardio Interval Requirements Example

### Interval Training Progression

```
# Ubiquitous
The interval training progression SHALL increase number of intervals (sets) as primary progression method.

# State-Driven
WHILE in PREPARATION phase, the system SHALL use 3 intervals at 84-87% pace with 3:00 rest.
WHILE in BUILD phase, the system SHALL use 4-5 intervals at 84-87% pace with 3:00 rest.
WHILE in PEAK phase, the system SHALL use 6 intervals at 84-87% pace with 3:00 rest.
WHILE in DELOAD phase, the system SHALL use 2-3 intervals at 84-87% pace with 3:00 rest.

# Event-Driven
WHEN phase adjustment is applied to interval workout, the system SHALL increase repetitions (number of intervals) while keeping pace percentage relatively constant.

# Optional Feature
WHERE pace multiplier bounds are provided, the system SHALL apply conservative pace progression as secondary progression method.

# Unwanted
IF calculated intervals exceed 12 for single workout, THEN the system SHALL split into multiple interval segments with recovery between.
```

## Requirement Organization

### Hierarchical Structure

**System Level** → **Subsystem Level** → **Component Level**

**Example**:

```
SYSTEM: Training Plan Generation
  SUBSYSTEM: Phase Adjustment Strategy
    COMPONENT: Strength Exercise Converter
      REQUIREMENT: WHEN converting strength exercise, the system SHALL apply phase-adjusted values...
```

### Grouping by Pattern Type

Organize requirements document by pattern type for clarity:

1. **Ubiquitous Requirements** - Fundamental rules
2. **Event-Driven Requirements** - Triggered behaviors
3. **State-Driven Requirements** - Phase-specific rules
4. **Optional Features** - Conditional capabilities
5. **Unwanted Behaviors** - Error handling

## Traceability

Link requirements to implementation:

```
REQ-001: WHEN a user submits a workout log, the system SHALL validate exercise names.
IMPLEMENTATION: backend/src/hercules/service/workout_logger.py:validate_exercise_names()
TEST: backend/src/tests/service/test_workout_logger.py:test_exercise_validation()
```

## Verification Criteria

Each requirement should have clear verification method:

- **Inspection**: Code review, documentation review
- **Analysis**: Mathematical proof, simulation
- **Test**: Unit test, integration test, system test
- **Demonstration**: User acceptance test

**Example**:

```
REQUIREMENT: WHEN phase changes to BUILD, the system SHALL use 60% interpolation factor.
VERIFICATION: Test (unit test)
TEST CASE: test_build_phase_interpolation_factor()
EXPECTED: interpolation_factor == 0.6
```

## Common Patterns Library

### Validation Requirements

```
WHEN <input is received>, the system SHALL validate <input> against <criteria>.
IF <validation fails>, THEN the system SHALL <error action>.
```

### Calculation Requirements

```
WHEN <condition>, the system SHALL calculate <value> using <formula>.
The calculated <value> SHALL be between <min> and <max>.
```

### State Transition Requirements

```
WHEN <event occurs>, the system SHALL transition from <state A> to <state B>.
WHILE in <state>, the system SHALL <behavior>.
```

### Configuration Requirements

```
WHERE <feature is enabled>, the system SHALL <action>.
The <system> SHALL allow users to configure <parameter> within <range>.
```

## Converting Informal to EARS

### Before (Informal)

"The system handles workout progression through training phases."

### After (EARS)

```
WHILE in PREPARATION phase, the system SHALL use 20% of bounds range for workout parameters.
WHILE in BUILD phase, the system SHALL use 60% of bounds range for workout parameters.
WHILE in PEAK phase, the system SHALL use 100% of bounds range for workout parameters.
WHEN phase transition occurs, the system SHALL interpolate smoothly from previous phase end to new phase target.
```

### Before (Informal) - ME Workouts

"ME workouts are heavy with low reps."

### After (EARS) - ME Workouts

```
The ME workout type SHALL target maximum effort with 1-5 reps at 90-100% of 1RM.
WHILE in PEAK phase, the ME workout SHALL use 2 reps at 95% intensity with 3 sets.
WHEN adjusting ME workout across phases, the system SHALL prioritize intensity progression over volume progression.
IF user cannot complete prescribed ME reps, THEN the system SHALL suggest reducing weight by 5%.
```

## Best Practices Summary

### Structure

- One requirement per statement
- Clear subject (system/component)
- Specific action (SHALL/SHOULD/MAY)
- Measurable outcome

### Clarity

- Use EARS pattern keywords (WHEN, WHILE, WHERE, IF-THEN)
- Define all conditions explicitly
- Avoid ambiguous terms
- Include units and ranges

### Testability

- Every requirement must be verifiable
- Include acceptance criteria
- Link to test cases
- Define expected behavior

### Completeness

- Cover normal operation (ubiquitous, event-driven, state-driven)
- Cover optional features (WHERE)
- Cover error cases (IF-THEN unwanted)
- Include edge cases

## Quick Reference

| Pattern | Keyword | Use Case | Example |
|---------|---------|----------|---------|
| Ubiquitous | SHALL | Always-active | The system SHALL validate inputs |
| Event-Driven | WHEN | Triggered by event | WHEN user submits, system SHALL process |
| State-Driven | WHILE | During specific state | WHILE in PEAK phase, system SHALL use 100% |
| Optional | WHERE | Conditional feature | WHERE premium enabled, system SHALL provide AI |
| Unwanted | IF-THEN | Error handling | IF timeout occurs, THEN system SHALL retry |

## Related Resources

- EARS Official: <https://alistairmavin.com/ears/>
- Research Papers: Search "EARS requirements" on ResearchGate
- INCOSE EARS Guide: <https://www.incose.org>

---

**Skill Status**: Complete
**Line Count**: < 500 lines ✅
**Coverage**: All 5 EARS patterns, examples, best practices
