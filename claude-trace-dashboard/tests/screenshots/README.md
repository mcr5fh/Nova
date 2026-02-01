# Dashboard Screenshot Automation

This directory contains Playwright tests for capturing screenshots of different dashboard views for visual testing and iteration.

## Available Views

The dashboard has three main visualization views:
- **Tree View**: Hierarchical tree visualization
- **Network View**: Network graph visualization
- **Timeline View**: Timeline flow visualization

## Usage

### Quick Start

```bash
# Run all screenshot tests (headless)
npm run screenshot

# Run with headed browser for live iteration
npm run screenshot:headed

# Run with Playwright UI mode (recommended for debugging)
npm test:ui

# Debug mode (step through tests)
npm test:debug
```

### All Available Scripts

```bash
# Run all Playwright tests
npm test

# Run tests in headed mode (see the browser)
npm run test:headed

# Open Playwright UI for interactive testing
npm run test:ui

# Debug tests with debugger
npm run test:debug

# Capture screenshots only
npm run screenshot

# Capture screenshots in headed mode (watch it happen)
npm run screenshot:headed

# Update baseline screenshots
npm run screenshot:update
```

## Screenshots Location

Screenshots are saved to `tests/screenshots/` with the following naming:
- `tree-view.png` - Hierarchical tree view
- `network-view.png` - Network graph view
- `timeline-view.png` - Timeline flow view
- `sequence-*.png` - Sequential capture of all views

## Live Iteration

For live development and iteration, use headed mode:

```bash
npm run screenshot:headed
```

This will:
1. Start the dev server automatically
2. Open a browser window where you can see the tests running
3. Capture screenshots of each view
4. Useful for verifying visual changes during development

## Tips

- Use `--headed` flag to see the browser and watch tests execute
- Use `--ui` flag for interactive mode with time-travel debugging
- Use `--debug` flag to step through tests line by line
- Screenshots are automatically captured on test runs
- The dev server starts automatically when running tests
