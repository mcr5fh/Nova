"""
Message Importer - Extract human messages from JSONL and insert into messages table.

This module reads a JSONL file, extracts all human messages in order,
and inserts them into the messages table with a message_index field.
"""

import json
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import database and parser modules
import db
from program_nova.jsonl_parser import parse_jsonl_line, filter_human_messages


def extract_human_messages_from_jsonl(jsonl_path: str) -> List[Dict[str, Any]]:
    """
    Extract all human messages from a JSONL file in order.

    Args:
        jsonl_path: Path to the .jsonl file

    Returns:
        List of dictionaries containing:
        - content: The message content
        - uuid: Message UUID
        - timestamp: Message timestamp
        - message_index: 0-based index of the message in the conversation
    """
    human_messages = []
    message_index = 0

    try:
        with open(jsonl_path, 'r') as f:
            for line in f:
                # Parse the line
                parsed = parse_jsonl_line(line)

                # Filter for human messages only
                if filter_human_messages(parsed):
                    human_messages.append({
                        'content': parsed.content,
                        'uuid': parsed.uuid,
                        'timestamp': parsed.timestamp,
                        'message_index': message_index,
                        'raw_data': parsed.raw_data
                    })
                    message_index += 1

    except FileNotFoundError:
        print(f"Error: File not found: {jsonl_path}")
        return []
    except Exception as e:
        print(f"Error reading file: {e}")
        return []

    return human_messages


def add_message_index_column(db_path: str = None):
    """
    Add message_index column to messages table if it doesn't exist.

    Args:
        db_path: Optional database path
    """
    with db.get_connection(db_path) as conn:
        cursor = db.get_cursor(conn)

        # Check if column already exists
        cursor.execute("PRAGMA table_info(messages)")
        columns = [row[1] for row in cursor.fetchall()]

        if 'message_index' not in columns:
            print("Adding message_index column to messages table...")
            cursor.execute("ALTER TABLE messages ADD COLUMN message_index INTEGER")

            # Create index for better query performance
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_session_message_index
                ON messages(session_id, message_index)
            """)
            print("✓ message_index column added")
        else:
            print("message_index column already exists")


def insert_human_messages(
    session_id: str,
    human_messages: List[Dict[str, Any]],
    db_path: str = None,
    clear_existing: bool = False
) -> int:
    """
    Insert human messages into the messages table with message_index.

    Args:
        session_id: Session identifier
        human_messages: List of human message dictionaries from extract_human_messages_from_jsonl()
        db_path: Optional database path
        clear_existing: If True, delete existing messages for this session before inserting

    Returns:
        Number of messages successfully inserted
    """
    if not human_messages:
        print("No human messages to insert")
        return 0

    # Ensure message_index column exists
    add_message_index_column(db_path)

    with db.get_connection(db_path) as conn:
        cursor = db.get_cursor(conn)

        # Clear existing messages if requested
        if clear_existing:
            cursor.execute("DELETE FROM messages WHERE session_id = ? AND role = 'user'", (session_id,))
            deleted_count = cursor.rowcount
            if deleted_count > 0:
                print(f"Cleared {deleted_count} existing user messages for session {session_id}")

        # Insert messages
        inserted_count = 0
        for msg in human_messages:
            try:
                # Prepare metadata
                metadata = {
                    'uuid': msg.get('uuid'),
                    'timestamp': msg.get('timestamp')
                }

                cursor.execute(
                    """INSERT INTO messages
                       (session_id, role, content, message_index, metadata)
                       VALUES (?, ?, ?, ?, ?)""",
                    (
                        session_id,
                        'user',  # Human messages have role 'user'
                        msg['content'],
                        msg['message_index'],
                        json.dumps(metadata)
                    )
                )
                inserted_count += 1
            except Exception as e:
                print(f"Error inserting message {msg.get('uuid')}: {e}")

        return inserted_count


def import_human_messages_from_jsonl(
    jsonl_path: str,
    session_id: Optional[str] = None,
    db_path: str = None,
    clear_existing: bool = False
) -> int:
    """
    Complete workflow: Extract human messages from JSONL and insert into database.

    Args:
        jsonl_path: Path to the .jsonl file
        session_id: Optional session ID. If not provided, will attempt to extract from file
        db_path: Optional database path
        clear_existing: If True, delete existing messages for this session before inserting

    Returns:
        Number of messages successfully inserted
    """
    # Extract session_id if not provided
    if not session_id:
        # Try to extract from session_importer
        from program_nova.session_importer import extract_session_metadata_from_jsonl
        metadata = extract_session_metadata_from_jsonl(jsonl_path)
        if metadata:
            session_id = metadata['session_id']
        else:
            print("Error: Could not extract session_id from JSONL file")
            print("Please provide session_id manually")
            return 0

    # Check if session exists in database
    existing_session = db.get_session(session_id, db_path)
    if not existing_session:
        print(f"Warning: Session {session_id} not found in database")
        print("Consider running session_importer.py first to import session metadata")
        print("Proceeding anyway...")

    # Extract human messages
    print(f"Extracting human messages from {jsonl_path}...")
    human_messages = extract_human_messages_from_jsonl(jsonl_path)

    if not human_messages:
        print("No human messages found in file")
        return 0

    print(f"Found {len(human_messages)} human messages")

    # Insert into database
    print(f"Inserting messages into database for session {session_id}...")
    inserted_count = insert_human_messages(session_id, human_messages, db_path, clear_existing)

    print(f"✓ Successfully inserted {inserted_count}/{len(human_messages)} messages")
    return inserted_count


if __name__ == "__main__":
    # Initialize database
    db.init_db()

    if len(sys.argv) < 2:
        print("Usage: python message_importer.py <file.jsonl> [session_id] [--clear]")
        print()
        print("Arguments:")
        print("  file.jsonl    - Path to JSONL file to import")
        print("  session_id    - (Optional) Session ID. Will extract from file if not provided")
        print("  --clear       - (Optional) Clear existing messages before inserting")
        print()
        print("Examples:")
        print("  python message_importer.py session.jsonl")
        print("  python message_importer.py session.jsonl abc-123-def --clear")
        sys.exit(1)

    jsonl_path = sys.argv[1]
    session_id = None
    clear_existing = False

    # Parse arguments
    if len(sys.argv) > 2:
        for arg in sys.argv[2:]:
            if arg == '--clear':
                clear_existing = True
            else:
                session_id = arg

    # Import messages
    import_human_messages_from_jsonl(jsonl_path, session_id, clear_existing=clear_existing)
