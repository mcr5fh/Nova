"""
Test script for session_importer module.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import db
from session_importer import extract_session_metadata_from_jsonl, import_session_from_jsonl
import json


def test_extract_metadata():
    """Test extracting metadata from a JSONL file."""
    print("Test 1: Extracting metadata from JSONL file")
    print("=" * 60)

    # Find a sample JSONL file
    claude_dir = Path.home() / ".claude" / "projects" / "-Users-ericmagliarditi-Desktop-Github-Nova"
    jsonl_files = list(claude_dir.glob("*.jsonl"))

    if not jsonl_files:
        print("No JSONL files found for testing")
        return

    test_file = jsonl_files[0]
    print(f"Testing with: {test_file.name}")
    print()

    metadata = extract_session_metadata_from_jsonl(str(test_file))

    if metadata:
        print("✓ Successfully extracted metadata:")
        print(f"  Session ID: {metadata['session_id']}")
        print(f"  Branch: {metadata.get('branch', 'N/A')}")
        print(f"  CWD: {metadata.get('cwd', 'N/A')}")
        print(f"  Version: {metadata.get('version', 'N/A')}")
        print(f"  Timestamp: {metadata.get('timestamp', 'N/A')}")
    else:
        print("✗ Failed to extract metadata")

    print()
    return metadata


def test_database_insertion():
    """Test inserting session into database."""
    print("Test 2: Database insertion")
    print("=" * 60)

    # Get a sample session
    sessions = db.get_all_sessions(limit=1)

    if sessions:
        session = sessions[0]
        print("✓ Found session in database:")
        print(f"  Database ID: {session['id']}")
        print(f"  Session ID: {session['session_id']}")
        print(f"  Title: {session['title']}")
        print(f"  Created: {session['created_at']}")

        # Parse metadata
        if session['metadata']:
            metadata = json.loads(session['metadata'])
            print(f"  Branch: {metadata.get('branch', 'N/A')}")
            print(f"  CWD: {metadata.get('cwd', 'N/A')}")
    else:
        print("✗ No sessions found in database")

    print()


def test_session_count():
    """Test counting all sessions."""
    print("Test 3: Session count")
    print("=" * 60)

    all_sessions = db.get_all_sessions()
    print(f"Total sessions in database: {len(all_sessions)}")

    # Group by branch
    branches = {}
    for session in all_sessions:
        if session['metadata']:
            metadata = json.loads(session['metadata'])
            branch = metadata.get('branch', 'unknown')
            branches[branch] = branches.get(branch, 0) + 1

    print()
    print("Sessions by branch:")
    for branch, count in sorted(branches.items(), key=lambda x: x[1], reverse=True):
        print(f"  {branch}: {count}")

    print()


if __name__ == "__main__":
    print("Testing Session Importer")
    print("=" * 60)
    print()

    # Initialize database
    db.init_db()

    # Run tests
    test_extract_metadata()
    test_database_insertion()
    test_session_count()

    print("All tests completed!")
