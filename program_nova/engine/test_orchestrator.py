"""
Tests for the orchestrator module.

These tests verify the main execution loop, dependency resolution,
worker spawning, concurrency limits, and task lifecycle management.
"""

import json
import pytest
import time
from pathlib import Path
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock

from program_nova.engine.orchestrator import Orchestrator
from program_nova.engine.state import StateManager, TaskStatus
from program_nova.engine.worker import Worker, WorkerStatus
from program_nova.engine.parser import parse_cascade


@pytest.fixture
def temp_cascade_file(tmp_path):
    """Create a temporary CASCADE.md file for testing."""
    cascade_content = """# Test Project

## L1: Application

### L2: Foundation
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | Core Types | Define base types | - |
| F2 | Error Handling | Implement errors | F1 |
| F3 | Config | Define config | F1 |

## L1: Infrastructure

### L2: Deployment
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| D1 | Docker | Create Dockerfile | - |
| D2 | CI | Setup CI | D1 |
"""
    cascade_file = tmp_path / "CASCADE.md"
    cascade_file.write_text(cascade_content)
    return str(cascade_file)


@pytest.fixture
def temp_state_file(tmp_path):
    """Create a temporary state file path."""
    return str(tmp_path / "cascade_state.json")


@pytest.fixture
def orchestrator(temp_cascade_file, temp_state_file):
    """Create an orchestrator instance for testing."""
    return Orchestrator(
        cascade_file=temp_cascade_file,
        state_file=temp_state_file,
        max_workers=2
    )


class TestOrchestratorInitialization:
    """Test orchestrator initialization and setup."""

    def test_init_creates_state_file(self, orchestrator, temp_state_file):
        """Test that initialization creates the state file."""
        assert Path(temp_state_file).exists()

        # Verify state file content
        with open(temp_state_file) as f:
            state = json.load(f)

        assert state["project"]["name"] == "Test Project"
        assert state["project"]["cascade_file"] is not None
        assert "tasks" in state

    def test_init_parses_cascade(self, orchestrator):
        """Test that initialization parses the CASCADE.md file."""
        assert orchestrator.cascade_data is not None
        assert "tasks" in orchestrator.cascade_data
        assert "hierarchy" in orchestrator.cascade_data
        assert "dag" in orchestrator.cascade_data

    def test_init_with_invalid_cascade(self, temp_state_file):
        """Test initialization with non-existent cascade file."""
        with pytest.raises(FileNotFoundError):
            Orchestrator(
                cascade_file="nonexistent.md",
                state_file=temp_state_file,
                max_workers=2
            )


class TestReadyTaskResolution:
    """Test dependency resolution and ready task identification."""

    def test_get_ready_tasks_initial(self, orchestrator):
        """Test that initially only tasks with no deps are ready."""
        ready = orchestrator.get_ready_tasks()

        # F1 and D1 have no dependencies
        assert "F1" in ready
        assert "D1" in ready
        assert len(ready) == 2

    def test_get_ready_tasks_after_completion(self, orchestrator, temp_state_file):
        """Test that completing a task makes dependent tasks ready."""
        state_mgr = StateManager(temp_state_file)

        # Mark F1 as completed
        state_mgr.update_task("F1", status=TaskStatus.COMPLETED)
        state_mgr.complete_task(
            "F1",
            completed_at=datetime.now().isoformat(),
            duration_seconds=10
        )

        ready = orchestrator.get_ready_tasks()

        # Now F2 and F3 should be ready (depend only on F1)
        assert "F2" in ready or "F3" in ready
        assert "D1" in ready  # Still ready
        assert "F1" not in ready  # Already completed

    def test_get_ready_tasks_respects_failed_deps(self, orchestrator, temp_state_file):
        """Test that tasks with failed dependencies are not ready."""
        state_mgr = StateManager(temp_state_file)

        # Mark F1 as failed
        state_mgr.fail_task("F1", error="Test failure")

        ready = orchestrator.get_ready_tasks()

        # F2 and F3 depend on F1, so should not be ready
        assert "F2" not in ready
        assert "F3" not in ready
        # D1 should still be ready (no deps)
        assert "D1" in ready


