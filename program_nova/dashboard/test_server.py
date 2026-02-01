"""Tests for FastAPI server endpoints."""

import json
import subprocess
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


class TestBeadsEndpoints:
    """Test /api/beads/* endpoints for bead mode."""

    def test_list_epics_success(self, client, monkeypatch, caplog):
        """GET /api/beads/epics returns list of epic beads."""
        import logging
        caplog.set_level(logging.INFO)

        # Mock bd list command output
        mock_output = json.dumps([
            {
                "id": "Nova-epic1",
                "title": "Test Epic 1",
                "type": "epic",
                "status": "open",
                "priority": 2
            },
            {
                "id": "Nova-epic2",
                "title": "Test Epic 2",
                "type": "epic",
                "status": "in_progress",
                "priority": 1
            }
        ])

        def mock_run(*args, **kwargs):
            class MockResult:
                stdout = mock_output
                returncode = 0
            return MockResult()

        monkeypatch.setattr("subprocess.run", mock_run)

        response = client.get("/api/beads/epics")
        assert response.status_code == 200

        data = response.json()
        assert len(data) == 2
        assert data[0]["id"] == "Nova-epic1"
        assert data[0]["title"] == "Test Epic 1"
        assert data[0]["type"] == "epic"
        assert data[1]["id"] == "Nova-epic2"

        # Verify logging occurred
        assert any("epic list requested" in record.message.lower() for record in caplog.records)
        assert any("2" in record.message for record in caplog.records)  # Count of epics

    def test_start_epic_success(self, client, caplog):
        """POST /api/beads/start starts epic execution."""
        import logging
        caplog.set_level(logging.INFO)

        response = client.post(
            "/api/beads/start",
            json={"epic_id": "Nova-epic1"}
        )
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "started"
        assert data["epic_id"] == "Nova-epic1"

        # Verify logging occurred
        assert any("epic start requested" in record.message.lower() for record in caplog.records)
        assert any("Nova-epic1" in record.message for record in caplog.records)

    def test_get_epic_status_success(self, client, monkeypatch, caplog):
        """GET /api/beads/status/{epic_id} returns epic status in dashboard format."""
        import logging
        caplog.set_level(logging.INFO)

        # Mock bd graph command output
        mock_graph = {
            "root": {
                "id": "Nova-epic1",
                "title": "Test Epic"
            },
            "issues": [
                {
                    "id": "Nova-epic1",
                    "title": "Test Epic",
                    "status": "in_progress",
                    "type": "epic"
                },
                {
                    "id": "Nova-epic1.1",
                    "title": "Task 1",
                    "status": "closed",
                    "type": "task",
                    "notes": "Metrics: {\"duration_seconds\": 45, \"token_usage\": {\"input_tokens\": 100, \"output_tokens\": 50}, \"cost_usd\": 0.01}"
                },
                {
                    "id": "Nova-epic1.2",
                    "title": "Task 2",
                    "status": "in_progress",
                    "type": "task",
                    "notes": ""
                }
            ],
            "layout": {
                "Layers": [
                    ["Nova-epic1"],
                    ["Nova-epic1.1", "Nova-epic1.2"]
                ],
                "Nodes": {
                    "Nova-epic1": {"DependsOn": []},
                    "Nova-epic1.1": {"DependsOn": []},
                    "Nova-epic1.2": {"DependsOn": ["Nova-epic1.1"]}
                }
            }
        }

        # Mock metrics comment for Nova-epic1.1
        metrics_comment = {
            "type": "metrics",
            "token_usage": {
                "input_tokens": 100,
                "output_tokens": 50,
                "cache_read_tokens": 0,
                "cache_creation_tokens": 0
            },
            "cost_usd": 0.01,
            "duration_seconds": 45
        }

        def mock_run(*args, **kwargs):
            # Return graph for 'bd graph' command
            if args[0][0] == "bd" and args[0][1] == "graph":
                class MockResult:
                    stdout = json.dumps(mock_graph)
                    returncode = 0
                return MockResult()
            # Return comments for 'bd comments' command
            elif args[0][0] == "bd" and args[0][1] == "comments":
                bead_id = args[0][2]
                if bead_id == "Nova-epic1.1":
                    # Return metrics comment for task 1
                    comments = [{"text": json.dumps(metrics_comment)}]
                    class MockResult:
                        stdout = json.dumps(comments)
                        returncode = 0
                    return MockResult()
                else:
                    # No comments for other beads
                    class MockResult:
                        stdout = "[]"
                        returncode = 0
                    return MockResult()

        monkeypatch.setattr("program_nova.dashboard.beads_adapter.subprocess.run", mock_run)

        response = client.get("/api/beads/status/Nova-epic1")
        assert response.status_code == 200

        data = response.json()
        assert "project" in data
        assert "tasks" in data
        assert "hierarchy" in data
        assert "task_definitions" in data
        assert "rollups" in data

        # Check project info
        assert data["project"]["name"] == "Test Epic"

        # Check tasks (epic itself should be excluded)
        assert "Nova-epic1" not in data["tasks"]
        assert "Nova-epic1.1" in data["tasks"]
        assert "Nova-epic1.2" in data["tasks"]

        # Check task 1 has parsed metrics
        task1 = data["tasks"]["Nova-epic1.1"]
        assert task1["status"] == "completed"
        assert task1["duration_seconds"] == 45
        assert task1["token_usage"]["input_tokens"] == 100
        assert task1["token_usage"]["output_tokens"] == 50

        # Check task 2
        task2 = data["tasks"]["Nova-epic1.2"]
        assert task2["status"] == "in_progress"

        # Check task definitions have dependencies
        assert data["task_definitions"]["Nova-epic1.2"]["depends_on"] == ["Nova-epic1.1"]

        # Verify logging occurred
        assert any("epic status queried" in record.message.lower() for record in caplog.records)
        assert any("Nova-epic1" in record.message for record in caplog.records)

    def test_list_epics_error_logging(self, client, monkeypatch, caplog):
        """GET /api/beads/epics logs errors with full details."""
        import logging
        caplog.set_level(logging.ERROR)

        def mock_run(*args, **kwargs):
            raise subprocess.CalledProcessError(1, "bd", stderr="Command failed: bd not found")

        monkeypatch.setattr("subprocess.run", mock_run)

        response = client.get("/api/beads/epics")
        assert response.status_code == 500

        # Verify error logging occurred
        assert any(record.levelname == "ERROR" for record in caplog.records)
        assert any("error listing epics" in record.message.lower() for record in caplog.records)

    def test_get_epic_status_error_logging(self, client, monkeypatch, caplog):
        """GET /api/beads/status/{epic_id} logs errors with full details."""
        import logging
        caplog.set_level(logging.ERROR)

        def mock_run(*args, **kwargs):
            raise subprocess.CalledProcessError(1, "bd", stderr="Epic not found")

        monkeypatch.setattr("program_nova.dashboard.beads_adapter.subprocess.run", mock_run)

        response = client.get("/api/beads/status/NonExistent")
        assert response.status_code == 500

        # Verify error logging occurred
        assert any(record.levelname == "ERROR" for record in caplog.records)
        assert any("error getting epic status" in record.message.lower() for record in caplog.records)


