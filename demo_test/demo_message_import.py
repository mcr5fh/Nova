#!/usr/bin/env python3
"""
Demo: Complete message import workflow

This script demonstrates:
1. Extracting human messages from a JSONL file
2. Inserting them into the database with message_index
3. Querying the results
"""

import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

import db
from program_nova.message_importer import import_human_messages_from_jsonl


def main():
    # Initialize database
    print("=" * 70)
    print("MESSAGE IMPORT DEMO")
    print("=" * 70)
    print()

    print("Step 1: Initializing database...")
    db.init_db()
    print("✓ Database initialized\n")

    # Example JSONL file - replace with your actual file
    jsonl_file = Path.home() / ".claude" / "projects" / "-Users-ericmagliarditi-Desktop-Github-Nova" / "8c528027-9be1-4e86-814d-9b8dbeb2d674.jsonl"

    if not jsonl_file.exists():
        print(f"Error: JSONL file not found: {jsonl_file}")
        print("\nPlease update the jsonl_file variable in this script")
        print("to point to a valid JSONL session file.")
        return

    # Import messages
    print(f"Step 2: Importing messages from:")
    print(f"  {jsonl_file.name}")
    print()

    count = import_human_messages_from_jsonl(
        str(jsonl_file),
        clear_existing=True  # Remove existing messages before import
    )

    if count == 0:
        print("No messages imported. Check the file format.")
        return

    print(f"\n✓ Successfully imported {count} human messages\n")

    # Query and display results
    print("Step 3: Querying imported messages...")
    print()

    session_id = jsonl_file.stem  # Use filename as session_id

    # Get messages from database
    messages = db.get_messages(session_id, limit=10)

    print(f"First {min(len(messages), 10)} messages (out of {count}):")
    print("-" * 70)

    for msg in messages:
        idx = msg.get('message_index', 'N/A')
        role = msg['role']
        content = msg['content']

        # Truncate long messages
        if len(content) > 100:
            content_preview = content[:100] + "..."
        else:
            content_preview = content

        # Replace newlines for cleaner display
        content_preview = content_preview.replace('\n', ' ')

        print(f"[{idx}] {role}: {content_preview}")

    print("-" * 70)

    # Show statistics
    print()
    print("Statistics:")
    print(f"  Total messages imported: {count}")
    print(f"  Session ID: {session_id}")
    print(f"  Database: {db.DB_PATH}")

    print()
    print("=" * 70)
    print("Demo complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
