"""
Example usage of the session importer module.

This demonstrates how to:
1. Import a single JSONL file
2. Import all JSONL files from a directory
3. Query the imported sessions
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import db
from session_importer import import_session_from_jsonl, import_sessions_from_directory
import json


def example_import_single_file():
    """Example: Import a single JSONL file."""
    print("=" * 70)
    print("Example 1: Import a single JSONL file")
    print("=" * 70)

    # Path to a single JSONL file
    jsonl_file = Path.home() / ".claude" / "projects" / "-Users-ericmagliarditi-Desktop-Github-Nova" / "d4c5120a-eb6c-40c2-9dbf-2ecb737a07ec.jsonl"

    if jsonl_file.exists():
        print(f"Importing: {jsonl_file.name}")
        result = import_session_from_jsonl(str(jsonl_file))
        if result:
            print(f"✓ Import successful, database ID: {result}")
        else:
            print("✗ Import failed")
    else:
        print(f"File not found: {jsonl_file}")

    print()


def example_import_directory():
    """Example: Import all JSONL files from a directory."""
    print("=" * 70)
    print("Example 2: Import all JSONL files from a directory")
    print("=" * 70)

    # Path to directory containing JSONL files
    sessions_dir = Path.home() / ".claude" / "projects" / "-Users-ericmagliarditi-Desktop-Github-Nova"

    if sessions_dir.exists():
        print(f"Importing from: {sessions_dir}")
        count = import_sessions_from_directory(str(sessions_dir))
        print(f"✓ Successfully imported {count} sessions")
    else:
        print(f"Directory not found: {sessions_dir}")

    print()


def example_query_sessions():
    """Example: Query imported sessions."""
    print("=" * 70)
    print("Example 3: Query imported sessions")
    print("=" * 70)

    # Get all sessions
    all_sessions = db.get_all_sessions()
    print(f"Total sessions: {len(all_sessions)}")
    print()

    # Show recent sessions
    print("5 most recent sessions:")
    print("-" * 70)
    for session in all_sessions[:5]:
        metadata = json.loads(session['metadata']) if session['metadata'] else {}

        print(f"ID: {session['id']}")
        print(f"  Session: {session['session_id'][:16]}...")
        print(f"  Title: {session['title']}")
        print(f"  Branch: {metadata.get('branch', 'N/A')}")
        print(f"  CWD: {metadata.get('cwd', 'N/A')}")
        print(f"  Created: {session['created_at']}")
        print()

    # Group sessions by branch
    print("Sessions by branch:")
    print("-" * 70)
    branches = {}
    for session in all_sessions:
        if session['metadata']:
            metadata = json.loads(session['metadata'])
            branch = metadata.get('branch', 'unknown')
            branches[branch] = branches.get(branch, 0) + 1

    for branch, count in sorted(branches.items(), key=lambda x: x[1], reverse=True):
        print(f"  {branch}: {count} sessions")

    print()


def example_get_specific_session():
    """Example: Get a specific session by session_id."""
    print("=" * 70)
    print("Example 4: Get a specific session")
    print("=" * 70)

    # Get a session by ID
    session_id = "d4c5120a-eb6c-40c2-9dbf-2ecb737a07ec"
    session = db.get_session(session_id)

    if session:
        print(f"Found session: {session_id}")
        print(f"  Database ID: {session['id']}")
        print(f"  Title: {session['title']}")
        print(f"  Created: {session['created_at']}")

        if session['metadata']:
            metadata = json.loads(session['metadata'])
            print(f"  Branch: {metadata.get('branch', 'N/A')}")
            print(f"  CWD: {metadata.get('cwd', 'N/A')}")
            print(f"  Version: {metadata.get('version', 'N/A')}")
            print(f"  Source: {metadata.get('source_file', 'N/A')}")
    else:
        print(f"Session not found: {session_id}")

    print()


if __name__ == "__main__":
    print()
    print("SESSION IMPORTER - USAGE EXAMPLES")
    print("=" * 70)
    print()

    # Initialize database
    db.init_db()

    # Run examples
    # example_import_single_file()
    # example_import_directory()
    example_query_sessions()
    example_get_specific_session()

    print("=" * 70)
    print("Examples completed!")
    print()
