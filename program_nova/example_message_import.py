"""
Example: Import human messages from a JSONL file with message_index.

This demonstrates the complete workflow for extracting human messages
from a JSONL file and inserting them into the messages table.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import db
from program_nova.message_importer import import_human_messages_from_jsonl


def main():
    """
    Example workflow:
    1. Initialize the database
    2. Import a JSONL file
    3. Extract human messages in order
    4. Insert them with message_index
    """

    # Initialize database
    print("Initializing database...")
    db.init_db()
    print("✓ Database initialized\n")

    # Example JSONL file path (modify this to your actual file)
    jsonl_file = ".beads/interactions.jsonl"

    # Option 1: Auto-extract session_id from file
    print(f"Importing messages from: {jsonl_file}")
    print("Extracting session_id from file...\n")

    count = import_human_messages_from_jsonl(
        jsonl_file,
        clear_existing=True  # Clear existing messages before importing
    )

    print(f"\n✓ Import complete: {count} human messages imported with message_index")

    # Option 2: Provide explicit session_id
    # count = import_human_messages_from_jsonl(
    #     jsonl_file,
    #     session_id="my-session-id-123",
    #     clear_existing=True
    # )


if __name__ == "__main__":
    main()
