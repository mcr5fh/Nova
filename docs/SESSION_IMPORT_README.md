# Session Import Module

This module provides functionality to read JSONL files from Claude Code sessions, extract session metadata (session_id, branch, cwd), and insert them into the SQLite sessions table.

## Files

- `program_nova/session_importer.py` - Main module for importing sessions
- `program_nova/test_session_importer.py` - Test suite
- `program_nova/example_session_import.py` - Usage examples
- `db.py` - Database module with sessions table

## Features

- Extract session metadata from JSONL files:
  - `session_id` - Unique session identifier (UUID)
  - `branch` - Git branch name
  - `cwd` - Current working directory
  - `version` - Claude Code version
  - `timestamp` - Session start time
  - `user_type` - User type (e.g., "external")

- Import single JSONL file or entire directory
- Automatic duplicate detection (skips already imported sessions)
- Stores metadata as JSON in the database

## Database Schema

The `sessions` table stores:
```sql
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    title TEXT,
    metadata TEXT  -- JSON containing branch, cwd, version, etc.
)
```

## Usage

### Command Line

```bash
# Import a single JSONL file
python3 program_nova/session_importer.py path/to/session.jsonl

# Import all JSONL files from a directory
python3 program_nova/session_importer.py ~/.claude/projects/my-project/

# Import from default Claude directory (if configured)
python3 program_nova/session_importer.py
```

### Python API

```python
import sys
sys.path.insert(0, '/path/to/Nova')
from session_importer import import_session_from_jsonl, import_sessions_from_directory
import db

# Initialize database
db.init_db()

# Import single file
db_id = import_session_from_jsonl('session.jsonl')

# Import directory
count = import_sessions_from_directory('~/.claude/projects/my-project/')

# Query sessions
session = db.get_session('session-id-here')
all_sessions = db.get_all_sessions()
```

## Example Output

```
Importing sessions from: /Users/user/.claude/projects/Nova
Found 38 JSONL files

✓ Imported session d4c5120a-eb6c-40c2-9dbf-2ecb737a07ec
  CWD: /Users/user/Desktop/Github/Nova
  Branch: eric-tinker
  Database ID: 2

✓ Imported session fcde4d9f-6f98-4030-a0c4-081dc2eb4ceb
  CWD: /Users/user/Desktop/Github/Nova
  Branch: eric-tinker
  Database ID: 3

...

Successfully imported 37/38 sessions
```

## Testing

Run the test suite:
```bash
python3 program_nova/test_session_importer.py
```

View usage examples:
```bash
python3 program_nova/example_session_import.py
```

## Session Metadata Structure

When extracted from JSONL, each session contains:
```json
{
  "session_id": "d4c5120a-eb6c-40c2-9dbf-2ecb737a07ec",
  "branch": "eric-tinker",
  "cwd": "/Users/user/Desktop/Github/Nova",
  "version": "2.1.29",
  "user_type": "external",
  "timestamp": "2026-02-01T00:53:03.096Z"
}
```

This metadata is stored in the `metadata` column as JSON in the database.

## Notes

- Sessions are identified by `session_id` (UUID from JSONL)
- Duplicate imports are automatically skipped
- Session title is auto-generated from CWD and session ID
- Import preserves original timestamps
- All metadata is stored for future analysis