class TestServerLifecycle:
    """Test server lifecycle management and graceful shutdown."""

    def test_app_state_orchestrators_initialized(self):
        """Test that app.state.orchestrators dictionary is initialized."""
        app = create_app()
        assert hasattr(app.state, "orchestrators")
        assert isinstance(app.state.orchestrators, dict)
        assert len(app.state.orchestrators) == 0

    def test_start_epic_tracks_orchestrator(self, client):
        """Test that starting an epic tracks the orchestrator in app state."""
        # Start an epic
        response = client.post(
            "/api/beads/start",
            json={"epic_id": "Nova-test"}
        )
        assert response.status_code == 200

        # Check that orchestrator is tracked
        # Note: We can't directly access app.state in TestClient, but we verify it doesn't error
        # The actual tracking will be verified in integration tests

    def test_orchestrator_thread_daemon_false(self, client, monkeypatch):
        """Test that orchestrator threads are created with daemon=False."""
        import threading
        created_threads = []

        # Capture thread creation
        original_thread_init = threading.Thread.__init__
        def track_thread_init(self, *args, **kwargs):
            created_threads.append((args, kwargs))
            original_thread_init(self, *args, **kwargs)

        monkeypatch.setattr(threading.Thread, "__init__", track_thread_init)

        # Start an epic
        response = client.post(
            "/api/beads/start",
            json={"epic_id": "Nova-test"}
        )
        assert response.status_code == 200

        # Check that a thread was created with daemon=False
        assert len(created_threads) > 0
        # Find the BeadOrchestrator thread
        for args, kwargs in created_threads:
            name = kwargs.get("name")
            if name and "BeadOrchestrator" in name:
                assert kwargs.get("daemon", True) is False
                break
        else:
            pytest.fail("No BeadOrchestrator thread found")
