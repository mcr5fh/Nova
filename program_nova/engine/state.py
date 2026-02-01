"""State management for cascade execution.

This module provides thread-safe read/write access to the cascade_state.json file
using file locking to prevent corruption from concurrent access.
"""

import fcntl
import json
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional


class TaskStatus(Enum):
    """Task status enumeration."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class StateManager:
    """Manages read/write access to cascade_state.json with file locking.

    This class provides thread-safe operations for reading and writing the shared
    state file used by the execution engine and dashboard.

    The state file uses the following schema:
    {
        "project": {
            "name": str,
            "cascade_file": str,
            "started_at": str | None,
            "completed_at": str | None
        },
        "tasks": {
            "<task_id>": {
                "status": "pending" | "in_progress" | "completed" | "failed",
                "worker_id": str | None,
                "pid": int | None,
                "started_at": str | None,
                "completed_at": str | None,
                "duration_seconds": int,
                "current_step": str | None,
                "token_usage": {
                    "input_tokens": int,
                    "output_tokens": int,
                    "cache_read_tokens": int,
                    "cache_creation_tokens": int
                },
                "error": str | None,
                "commit_sha": str | None,
                "files_changed": List[str]
            }
        }
    }
    """

    def __init__(self, state_file_path: str):
        """Initialize the StateManager.

        Args:
            state_file_path: Path to the cascade_state.json file
        """
        self.state_file_path = Path(state_file_path)

    def _get_empty_task(self) -> Dict[str, Any]:
        """Return an empty task structure."""
        return {
            "status": TaskStatus.PENDING.value,
            "worker_id": None,
            "pid": None,
            "started_at": None,
            "completed_at": None,
            "duration_seconds": 0,
            "current_step": None,
            "token_usage": {
                "input_tokens": 0,
                "output_tokens": 0,
                "cache_read_tokens": 0,
                "cache_creation_tokens": 0,
            },
            "error": None,
            "commit_sha": None,
            "files_changed": [],
        }

    def _get_empty_state(
        self, project_name: str, cascade_file: str
    ) -> Dict[str, Any]:
        """Return an empty state structure.

        Args:
            project_name: Name of the project
            cascade_file: Path to the CASCADE.md file

        Returns:
            Empty state dictionary
        """
        return {
            "project": {
                "name": project_name,
                "cascade_file": cascade_file,
                "started_at": None,
                "completed_at": None,
            },
            "tasks": {},
        }

    def initialize(self, project_name: str, cascade_file: str) -> None:
        """Initialize a new state file.

        Args:
            project_name: Name of the project
            cascade_file: Path to the CASCADE.md file
        """
        state = self._get_empty_state(project_name, cascade_file)
        self._write_state(state)

    def read_state(self) -> Dict[str, Any]:
        """Read the current state from the file.

        Returns:
            The current state dictionary

        Raises:
            FileNotFoundError: If the state file doesn't exist
            json.JSONDecodeError: If the state file is corrupted
        """
        if not self.state_file_path.exists():
            raise FileNotFoundError(
                f"State file not found: {self.state_file_path}"
            )

        with open(self.state_file_path, "r") as f:
            # Acquire shared lock for reading
            fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            try:
                state = json.load(f)
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)

        return state

    def _write_state(self, state: Dict[str, Any]) -> None:
        """Write state to the file with exclusive locking.

        Args:
            state: The state dictionary to write
        """
        # Create parent directory if it doesn't exist
        self.state_file_path.parent.mkdir(parents=True, exist_ok=True)

        # Write with exclusive lock
        with open(self.state_file_path, "w") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                json.dump(state, f, indent=2)
                f.flush()
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)

    def _update_state(self, updater_fn) -> None:
        """Read, modify, and write state atomically.

        Args:
            updater_fn: Function that takes state dict and modifies it in-place
        """
        # Use exclusive lock for read-modify-write
        with open(self.state_file_path, "r+") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                state = json.load(f)
                updater_fn(state)
                f.seek(0)
                f.truncate()
                json.dump(state, f, indent=2)
                f.flush()
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)

    def update_task(
        self,
        task_id: str,
        status: Optional[TaskStatus] = None,
        worker_id: Optional[str] = None,
        pid: Optional[int] = None,
        started_at: Optional[str] = None,
        current_step: Optional[str] = None,
    ) -> None:
        """Update a task's metadata.

        Args:
            task_id: The task identifier
            status: New status (if provided)
            worker_id: Worker identifier (if provided)
            pid: Process ID (if provided)
            started_at: Start timestamp ISO format (if provided)
            current_step: Current activity description (if provided)
        """

        def updater(state):
            if task_id not in state["tasks"]:
                state["tasks"][task_id] = self._get_empty_task()

            task = state["tasks"][task_id]

            if status is not None:
                task["status"] = status.value
            if worker_id is not None:
                task["worker_id"] = worker_id
            if pid is not None:
                task["pid"] = pid
            if started_at is not None:
                task["started_at"] = started_at
            if current_step is not None:
                task["current_step"] = current_step

        self._update_state(updater)

    def update_task_tokens(
        self,
        task_id: str,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
        cache_read_tokens: Optional[int] = None,
        cache_creation_tokens: Optional[int] = None,
    ) -> None:
        """Update a task's token usage.

        Args:
            task_id: The task identifier
            input_tokens: Input tokens (if provided)
            output_tokens: Output tokens (if provided)
            cache_read_tokens: Cache read tokens (if provided)
            cache_creation_tokens: Cache creation tokens (if provided)
        """

        def updater(state):
            if task_id not in state["tasks"]:
                state["tasks"][task_id] = self._get_empty_task()

            tokens = state["tasks"][task_id]["token_usage"]

            if input_tokens is not None:
                tokens["input_tokens"] = input_tokens
            if output_tokens is not None:
                tokens["output_tokens"] = output_tokens
            if cache_read_tokens is not None:
                tokens["cache_read_tokens"] = cache_read_tokens
            if cache_creation_tokens is not None:
                tokens["cache_creation_tokens"] = cache_creation_tokens

        self._update_state(updater)

    def complete_task(
        self,
        task_id: str,
        completed_at: str,
        duration_seconds: int,
        commit_sha: Optional[str] = None,
        files_changed: Optional[List[str]] = None,
    ) -> None:
        """Mark a task as completed.

        Args:
            task_id: The task identifier
            completed_at: Completion timestamp ISO format
            duration_seconds: Total duration in seconds
            commit_sha: Git commit SHA (if available)
            files_changed: List of changed files (if available)
        """

        def updater(state):
            if task_id not in state["tasks"]:
                state["tasks"][task_id] = self._get_empty_task()

            task = state["tasks"][task_id]
            task["status"] = TaskStatus.COMPLETED.value
            task["completed_at"] = completed_at
            task["duration_seconds"] = duration_seconds

            if commit_sha is not None:
                task["commit_sha"] = commit_sha
            if files_changed is not None:
                task["files_changed"] = files_changed

        self._update_state(updater)

    def fail_task(self, task_id: str, error: str) -> None:
        """Mark a task as failed.

        Args:
            task_id: The task identifier
            error: Error message describing the failure
        """

        def updater(state):
            if task_id not in state["tasks"]:
                state["tasks"][task_id] = self._get_empty_task()

            task = state["tasks"][task_id]
            task["status"] = TaskStatus.FAILED.value
            task["error"] = error
            task["completed_at"] = datetime.now(timezone.utc).isoformat()

        self._update_state(updater)

    def update_project(
        self,
        started_at: Optional[str] = None,
        completed_at: Optional[str] = None,
    ) -> None:
        """Update project-level timestamps.

        Args:
            started_at: Project start timestamp ISO format (if provided)
            completed_at: Project completion timestamp ISO format (if provided)
        """

        def updater(state):
            if started_at is not None:
                state["project"]["started_at"] = started_at
            if completed_at is not None:
                state["project"]["completed_at"] = completed_at

        self._update_state(updater)
