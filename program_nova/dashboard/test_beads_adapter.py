"""Tests for beads_adapter module.

Tests the transformation of bead graph data into dashboard format.
"""

import json
import pytest
from unittest.mock import Mock, patch
from program_nova.dashboard.beads_adapter import (
    get_epic_status,
    map_bead_status,
    parse_metrics_from_comments,
)


def test_map_bead_status_open():
    """Test mapping open bead status to pending."""
    assert map_bead_status("open") == "pending"


def test_map_bead_status_in_progress():
    """Test mapping in_progress bead status."""
    assert map_bead_status("in_progress") == "in_progress"


def test_map_bead_status_closed():
    """Test mapping closed bead status to completed."""
    assert map_bead_status("closed") == "completed"


def test_map_bead_status_deferred():
    """Test mapping deferred bead status to pending."""
    assert map_bead_status("deferred") == "pending"


def test_map_bead_status_unknown():
    """Test mapping unknown status defaults to pending."""
    assert map_bead_status("unknown") == "pending"


@patch("subprocess.run")
def test_parse_metrics_from_comments_no_comments(mock_run):
    """Test parsing metrics when bead has no comments."""
    mock_run.return_value = Mock(returncode=0, stdout="[]")
    assert parse_metrics_from_comments("Nova-abc.1") == {}


@patch("subprocess.run")
def test_parse_metrics_from_comments_command_fails(mock_run):
    """Test parsing metrics when bd comments command fails."""
    mock_run.return_value = Mock(returncode=1, stdout="")
    assert parse_metrics_from_comments("Nova-abc.1") == {}


@patch("subprocess.run")
def test_parse_metrics_from_comments_invalid_json(mock_run):
    """Test parsing metrics when comment has invalid JSON."""
    comments = [{"text": "not json"}]
    mock_run.return_value = Mock(returncode=0, stdout=json.dumps(comments))
    assert parse_metrics_from_comments("Nova-abc.1") == {}


@patch("subprocess.run")
def test_parse_metrics_from_comments_no_metrics_type(mock_run):
    """Test parsing when comments exist but none have type='metrics'."""
    comments = [
        {"text": json.dumps({"type": "note", "content": "Some note"})},
        {"text": json.dumps({"type": "log", "message": "Some log"})}
    ]
    mock_run.return_value = Mock(returncode=0, stdout=json.dumps(comments))
    assert parse_metrics_from_comments("Nova-abc.1") == {}


@patch("subprocess.run")
def test_parse_metrics_from_comments_valid(mock_run):
    """Test parsing valid metrics from comments."""
    metrics_comment = {
        "type": "metrics",
        "token_usage": {
            "input_tokens": 1234,
            "output_tokens": 567,
            "cache_read_tokens": 890,
            "cache_creation_tokens": 12,
        },
        "cost_usd": 0.0523,
        "duration_seconds": 45,
    }
    comments = [
        {"text": json.dumps({"type": "note", "content": "Some note"})},
        {"text": json.dumps(metrics_comment)},
    ]
    mock_run.return_value = Mock(returncode=0, stdout=json.dumps(comments))

    result = parse_metrics_from_comments("Nova-abc.1")

    # Verify it called bd comments correctly
    mock_run.assert_called_once_with(
        ["bd", "comments", "Nova-abc.1", "--json"],
        capture_output=True,
        text=True
    )

    # Verify returned metrics (without 'type' field)
    assert result["token_usage"]["input_tokens"] == 1234
    assert result["token_usage"]["output_tokens"] == 567
    assert result["cost_usd"] == 0.0523
    assert result["duration_seconds"] == 45
    assert "type" not in result


@patch("subprocess.run")
def test_parse_metrics_from_comments_missing_fields(mock_run):
    """Test parsing metrics with missing optional fields."""
    metrics_comment = {
        "type": "metrics",
        "token_usage": {},
        # Missing cost_usd and duration_seconds
    }
    comments = [{"text": json.dumps(metrics_comment)}]
    mock_run.return_value = Mock(returncode=0, stdout=json.dumps(comments))

    result = parse_metrics_from_comments("Nova-abc.1")

    # Should return defaults for missing fields
    assert result["token_usage"] == {}
    assert result["cost_usd"] == 0
    assert result["duration_seconds"] == 0


