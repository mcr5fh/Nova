# Session Analysis Workflow

This document describes the complete workflow for analyzing Claude Code sessions to identify planning failures.

## Overview

The workflow loads user messages from the database, sends them to Claude for analysis using a specialized prompt, parses the JSON response, and stores the findings in the analyses table.

## Components

### A1: Anthropic Wrapper (`program_nova/anthropic_wrapper.py`)
- Thin wrapper around Anthropic SDK
- Handles message sending and error handling
- Returns structured `MessageResponse` objects

### A2: Analysis Prompts (`prompts.py`)
- Contains `get_planning_failure_analysis_prompt()`
- Generates prompts that ask Claude to identify planning failures
- Provides clear criteria and output format (JSON)

### A3: JSONL Parser (`program_nova/jsonl_parser.py`)
- Parses individual JSONL lines
- Classifies messages as user/assistant/tool/queue_op
- Filters for genuine human messages

### Main Workflow Script (`analyze_session.py`)
Orchestrates the complete process:
1. Load messages from database
2. Send to Claude via wrapper with analysis prompt
3. Parse JSON response
4. Store in analyses table

## Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    title TEXT,
    metadata TEXT
)
```

### Messages Table
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tokens_input INTEGER,
    tokens_output INTEGER,
    model TEXT,
    metadata TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
)
```

### Analyses Table
```sql
CREATE TABLE analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    analysis_type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
)
```

## Usage

### Prerequisites

1. Set up your Anthropic API key:
```bash
export ANTHROPIC_API_KEY='your-api-key-here'
```

2. Initialize the database (if not already done):
```bash
python3 db.py
```

3. Import sessions from JSONL files (if needed):
```bash
python3 program_nova/session_importer.py <path-to-jsonl-or-directory>
```

### Analyze a Single Session

```bash
python3 analyze_session.py <session_id>
```

Example:
```bash
python3 analyze_session.py d4c5120a-eb6c-40c2-9dbf-2ecb737a07ec
```

Output:
```
Analyzing session: d4c5120a-eb6c-40c2-9dbf-2ecb737a07ec
  Loading messages from database...
  ✓ Loaded 15 user messages
  Sending 15 user messages to Claude for analysis...
  ✓ Analysis complete. Found 2 planning failures.
  ✓ Stored analysis in database (ID: 42)
```

### Analyze All Sessions

```bash
python3 analyze_session.py --all
```

With a limit:
```bash
python3 analyze_session.py --all --limit 10
```

## Analysis Output Format

The analysis findings are stored as JSON in the `analyses` table:

```json
[
  {
    "failure_category": "missing_plan_mode",
    "triggering_message_number": 3,
    "description": "User requested adding authentication to the app, which is a multi-file architectural change. Claude should have entered plan mode to design the auth system before implementing.",
    "suggested_improvement": "System prompt should emphasize entering plan mode for authentication/authorization features as they always involve architectural decisions."
  },
  {
    "failure_category": "insufficient_clarification",
    "triggering_message_number": 7,
    "description": "User asked to 'optimize the API' without specifying what metrics matter. Claude started making changes without clarifying optimization goals.",
    "suggested_improvement": "When users request optimization, the prompt should require asking what specific metrics to optimize for before proceeding."
  }
]
```

## Failure Categories

The analysis identifies these types of planning failures:

1. **missing_plan_mode**: Should have entered plan mode but didn't
2. **insufficient_clarification**: Should have asked clarifying questions first
3. **premature_implementation**: Started coding before understanding requirements
4. **missing_architecture_discussion**: Should have discussed approach/tradeoffs
5. **poor_task_breakdown**: Should have broken task into clearer subtasks

## Querying Analysis Results

### Get all analyses for a session
```python
import db
analyses = db.get_analyses('session-id-here')
for analysis in analyses:
    print(f"Type: {analysis['analysis_type']}")
    print(f"Content: {analysis['content']}")
```

### Get planning failure analyses specifically
```python
import db
planning_analyses = db.get_analyses('session-id-here', analysis_type='planning_failure')
```

### Count failures by category
```python
import db
import json

analyses = db.get_analyses('session-id-here', analysis_type='planning_failure')
for analysis in analyses:
    findings = json.loads(analysis['content'])
    categories = {}
    for finding in findings:
        cat = finding['failure_category']
        categories[cat] = categories.get(cat, 0) + 1
    print(categories)
```

## Workflow Diagram

```
┌─────────────────┐
│  Database       │
│  (sessions,     │
│   messages)     │
└────────┬────────┘
         │
         │ Load user messages
         ▼
┌─────────────────────────────────┐
│  analyze_session.py             │
│  - Load messages from DB        │
│  - Generate analysis prompt (A2)│
│  - Send to Claude API (A1)      │
│  - Parse JSON response          │
│  - Store findings               │
└────────┬────────────────────────┘
         │
         │ Store analysis
         ▼
┌─────────────────┐
│  Database       │
│  (analyses)     │
└─────────────────┘
```

## Error Handling

The script handles various error scenarios:

- **No messages found**: Skips session and reports it
- **API errors**: Catches and reports Anthropic API errors
- **JSON parse errors**: Reports if Claude's response isn't valid JSON
- **Database errors**: Connection issues are caught at the DB layer

## Next Steps

After running analyses, you can:

1. Query the analyses table to find common patterns
2. Aggregate findings across multiple sessions
3. Use `prompts.get_prompt_update_generation_prompt()` to generate system prompt updates
4. Feed the aggregated findings back to Claude to improve the planning prompt

## Example Complete Workflow

```bash
# 1. Initialize database
python3 db.py

# 2. Import sessions
python3 program_nova/session_importer.py ~/.claude/projects/my-project/

# 3. Set API key
export ANTHROPIC_API_KEY='sk-...'

# 4. Analyze all sessions
python3 analyze_session.py --all

# 5. Query results
python3 query_analyses.py  # (create this to aggregate findings)
```
