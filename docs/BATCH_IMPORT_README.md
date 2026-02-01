# Batch Import Tool

## Overview

The `batch_import.py` script automates the process of discovering all `.jsonl` files in a directory and running both **I1 (session import)** and **I2 (message import)** for each file. It intelligently skips sessions that have already been imported, preventing duplicates.

## Features

- 🔍 **Auto-discovery**: Automatically finds all `.jsonl` files in a directory
- 🔄 **Combined I1+I2**: Runs both session and message import in one command
- ⏭️ **Smart skipping**: Automatically skips sessions that already have messages imported
- 🔁 **Re-import option**: Use `--clear-messages` to force re-import of messages
- 📊 **Progress tracking**: Shows real-time progress for each file
- 📈 **Summary statistics**: Reports total files processed, successful imports, skips, and failures

## Usage

### Basic Usage

```bash
# Import all .jsonl files from a specific directory
python3 batch_import.py /path/to/directory
```

### Use Default Directory

```bash
# Uses ~/.claude/projects/-Users-ericmagliarditi-Desktop-Github-Nova/
python3 batch_import.py
```

### Re-import with Clear Messages

```bash
# Clear existing messages and re-import (useful for fixing corrupted data)
python3 batch_import.py /path/to/directory --clear-messages
```

### Custom Database

```bash
# Use a different database file
python3 batch_import.py /path/to/directory --db custom.db
```

### Quiet Mode

```bash
# Suppress progress messages (only show summary)
python3 batch_import.py /path/to/directory --quiet
```

## Command-Line Options

| Option | Description |
|--------|-------------|
| `directory` | Directory containing `.jsonl` files (optional, uses default if not provided) |
| `--clear-messages` | Clear existing messages before importing (allows re-import) |
| `--db DB` | Path to SQLite database (default: `nova.db`) |
| `--quiet` | Suppress progress messages |
| `--help` | Show help message |

## How It Works

### Import Process (for each .jsonl file)

1. **I1: Session Import**
   - Extracts session metadata (session_id, branch, cwd, etc.)
   - Checks if session already exists in database
   - Inserts session into `sessions` table (or returns existing ID)

2. **Duplicate Check**
   - Queries `messages` table to see if this session already has messages
   - If messages exist and `--clear-messages` is NOT set, skips I2 import
   - If `--clear-messages` is set, clears existing messages and proceeds

3. **I2: Message Import**
   - Extracts all human messages from the JSONL file
   - Assigns `message_index` (0-based counter) to preserve conversation order
   - Inserts messages into `messages` table

### Output Example

```
============================================================
Batch Import: Found 54 .jsonl files
Directory: /Users/ericmagliarditi/.claude/projects/-Users-ericmagliarditi-Desktop-Github-Nova/
Clear messages: False
============================================================

[1/54] Processing: 01214992-c3d0-4c6e-a869-c44ff1f5b80f.jsonl

[I1] Importing session from: ...
✓ Imported session 01214992-c3d0-4c6e-a869-c44ff1f5b80f
  CWD: /Users/ericmagliarditi/Desktop/Github/Nova
  Branch: eric-tinker
  Database ID: 8
[I2] Importing messages for session 01214992...
Extracting human messages from ...
Found 12 human messages
✓ Successfully inserted 12/12 messages
✓ Imported 12 messages

[2/54] Processing: 0162f921-596f-4722-b73f-6760e3e05a56.jsonl

[I1] Importing session from: ...
Session 0162f921-596f-4722-b73f-6760e3e05a56 already exists in database
[I2] Session 0162f921... already has 8 messages - skipping

...

============================================================
Batch Import Summary:
  Total files: 54
  Successful: 32
  Skipped (already imported): 20
  Failed: 2
  Total messages imported: 487
============================================================
```

## Architecture

### Key Functions

| Function | Purpose |
|----------|---------|
| `get_session_id_from_jsonl()` | Extract session_id from JSONL file |
| `import_single_file()` | Run I1+I2 for a single file |
| `batch_import_from_directory()` | Discover and process all .jsonl files |
| `get_default_directory()` | Get default Claude projects directory |

### Duplicate Prevention

The tool uses two mechanisms to prevent duplicate imports:

1. **Session-level**: `sessions` table has a UNIQUE constraint on `session_id`
   - Attempting to insert a duplicate session returns the existing session's ID
   - No error is thrown; existing session is reused

2. **Message-level**: Before running I2, the tool queries:
   ```sql
   SELECT COUNT(*) FROM messages WHERE session_id = ?
   ```
   - If count > 0 and `--clear-messages` is NOT set, skip I2 import
   - If `--clear-messages` is set, clears messages and proceeds

