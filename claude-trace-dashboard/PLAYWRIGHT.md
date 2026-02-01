# Playwright Visual Testing Setup

This document describes the Playwright setup for visual testing and iteration of the Claude Trace Dashboard.

## Overview

Playwright is configured to capture screenshots of the dashboard's three main visualization views:
- **Tree View**: Hierarchical tree visualization
- **Network View**: Network graph visualization
- **Timeline View**: Timeline flow visualization

## Quick Start

```bash
# Install dependencies (if not already done)
npm install

# Run all screenshot tests
npm run screenshot

# Run with browser visible (recommended for development)
npm run screenshot:headed

# Interactive UI mode (best for debugging)
npm test:ui
```

## Available Scripts

### Basic Testing
- `npm test` - Run all Playwright tests (headless)
- `npm run test:headed` - Run tests with visible browser
- `npm run test:ui` - Open Playwright UI for interactive testing
- `npm run test:debug` - Run tests with debugger

### Screenshot-Specific
- `npm run screenshot` - Capture screenshots of all views (headless)
- `npm run screenshot:headed` - Capture screenshots with visible browser
- `npm run screenshot:update` - Update baseline screenshots

## Usage Patterns

### For Live Development

When iterating on UI changes, use headed mode to see the browser in action:

```bash
npm run screenshot:headed
```

This will:
1. Start the dev server automatically on http://localhost:5173
2. Open a browser window showing each test execution
3. Capture screenshots to `tests/screenshots/`
4. Allow you to see exactly what Playwright sees

### For Visual Regression Testing

Capture baseline screenshots during development:

```bash
npm run screenshot
```

Screenshots are saved to `tests/screenshots/`:
- `tree-view.png` - Hierarchical tree view
- `network-view.png` - Network graph view
- `timeline-view.png` - Timeline flow view

### For Interactive Debugging

Use the Playwright UI mode for the best debugging experience:

```bash
npm test:ui
```

Features:
- Time-travel debugging through test steps
- Visual timeline of all actions
- Inspect DOM at any point in test
- Re-run specific tests
- Watch mode for file changes

## Test Structure

Tests are located in `tests/screenshots/dashboard-views.spec.ts`:

```typescript
test.describe('Dashboard View Screenshots', () => {
  test('capture hierarchical tree view', async ({ page }) => { ... });
  test('capture network view', async ({ page }) => { ... });
  test('capture timeline view', async ({ page }) => { ... });
  test('capture all views in sequence', async ({ page }) => { ... });
});
```

## Configuration

Configuration is in `playwright.config.ts`:

- **Base URL**: http://localhost:5173
- **Browser**: Chromium (Desktop Chrome)
- **Test Directory**: `./tests`
- **Auto-start dev server**: Yes
- **Screenshots on failure**: Yes
- **Trace on retry**: Yes

## Best Practices

1. **Use headed mode during development**: `npm run screenshot:headed`
   - See what's happening in real-time
   - Identify issues immediately
   - Verify visual changes

2. **Use UI mode for debugging**: `npm test:ui`
   - Step through tests
   - Inspect DOM state
   - Identify selector issues

3. **Run headless in CI/CD**: `npm test`
   - Faster execution
   - No visual overhead
   - Consistent results

4. **Commit screenshots for baselines**:
   - Store in `tests/screenshots/`
   - Review changes in PRs
   - Track visual history

## Troubleshooting

### Tests timeout
- Increase timeout in individual tests
- Check if dev server is starting correctly
- Verify network connectivity

### Screenshots are blank
- Ensure dev server is running
- Check if page loaded completely
- Verify view switcher buttons exist

### Wrong view captured
- Check button selectors in test
- Verify ViewSwitcher component labels
- Ensure wait times are sufficient

### Dev server won't start
- Check if port 5173 is available
- Kill existing Vite processes
- Manually start: `npm run dev`

## File Structure

```
claude-trace-dashboard/
├── playwright.config.ts           # Playwright configuration
├── tests/
│   ├── .gitignore                # Ignore test artifacts
│   └── screenshots/
│       ├── README.md             # Screenshot-specific docs
│       ├── dashboard-views.spec.ts  # Test specifications
│       ├── tree-view.png         # Tree view screenshot
│       ├── network-view.png      # Network view screenshot
│       └── timeline-view.png     # Timeline view screenshot
```

## CI/CD Integration

For continuous integration, add to your workflow:

```yaml
- name: Install Playwright Browsers
  run: npx playwright install --with-deps chromium

- name: Run Playwright tests
  run: npm test
  working-directory: claude-trace-dashboard

- name: Upload screenshots
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-screenshots
    path: claude-trace-dashboard/test-results/
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Test](https://playwright.dev/docs/api/class-test)
- [Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [UI Mode](https://playwright.dev/docs/test-ui-mode)
