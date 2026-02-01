# Quick Start Guide: Session Analysis Workflow

This guide shows you how to run the complete workflow to analyze Claude Code sessions for planning failures.

## Prerequisites

```bash
# 1. Set your Anthropic API key
export ANTHROPIC_API_KEY='your-api-key-here'

# 2. Install dependencies (if needed)
pip install anthropic
```

## Step-by-Step Workflow

### 1. Initialize Database

```bash
python3 db.py
```

This creates `nova.db` with three tables: `sessions`, `messages`, and `analyses`.

### 2. Import Session Metadata

Import session metadata from Claude Code JSONL files:

```bash
# Single file
python3 program_nova/session_importer.py path/to/session.jsonl

# Entire directory
python3 program_nova/session_importer.py ~/.claude/projects/my-project/

# Default location (Nova project)
python3 program_nova/session_importer.py
```

This extracts session_id, branch, cwd, etc. and stores them in the `sessions` table.

### 3. Import Messages

Import the actual user messages from JSONL files:

```bash
# Single file (auto-detects session_id)
python3 program_nova/message_importer.py path/to/session.jsonl

# With explicit session_id
python3 program_nova/message_importer.py session.jsonl abc-123-def

# Clear and re-import
python3 program_nova/message_importer.py session.jsonl --clear
```

This extracts human messages and stores them in the `messages` table with `role='user'`.

### 4. Analyze Sessions

Run the analysis workflow:

```bash
# Analyze a single session
python3 analyze_session.py d4c5120a-eb6c-40c2-9dbf-2ecb737a07ec

# Analyze all sessions
python3 analyze_session.py --all

# Analyze first 10 sessions
python3 analyze_session.py --all --limit 10
```

This:
1. Loads user messages from DB
2. Sends them to Claude via the Anthropic API
3. Parses the JSON response containing planning failure findings
4. Stores the results in the `analyses` table

### 5. Query Results

```bash
# View analyses in the database
python3 -c "
import db, json
analyses = db.get_analyses('session-id-here', analysis_type='planning_failure')
for a in analyses:
    findings = json.loads(a['content'])
    print(f'Session: {a[\"session_id\"]}')
    print(f'Findings: {len(findings)}')
    for f in findings:
        print(f'  - {f[\"failure_category\"]}: {f[\"description\"][:60]}...')
"
```

## Complete Example

```bash
# Full workflow from scratch
export ANTHROPIC_API_KEY='sk-...'

# 1. Initialize
python3 db.py

# 2. Import session metadata
python3 program_nova/session_importer.py ~/.claude/projects/Nova/

# 3. Import messages for each session
for file in ~/.claude/projects/Nova/*.jsonl; do
    python3 program_nova/message_importer.py "$file"
done

# 4. Analyze all sessions
python3 analyze_session.py --all

# 5. View results
python3 query_analyses.py  # (if you create this aggregation script)
```

## Output Example

```
Analyzing session: d4c5120a-eb6c-40c2-9dbf-2ecb737a07ec
  Loading messages from database...
  ✓ Loaded 15 user messages
  Sending 15 user messages to Claude for analysis...
  ✓ Analysis complete. Found 2 planning failures.
  ✓ Stored analysis in database (ID: 42)
```

## Testing Without API Calls

Run the test suite to verify everything works (doesn't call API):

```bash
python3 test_workflow.py
```

## Troubleshooting

### "No user messages found"
- Make sure you ran `message_importer.py` after `session_importer.py`
- `session_importer.py` only imports metadata, not the actual messages

### "Authentication failed"
- Check that `ANTHROPIC_API_KEY` is set correctly
- Verify the API key is valid

### "Session not found"
- Run `session_importer.py` first to import session metadata
- Check the session_id is correct

## File Reference

| File | Purpose |
|------|---------|
| `db.py` | Database operations (sessions, messages, analyses) |
| `program_nova/session_importer.py` | Import session metadata from JSONL |
| `program_nova/message_importer.py` | Import user messages from JSONL |
| `program_nova/anthropic_wrapper.py` | Wrapper for Anthropic API (A1) |
| `prompts.py` | Analysis prompt templates (A2) |
| `program_nova/jsonl_parser.py` | Parse and filter JSONL lines (A3) |
| `analyze_session.py` | **Main workflow orchestrator** |
| `test_workflow.py` | Test suite for the workflow |

## What Gets Stored

### Sessions Table
- `session_id`: UUID from JSONL
- `title`: Auto-generated from path
- `metadata`: {branch, cwd, version, source_file, etc.}

### Messages Table
- `session_id`: Links to sessions
- `role`: Always 'user' for imported messages
- `content`: The actual message text
- `message_index`: Sequential order in conversation

### Analyses Table
- `session_id`: Links to sessions
- `analysis_type`: 'planning_failure'
- `content`: JSON array of findings
- `metadata`: {failure_count, categories}

## Next Steps

After analyzing sessions, you can:

1. Aggregate findings across all sessions to find patterns
2. Use `prompts.get_prompt_update_generation_prompt()` to generate system prompt improvements
3. Feed aggregated findings back to Claude to improve the planning behavior
4. Track improvements over time by re-analyzing sessions
