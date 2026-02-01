---
name: sim-screenshot
description: Capture iOS Simulator screenshots for visual UI feedback. Use when working on UI components, verifying layout changes, or debugging visual issues. Triggers on UI verification requests, layout checks, and component styling work.
---

# Simulator Screenshot

Fast visual feedback loop for iOS UI development by capturing and analyzing simulator screenshots.

## When to Use

This skill activates when:

- Working on React Native or SwiftUI components
- User asks to verify how something looks
- Debugging layout or styling issues
- Comparing implementation to designs

## Quick Reference

**Slash command:** `/sim-screenshot`

**Manual execution:**

```bash
xcrun simctl io booted screenshot /tmp/simulator_screenshot.png
```

Then read `/tmp/simulator_screenshot.png` with the Read tool.

## Workflow

1. **Capture** - Take screenshot of booted simulator
2. **Analyze** - Read the image and describe what you see
3. **Feedback** - Provide specific observations about:
   - Layout correctness
   - Spacing and alignment
   - Color and styling
   - Component visibility
   - Any visual issues

## Proactive Usage

When editing UI files, consider offering to take a screenshot:

- After making styling changes
- When user mentions something "looks wrong"
- Before and after layout modifications
- When comparing to Figma designs

## Error States

**No simulator running:**

```
No iOS Simulator is currently running. Start one with:
- `npx expo run:ios` (Expo)
- Open Xcode and run a simulator
```

**Multiple simulators:**
The `booted` keyword captures the most recently interacted simulator. If multiple are running, specify device UUID instead.

## Integration with Other Skills

- **visual-tdd-workflow** - Use screenshots to verify snapshot test results
- **swift-development** - Verify SwiftUI component appearance
- **frontend-dev-guidelines** - Check React Native component styling
