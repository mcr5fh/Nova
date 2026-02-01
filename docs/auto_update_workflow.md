# Auto-Update Workflow

## Overview

The auto-update workflow orchestrates the complete process of ingesting Claude Code session transcripts, detecting active system prompts, and updating prompts based on analysis findings.

## Components

### 1. Session Ingestion (`ingest.py`)
- Imports Claude Code JSONL transcript files into the Nova database
- Extracts session metadata and human messages
- Supports single files or batch processing of directories

### 2. Prompt Detection (`program_nova/prompt_detector.py`)
- Detects which system prompts were active during a session
- Analyzes `.claude/prompts/` directory and common prompt locations
- Extracts project directory from transcript JSONL file
- **Status**: Not yet implemented (Phase 2: Nova-t34z.2)

### 3. Prompt Updates (`update_prompt.py`)
- Aggregates planning failure analyses from the database
- Sends current prompt + findings to Claude API for improvement
- Generates updated prompt files
- Optionally creates PRs with changes

### 4. Workflow Orchestrator (`auto_update_workflow.py`)
- **NEW**: Coordinates all three components
- Provides comprehensive logging to `~/.nova/hook-logs/workflow.log`
- Handles errors gracefully
- Supports dry-run mode

## Usage

### Basic Usage

```bash
# Process a single session
python3 auto_update_workflow.py /path/to/session.jsonl

# Process all sessions in a directory
python3 auto_update_workflow.py /path/to/sessions/
```

### Advanced Options

```bash
# Use custom log file
python3 auto_update_workflow.py session.jsonl --log-file /tmp/workflow.log

# Use custom database
python3 auto_update_workflow.py session.jsonl --db custom.db

# Disable dry-run mode (make actual updates)
python3 auto_update_workflow.py session.jsonl --no-dry-run
```

## Workflow Steps

### Step 1: Ingest Session
- Processes JSONL file(s) via `ingest.py`
- Imports session metadata and human messages into database
- Logs session ID and message count

### Step 2: Detect Prompts
- Identifies active system prompts for the session
- Gracefully skips if `prompt_detector` module is not yet available
- Logs detected prompt files

### Step 3: Update Prompts
- Plans prompt updates based on detected prompts
- Runs in dry-run mode by default for safety
- Logs planned updates

## Logging

All operations are logged to `~/.nova/hook-logs/workflow.log` by default.

### Log Format

```
2026-01-31 23:44:03 - auto_update_workflow - INFO - ================================================================================
2026-01-31 23:44:03 - auto_update_workflow - INFO - AUTO-UPDATE WORKFLOW STARTED
2026-01-31 23:44:03 - auto_update_workflow - INFO - ================================================================================
2026-01-31 23:44:03 - auto_update_workflow - INFO - Timestamp: 2026-01-31T23:44:03.054299
2026-01-31 23:44:03 - auto_update_workflow - INFO - Input path: session.jsonl
...
```

### Log Levels

- **INFO**: Normal operation (workflow start, step completion, success)
- **WARNING**: Non-critical issues (missing modules, skipped steps)
- **ERROR**: Failures (ingestion errors, API errors)
- **DEBUG**: Detailed operation information (file handler only)

## Error Handling

The workflow is designed to be resilient:

1. **Missing prompt_detector**: Workflow continues without Step 2
2. **Ingestion failures**: Workflow stops, logs error details
3. **No prompts detected**: Step 3 is skipped gracefully
4. **API failures**: Logged with full error context

## Testing

Run the test suite:

```bash
source .venv/bin/activate
python -m pytest program_nova/test_auto_update_workflow.py -v
```

### Test Coverage

- ✓ Logging setup (default and custom paths)
- ✓ File and console handler configuration
- ✓ Step 1: Session ingestion (success and failure cases)
- ✓ Step 2: Prompt detection (with and without module)
- ✓ Step 3: Prompt updates (dry-run mode)
- ✓ Full workflow integration
- ✓ Error handling and graceful degradation

## Integration with SessionEnd Hook

This workflow is designed to be called by the SessionEnd hook when a Claude Code session ends.

### Hook Configuration (Phase 1)

The `.claude/settings.json` file should contain:

```json
{
  "hooks": {
    "SessionEnd": {
      "command": "python3 .claude/hooks/session-end-ingest.py",
      "async": true,
      "timeout": 300
    }
  }
}
```

### Hook Script

The `.claude/hooks/session-end-ingest.py` script receives session data via stdin and calls this workflow:

```python
#!/usr/bin/env python3
import json
import sys
import subprocess

# Read session data from stdin
data = json.load(sys.stdin)

# Call workflow
subprocess.run([
    "python3",
    "auto_update_workflow.py",
    data["transcript_path"]
])
```

## Dependencies

This workflow depends on:

1. **Phase 1 (Nova-t34z.1)**: SessionEnd hook and configuration
2. **Phase 2 (Nova-t34z.2)**: Prompt detector module (optional for now)

The workflow is designed to function without Phase 2 by gracefully skipping prompt detection.

## Development Status

- ✅ Phase 3 (Nova-t34z.3): Auto-update workflow implementation
  - ✅ Workflow orchestration
  - ✅ Comprehensive logging
  - ✅ Error handling
  - ✅ Test suite (12 tests, all passing)
  - ⚠️ Blocked by Phase 1 and Phase 2 for full functionality

- ⏳ Phase 1 (Nova-t34z.1): SessionEnd hook - In Progress
- ⏳ Phase 2 (Nova-t34z.2): Prompt detector - In Progress

## Future Enhancements

1. **Batch Analysis**: Analyze multiple sessions together for pattern detection
2. **Smart Scheduling**: Only update prompts when significant patterns emerge
3. **Rollback Support**: Ability to revert prompt updates if they don't improve results
4. **Metrics Dashboard**: Track prompt effectiveness over time
