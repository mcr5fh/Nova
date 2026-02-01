# Message Import System

Extract human messages from JSONL files and insert them into the messages table with proper indexing.

## Overview

This system extracts all human messages from a Claude Code session JSONL file, maintains their order using a `message_index` field, and inserts them into the SQLite database.

## Features

- **Extract Human Messages**: Parses JSONL files and filters for genuine human messages (excludes tool results, assistant responses, etc.)
- **Order Preservation**: Assigns a 0-based `message_index` to each message to maintain conversation order
- **Database Integration**: Inserts messages into the `messages` table with full metadata
- **Session Linking**: Links messages to their parent session via `session_id`
- **Idempotent**: Can safely re-import with `--clear` flag to replace existing messages

## Database Schema

The `messages` table includes:

```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_index INTEGER,          -- NEW: Order of message in conversation
    tokens_input INTEGER,
    tokens_output INTEGER,
    model TEXT,
    metadata TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

-- Index for efficient querying
CREATE INDEX idx_messages_session_message_index
ON messages(session_id, message_index);
```

## Quick Start

### 1. Import a Single JSONL File

```bash
python program_nova/message_importer.py path/to/session.jsonl
```

This will:
- Extract the session_id from the JSONL file
- Extract all human messages in order
- Insert them into the database with `message_index` 0, 1, 2, ...

### 2. Import with Explicit Session ID

```bash
python program_nova/message_importer.py path/to/session.jsonl my-session-id-123
```

### 3. Clear Existing Messages Before Import

```bash
python program_nova/message_importer.py path/to/session.jsonl --clear
```

This removes all existing user messages for the session before importing new ones.

## Programmatic Usage

```python
from program_nova.message_importer import import_human_messages_from_jsonl

# Import messages from a JSONL file
count = import_human_messages_from_jsonl(
    jsonl_path="session.jsonl",
    session_id="abc-123-def",  # Optional: will extract from file if not provided
    clear_existing=True         # Optional: clear existing messages first
)

print(f"Imported {count} messages")
```

## Detailed API

### `extract_human_messages_from_jsonl(jsonl_path)`

Extracts all human messages from a JSONL file.

**Returns:** List of dictionaries:
```python
[
    {
        'content': 'What is the capital of France?',
        'uuid': 'msg-001',
        'timestamp': '2024-01-01T10:00:00Z',
        'message_index': 0
    },
    {
        'content': 'How do I fix this bug?',
        'uuid': 'msg-002',
        'timestamp': '2024-01-01T10:01:00Z',
        'message_index': 1
    }
]
```

### `insert_human_messages(session_id, human_messages, clear_existing=False)`

Inserts human messages into the database.

**Parameters:**
- `session_id`: Session identifier
- `human_messages`: List of message dicts from `extract_human_messages_from_jsonl()`
- `clear_existing`: If True, deletes existing user messages for this session first

**Returns:** Number of messages successfully inserted

### `import_human_messages_from_jsonl(jsonl_path, session_id=None, clear_existing=False)`

Complete workflow: extract and insert in one call.

**Parameters:**
- `jsonl_path`: Path to JSONL file
- `session_id`: Optional session ID (extracted from file if not provided)
- `clear_existing`: Whether to clear existing messages first

**Returns:** Number of messages successfully inserted

## Message Filtering

The system correctly identifies human messages by:

1. **Type Check**: `type === "user"`
2. **Content Type**: `content` must be a string (not an array)
3. **Tool Result Exclusion**: Excludes messages with array content (tool results)

### What Gets Imported

✅ **Imported:**
```json
{"type": "user", "message": {"content": "Hello Claude", "uuid": "msg-123"}}
```

❌ **Not Imported:**
```json
// Tool result (array content)
{"type": "tool", "message": {"content": [{"type": "text"}], "uuid": "msg-456"}}

// Assistant response
{"type": "assistant", "message": {"content": "Hi there!"}}

// Queue operation
{"type": "queue_op", "operation": "enqueue"}
```

## Testing

Run the test suite:

```bash
python program_nova/test_message_importer.py
```

This will:
1. Add the `message_index` column if needed
2. Extract messages from a sample JSONL file
3. Insert test messages
4. Verify the full import workflow

## Example Workflow

```bash
# Step 1: Import session metadata
python program_nova/session_importer.py session.jsonl

# Step 2: Import human messages
python program_nova/message_importer.py session.jsonl --clear

# Step 3: Query messages in order
sqlite3 nova.db "
  SELECT message_index, substr(content, 1, 50) as preview
  FROM messages
  WHERE session_id = 'your-session-id'
  ORDER BY message_index
"
```

## Integration with Existing Code

This system integrates with:

- **`db.py`**: Uses database connection and table schema
- **`jsonl_parser.py`**: Uses message parsing and filtering logic
- **`session_importer.py`**: Can extract session_id from JSONL files

## Files

- `program_nova/message_importer.py` - Main implementation
- `program_nova/test_message_importer.py` - Test suite
- `program_nova/example_message_import.py` - Usage example
- `db.py` - Database schema (updated with message_index)
- `program_nova/jsonl_parser.py` - JSONL parsing utilities

## Notes

- The `message_index` is 0-based (first message = 0, second = 1, etc.)
- Only genuine human messages are imported (role = 'user')
- Messages are ordered by their appearance in the JSONL file
- The system handles malformed JSON lines gracefully
- Session must exist in the database (or will warn but proceed anyway)
