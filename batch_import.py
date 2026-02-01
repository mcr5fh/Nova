#!/usr/bin/env python3
"""
Batch Import Tool (I1+I2 Combined)

Discovers all .jsonl files in a directory and runs:
- I1: Session metadata import
- I2: Human message import

Automatically skips already-ingested sessions.

Usage:
    python batch_import.py /path/to/directory
    python batch_import.py /path/to/directory --clear-messages
    python batch_import.py  # Uses default Claude projects directory
"""

import sys
from pathlib import Path
from typing import Optional, Dict, List
from program_nova.session_importer import import_session_from_jsonl
from program_nova.message_importer import import_human_messages_from_jsonl
from program_nova.jsonl_parser import parse_jsonl_line
import db


def get_session_id_from_jsonl(jsonl_path: str) -> Optional[str]:
    """
    Extract session_id from a JSONL file by reading the first line.

    Args:
        jsonl_path: Path to the JSONL file

    Returns:
        Session ID string or None if not found
    """
    import json

    try:
        with open(jsonl_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    # Look for session metadata - typically in first line with sessionId field
                    if 'sessionId' in data:
                        return data.get('sessionId')
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        print(f"Error extracting session_id from {jsonl_path}: {e}")
    return None


def import_single_file(
    jsonl_path: str,
    db_path: str = None,
    clear_messages: bool = False,
    verbose: bool = True
) -> Dict[str, any]:
    """
    Run I1+I2 import for a single JSONL file.

    Args:
        jsonl_path: Path to the JSONL file
        db_path: Path to the SQLite database (default: nova.db)
        clear_messages: Whether to clear existing messages before importing
        verbose: Whether to print progress messages

    Returns:
        Dictionary with import results:
        {
            'success': bool,
            'session_id': str,
            'session_db_id': int,
            'messages_imported': int,
            'skipped': bool,
            'error': str (if failed)
        }
    """
    result = {
        'success': False,
        'session_id': None,
        'session_db_id': None,
        'messages_imported': 0,
        'skipped': False,
        'error': None
    }

    try:
        # Step 1: I1 - Import session metadata
        if verbose:
            print(f"\n[I1] Importing session from: {jsonl_path}")

        session_db_id = import_session_from_jsonl(jsonl_path, db_path)

        if not session_db_id:
            result['error'] = "Failed to import session"
            return result

        result['session_db_id'] = session_db_id

        # Extract session_id for I2
        session_id = get_session_id_from_jsonl(jsonl_path)
        if not session_id:
            result['error'] = "Could not extract session_id from file"
            return result

        result['session_id'] = session_id

        # Check if this session was already imported (messages exist)
        if not clear_messages:
            with db.get_connection(db_path) as conn:
                cursor = conn.execute(
                    "SELECT COUNT(*) FROM messages WHERE session_id = ?",
                    (session_id,)
                )
                existing_count = cursor.fetchone()[0]

            if existing_count > 0:
                if verbose:
                    print(f"[I2] Session {session_id[:8]}... already has {existing_count} messages - skipping")
                result['skipped'] = True
                result['messages_imported'] = existing_count
                result['success'] = True
                return result

        # Step 2: I2 - Import human messages
        if verbose:
            print(f"[I2] Importing messages for session {session_id[:8]}...")

        messages_count = import_human_messages_from_jsonl(
            jsonl_path=jsonl_path,
            session_id=session_id,
            db_path=db_path,
            clear_existing=clear_messages
        )

        result['messages_imported'] = messages_count
        result['success'] = True

        if verbose:
            print(f"✓ Imported {messages_count} messages")

    except Exception as e:
        result['error'] = str(e)
        if verbose:
            print(f"✗ Error importing {jsonl_path}: {e}")

    return result


def batch_import_from_directory(
    directory_path: str,
    db_path: str = None,
    clear_messages: bool = False,
    verbose: bool = True
) -> Dict[str, any]:
    """
    Discover all .jsonl files in a directory and run I1+I2 for each.

    Args:
        directory_path: Path to directory containing .jsonl files
        db_path: Path to the SQLite database (default: nova.db)
        clear_messages: Whether to clear existing messages before importing
        verbose: Whether to print progress messages

    Returns:
        Dictionary with batch import results:
        {
            'total_files': int,
            'successful': int,
            'skipped': int,
            'failed': int,
            'total_messages': int,
            'results': List[Dict]  # Per-file results
        }
    """
    directory = Path(directory_path)

    if not directory.exists():
        raise ValueError(f"Directory does not exist: {directory_path}")

    if not directory.is_dir():
        raise ValueError(f"Path is not a directory: {directory_path}")

    # Discover all .jsonl files
    jsonl_files = sorted(directory.glob("*.jsonl"))

    if not jsonl_files:
        print(f"No .jsonl files found in {directory_path}")
        return {
            'total_files': 0,
            'successful': 0,
            'skipped': 0,
            'failed': 0,
            'total_messages': 0,
            'results': []
        }

    if verbose:
        print(f"\n{'='*60}")
        print(f"Batch Import: Found {len(jsonl_files)} .jsonl files")
        print(f"Directory: {directory_path}")
        print(f"Clear messages: {clear_messages}")
        print(f"{'='*60}")

    # Process each file
    results = []
    successful = 0
    skipped = 0
    failed = 0
    total_messages = 0

    for i, jsonl_file in enumerate(jsonl_files, 1):
        if verbose:
            print(f"\n[{i}/{len(jsonl_files)}] Processing: {jsonl_file.name}")

        result = import_single_file(
            str(jsonl_file),
            db_path=db_path,
            clear_messages=clear_messages,
            verbose=verbose
        )

        result['filename'] = jsonl_file.name
        results.append(result)

        if result['success']:
            if result['skipped']:
                skipped += 1
            else:
                successful += 1
            total_messages += result['messages_imported']
        else:
            failed += 1

    # Summary
    summary = {
        'total_files': len(jsonl_files),
        'successful': successful,
        'skipped': skipped,
        'failed': failed,
        'total_messages': total_messages,
        'results': results
    }

    if verbose:
        print(f"\n{'='*60}")
        print(f"Batch Import Summary:")
        print(f"  Total files: {summary['total_files']}")
        print(f"  Successful: {summary['successful']}")
        print(f"  Skipped (already imported): {summary['skipped']}")
        print(f"  Failed: {summary['failed']}")
        print(f"  Total messages imported: {summary['total_messages']}")
        print(f"{'='*60}\n")

    return summary


def get_default_directory() -> Optional[str]:
    """Get the default Claude projects directory for this repo."""
    home = Path.home()
    # Convert /Users/ericmagliarditi/Desktop/Github/Nova to
    # ~/.claude/projects/-Users-ericmagliarditi-Desktop-Github-Nova/
    cwd_encoded = str(Path.cwd()).replace('/', '-')
    default_dir = home / ".claude" / "projects" / cwd_encoded

    if default_dir.exists():
        return str(default_dir)
    return None


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Batch import .jsonl files (I1+I2 combined)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Import all .jsonl files from a directory
  python batch_import.py /path/to/directory

  # Import with clearing existing messages (re-import)
  python batch_import.py /path/to/directory --clear-messages

  # Use default Claude projects directory
  python batch_import.py

  # Use custom database
  python batch_import.py /path/to/directory --db custom.db
        """
    )

    parser.add_argument(
        'directory',
        nargs='?',
        help='Directory containing .jsonl files (default: ~/.claude/projects/<cwd>/)'
    )

    parser.add_argument(
        '--clear-messages',
        action='store_true',
        help='Clear existing messages before importing (allows re-import)'
    )

    parser.add_argument(
        '--db',
        default=None,
        help='Path to SQLite database (default: nova.db)'
    )

    parser.add_argument(
        '--quiet',
        action='store_true',
        help='Suppress progress messages'
    )

    args = parser.parse_args()

    # Determine directory
    directory = args.directory
    if not directory:
        directory = get_default_directory()
        if not directory:
            print("Error: No directory specified and default directory not found")
            print("Default would be: ~/.claude/projects/-Users-ericmagliarditi-Desktop-Github-Nova/")
            sys.exit(1)
        print(f"Using default directory: {directory}")

    # Run batch import
    try:
        summary = batch_import_from_directory(
            directory_path=directory,
            db_path=args.db,
            clear_messages=args.clear_messages,
            verbose=not args.quiet
        )

        # Exit with error code if any imports failed
        sys.exit(0 if summary['failed'] == 0 else 1)

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
