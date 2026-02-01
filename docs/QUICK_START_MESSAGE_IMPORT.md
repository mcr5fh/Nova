# Quick Start: Message Import

Extract human messages from a JSONL file and insert them into the messages table with `message_index`.

## One-Line Usage

```bash
python program_nova/message_importer.py path/to/session.jsonl
```

## What It Does

1. Reads the JSONL file line by line
2. Filters for human messages only (type="user", string content)
3. Assigns message_index (0, 1, 2, ...) to preserve order
4. Inserts into the `messages` table

## Examples

### Basic Import
```bash
python program_nova/message_importer.py ~/.claude/projects/my-project/session.jsonl
```

### Clear Existing First
```bash
python program_nova/message_importer.py session.jsonl --clear
```

### Specify Session ID
```bash
python program_nova/message_importer.py session.jsonl abc-123-def-456
```

## Programmatic Usage

```python
from program_nova.message_importer import import_human_messages_from_jsonl

count = import_human_messages_from_jsonl("session.jsonl", clear_existing=True)
print(f"Imported {count} messages")
```

## Query Messages by Index

```sql
SELECT message_index, content
FROM messages
WHERE session_id = 'your-session-id'
ORDER BY message_index;
```

## Database Schema

```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    message_index INTEGER,  -- Order in conversation (0, 1, 2, ...)
    -- ... other fields
);
```

## Files

- **Implementation**: `program_nova/message_importer.py`
- **Tests**: `program_nova/test_message_importer.py`
- **Demo**: `demo_message_import.py`
- **Full Docs**: `MESSAGE_IMPORT_README.md`

## Workflow

```
JSONL File → Parse → Filter Human Messages → Assign Index → Insert to DB
```

## Validation

Tested with real session file containing 47 messages:
- ✅ All 47 human messages extracted
- ✅ Indexed 0-46 in correct order
- ✅ Successfully inserted into database
- ✅ Queryable by session_id and message_index
