#!/usr/bin/env python3
"""
Integration tests for SessionEnd hook with actual ingestion.

Run with: python3 -m pytest test_session_end_hook_integration.py -v
"""

import json
import subprocess
import tempfile
import os
from pathlib import Path


def create_test_jsonl():
    """Create a minimal test JSONL file with correct Claude Code format."""
    # Create a simple test transcript matching actual Claude Code format
    events = [
        {
            "type": "queue-operation",
            "operation": "dequeue",
            "timestamp": "2026-01-31T00:00:00.000Z",
            "sessionId": "test-integration-123"
        },
        {
            "parentUuid": None,
            "isSidechain": False,
            "userType": "external",
            "cwd": "/test/project",
            "sessionId": "test-integration-123",
            "version": "2.1.1",
            "gitBranch": "main",
            "type": "user",
            "message": {
                "role": "user",
                "content": "Hello, can you help me?"
            },
            "uuid": "msg-001",
            "timestamp": "2026-01-31T00:00:01.000Z"
        },
        {
            "parentUuid": "msg-001",
            "isSidechain": False,
            "userType": "external",
            "cwd": "/test/project",
            "sessionId": "test-integration-123",
            "version": "2.1.1",
            "gitBranch": "main",
            "message": {
                "model": "claude-sonnet-4-5",
                "role": "assistant",
                "content": [{"type": "text", "text": "Hello! I'd be happy to help."}]
            },
            "type": "assistant",
            "uuid": "asst-001",
            "timestamp": "2026-01-31T00:00:02.000Z"
        },
        {
            "parentUuid": "asst-001",
            "isSidechain": False,
            "userType": "external",
            "cwd": "/test/project",
            "sessionId": "test-integration-123",
            "version": "2.1.1",
            "gitBranch": "main",
            "type": "user",
            "message": {
                "role": "user",
                "content": "Thanks!"
            },
            "uuid": "msg-002",
            "timestamp": "2026-01-31T00:00:03.000Z"
        }
    ]

    # Create temp file
    fd, path = tempfile.mkstemp(suffix=".jsonl")
    with os.fdopen(fd, 'w') as f:
        for event in events:
            f.write(json.dumps(event) + '\n')

    return path


def test_hook_integration_with_real_file():
    """Test hook with a real JSONL file and database ingestion."""
    # Create test JSONL file
    transcript_path = create_test_jsonl()

    try:
        event_data = {
            "session_id": "test-integration-123",
            "transcript_path": transcript_path,
            "cwd": os.getcwd(),
            "hook_event_name": "SessionEnd",
            "reason": "prompt_input_exit"
        }

        result = subprocess.run(
            [".claude/hooks/session-end-ingest.py"],
            input=json.dumps(event_data),
            text=True,
            capture_output=True,
            cwd=os.getcwd()
        )

        # Parse output
        if result.stdout:
            output = json.loads(result.stdout)

            # Should succeed with proper ingestion
            assert output['success'] is True, f"Expected success, got error: {output.get('error')}"
            assert 'messages_imported' in output
            assert output['messages_imported'] >= 2  # At least 2 user messages

    finally:
        # Clean up
        Path(transcript_path).unlink(missing_ok=True)


def test_hook_preserves_event_data():
    """Test that hook output includes all relevant event data."""
    # Create test JSONL file
    transcript_path = create_test_jsonl()

    try:
        event_data = {
            "session_id": "test-preserve-data",
            "transcript_path": transcript_path,
            "cwd": os.getcwd(),
            "hook_event_name": "SessionEnd",
            "reason": "prompt_input_exit"
        }

        result = subprocess.run(
            [".claude/hooks/session-end-ingest.py"],
            input=json.dumps(event_data),
            text=True,
            capture_output=True,
            cwd=os.getcwd()
        )

        output = json.loads(result.stdout)

        # Check that output preserves input data
        assert output['session_id'] == "test-preserve-data"
        assert output['transcript_path'] == transcript_path
        assert output['reason'] == "prompt_input_exit"

    finally:
        # Clean up
        Path(transcript_path).unlink(missing_ok=True)


if __name__ == "__main__":
    # Run pytest programmatically
    import sys
    import pytest
    sys.exit(pytest.main([__file__, "-v"]))
