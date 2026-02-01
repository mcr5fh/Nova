"""Tests for FastAPI server endpoints."""

import json
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from program_nova.dashboard.server import create_app
from program_nova.engine.state import StateManager, TaskStatus


@pytest.fixture
def temp_state_file():
    """Create a temporary state file for testing."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        temp_path = f.name
    yield temp_path
    # Cleanup
    Path(temp_path).unlink(missing_ok=True)


@pytest.fixture
def temp_cascade_file():
    """Create a temporary CASCADE.md file for testing."""
    cascade_content = """# Test Project

## L1: Application

### L2: Foundation
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | Core Types | Define base types | - |
| F2 | Error Handling | Implement errors | F1 |

### L2: Provider Layer
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| P1 | Provider Interface | Define provider | F1 |
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        f.write(cascade_content)
        temp_path = f.name
    yield temp_path
    # Cleanup
    Path(temp_path).unlink(missing_ok=True)


@pytest.fixture
def initialized_state(temp_state_file, temp_cascade_file):
    """Create an initialized state with some tasks."""
    sm = StateManager(temp_state_file)
    sm.initialize(
        project_name="Test Project",
        cascade_file=temp_cascade_file
    )

    # Add some tasks
    sm.update_task(
        task_id="F1",
        status=TaskStatus.COMPLETED,
        worker_id="worker-1",
        pid=12345,
        started_at="2024-01-01T10:00:00Z",
    )
    sm.complete_task(
        task_id="F1",
        completed_at="2024-01-01T10:05:00Z",
        duration_seconds=300,
        commit_sha="abc123",
        files_changed=["src/types.py"],
    )
    sm.update_task_tokens(
        task_id="F1",
        input_tokens=1000,
        output_tokens=500,
        cache_read_tokens=200,
        cache_creation_tokens=100,
    )

    sm.update_task(
        task_id="F2",
        status=TaskStatus.IN_PROGRESS,
        worker_id="worker-2",
        pid=12346,
        started_at="2024-01-01T10:05:00Z",
        current_step="Writing error types",
    )

    sm.update_task(
        task_id="P1",
        status=TaskStatus.PENDING,
    )

    return temp_state_file, temp_cascade_file


@pytest.fixture
def client(initialized_state):
    """Create a test client for the FastAPI app."""
    state_file, cascade_file = initialized_state
    app = create_app(state_file, cascade_file)
    return TestClient(app)


@pytest.fixture
def logs_dir():
    """Create a temporary logs directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        logs_path = Path(tmpdir)
        # Create sample log files
        (logs_path / "F1.log").write_text("Log line 1\nLog line 2\nLog line 3\n")
        (logs_path / "F2.log").write_text("Current task log\n")
        yield logs_path


class TestStatusEndpoint:
    """Test /api/status endpoint."""

    def test_get_status_success(self, client):
        """GET /api/status returns full state with rollups."""
        response = client.get("/api/status")
        assert response.status_code == 200

        data = response.json()
        assert "project" in data
        assert "tasks" in data
        assert "rollups" in data

        # Check project info
        assert data["project"]["name"] == "Test Project"

        # Check tasks
        assert "F1" in data["tasks"]
        assert "F2" in data["tasks"]
        assert "P1" in data["tasks"]

        # Check F1 task
        f1 = data["tasks"]["F1"]
        assert f1["status"] == "completed"
        assert f1["duration_seconds"] == 300
        assert f1["token_usage"]["input_tokens"] == 1000

        # Check rollups exist
        assert "l0_rollup" in data["rollups"]
        assert "l1_rollups" in data["rollups"]
        assert "l2_rollups" in data["rollups"]


class TestTaskEndpoint:
    """Test /api/tasks/{task_id} endpoint."""

    def test_get_task_success(self, client):
        """GET /api/tasks/{task_id} returns task details."""
        response = client.get("/api/tasks/F1")
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == "F1"
        assert data["status"] == "completed"
        assert data["duration_seconds"] == 300
        assert data["worker_id"] == "worker-1"
        assert data["commit_sha"] == "abc123"

    def test_get_task_in_progress(self, client):
        """GET /api/tasks/{task_id} for in-progress task."""
        response = client.get("/api/tasks/F2")
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == "F2"
        assert data["status"] == "in_progress"
        assert data["current_step"] == "Writing error types"

    def test_get_task_not_found(self, client):
        """GET /api/tasks/{task_id} for non-existent task returns 404."""
        response = client.get("/api/tasks/NONEXISTENT")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestLogsEndpoint:
    """Test /api/tasks/{task_id}/logs endpoint."""

    def test_get_logs_success(self, client, logs_dir, monkeypatch):
        """GET /api/tasks/{task_id}/logs returns log file content."""
        # Mock the logs directory
        monkeypatch.setattr(
            "program_nova.dashboard.server.LOGS_DIR",
            logs_dir
        )

        response = client.get("/api/tasks/F1/logs")
        assert response.status_code == 200

        data = response.json()
        assert data["task_id"] == "F1"
        assert data["logs"] == "Log line 1\nLog line 2\nLog line 3\n"

    def test_get_logs_not_found(self, client, logs_dir, monkeypatch):
        """GET /api/tasks/{task_id}/logs for missing log file returns 404."""
        monkeypatch.setattr(
            "program_nova.dashboard.server.LOGS_DIR",
            logs_dir
        )

        response = client.get("/api/tasks/NONEXISTENT/logs")
        assert response.status_code == 404
        assert "log file not found" in response.json()["detail"].lower()

    def test_get_logs_with_lines_param(self, client, logs_dir, monkeypatch):
        """GET /api/tasks/{task_id}/logs?lines=N returns last N lines."""
        monkeypatch.setattr(
            "program_nova.dashboard.server.LOGS_DIR",
            logs_dir
        )

        response = client.get("/api/tasks/F1/logs?lines=2")
        assert response.status_code == 200

        data = response.json()
        assert data["logs"] == "Log line 2\nLog line 3\n"
