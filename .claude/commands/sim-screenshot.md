# Simulator Screenshot

Capture a screenshot of the currently running iOS Simulator and analyze it for UI feedback.

## Process

1. **Capture the screenshot:**

   ```bash
   xcrun simctl io booted screenshot /tmp/simulator_screenshot.png
   ```

2. **Read and analyze the image** using the Read tool on `/tmp/simulator_screenshot.png`

3. **Provide feedback** based on context:
   - If the user asked a specific question, answer it based on what you see
   - If working on UI development, describe what you observe and any issues
   - If comparing to a design, note differences or confirm alignment

## Usage Examples

- `/sim-screenshot` - Take screenshot and describe what you see
- `/sim-screenshot what color is the button?` - Take screenshot and answer the question
- `/sim-screenshot does this match the figma?` - Compare current UI to design expectations

## Error Handling

If no simulator is booted, inform the user:

```
No iOS Simulator is currently running. Please start a simulator with:
- `npx expo run:ios` (for Expo apps)
- Or open Xcode and run a simulator directly
```

## Notes

- Screenshots are saved to `/tmp/simulator_screenshot.png` (overwritten each time)
- Works with any booted iOS Simulator
- Supports all simulator device types and orientations
