---
name: visual-tdd-workflow
description: Visual TDD workflow for SwiftUI development using swift-snapshot-testing with PNG format and XCTest. Guides agent through snapshot-based UI iteration with image comparison, beads issue tracking, and human-in-the-loop checkpoints. PNG format enables inline diff viewing in GitHub PRs and Xcode Report Navigator. All snapshots use iPhone 16 device configuration. Triggers on snapshot, visual TDD, UI iteration, SwiftUI component, reference image keywords.
---

# Visual TDD Workflow for SwiftUI

## Purpose

Guide agents through Test-Driven Development of SwiftUI UI components using snapshot testing with PNG format. The agent iterates on visual output by reading and comparing images until the rendered component matches the reference.

## Image Format

All snapshots use **PNG format** for maximum compatibility:

- GitHub renders inline diffs in PRs
- Xcode Report Navigator shows attachments via XCTest
- Device: **iPhone 16** (393x852 @3x)
- Color scheme: **Dark mode** (default)

## When to Use This Skill

- Implementing new SwiftUI components from Figma designs
- Iterating on UI appearance based on human feedback
- Visual regression testing during refactoring
- When asked to "make it look like" a reference image

---

## The Visual TDD Cycle

```
┌─────────────────────────────────────────────────────────────────┐
│  REFERENCE    →    RED         →    GREEN     →    APPROVE      │
│  (Establish       (Snapshot        (Agent         (Human        │
│   target)          mismatch)        iterates)      reviews)     │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1: Establish Reference

**From Figma:**

```
Use mcp__figma__get_screenshot with fileKey and nodeId
Save to: Tests/__Snapshots__/ComponentTests/testName.png
```

**From File:**

```
Human provides path to reference image
Copy to: Tests/__Snapshots__/ComponentTests/testName.png
```

**From Prompt (Iterative):**

```
Human describes desired appearance
Agent generates initial version
Run test with record: .all to capture as reference
Human approves or provides feedback
```

### Step 2: Create Beads Issue

```bash
bd create --title="Visual TDD: ComponentName" --type=feature --priority=2
```

Note the issue ID (e.g., hyb-abc) for linking iterations.

### Step 3: Write Snapshot Test

```swift
import HybrdCoreTestSupport
import SnapshotTesting
import SwiftUI
import XCTest

@testable import HybrdDesign

final class ComponentNameSnapshotTests: XCTestCase {

    @MainActor func testDefaultState() {
        let view = ComponentName(/* props */)
            .frame(width: 300, height: 100)

        assertSnapshot(of: view, as: .standardImage)
    }
}
```

**Available snapshot strategies (from HybrdCoreTestSupport):**

- `.standardImage` - iPhone 16, dark mode, PNG format (default)
- `.standardImage(precision:perceptualPrecision:)` - Custom tolerance

### Step 4: Implement and Iterate

**Create iteration issue:**

```bash
bd create --title="Iteration 1: Initial implementation" --type=task --priority=3
bd dep add <iteration-id> <parent-id>
bd update <iteration-id> --status in_progress
```

**Run test via Xcode:**

- Build for iOS target (iPhone 16 simulator)
- Run tests from Test Navigator
- View diff attachments in Report Navigator on failure

**If test fails, analyze the images:**

1. Reference: `__Snapshots__/.../testName.png`
2. Failure: `__Snapshots__/.../testName.1.png`
3. View diff in Xcode Report Navigator (XCTest attachments)

**Analyze differences visually:**

- Describe what you see in each image
- Identify specific mismatches (colors, spacing, fonts, layout)
- Plan targeted fixes

**Make changes and re-run:**

- Edit the SwiftUI component
- Run test again
- Repeat until pass OR 5+ iterations without progress

### Step 5: Complete or Escalate

**On success:**

```bash
bd close <iteration-id>
bd close <parent-id> --reason="Snapshot matches reference within tolerance"
```

**When stuck:**

- Document what you've tried in beads issue
- Ask human for guidance
- Human may provide new reference or adjust requirements

---

## Xcode Diff Viewing

XCTest provides built-in support for viewing snapshot diffs:

1. Run snapshot tests in Xcode
2. On failure, open **Report Navigator** (Cmd+9)
3. Select the failed test
4. View attachments showing reference, actual, and diff images

This is why we use XCTest instead of Swift Testing - XCTest attachments appear in the Report Navigator while Swift Testing doesn't support this yet.

---

## Stacked Variant Testing

For efficiency, stack multiple component states in a single test:

```swift
@MainActor func testAllVariants() {
    let view = VariantStack {
        LabeledVariant("Default") {
            MyButton(title: "Tap Me") {}
        }

        LabeledVariant("Disabled") {
            MyButton(title: "Tap Me") {}
                .disabled(true)
        }

        LabeledVariant("Loading") {
            MyButton(title: "Tap Me", isLoading: true) {}
        }
    }
    .frame(width: 350)

    assertSnapshot(of: view, as: .standardImage)
}
```

`VariantStack` and `LabeledVariant` are provided by `HybrdCoreTestSupport`.

---

## Beads Integration

Each visual TDD session creates:

- **Parent issue**: The component being developed
- **Child issues**: Each iteration attempt

This provides:

- Full history of what was tried
- Traceability from design to implementation
- Clear handoff points for human review

**View iteration history:**

```bash
bd show <parent-id>
```

---

## Tolerance Configuration

Default thresholds (adjustable per test):

- **Pixel precision**: 98% (2% of pixels can differ)
- **Perceptual precision**: 95% (allows anti-aliasing variance)

For stricter matching:

```swift
assertSnapshot(of: view, as: .standardImage(precision: 1.0, perceptualPrecision: 1.0))
```

For looser matching (early iterations):

```swift
assertSnapshot(of: view, as: .standardImage(precision: 0.90, perceptualPrecision: 0.85))
```

---

## Exit Conditions

**Success**: Snapshot test passes within tolerance

**Human checkpoint**:

- 5+ iterations without convergence
- Agent uncertain about design intent
- Significant architectural decision needed

**Failure modes to watch:**

- Infinite loop of minor adjustments
- Fundamentally wrong approach
- Missing design context

---

## Quick Reference

```bash
# Start visual TDD session
bd create --title="Visual TDD: ButtonName" --type=feature --priority=2

# Run snapshot tests in Xcode
# Use Test Navigator, target iPhone 16 simulator

# Complete iteration
bd close <iteration-id>

# View full history
bd show <parent-id>
```

---

## Related Resources

- [swift-snapshot-testing](https://github.com/pointfreeco/swift-snapshot-testing)
- TDD Workflow skill for general TDD patterns
- Swift Development skill for SwiftUI patterns
