"""
Worker module for spawning, monitoring, and managing Claude Code agent subprocesses.

Responsibilities:
- Spawn Claude Code agents as subprocesses
- Monitor execution status
- Capture stdout/stderr to log files
- Parse and track token usage from agent output
- Report completion status and metrics
"""

import json
import os
import subprocess
import signal
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional


class WorkerStatus(Enum):
    """Worker execution status states"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Worker:
    """
    Manages a single worker subprocess that executes a task.

    Typical lifecycle:
    1. Create Worker(task_id, task_description)
    2. worker.start(command) - spawns subprocess, begins log capture
    3. worker.is_alive() - check if still running
    4. worker.get_token_usage() - retrieve accumulated token metrics
    5. worker.wait() - wait for completion and update status
    """

    def __init__(self, task_id: str, task_description: str):
        """
        Initialize a worker for a specific task.

        Args:
            task_id: Unique identifier for the task (e.g., "F1", "P3")
            task_description: Human-readable description of what the task does
        """
        self.task_id = task_id
        self.task_description = task_description
        self.status = WorkerStatus.PENDING
        self.process: Optional[subprocess.Popen] = None
        self.pid: Optional[int] = None
        # Use current working directory for logs
        self.log_path = Path.cwd() / "logs" / f"{task_id}.log"

        # Token usage tracking
        self._token_usage = {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
        }

    def start(self, command: List[str], cwd: Optional[str] = None) -> None:
        """
        Spawn the worker subprocess and begin capturing output to logs.

        Args:
            command: Command and arguments to execute (e.g., ["claude", "code", ...])
            cwd: Working directory for the subprocess (default: current directory)

        Side effects:
            - Creates log file at self.log_path
            - Sets self.process, self.pid, and self.status
            - Begins writing stdout/stderr to log file
        """
        # Ensure logs directory exists
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

        # Open log file for writing
        self.log_file = open(self.log_path, "w", buffering=1)  # Line buffered

        # Spawn subprocess with stdout/stderr redirected to log
        self.process = subprocess.Popen(
            command,
            stdout=self.log_file,
            stderr=subprocess.STDOUT,  # Merge stderr into stdout
            text=True,
            bufsize=1,  # Line buffered
            cwd=cwd,  # Set working directory for the subprocess
        )

        self.pid = self.process.pid
        self.status = WorkerStatus.RUNNING

    def is_alive(self) -> bool:
        """
        Check if the worker process is still running.

        Returns:
            True if process is running, False if it has exited
        """
        if self.process is None:
            return False

        return self.process.poll() is None

    def get_exit_code(self) -> Optional[int]:
        """
        Get the exit code of the process.

        Returns:
            Exit code (0 for success, non-zero for failure) or None if still running
        """
        if self.process is None:
            return None

        return self.process.poll()

    def wait(self, timeout: Optional[float] = None) -> int:
        """
        Wait for the worker process to complete.

        Args:
            timeout: Maximum time to wait in seconds (None = wait forever)

        Returns:
            Exit code of the process

        Side effects:
            - Updates self.status based on exit code
            - Closes log file
            - Parses token usage from logs
        """
        if self.process is None:
            raise RuntimeError("Cannot wait on worker that hasn't been started")

        try:
            exit_code = self.process.wait(timeout=timeout)
        finally:
            # Ensure log file is closed
            if hasattr(self, 'log_file') and self.log_file:
                self.log_file.close()

        # Update status based on exit code
        if exit_code == 0:
            self.status = WorkerStatus.COMPLETED
        else:
            self.status = WorkerStatus.FAILED

        # Parse token usage from logs
        self._parse_token_usage_from_log()

        return exit_code

    def terminate(self) -> None:
        """
        Gracefully terminate the worker process.

        Sends SIGTERM to the process and waits for it to exit.
        Updates status to FAILED since this is an abnormal termination.
        """
        if self.process is None:
            return

        if self.is_alive():
            self.process.terminate()
            try:
                self.process.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                # Force kill if graceful termination fails
                self.process.kill()
                self.process.wait()

        self.status = WorkerStatus.FAILED

        # Close log file
        if hasattr(self, 'log_file') and self.log_file:
            self.log_file.close()

    def get_token_usage(self) -> Dict[str, int]:
        """
        Get accumulated token usage metrics.

        Returns:
            Dictionary with keys: input_tokens, output_tokens,
            cache_read_tokens, cache_creation_tokens
        """
        # If process is still running or just finished, parse latest usage
        if self.log_path.exists():
            self._parse_token_usage_from_log()

        return self._token_usage.copy()

    def _parse_token_usage_from_log(self) -> None:
        """
        Parse token usage from Claude Code JSON output in log file.

        Claude Code with --output-format json outputs a JSON object containing:
        {
          "usage": {
            "input_tokens": 123,
            "output_tokens": 456,
            "cache_read_input_tokens": 789,
            "cache_creation_input_tokens": 12
          },
          "modelUsage": { ... }
        }

        Updates self._token_usage with accumulated totals from all JSON responses.
        """
        if not self.log_path.exists():
            return

        # Reset counters
        totals = {
            "input_tokens": 0,
            "output_tokens": 0,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
        }

        # Read log file and parse JSON output
        try:
            with open(self.log_path, "r") as f:
                content = f.read()

                # Claude Code outputs JSON on a single line
                # Try to parse each line as JSON
                for line in content.splitlines():
                    if not line.strip():
                        continue

                    try:
                        data = json.loads(line)

                        # Extract from 'usage' field if present
                        if "usage" in data:
                            usage = data["usage"]
                            totals["input_tokens"] += usage.get("input_tokens", 0)
                            totals["output_tokens"] += usage.get("output_tokens", 0)
                            totals["cache_read_tokens"] += usage.get("cache_read_input_tokens", 0)
                            totals["cache_creation_tokens"] += usage.get("cache_creation_input_tokens", 0)

                        # Alternatively, extract from modelUsage (more detailed)
                        # This provides per-model breakdown if using multiple models
                        elif "modelUsage" in data:
                            for _, model_usage in data["modelUsage"].items():
                                totals["input_tokens"] += model_usage.get("inputTokens", 0)
                                totals["output_tokens"] += model_usage.get("outputTokens", 0)
                                totals["cache_read_tokens"] += model_usage.get("cacheReadInputTokens", 0)
                                totals["cache_creation_tokens"] += model_usage.get("cacheCreationInputTokens", 0)

                    except json.JSONDecodeError:
                        # Skip non-JSON lines (e.g., error messages, partial output)
                        continue

        except IOError:
            # If we can't read the log, keep existing token counts
            pass

        self._token_usage = totals

    def get_status_dict(self) -> Dict:
        """
        Get worker status as a dictionary suitable for JSON serialization.

        Returns:
            Dictionary with worker state including status, PID, tokens, etc.
        """
        return {
            "task_id": self.task_id,
            "status": self.status.value,
            "pid": self.pid,
            "exit_code": self.get_exit_code(),
            "is_alive": self.is_alive(),
            "token_usage": self.get_token_usage(),
            "log_path": str(self.log_path),
        }

    def __repr__(self) -> str:
        """String representation for debugging"""
        return f"Worker(task_id={self.task_id}, status={self.status.value}, pid={self.pid})"
