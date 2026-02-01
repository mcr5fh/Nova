"""
Session Importer - Reads JSONL files and extracts session metadata for database insertion.

This module reads Claude Code session JSONL files, extracts session metadata
(session_id, branch, cwd), and inserts them into the sessions table.
"""

import json
import sys
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import database module
import db


def extract_session_metadata_from_jsonl(jsonl_path: str) -> Optional[Dict[str, Any]]:
    """
    Extract session metadata from a JSONL file.

    The session metadata is typically found in the first user message of the JSONL file.

    Args:
        jsonl_path: Path to the .jsonl file

    Returns:
        Dictionary containing:
        - session_id: The session UUID
        - branch: Git branch name (if available)
        - cwd: Current working directory
        - timestamp: Session start timestamp
        Returns None if metadata cannot be extracted.
    """
    try:
        with open(jsonl_path, 'r') as f:
            # Read through lines to find the first one with metadata
            for line in f:
                line = line.strip()
                if not line:
                    continue

                try:
                    data = json.loads(line)

                    # Look for session metadata - typically in messages with cwd field
                    if 'cwd' in data and 'sessionId' in data:
                        return {
                            'session_id': data.get('sessionId'),
                            'branch': data.get('gitBranch'),
                            'cwd': data.get('cwd'),
                            'timestamp': data.get('timestamp'),
                            'version': data.get('version'),
                            'user_type': data.get('userType')
                        }

                except json.JSONDecodeError:
                    continue

    except FileNotFoundError:
        print(f"Error: File not found: {jsonl_path}")
        return None
    except Exception as e:
        print(f"Error reading file: {e}")
        return None

    return None


def import_session_from_jsonl(jsonl_path: str, db_path: str = None) -> Optional[int]:
    """
    Import a session from a JSONL file into the database.

    Args:
        jsonl_path: Path to the .jsonl file
        db_path: Optional database path

    Returns:
        Database ID of the created session, or None if import failed
    """
    # Extract metadata
    metadata = extract_session_metadata_from_jsonl(jsonl_path)

    if not metadata:
        print(f"Could not extract session metadata from {jsonl_path}")
        return None

    session_id = metadata['session_id']

    # Check if session already exists
    existing = db.get_session(session_id, db_path)
    if existing:
        print(f"Session {session_id} already exists in database")
        return existing['id']

    # Create title from filename or cwd
    filename = Path(jsonl_path).stem
    cwd = metadata.get('cwd', 'Unknown')
    title = f"{Path(cwd).name} - {filename[:8]}"

    # Prepare metadata for storage
    session_metadata = {
        'branch': metadata.get('branch'),
        'cwd': metadata.get('cwd'),
        'version': metadata.get('version'),
        'user_type': metadata.get('user_type'),
        'source_file': str(jsonl_path),
        'imported_at': datetime.now().isoformat()
    }

    # Create session in database
    try:
        db_id = db.create_session(
            session_id=session_id,
            title=title,
            metadata=session_metadata,
            db_path=db_path
        )
        print(f"✓ Imported session {session_id}")
        print(f"  CWD: {metadata.get('cwd')}")
        print(f"  Branch: {metadata.get('branch')}")
        print(f"  Database ID: {db_id}")
        return db_id

    except Exception as e:
        print(f"Error creating session: {e}")
        return None


def import_sessions_from_directory(directory_path: str, db_path: str = None) -> int:
    """
    Import all JSONL sessions from a directory.

    Args:
        directory_path: Path to directory containing .jsonl files
        db_path: Optional database path

    Returns:
        Number of sessions successfully imported
    """
    directory = Path(directory_path)
    if not directory.exists() or not directory.is_dir():
        print(f"Error: {directory_path} is not a valid directory")
        return 0

    jsonl_files = list(directory.glob("*.jsonl"))

    if not jsonl_files:
        print(f"No .jsonl files found in {directory_path}")
        return 0

    print(f"Found {len(jsonl_files)} JSONL files")
    print()

    imported_count = 0
    for jsonl_file in jsonl_files:
        result = import_session_from_jsonl(str(jsonl_file), db_path)
        if result:
            imported_count += 1
        print()

    print(f"Successfully imported {imported_count}/{len(jsonl_files)} sessions")
    return imported_count


if __name__ == "__main__":
    # Initialize database
    db.init_db()

    # Example usage
    if len(sys.argv) > 1:
        path = sys.argv[1]

        # Check if it's a file or directory
        path_obj = Path(path)
        if path_obj.is_file():
            import_session_from_jsonl(path)
        elif path_obj.is_dir():
            import_sessions_from_directory(path)
        else:
            print(f"Error: {path} is not a valid file or directory")
    else:
        # Default: import from Claude's project directory
        claude_project_dir = Path.home() / ".claude" / "projects" / "-Users-ericmagliarditi-Desktop-Github-Nova"

        if claude_project_dir.exists():
            print(f"Importing sessions from: {claude_project_dir}")
            print()
            import_sessions_from_directory(str(claude_project_dir))
        else:
            print("Usage: python session_importer.py <file.jsonl or directory>")
            print()
            print("Examples:")
            print("  python session_importer.py session.jsonl")
            print("  python session_importer.py ~/.claude/projects/my-project/")
