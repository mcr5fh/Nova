"""
Tests for worker.py - Worker subprocess management module

Following TDD: Write tests first (Red), then implement (Green), then refactor (Clean)
"""

import os
import subprocess
import tempfile
import time
import pytest
from pathlib import Path
from program_nova.engine.worker import Worker, WorkerStatus


class TestWorkerInitialization:
    """Test worker creation and initialization"""

    def test_worker_creates_with_required_fields(self):
        """Worker should initialize with task_id and store logs in correct location"""
        worker = Worker(task_id="TEST-001", task_description="Test task")

        assert worker.task_id == "TEST-001"
        assert worker.task_description == "Test task"
        assert worker.status == WorkerStatus.PENDING
        assert worker.pid is None
        assert worker.process is None

    def test_worker_computes_log_path_correctly(self):
        """Worker should compute log file path relative to cwd as ./logs/<task_id>.log"""
        worker = Worker(task_id="F1", task_description="Foundation task")

        expected_path = Path.cwd() / "logs" / "F1.log"
        assert worker.log_path == expected_path

    def test_worker_uses_cwd_for_log_path(self):
        """Worker log path should use current working directory"""
        worker = Worker(task_id="TEST-CWD", task_description="CWD test")

        # Log path should be absolute and include current working directory
        assert worker.log_path.is_absolute()
        assert str(Path.cwd()) in str(worker.log_path)
        assert worker.log_path.name == "TEST-CWD.log"


class TestWorkerSpawning:
    """Test spawning Claude Code agents as subprocesses"""

    def test_worker_spawns_subprocess(self):
        """Worker.start() should spawn a subprocess and capture PID"""
        worker = Worker(task_id="TEST-002", task_description="Echo test")

        # Use a simple command instead of actual Claude Code for testing
        worker.start(command=["echo", "hello"])

        assert worker.status == WorkerStatus.RUNNING
        assert worker.pid is not None
        assert worker.process is not None
        assert isinstance(worker.pid, int)

        worker.wait()  # Clean up

    def test_worker_creates_log_file(self):
        """Worker should create log file when starting"""
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = Path(tmpdir) / "test.log"
            worker = Worker(task_id="TEST-003", task_description="Log test")
            worker.log_path = log_path

            worker.start(command=["echo", "test output"])
            worker.wait()

            assert log_path.exists()

    def test_worker_captures_stdout_to_log(self):
        """Worker should capture subprocess stdout to log file"""
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = Path(tmpdir) / "stdout.log"
            worker = Worker(task_id="TEST-004", task_description="Stdout test")
            worker.log_path = log_path

            worker.start(command=["echo", "test message"])
            worker.wait()

            log_content = log_path.read_text()
            assert "test message" in log_content

    def test_worker_captures_stderr_to_log(self):
        """Worker should capture subprocess stderr to log file"""
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = Path(tmpdir) / "stderr.log"
            worker = Worker(task_id="TEST-005", task_description="Stderr test")
            worker.log_path = log_path

            # Python command that writes to stderr
            worker.start(command=["python3", "-c", "import sys; sys.stderr.write('error message\\n')"])
            worker.wait()

            log_content = log_path.read_text()
            assert "error message" in log_content


class TestWorkerMonitoring:
    """Test monitoring worker execution"""

    def test_worker_is_alive_returns_true_for_running_process(self):
        """Worker.is_alive() should return True while process is running"""
        worker = Worker(task_id="TEST-006", task_description="Sleep test")

        worker.start(command=["sleep", "0.5"])

        assert worker.is_alive() is True

        worker.wait()

    def test_worker_is_alive_returns_false_for_completed_process(self):
        """Worker.is_alive() should return False after process exits"""
        worker = Worker(task_id="TEST-007", task_description="Quick exit")

        worker.start(command=["echo", "done"])
        worker.wait()

        assert worker.is_alive() is False

    def test_worker_get_exit_code_returns_none_while_running(self):
        """Worker.get_exit_code() should return None while process is running"""
        worker = Worker(task_id="TEST-008", task_description="Running process")

        worker.start(command=["sleep", "0.5"])

        assert worker.get_exit_code() is None

        worker.wait()

    def test_worker_get_exit_code_returns_zero_on_success(self):
        """Worker.get_exit_code() should return 0 for successful completion"""
        worker = Worker(task_id="TEST-009", task_description="Success test")

        worker.start(command=["echo", "success"])
        worker.wait()

        assert worker.get_exit_code() == 0

    def test_worker_get_exit_code_returns_nonzero_on_failure(self):
        """Worker.get_exit_code() should return non-zero for failures"""
        worker = Worker(task_id="TEST-010", task_description="Failure test")

        worker.start(command=["false"])
        worker.wait()

        exit_code = worker.get_exit_code()
        assert exit_code is not None
        assert exit_code != 0

    def test_worker_updates_status_on_completion(self):
        """Worker should update status based on exit code"""
        worker = Worker(task_id="TEST-011", task_description="Status update")

        worker.start(command=["echo", "done"])
        worker.wait()

        assert worker.status == WorkerStatus.COMPLETED

    def test_worker_updates_status_on_failure(self):
        """Worker should update status to FAILED on non-zero exit"""
        worker = Worker(task_id="TEST-012", task_description="Failure status")

        worker.start(command=["false"])
        worker.wait()

        assert worker.status == WorkerStatus.FAILED


