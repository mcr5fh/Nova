#!/usr/bin/env python3
"""
SessionEnd Hook - Ingest Claude Code session when user exits via prompt

This hook receives JSON from stdin when a session ends with reason='prompt_input_exit'.
It ingests the session transcript into the Nova database for planning failure analysis.

Expected input JSON format:
{
  "session_id": "...",
  "transcript_path": "/path/to/session.jsonl",
  "cwd": "/path/to/project",
  "hook_event_name": "SessionEnd",
  "reason": "prompt_input_exit"
}

Usage:
    This script is called automatically by Claude Code via SessionEnd hook.
    It runs asynchronously with a 300s timeout.
"""

import json
import sys
import os
from pathlib import Path


def ingest_session(event_data: dict) -> dict:
    """
    Ingest a session transcript into Nova database.

    Args:
        event_data: SessionEnd event data from Claude Code

    Returns:
        Dictionary with ingestion results
    """
    session_id = event_data.get('session_id')
    transcript_path = event_data.get('transcript_path')
    reason = event_data.get('reason')

    result = {
        'success': False,
        'session_id': session_id,
        'transcript_path': transcript_path,
        'reason': reason,
        'error': None
    }

    # Only process sessions that ended via prompt_input_exit
    if reason != 'prompt_input_exit':
        result['error'] = f"Skipping: reason is '{reason}', not 'prompt_input_exit'"
        return result

    # Validate required fields
    if not session_id or not transcript_path:
        result['error'] = "Missing required fields: session_id or transcript_path"
        return result

    # Check if transcript file exists
    transcript_file = Path(transcript_path)
    if not transcript_file.exists():
        result['error'] = f"Transcript file not found: {transcript_path}"
        return result

    # Get the project root (cwd from event or script directory)
    project_root = event_data.get('cwd') or os.getcwd()

    # Import the ingest module (assumes script is in project with ingest.py)
    sys.path.insert(0, project_root)

    try:
        from ingest import ingest_file
        import db
        from contextlib import redirect_stdout, redirect_stderr

        # Initialize database (suppress output)
        with redirect_stdout(open(os.devnull, 'w')), redirect_stderr(open(os.devnull, 'w')):
            db.init_db()

            # Ingest the session (suppress output from print statements)
            ingest_result = ingest_file(str(transcript_file))

        if ingest_result['success']:
            result['success'] = True
            result['messages_imported'] = ingest_result.get('messages_imported', 0)
        else:
            result['error'] = ingest_result.get('error', 'Unknown error during ingestion')

    except ImportError as e:
        result['error'] = f"Failed to import ingest module: {e}"
    except Exception as e:
        result['error'] = f"Ingestion failed: {e}"

    return result


def main():
    """Entry point for SessionEnd hook."""
    try:
        # Read event JSON from stdin
        event_json = sys.stdin.read()

        if not event_json.strip():
            print(json.dumps({
                'success': False,
                'error': 'No input received from stdin'
            }), file=sys.stderr)
            sys.exit(1)

        # Parse JSON
        event_data = json.loads(event_json)

        # Ingest the session
        result = ingest_session(event_data)

        # Output result as JSON
        print(json.dumps(result, indent=2))

        # Exit with appropriate code
        sys.exit(0 if result['success'] else 1)

    except json.JSONDecodeError as e:
        print(json.dumps({
            'success': False,
            'error': f'Invalid JSON input: {e}'
        }), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Unexpected error: {e}'
        }), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