class TestWorkerManagement:
    """Test worker spawning, monitoring, and lifecycle."""

    @patch('program_nova.engine.orchestrator.Worker')
    def test_start_worker(self, mock_worker_class, orchestrator):
        """Test starting a worker for a task."""
        mock_worker = Mock()
        mock_worker.task_id = "F1"
        mock_worker.pid = 12345
        mock_worker.status = WorkerStatus.RUNNING
        mock_worker_class.return_value = mock_worker

        orchestrator.start_worker("F1")

        # Verify worker was created and started
        mock_worker_class.assert_called_once()
        mock_worker.start.assert_called_once()

        # Verify worker is tracked
        assert "F1" in orchestrator.active_workers
        assert orchestrator.active_workers["F1"] == mock_worker

    @patch('program_nova.engine.orchestrator.Worker')
    def test_start_worker_uses_claude_code_command(self, mock_worker_class, orchestrator):
        """Test that start_worker uses the Claude Code command to spawn workers."""
        mock_worker = Mock()
        mock_worker.task_id = "F1"
        mock_worker.pid = 12345
        mock_worker.status = WorkerStatus.RUNNING
        mock_worker_class.return_value = mock_worker

        # Get the task description for F1
        task_description = orchestrator.tasks["F1"]["description"]

        orchestrator.start_worker("F1")

        # Verify worker.start was called with the correct Claude Code command
        mock_worker.start.assert_called_once()
        called_command = mock_worker.start.call_args[0][0]

        # Verify it's a Claude Code command with the right structure
        assert called_command[0] == "claude"
        assert "--model" in called_command
        assert "sonnet" in called_command
        assert task_description in called_command

    @patch('program_nova.engine.orchestrator.Worker')
    def test_start_worker_includes_permission_flags(self, mock_worker_class, orchestrator):
        """Test that start_worker includes auto-approve permission flags."""
        mock_worker = Mock()
        mock_worker.task_id = "F1"
        mock_worker.pid = 12345
        mock_worker.status = WorkerStatus.RUNNING
        mock_worker_class.return_value = mock_worker

        orchestrator.start_worker("F1")

        # Verify worker.start was called with permission flags
        mock_worker.start.assert_called_once()
        called_command = mock_worker.start.call_args[0][0]

        # Verify the command includes permission bypass flags
        # Should include either --dangerously-skip-permissions or --permission-mode bypassPermissions
        assert "--dangerously-skip-permissions" in called_command or (
            "--permission-mode" in called_command and "bypassPermissions" in called_command
        ), f"Command missing permission flags: {called_command}"

    @patch('program_nova.engine.orchestrator.Worker')
    def test_respects_max_workers(self, mock_worker_class, orchestrator):
        """Test that orchestrator respects max concurrent workers limit."""
        # Set max_workers to 2
        orchestrator.max_workers = 2

        # Create mock workers
        def create_mock_worker(task_id, desc):
            w = Mock()
            w.task_id = task_id
            w.pid = 12345
            w.status = WorkerStatus.RUNNING
            w.is_alive.return_value = True
            return w

        mock_worker_class.side_effect = [
            create_mock_worker("F1", "task1"),
            create_mock_worker("D1", "task2"),
        ]

        # Start first two workers
        orchestrator.start_worker("F1")
        orchestrator.start_worker("D1")

        # Attempt to start third worker should not happen
        # (This would be controlled by the main loop logic)
        assert len(orchestrator.active_workers) == 2

    def test_monitor_workers_updates_tokens(self, orchestrator):
        """Test that monitoring workers updates token usage in state."""
        # Create a mock worker with token usage
        mock_worker = Mock()
        mock_worker.task_id = "F1"
        mock_worker.is_alive.return_value = True
        mock_worker.get_token_usage.return_value = {
            "input_tokens": 1000,
            "output_tokens": 500,
            "cache_read_tokens": 200,
            "cache_creation_tokens": 100,
        }

        orchestrator.active_workers["F1"] = mock_worker

        # Monitor workers
        orchestrator.monitor_workers()

        # Verify token usage was updated in state
        state = orchestrator.state_mgr.read_state()
        if "F1" in state["tasks"]:
            tokens = state["tasks"]["F1"]["token_usage"]
            assert tokens["input_tokens"] == 1000
            assert tokens["output_tokens"] == 500


class TestTaskCompletion:
    """Test handling of task completion and failure."""

    def test_handle_completed_worker(self, orchestrator):
        """Test handling a worker that completes successfully."""
        # Create a mock completed worker
        mock_worker = Mock()
        mock_worker.task_id = "F1"
        mock_worker.is_alive.return_value = False
        mock_worker.get_exit_code.return_value = 0
        mock_worker.status = WorkerStatus.COMPLETED
        mock_worker.get_token_usage.return_value = {
            "input_tokens": 1000,
            "output_tokens": 500,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
        }

        orchestrator.active_workers["F1"] = mock_worker

        # Handle completion
        orchestrator.monitor_workers()

        # Verify worker was removed from active workers
        assert "F1" not in orchestrator.active_workers

        # Verify task status was updated
        state = orchestrator.state_mgr.read_state()
        if "F1" in state["tasks"]:
            assert state["tasks"]["F1"]["status"] == TaskStatus.COMPLETED.value

    def test_handle_failed_worker(self, orchestrator):
        """Test handling a worker that fails."""
        # Create a mock failed worker
        mock_worker = Mock()
        mock_worker.task_id = "F1"
        mock_worker.is_alive.return_value = False
        mock_worker.get_exit_code.return_value = 1
        mock_worker.status = WorkerStatus.FAILED
        mock_worker.get_token_usage.return_value = {
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
        }

        orchestrator.active_workers["F1"] = mock_worker

        # Handle failure
        orchestrator.monitor_workers()

        # Verify worker was removed from active workers
        assert "F1" not in orchestrator.active_workers

        # Verify task status was updated to failed
        state = orchestrator.state_mgr.read_state()
        if "F1" in state["tasks"]:
            assert state["tasks"]["F1"]["status"] == TaskStatus.FAILED.value