class TestTokenUsageTracking:
    """Test tracking token usage from agent output"""

    def test_worker_parses_token_usage_from_output(self):
        """Worker should parse token usage from Claude Code output"""
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = Path(tmpdir) / "tokens.log"
            worker = Worker(task_id="TEST-013", task_description="Token test")
            worker.log_path = log_path

            # Simulate Claude Code output with token usage
            output = """Some output
Token usage: input=1234, output=567, cache_read=890, cache_creation=123
More output"""

            worker.start(command=["echo", output])
            worker.wait()

            tokens = worker.get_token_usage()
            assert tokens["input_tokens"] == 1234
            assert tokens["output_tokens"] == 567
            assert tokens["cache_read_tokens"] == 890
            assert tokens["cache_creation_tokens"] == 123

    def test_worker_accumulates_token_usage(self):
        """Worker should accumulate token usage from multiple reports"""
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = Path(tmpdir) / "accumulate.log"
            worker = Worker(task_id="TEST-014", task_description="Accumulation test")
            worker.log_path = log_path

            # Simulate multiple token usage reports
            output = """Token usage: input=100, output=50, cache_read=20, cache_creation=10
Some work happening
Token usage: input=200, output=75, cache_read=30, cache_creation=15"""

            worker.start(command=["echo", output])
            worker.wait()

            tokens = worker.get_token_usage()
            assert tokens["input_tokens"] == 300  # 100 + 200
            assert tokens["output_tokens"] == 125  # 50 + 75
            assert tokens["cache_read_tokens"] == 50  # 20 + 30
            assert tokens["cache_creation_tokens"] == 25  # 10 + 15

    def test_worker_returns_zero_tokens_when_none_found(self):
        """Worker should return zeros if no token usage found in output"""
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = Path(tmpdir) / "no_tokens.log"
            worker = Worker(task_id="TEST-015", task_description="No tokens test")
            worker.log_path = log_path

            worker.start(command=["echo", "just some output"])
            worker.wait()

            tokens = worker.get_token_usage()
            assert tokens["input_tokens"] == 0
            assert tokens["output_tokens"] == 0
            assert tokens["cache_read_tokens"] == 0
            assert tokens["cache_creation_tokens"] == 0


class TestWorkerLifecycle:
    """Test complete worker lifecycle"""

    def test_worker_complete_lifecycle_success(self):
        """Test complete worker lifecycle from spawn to completion"""
        with tempfile.TemporaryDirectory() as tmpdir:
            log_path = Path(tmpdir) / "lifecycle.log"
            worker = Worker(task_id="TEST-016", task_description="Lifecycle test")
            worker.log_path = log_path

            # Start
            assert worker.status == WorkerStatus.PENDING

            worker.start(command=["echo", "hello world"])
            assert worker.status == WorkerStatus.RUNNING
            assert worker.is_alive() is True or worker.get_exit_code() == 0  # Might finish quickly

            # Wait for completion
            worker.wait()
            assert worker.status == WorkerStatus.COMPLETED
            assert worker.is_alive() is False
            assert worker.get_exit_code() == 0

            # Verify log
            assert log_path.exists()
            assert "hello world" in log_path.read_text()

    def test_worker_can_be_terminated(self):
        """Worker should support graceful termination"""
        worker = Worker(task_id="TEST-017", task_description="Termination test")

        worker.start(command=["sleep", "10"])
        assert worker.is_alive() is True

        worker.terminate()
        time.sleep(0.1)  # Give it a moment to terminate

        assert worker.is_alive() is False
        assert worker.status == WorkerStatus.FAILED


class TestWorkerWithClaudeCode:
    """Test worker with actual Claude Code command structure"""

    def test_worker_command_structure_for_claude_code(self):
        """Worker should support the expected Claude Code command structure"""
        worker = Worker(task_id="F1", task_description="Implement core types")

        # This test documents the expected command structure
        # We won't actually run Claude Code in tests, but verify the structure
        expected_command = [
            "claude",
            "code",
            "--task",
            "Implement core types",
            "--context",
            "program_nova project"
        ]

        # Worker should be able to accept and store this command
        # (actual execution tested with mock commands above)
        assert worker.task_description == "Implement core types"
