#!/usr/bin/env python3
"""
Tests for SessionEnd hook script.

Run with: python3 -m pytest test_session_end_hook.py -v
"""

import json
import subprocess
import sys
from pathlib import Path


def test_hook_rejects_non_prompt_input_exit():
    """Test that hook only processes sessions ending with reason='prompt_input_exit'."""
    event_data = {
        "session_id": "test-123",
        "transcript_path": "/some/path.jsonl",
        "cwd": "/project",
        "hook_event_name": "SessionEnd",
        "reason": "other"
    }

    result = subprocess.run(
        [".claude/hooks/session-end-ingest.py"],
        input=json.dumps(event_data),
        text=True,
        capture_output=True
    )

    output = json.loads(result.stdout)
    assert output['success'] is False
    assert "reason is 'other'" in output['error']
    assert output['reason'] == "other"


def test_hook_requires_session_id():
    """Test that hook validates required fields."""
    event_data = {
        "transcript_path": "/some/path.jsonl",
        "hook_event_name": "SessionEnd",
        "reason": "prompt_input_exit"
    }

    result = subprocess.run(
        [".claude/hooks/session-end-ingest.py"],
        input=json.dumps(event_data),
        text=True,
        capture_output=True
    )

    output = json.loads(result.stdout)
    assert output['success'] is False
    assert "Missing required fields" in output['error']


def test_hook_requires_transcript_path():
    """Test that hook validates required fields."""
    event_data = {
        "session_id": "test-123",
        "hook_event_name": "SessionEnd",
        "reason": "prompt_input_exit"
    }

    result = subprocess.run(
        [".claude/hooks/session-end-ingest.py"],
        input=json.dumps(event_data),
        text=True,
        capture_output=True
    )

    output = json.loads(result.stdout)
    assert output['success'] is False
    assert "Missing required fields" in output['error']


def test_hook_checks_transcript_exists():
    """Test that hook verifies transcript file exists."""
    event_data = {
        "session_id": "test-123",
        "transcript_path": "/nonexistent/path.jsonl",
        "cwd": "/project",
        "hook_event_name": "SessionEnd",
        "reason": "prompt_input_exit"
    }

    result = subprocess.run(
        [".claude/hooks/session-end-ingest.py"],
        input=json.dumps(event_data),
        text=True,
        capture_output=True
    )

    output = json.loads(result.stdout)
    assert output['success'] is False
    assert "Transcript file not found" in output['error']


def test_hook_handles_invalid_json():
    """Test that hook handles malformed JSON input."""
    result = subprocess.run(
        [".claude/hooks/session-end-ingest.py"],
        input="not valid json",
        text=True,
        capture_output=True
    )

    assert result.returncode != 0
    error_output = json.loads(result.stderr)
    assert error_output['success'] is False
    assert "Invalid JSON input" in error_output['error']


def test_hook_handles_empty_input():
    """Test that hook handles empty input."""
    result = subprocess.run(
        [".claude/hooks/session-end-ingest.py"],
        input="",
        text=True,
        capture_output=True
    )

    assert result.returncode != 0
    error_output = json.loads(result.stderr)
    assert error_output['success'] is False
    assert "No input received" in error_output['error']


def test_hook_output_format():
    """Test that hook returns expected JSON structure."""
    event_data = {
        "session_id": "test-123",
        "transcript_path": "/nonexistent/path.jsonl",
        "cwd": "/project",
        "hook_event_name": "SessionEnd",
        "reason": "prompt_input_exit"
    }

    result = subprocess.run(
        [".claude/hooks/session-end-ingest.py"],
        input=json.dumps(event_data),
        text=True,
        capture_output=True
    )

    output = json.loads(result.stdout)
    assert 'success' in output
    assert 'session_id' in output
    assert 'transcript_path' in output
    assert 'reason' in output
    assert 'error' in output
    assert output['session_id'] == "test-123"
    assert output['reason'] == "prompt_input_exit"


if __name__ == "__main__":
    # Run pytest programmatically
    import pytest
    sys.exit(pytest.main([__file__, "-v"]))
