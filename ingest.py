#!/usr/bin/env python3
"""
Ingest Tool - Import Claude Code JSONL files into Nova database

Accepts a file or directory path and ingests session metadata and messages.
Prints a summary of what was ingested.

Usage:
    python ingest.py <path>                    # Ingest single file or directory
    python ingest.py <path> --clear-messages   # Re-import with message clearing
    python ingest.py <path> --db custom.db     # Use custom database
"""

import argparse
import sys
from pathlib import Path
from typing import Dict, List
from program_nova.session_importer import import_session_from_jsonl
from program_nova.message_importer import import_human_messages_from_jsonl
import db


def ingest_file(
    file_path: str,
    db_path: str = None,
    clear_messages: bool = False
) -> Dict:
    """
    Ingest a single JSONL file.

    Args:
        file_path: Path to JSONL file
        db_path: Optional database path
        clear_messages: Whether to clear existing messages

    Returns:
        Dictionary with ingestion results
    """
    result = {
        'type': 'file',
        'path': file_path,
        'success': False,
        'session_id': None,
        'messages_imported': 0,
        'error': None
    }

    try:
        # Import session metadata
        session_db_id = import_session_from_jsonl(file_path, db_path)

        if not session_db_id:
            result['error'] = "Failed to import session metadata"
            return result

        # Extract session_id from file for message import
        from batch_import import get_session_id_from_jsonl
        session_id = get_session_id_from_jsonl(file_path)

        if not session_id:
            result['error'] = "Could not extract session_id from file"
            return result

        result['session_id'] = session_id

        # Import messages
        messages_count = import_human_messages_from_jsonl(
            jsonl_path=file_path,
            session_id=session_id,
            db_path=db_path,
            clear_existing=clear_messages
        )

        result['messages_imported'] = messages_count
        result['success'] = True

    except Exception as e:
        result['error'] = str(e)

    return result


def ingest_directory(
    directory_path: str,
    db_path: str = None,
    clear_messages: bool = False
) -> Dict:
    """
    Ingest all JSONL files in a directory.

    Args:
        directory_path: Path to directory
        db_path: Optional database path
        clear_messages: Whether to clear existing messages

    Returns:
        Dictionary with ingestion results
    """
    directory = Path(directory_path)

    if not directory.exists():
        return {
            'type': 'directory',
            'path': directory_path,
            'success': False,
            'error': f"Directory does not exist: {directory_path}"
        }

    if not directory.is_dir():
        return {
            'type': 'directory',
            'path': directory_path,
            'success': False,
            'error': f"Path is not a directory: {directory_path}"
        }

    # Find all JSONL files
    jsonl_files = sorted(directory.glob("*.jsonl"))

    results = {
        'type': 'directory',
        'path': directory_path,
        'success': True,
        'total_files': len(jsonl_files),
        'files_ingested': 0,
        'total_messages': 0,
        'files': []
    }

    if not jsonl_files:
        results['success'] = False
        results['error'] = f"No .jsonl files found in {directory_path}"
        return results

    # Ingest each file
    for jsonl_file in jsonl_files:
        file_result = ingest_file(
            str(jsonl_file),
            db_path=db_path,
            clear_messages=clear_messages
        )
        file_result['filename'] = jsonl_file.name
        results['files'].append(file_result)

        if file_result['success']:
            results['files_ingested'] += 1
            results['total_messages'] += file_result['messages_imported']

    return results


def print_summary(result: Dict):
    """
    Print a formatted summary of ingestion results.

    Args:
        result: Dictionary containing ingestion results
    """
    print("\n" + "=" * 70)
    print("INGESTION SUMMARY")
    print("=" * 70)

    if result['type'] == 'file':
        # Single file summary
        print(f"\nType:     Single File")
        print(f"Path:     {result['path']}")

        if result['success']:
            print(f"Status:   ✓ Success")
            print(f"\nSession ID:        {result['session_id'][:16]}...")
            print(f"Messages Imported: {result['messages_imported']}")
        else:
            print(f"Status:   ✗ Failed")
            print(f"Error:    {result['error']}")

    elif result['type'] == 'directory':
        # Directory summary
        print(f"\nType:     Directory")
        print(f"Path:     {result['path']}")

        if not result['success']:
            print(f"Status:   ✗ Failed")
            print(f"Error:    {result['error']}")
        else:
            print(f"Status:   ✓ Success")
            print(f"\nFiles Found:       {result['total_files']}")
            print(f"Files Ingested:    {result['files_ingested']}")
            print(f"Total Messages:    {result['total_messages']}")

            # Show per-file details
            if result['files']:
                print(f"\nFile Details:")
                print("-" * 70)
                for file_result in result['files']:
                    status_icon = "✓" if file_result['success'] else "✗"
                    filename = file_result['filename']
                    messages = file_result['messages_imported']
                    print(f"  {status_icon} {filename:50} {messages:>5} messages")

                    if not file_result['success']:
                        print(f"      Error: {file_result['error']}")

    print("=" * 70 + "\n")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest Claude Code JSONL files into Nova database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Ingest a single file
  python ingest.py /path/to/session.jsonl

  # Ingest all files in a directory
  python ingest.py /path/to/directory

  # Re-import with message clearing
  python ingest.py /path/to/directory --clear-messages

  # Use custom database
  python ingest.py /path/to/directory --db custom.db
        """
    )

    parser.add_argument(
        'path',
        help='Path to JSONL file or directory containing JSONL files'
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

    args = parser.parse_args()

    # Initialize database
    db.init_db(args.db)

    # Determine if path is file or directory
    path = Path(args.path)

    if not path.exists():
        print(f"Error: Path does not exist: {args.path}")
        sys.exit(1)

    # Ingest
    if path.is_file():
        if not path.suffix == '.jsonl':
            print(f"Error: File must have .jsonl extension: {args.path}")
            sys.exit(1)

        result = ingest_file(
            str(path),
            db_path=args.db,
            clear_messages=args.clear_messages
        )
    elif path.is_dir():
        result = ingest_directory(
            str(path),
            db_path=args.db,
            clear_messages=args.clear_messages
        )
    else:
        print(f"Error: Path is neither a file nor directory: {args.path}")
        sys.exit(1)

    # Print summary
    print_summary(result)

    # Exit with appropriate code
    if not result['success']:
        sys.exit(1)


if __name__ == "__main__":
    main()