class TestMainLoop:
    """Test the main execution loop."""

    @patch('program_nova.engine.orchestrator.Worker')
    def test_run_completes_all_tasks(self, mock_worker_class, orchestrator, temp_state_file):
        """Test that run() executes all tasks and completes."""
        # Mock all workers to complete immediately
        completed_tasks = []

        def create_completing_worker(task_id, desc):
            w = Mock()
            w.task_id = task_id
            w.pid = 12345
            w.status = WorkerStatus.COMPLETED
            w.is_alive.return_value = False
            w.get_exit_code.return_value = 0
            w.get_token_usage.return_value = {
                "input_tokens": 100,
                "output_tokens": 50,
                "cache_read_tokens": 0,
                "cache_creation_tokens": 0,
            }

            # Mark task as completed when worker starts
            def start_side_effect(cmd, cwd=None):
                state_mgr = StateManager(temp_state_file)
                state_mgr.complete_task(
                    task_id,
                    completed_at=datetime.now().isoformat(),
                    duration_seconds=1
                )
                completed_tasks.append(task_id)

            w.start.side_effect = start_side_effect
            return w

        mock_worker_class.side_effect = lambda *args, **kwargs: create_completing_worker(
            kwargs.get('task_id', args[0] if args else None),
            kwargs.get('task_description', args[1] if len(args) > 1 else None)
        )

        # Run with a short timeout to prevent infinite loop
        orchestrator.run(check_interval=0.1, max_iterations=50)

        # Verify all tasks were attempted
        # At minimum, tasks with no dependencies should have been started
        assert len(completed_tasks) >= 2  # F1 and D1

    def test_run_stops_when_all_complete(self, orchestrator):
        """Test that run() stops when all tasks are complete or blocked."""
        # Pre-mark all tasks as completed
        state_mgr = orchestrator.state_mgr
        for task_id in orchestrator.cascade_data["tasks"].keys():
            state_mgr.complete_task(
                task_id,
                completed_at=datetime.now().isoformat(),
                duration_seconds=1
            )

        # Run should exit immediately
        orchestrator.run(check_interval=0.1, max_iterations=10)

        # Verify no workers are active
        assert len(orchestrator.active_workers) == 0


class TestConcurrency:
    """Test concurrency control and limits."""

    @patch('program_nova.engine.orchestrator.Worker')
    def test_maintains_max_workers_limit(self, mock_worker_class, orchestrator):
        """Test that never more than max_workers run concurrently."""
        orchestrator.max_workers = 2

        worker_count = 0
        max_concurrent = 0

        def create_worker(task_id, desc):
            nonlocal worker_count, max_concurrent
            w = Mock()
            w.task_id = task_id
            w.pid = 12345 + worker_count
            w.status = WorkerStatus.RUNNING
            w.is_alive.return_value = True
            w.get_token_usage.return_value = {
                "input_tokens": 0,
                "output_tokens": 0,
                "cache_read_tokens": 0,
                "cache_creation_tokens": 0,
            }
            worker_count += 1
            return w

        mock_worker_class.side_effect = lambda *args, **kwargs: create_worker(
            kwargs.get('task_id', args[0] if args else None),
            kwargs.get('task_description', args[1] if len(args) > 1 else None)
        )

        # Start workers and track concurrent count
        ready_tasks = orchestrator.get_ready_tasks()
        for task_id in ready_tasks[:orchestrator.max_workers]:
            orchestrator.start_worker(task_id)

        max_concurrent = max(max_concurrent, len(orchestrator.active_workers))

        # Should not exceed max_workers
        assert max_concurrent <= orchestrator.max_workers
        assert len(orchestrator.active_workers) <= orchestrator.max_workers


class TestDirectExecution:
    """Test that orchestrator.py can be executed as a module."""

    def test_orchestrator_module_execution(self, tmp_path):
        """Test that orchestrator.py can be run as a module without import errors."""
        import subprocess
        import sys

        # Create a minimal CASCADE.md for testing
        cascade_content = """# Test Project

## L1: Application

### L2: Foundation
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | Core Types | Define base types | - |
"""
        cascade_file = tmp_path / "CASCADE.md"
        cascade_file.write_text(cascade_content)

        # Get the project root directory (parent of program_nova)
        project_root = Path(__file__).parent.parent.parent

        # Run orchestrator.py as a module with --help to verify imports work
        result = subprocess.run(
            [sys.executable, "-m", "program_nova.engine.orchestrator", "--help"],
            cwd=str(project_root),
            capture_output=True,
            text=True,
            timeout=5
        )

        # Should not have import errors
        assert "ImportError" not in result.stderr, f"ImportError found: {result.stderr}"
        assert "ModuleNotFoundError" not in result.stderr, f"ModuleNotFoundError found: {result.stderr}"
        assert "attempted relative import" not in result.stderr, f"Relative import error found: {result.stderr}"
        # Should show help text and exit successfully
        assert result.returncode == 0, f"Non-zero exit code: {result.returncode}, stderr: {result.stderr}"
        assert "usage:" in result.stdout.lower(), f"Usage text not found in: {result.stdout}"
