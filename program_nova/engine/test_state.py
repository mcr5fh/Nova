"""Tests for state.py - cascade state management with file locking."""

import json
import os
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from threading import Thread

import pytest

from .state import StateManager, TaskStatus


class TestStateManager:
    """Test suite for StateManager."""

    @pytest.fixture
    def temp_state_file(self):
        """Create a temporary state file for testing."""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
            state_path = f.name
        yield state_path
        # Cleanup
        if os.path.exists(state_path):
            os.unlink(state_path)

    @pytest.fixture
    def state_manager(self, temp_state_file):
        """Create a StateManager instance with a temp file."""
        return StateManager(temp_state_file)

    def test_initialize_creates_empty_state(self, state_manager):
        """Test that initialize creates a valid empty state file."""
        state_manager.initialize(
            project_name="Test Project",
            cascade_file="/path/to/CASCADE.md"
        )

        state = state_manager.read_state()

        assert state["project"]["name"] == "Test Project"
        assert state["project"]["cascade_file"] == "/path/to/CASCADE.md"
        assert state["project"]["started_at"] is None
        assert state["project"]["completed_at"] is None
        assert state["tasks"] == {}

    def test_read_nonexistent_file_raises_error(self):
        """Test that reading a non-existent file raises FileNotFoundError."""
        sm = StateManager("/nonexistent/path/state.json")
        with pytest.raises(FileNotFoundError):
            sm.read_state()

    def test_update_task_status(self, state_manager):
        """Test updating a task's status."""
        state_manager.initialize("Test", "/cascade.md")

        # Create a task
        state_manager.update_task(
            task_id="F1",
            status=TaskStatus.PENDING
        )

        state = state_manager.read_state()
        assert "F1" in state["tasks"]
        assert state["tasks"]["F1"]["status"] == "pending"

        # Update to in_progress
        now = datetime.now(timezone.utc).isoformat()
        state_manager.update_task(
            task_id="F1",
            status=TaskStatus.IN_PROGRESS,
            worker_id="worker-1",
            pid=12345,
            started_at=now
        )

        state = state_manager.read_state()
        assert state["tasks"]["F1"]["status"] == "in_progress"
        assert state["tasks"]["F1"]["worker_id"] == "worker-1"
        assert state["tasks"]["F1"]["pid"] == 12345
        assert state["tasks"]["F1"]["started_at"] == now

    def test_update_task_token_usage(self, state_manager):
        """Test updating task token usage."""
        state_manager.initialize("Test", "/cascade.md")
        state_manager.update_task(task_id="F1", status=TaskStatus.IN_PROGRESS)

        state_manager.update_task_tokens(
            task_id="F1",
            input_tokens=1000,
            output_tokens=500,
            cache_read_tokens=200,
            cache_creation_tokens=100
        )

        state = state_manager.read_state()
        tokens = state["tasks"]["F1"]["token_usage"]
        assert tokens["input_tokens"] == 1000
        assert tokens["output_tokens"] == 500
        assert tokens["cache_read_tokens"] == 200
        assert tokens["cache_creation_tokens"] == 100

    def test_complete_task(self, state_manager):
        """Test completing a task."""
        state_manager.initialize("Test", "/cascade.md")

        started_at = datetime.now(timezone.utc).isoformat()
        state_manager.update_task(
            task_id="F1",
            status=TaskStatus.IN_PROGRESS,
            started_at=started_at
        )

        completed_at = datetime.now(timezone.utc).isoformat()
        state_manager.complete_task(
            task_id="F1",
            completed_at=completed_at,
            duration_seconds=120,
            commit_sha="abc123",
            files_changed=["src/main.py", "tests/test_main.py"]
        )

        state = state_manager.read_state()
        task = state["tasks"]["F1"]
        assert task["status"] == "completed"
        assert task["completed_at"] == completed_at
        assert task["duration_seconds"] == 120
        assert task["commit_sha"] == "abc123"
        assert task["files_changed"] == ["src/main.py", "tests/test_main.py"]

    def test_fail_task(self, state_manager):
        """Test failing a task with error message."""
        state_manager.initialize("Test", "/cascade.md")
        state_manager.update_task(task_id="F1", status=TaskStatus.IN_PROGRESS)

        state_manager.fail_task(
            task_id="F1",
            error="Test failed: assertion error"
        )

        state = state_manager.read_state()
        assert state["tasks"]["F1"]["status"] == "failed"
        assert state["tasks"]["F1"]["error"] == "Test failed: assertion error"

    def test_concurrent_writes_use_file_locking(self, state_manager):
        """Test that concurrent writes don't corrupt the state file."""
        state_manager.initialize("Test", "/cascade.md")

        # Initialize some tasks
        for i in range(10):
            state_manager.update_task(f"T{i}", status=TaskStatus.PENDING)

        errors = []

        def update_task(task_id, task_num):
            try:
                for j in range(5):
                    # Each update uses a unique value so we can verify all writes succeeded
                    state_manager.update_task_tokens(
                        task_id=task_id,
                        input_tokens=(task_num * 100) + j,
                        output_tokens=50
                    )
                    time.sleep(0.01)
            except Exception as e:
                errors.append(e)

        # Start multiple threads updating different tasks
        threads = []
        for i in range(10):
            t = Thread(target=update_task, args=(f"T{i}", i))
            threads.append(t)
            t.start()

        # Wait for all threads to complete
        for t in threads:
            t.join()

        # Verify no errors occurred
        assert len(errors) == 0, f"Concurrent write errors: {errors}"

        # Verify state file is valid JSON and has all tasks
        state = state_manager.read_state()
        assert len(state["tasks"]) == 10
        for i in range(10):
            assert f"T{i}" in state["tasks"]
            # Last update should have stored the final value
            expected_tokens = (i * 100) + 4  # Last iteration (j=4)
            assert state["tasks"][f"T{i}"]["token_usage"]["input_tokens"] == expected_tokens

    def test_update_project_timestamps(self, state_manager):
        """Test updating project-level timestamps."""
        state_manager.initialize("Test", "/cascade.md")

        started = datetime.now(timezone.utc).isoformat()
        state_manager.update_project(started_at=started)

        state = state_manager.read_state()
        assert state["project"]["started_at"] == started
        assert state["project"]["completed_at"] is None

        completed = datetime.now(timezone.utc).isoformat()
        state_manager.update_project(completed_at=completed)

        state = state_manager.read_state()
        assert state["project"]["completed_at"] == completed

    def test_task_status_enum(self):
        """Test TaskStatus enum values."""
        assert TaskStatus.PENDING.value == "pending"
        assert TaskStatus.IN_PROGRESS.value == "in_progress"
        assert TaskStatus.COMPLETED.value == "completed"
        assert TaskStatus.FAILED.value == "failed"

    def test_incremental_token_updates(self, state_manager):
        """Test that token usage can be updated incrementally."""
        state_manager.initialize("Test", "/cascade.md")
        state_manager.update_task(task_id="F1", status=TaskStatus.IN_PROGRESS)

        # First update
        state_manager.update_task_tokens(
            task_id="F1",
            input_tokens=100,
            output_tokens=50
        )

        state = state_manager.read_state()
        assert state["tasks"]["F1"]["token_usage"]["input_tokens"] == 100

        # Second update (incremental)
        state_manager.update_task_tokens(
            task_id="F1",
            input_tokens=200,
            output_tokens=100
        )

        state = state_manager.read_state()
        assert state["tasks"]["F1"]["token_usage"]["input_tokens"] == 200
        assert state["tasks"]["F1"]["token_usage"]["output_tokens"] == 100
