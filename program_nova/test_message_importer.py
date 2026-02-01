"""
Test script for message_importer module.

This demonstrates how to extract human messages from a JSONL file
and insert them into the messages table with message_index.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import db
from program_nova.message_importer import (
    extract_human_messages_from_jsonl,
    insert_human_messages,
    import_human_messages_from_jsonl,
    add_message_index_column
)


def test_extract_human_messages():
    """Test extracting human messages from a JSONL file."""
    print("=" * 60)
    print("TEST: Extract Human Messages from JSONL")
    print("=" * 60)

    # Use one of the example JSONL files
    test_file = Path(__file__).parent.parent / ".beads" / "interactions.jsonl"

    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        print("Skipping test")
        return

    messages = extract_human_messages_from_jsonl(str(test_file))

    print(f"\nFound {len(messages)} human messages\n")

    # Print first 3 messages as examples
    for i, msg in enumerate(messages[:3]):
        print(f"Message {i}:")
        print(f"  Index: {msg['message_index']}")
        print(f"  UUID: {msg.get('uuid', 'N/A')}")
        print(f"  Content preview: {msg['content'][:100]}...")
        print()

    if len(messages) > 3:
        print(f"... and {len(messages) - 3} more messages\n")


def test_add_message_index_column():
    """Test adding message_index column to messages table."""
    print("=" * 60)
    print("TEST: Add message_index Column")
    print("=" * 60)

    add_message_index_column()
    print()


def test_insert_messages():
    """Test inserting messages with message_index."""
    print("=" * 60)
    print("TEST: Insert Messages with message_index")
    print("=" * 60)

    # Create a test session
    test_session_id = "test-session-message-import"

    # Check if session exists, create if not
    existing = db.get_session(test_session_id)
    if not existing:
        print(f"Creating test session: {test_session_id}")
        db.create_session(
            session_id=test_session_id,
            title="Test Session for Message Import",
            metadata={"test": True}
        )

    # Create test messages
    test_messages = [
        {
            'content': 'First message',
            'uuid': 'msg-001',
            'timestamp': '2024-01-01T10:00:00Z',
            'message_index': 0
        },
        {
            'content': 'Second message',
            'uuid': 'msg-002',
            'timestamp': '2024-01-01T10:01:00Z',
            'message_index': 1
        },
        {
            'content': 'Third message',
            'uuid': 'msg-003',
            'timestamp': '2024-01-01T10:02:00Z',
            'message_index': 2
        }
    ]

    # Insert messages (clear existing first)
    count = insert_human_messages(test_session_id, test_messages, clear_existing=True)
    print(f"\nInserted {count} messages")

    # Verify insertion
    with db.get_connection() as conn:
        cursor = db.get_cursor(conn)
        cursor.execute(
            "SELECT role, content, message_index FROM messages WHERE session_id = ? ORDER BY message_index",
            (test_session_id,)
        )
        rows = cursor.fetchall()

        print(f"\nRetrieved {len(rows)} messages from database:")
        for row in rows:
            print(f"  [{row[2]}] {row[0]}: {row[1]}")

    print()


def test_full_import():
    """Test the complete import workflow."""
    print("=" * 60)
    print("TEST: Full Import Workflow")
    print("=" * 60)

    # Use one of the example JSONL files
    test_file = Path(__file__).parent.parent / ".beads" / "interactions.jsonl"

    if not test_file.exists():
        print(f"Test file not found: {test_file}")
        print("Skipping test")
        return

    # Import with a test session ID
    test_session_id = "test-full-import"

    # Create session if needed
    existing = db.get_session(test_session_id)
    if not existing:
        db.create_session(
            session_id=test_session_id,
            title="Test Full Import",
            metadata={"test": True}
        )

    # Import messages
    count = import_human_messages_from_jsonl(
        str(test_file),
        session_id=test_session_id,
        clear_existing=True
    )

    print(f"\nImported {count} messages")
    print()


if __name__ == "__main__":
    # Initialize database
    print("Initializing database...")
    db.init_db()
    print()

    # Run tests
    test_add_message_index_column()
    test_extract_human_messages()
    test_insert_messages()
    test_full_import()

    print("=" * 60)
    print("All tests completed!")
    print("=" * 60)