### Error Handling

- **File not found**: Reports error and continues with next file
- **Invalid JSONL**: Reports error and continues with next file
- **Database errors**: Reports error and continues with next file
- **Exit code**: Returns 0 if all imports succeeded, 1 if any failed

## Integration with Existing Tools

### Compared to Individual Importers

| Tool | Purpose | Batch Support |
|------|---------|---------------|
| `session_importer.py` | I1 only (session metadata) | ✅ Yes (via `import_sessions_from_directory()`) |
| `message_importer.py` | I2 only (human messages) | ❌ No (single file only) |
| `batch_import.py` | I1+I2 combined | ✅ Yes (primary purpose) |

### When to Use Each

- **Use `session_importer.py`** when you only need session metadata
- **Use `message_importer.py`** when you need fine-grained control over message import
- **Use `batch_import.py`** when you want to import complete sessions (metadata + messages) from multiple files

## Programmatic Usage

You can also import the functions directly in Python:

```python
from batch_import import batch_import_from_directory, import_single_file

# Import all files in a directory
summary = batch_import_from_directory(
    directory_path="/path/to/directory",
    db_path="nova.db",
    clear_messages=False,
    verbose=True
)

print(f"Imported {summary['total_messages']} messages from {summary['successful']} sessions")

# Import a single file
result = import_single_file(
    jsonl_path="/path/to/session.jsonl",
    db_path="nova.db",
    clear_messages=False,
    verbose=True
)

if result['success']:
    print(f"Imported {result['messages_imported']} messages")
```

## Return Values

### `batch_import_from_directory()` returns:

```python
{
    'total_files': int,       # Total .jsonl files found
    'successful': int,        # Successfully imported (new imports)
    'skipped': int,          # Skipped (already had messages)
    'failed': int,           # Failed imports
    'total_messages': int,   # Total messages imported
    'results': [             # Per-file results
        {
            'filename': str,
            'success': bool,
            'session_id': str,
            'session_db_id': int,
            'messages_imported': int,
            'skipped': bool,
            'error': str or None
        },
        ...
    ]
}
```

### `import_single_file()` returns:

```python
{
    'success': bool,              # True if import succeeded
    'session_id': str,            # Session UUID
    'session_db_id': int,         # Database ID of session
    'messages_imported': int,     # Number of messages imported
    'skipped': bool,              # True if skipped due to existing messages
    'error': str or None          # Error message if failed
}
```

## Examples

### Example 1: Import all sessions from default directory

```bash
python3 batch_import.py
```

### Example 2: Import from specific directory

```bash
python3 batch_import.py ~/.claude/projects/my-project/
```

### Example 3: Re-import all sessions (clear existing messages)

```bash
python3 batch_import.py ~/.claude/projects/my-project/ --clear-messages
```

### Example 4: Import to custom database

```bash
python3 batch_import.py /path/to/sessions/ --db analysis.db
```

### Example 5: Quiet mode for scripting

```bash
python3 batch_import.py /path/to/sessions/ --quiet
if [ $? -eq 0 ]; then
    echo "All imports succeeded"
else
    echo "Some imports failed"
fi
```

## Troubleshooting

### No files found

```
No .jsonl files found in /path/to/directory
```

**Solution**: Verify the directory path contains `.jsonl` files

### Permission denied

```
Error: [Errno 13] Permission denied: '/path/to/file.jsonl'
```

**Solution**: Check file permissions with `ls -l` and adjust with `chmod`

### Database locked

```
Error: database is locked
```

**Solution**: Close other processes using `nova.db` or wait for them to finish

### Session already exists but messages are missing

If a session exists but has no messages (possibly from a previous failed import):

```bash
# Re-import messages only for that session
python3 program_nova/message_importer.py /path/to/session.jsonl --clear

# Or re-import everything in the directory
python3 batch_import.py /path/to/directory --clear-messages
```

## Performance

- **Typical speed**: ~2-5 files per second (depends on file size)
- **Memory usage**: Minimal (processes one file at a time)
- **Database**: Uses WAL mode for better concurrent access

### Optimizing for Large Imports

For importing 1000+ sessions:

1. Use `--quiet` to reduce console I/O overhead
2. Ensure database is on SSD (not network drive)
3. Consider splitting into smaller batches if memory is constrained

## Related Documentation

- [SESSION_IMPORT_README.md](SESSION_IMPORT_README.md) - I1 (Session Import) details
- [MESSAGE_IMPORT_README.md](MESSAGE_IMPORT_README.md) - I2 (Message Import) details
- [QUICK_START.md](QUICK_START.md) - General setup and usage guide