def test_get_epic_status_basic_structure(tmp_path, monkeypatch):
    """Test basic structure of get_epic_status output."""
    # Mock subprocess.run to return a sample graph
    import subprocess

    sample_graph = {
        "root": {
            "id": "Nova-abc",
            "title": "Test Epic",
            "type": "epic",
            "status": "open",
        },
        "issues": [
            {
                "id": "Nova-abc",
                "title": "Test Epic",
                "type": "epic",
                "status": "open",
            },
            {
                "id": "Nova-abc.1",
                "title": "Task 1",
                "type": "task",
                "status": "open",
            },
            {
                "id": "Nova-abc.2",
                "title": "Task 2",
                "type": "task",
                "status": "in_progress",
                "updated_at": "2026-01-31T10:00:00",
            },
        ],
        "layout": {
            "Layers": [["Nova-abc"], ["Nova-abc.1", "Nova-abc.2"]],
            "Nodes": {
                "Nova-abc": {"DependsOn": []},
                "Nova-abc.1": {"DependsOn": []},
                "Nova-abc.2": {"DependsOn": ["Nova-abc.1"]},
            },
        },
    }

    # Mock metrics comment for Nova-abc.2
    metrics_comment = {
        "type": "metrics",
        "token_usage": {
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0
        },
        "cost_usd": 0.001,
        "duration_seconds": 10
    }

    def mock_run(*args, **kwargs):
        # Return graph for 'bd graph' command
        if args[0][0] == "bd" and args[0][1] == "graph":
            class Result:
                stdout = json.dumps(sample_graph)
                returncode = 0
            return Result()
        # Return comments for 'bd comments' command
        elif args[0][0] == "bd" and args[0][1] == "comments":
            bead_id = args[0][2]
            if bead_id == "Nova-abc.2":
                # Return metrics comment for task 2
                comments = [{"text": json.dumps(metrics_comment)}]
                class Result:
                    stdout = json.dumps(comments)
                    returncode = 0
                return Result()
            else:
                # No comments for other beads
                class Result:
                    stdout = "[]"
                    returncode = 0
                return Result()

    monkeypatch.setattr(subprocess, "run", mock_run)

    result = get_epic_status("Nova-abc")

    # Check top-level structure
    assert "project" in result
    assert "tasks" in result
    assert "hierarchy" in result
    assert "task_definitions" in result
    assert "rollups" in result

    # Check project name
    assert result["project"]["name"] == "Test Epic"

    # Check tasks (epic should be excluded)
    assert len(result["tasks"]) == 2
    assert "Nova-abc" not in result["tasks"]
    assert "Nova-abc.1" in result["tasks"]
    assert "Nova-abc.2" in result["tasks"]

    # Check task 1
    task1 = result["tasks"]["Nova-abc.1"]
    assert task1["name"] == "Task 1"
    assert task1["status"] == "pending"
    assert task1["token_usage"] == {}

    # Check task 2
    task2 = result["tasks"]["Nova-abc.2"]
    assert task2["name"] == "Task 2"
    assert task2["status"] == "in_progress"
    assert task2["token_usage"]["input_tokens"] == 100
    assert task2["duration_seconds"] == 10

    # Check hierarchy
    assert "Layer 0" not in result["hierarchy"] or len(result["hierarchy"]["Layer 0"]["All"]) == 0
    assert "Layer 1" in result["hierarchy"]
    assert "Nova-abc.1" in result["hierarchy"]["Layer 1"]["All"]
    assert "Nova-abc.2" in result["hierarchy"]["Layer 1"]["All"]

    # Check task definitions
    assert "Nova-abc.1" in result["task_definitions"]
    assert result["task_definitions"]["Nova-abc.1"]["depends_on"] == []
    assert "Nova-abc.2" in result["task_definitions"]
    assert result["task_definitions"]["Nova-abc.2"]["depends_on"] == ["Nova-abc.1"]
