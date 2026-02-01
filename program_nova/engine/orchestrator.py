"""
Orchestrator for Program Nova execution engine.

Main responsibilities:
1. Parse CASCADE.md to get task graph and dependencies
2. Initialize shared state file
3. Resolve ready tasks (dependencies satisfied)
4. Spawn workers for ready tasks respecting concurrency limit
5. Monitor worker progress and update state
6. Handle task completion/failure
7. Advance execution by starting new tasks as dependencies complete
"""

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from program_nova.engine.parser import parse_cascade, DAG
from program_nova.engine.state import StateManager, TaskStatus
from program_nova.engine.worker import Worker, WorkerStatus


class Orchestrator:
    """
    Main orchestrator that manages cascade execution.

    Lifecycle:
    1. Initialize: Parse cascade, create state file, load configuration
    2. Run: Main loop that spawns workers, monitors progress, handles completion
    3. Cleanup: Ensure all workers finish and state is final
    """

    def __init__(
        self,
        cascade_file: str,
        state_file: str,
        max_workers: int = 3,
    ):
        """
        Initialize the orchestrator.

        Args:
            cascade_file: Path to CASCADE.md file
            state_file: Path to cascade_state.json
            max_workers: Maximum number of concurrent workers (default: 3)
        """
        self.cascade_file = cascade_file
        self.state_file = state_file
        self.max_workers = max_workers

        # Parse the cascade file
        self.cascade_data = parse_cascade(cascade_file)
        self.tasks = self.cascade_data["tasks"]
        self.hierarchy = self.cascade_data["hierarchy"]
        self.dag = self.cascade_data["dag"]

        # Initialize state manager
        self.state_mgr = StateManager(state_file)

        # Initialize state file if it doesn't exist
        if not Path(state_file).exists():
            self.state_mgr.initialize(
                project_name=self.cascade_data["project_name"],
                cascade_file=cascade_file,
            )

            # Initialize all tasks in state as pending
            for task_id in self.tasks.keys():
                self.state_mgr.update_task(task_id, status=TaskStatus.PENDING)

        # Track active workers
        self.active_workers: Dict[str, Worker] = {}

    def get_ready_tasks(self) -> List[str]:
        """
        Get list of tasks that are ready to execute.

        A task is ready if:
        - Status is pending (not started/completed/failed/in-progress)
        - All dependencies have status 'completed'

        Returns:
            List of task IDs that are ready to start
        """
        state = self.state_mgr.read_state()
        task_states = state.get("tasks", {})

        # Build a dict of task_id -> status for completed/in_progress/failed tasks
        task_status_map = {}
        for task_id, task_data in task_states.items():
            status = task_data.get("status", "pending")
            task_status_map[task_id] = status

        # Get ready tasks from DAG
        # We need to pass tasks that have been started/completed
        completed_or_started = {
            tid: status
            for tid, status in task_status_map.items()
            if status in ["completed", "in_progress", "failed"]
        }

        ready = self.dag.get_ready_tasks(completed_or_started)

        # Filter out tasks that are already in progress or being tracked
        ready = [
            tid for tid in ready
            if task_status_map.get(tid, "pending") == "pending"
            and tid not in self.active_workers
        ]

        return ready

    def start_worker(self, task_id: str) -> None:
        """
        Start a worker for the given task.

        Args:
            task_id: ID of the task to start

        Side effects:
            - Creates Worker instance
            - Spawns subprocess
            - Updates state file with task start info
            - Adds worker to active_workers tracking
        """
        task_info = self.tasks[task_id]
        task_description = task_info["description"]

        # Create worker
        worker = Worker(task_id=task_id, task_description=task_description)

        # Build command for worker to spawn Claude Code agent
        # Add permission bypass flag so workers don't prompt for file creation
        command = [
            "claude",
            "--model",
            "sonnet",
            "--dangerously-skip-permissions",
            task_description,
        ]

        # Mark task as in-progress in state
        started_at = datetime.now(timezone.utc).isoformat()
        self.state_mgr.update_task(
            task_id,
            status=TaskStatus.IN_PROGRESS,
            worker_id=task_id,
            started_at=started_at,
        )

        # Start the worker in the current working directory
        # This ensures workers run in the project directory where nova was invoked
        worker.start(command, cwd=str(Path.cwd()))

        # Update state with PID
        self.state_mgr.update_task(task_id, pid=worker.pid)

        # Track the worker
        self.active_workers[task_id] = worker

    def monitor_workers(self) -> None:
        """
        Monitor all active workers and update state.

        For each active worker:
        1. Check if still alive
        2. Update token usage in state
        3. If completed/failed, finalize the task and remove from active workers

        Side effects:
            - Updates task state for all active workers
            - Removes completed/failed workers from active_workers
        """
        completed_workers = []

        for task_id, worker in self.active_workers.items():
            # Update token usage
            token_usage = worker.get_token_usage()
            self.state_mgr.update_task_tokens(
                task_id,
                input_tokens=token_usage["input_tokens"],
                output_tokens=token_usage["output_tokens"],
                cache_read_tokens=token_usage["cache_read_tokens"],
                cache_creation_tokens=token_usage["cache_creation_tokens"],
            )

            # Check if worker has finished
            if not worker.is_alive():
                exit_code = worker.get_exit_code()

                if exit_code == 0:
                    # Task completed successfully
                    self._handle_task_completion(task_id, worker)
                else:
                    # Task failed
                    self._handle_task_failure(task_id, worker, exit_code)

                completed_workers.append(task_id)

        # Remove completed workers from tracking
        for task_id in completed_workers:
            del self.active_workers[task_id]

    def _handle_task_completion(self, task_id: str, worker: Worker) -> None:
        """
        Handle successful task completion.

        Args:
            task_id: ID of the completed task
            worker: Worker instance that completed the task
        """
        # Get task start time to calculate duration
        state = self.state_mgr.read_state()
        task_data = state["tasks"].get(task_id, {})
        started_at_str = task_data.get("started_at")

        if started_at_str:
            started_at = datetime.fromisoformat(started_at_str)
            completed_at = datetime.now(timezone.utc)
            duration_seconds = int((completed_at - started_at).total_seconds())
        else:
            duration_seconds = 0
            completed_at = datetime.now(timezone.utc)

        # Mark as completed in state
        self.state_mgr.complete_task(
            task_id,
            completed_at=completed_at.isoformat(),
            duration_seconds=duration_seconds,
        )

    def _handle_task_failure(
        self, task_id: str, worker: Worker, exit_code: int
    ) -> None:
        """
        Handle task failure.

        Args:
            task_id: ID of the failed task
            worker: Worker instance that failed
            exit_code: Non-zero exit code from the worker process
        """
        error_msg = f"Worker exited with code {exit_code}"
        self.state_mgr.fail_task(task_id, error=error_msg)

    def run(self, check_interval: float = 2.0, max_iterations: Optional[int] = None) -> None:
        """
        Main execution loop.

        This is the heart of the orchestrator. It:
        1. Checks for ready tasks
        2. Starts workers for ready tasks (up to max_workers limit)
        3. Monitors running workers
        4. Handles completions/failures
        5. Repeats until all tasks are complete or blocked

        Args:
            check_interval: Seconds to wait between loop iterations (default: 2.0)
            max_iterations: Maximum loop iterations (for testing, default: None = unlimited)

        Side effects:
            - Updates project start/end timestamps
            - Spawns and monitors workers
            - Updates state file continuously
        """
        # Mark project as started
        self.state_mgr.update_project(started_at=datetime.now(timezone.utc).isoformat())

        iteration = 0
        while True:
            iteration += 1

            # Check if we've hit max iterations (for testing)
            if max_iterations is not None and iteration > max_iterations:
                break

            # Monitor existing workers
            self.monitor_workers()

            # Check if we can start new workers
            available_slots = self.max_workers - len(self.active_workers)

            if available_slots > 0:
                ready_tasks = self.get_ready_tasks()

                # Start workers for ready tasks (up to available slots)
                for task_id in ready_tasks[:available_slots]:
                    self.start_worker(task_id)

            # Check if execution is complete
            if self._is_execution_complete():
                break

            # Wait before next iteration
            time.sleep(check_interval)

        # Final monitoring pass to ensure all workers are handled
        self.monitor_workers()

        # Mark project as completed
        self.state_mgr.update_project(completed_at=datetime.now(timezone.utc).isoformat())

    def _is_execution_complete(self) -> bool:
        """
        Check if execution is complete.

        Execution is complete when:
        - No workers are active AND
        - No more ready tasks exist

        This means all tasks are either completed, failed, or blocked by failed dependencies.

        Returns:
            True if execution is complete, False otherwise
        """
        # If there are still active workers, not done
        if self.active_workers:
            return False

        # If there are ready tasks, not done
        ready_tasks = self.get_ready_tasks()
        if ready_tasks:
            return False

        # No active workers and no ready tasks = complete
        return True

    def get_status_summary(self) -> Dict:
        """
        Get a summary of current execution status.

        Returns:
            Dictionary with:
            - total_tasks: Total number of tasks
            - completed: Number of completed tasks
            - failed: Number of failed tasks
            - in_progress: Number of in-progress tasks
            - pending: Number of pending tasks
            - active_workers: Number of active workers
        """
        state = self.state_mgr.read_state()
        task_states = state.get("tasks", {})

        summary = {
            "total_tasks": len(self.tasks),
            "completed": 0,
            "failed": 0,
            "in_progress": 0,
            "pending": 0,
            "active_workers": len(self.active_workers),
        }

        for task_data in task_states.values():
            status = task_data.get("status", "pending")
            if status == "completed":
                summary["completed"] += 1
            elif status == "failed":
                summary["failed"] += 1
            elif status == "in_progress":
                summary["in_progress"] += 1
            else:
                summary["pending"] += 1

        # Account for tasks not yet in state (they're pending)
        tasks_in_state = len(task_states)
        if tasks_in_state < summary["total_tasks"]:
            summary["pending"] += summary["total_tasks"] - tasks_in_state

        return summary


def setup_logging(daemon_mode: bool = False):
    """
    Setup logging configuration.

    Args:
        daemon_mode: If True, configure logging for daemon mode (log to file)
                    If False, log to console
    """
    import logging
    import logging.handlers
    from pathlib import Path

    # Create logs directory if it doesn't exist (relative to cwd)
    logs_dir = Path.cwd() / "logs"
    logs_dir.mkdir(exist_ok=True)

    # Configure root logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    # Clear any existing handlers
    logger.handlers.clear()

    if daemon_mode:
        # Daemon mode: log to file with rotation
        log_file = logs_dir / "orchestrator.log"
        handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
        )
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
    else:
        # Interactive mode: log to console
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            "%(levelname)s: %(message)s"
        )

    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger


def main():
    """
    Main entry point for running the orchestrator.

    Usage:
        python -m program_nova.engine.orchestrator [--daemon] [CASCADE_FILE]

    Args:
        --daemon: Run in daemon mode (log to file instead of console)
        CASCADE_FILE: Path to cascade file (default: CASCADE.md)

    Expects:
        - CASCADE.md in current directory (or specified file)
        - Will create cascade_state.json in current directory
    """
    import sys
    import argparse

    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Program Nova Orchestrator - Cascade Task Execution Engine"
    )
    parser.add_argument(
        "cascade_file",
        nargs="?",
        default="./CASCADE.md",
        help="Path to CASCADE.md file (default: ./CASCADE.md)",
    )
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run in daemon mode (log to file)",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=3,
        help="Maximum number of concurrent workers (default: 3)",
    )
    parser.add_argument(
        "--state-file",
        default="./cascade_state.json",
        help="Path to state file (default: ./cascade_state.json)",
    )

    args = parser.parse_args()

    # Setup logging
    logger = setup_logging(daemon_mode=args.daemon)

    # Create orchestrator
    try:
        orchestrator = Orchestrator(
            cascade_file=args.cascade_file,
            state_file=args.state_file,
            max_workers=args.max_workers,
        )
    except FileNotFoundError as e:
        logger.error(f"File not found: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to initialize orchestrator: {e}")
        sys.exit(1)

    logger.info(f"Starting Program Nova orchestrator")
    logger.info(f"Cascade: {args.cascade_file}")
    logger.info(f"State: {args.state_file}")
    logger.info(f"Max workers: {orchestrator.max_workers}")
    logger.info(f"Total tasks: {len(orchestrator.tasks)}")
    logger.info(f"Daemon mode: {args.daemon}")

    try:
        # Run the orchestrator
        orchestrator.run(check_interval=2.0)

        # Print final summary
        summary = orchestrator.get_status_summary()
        logger.info("Execution complete!")
        logger.info(f"Completed: {summary['completed']}/{summary['total_tasks']}")
        logger.info(f"Failed: {summary['failed']}")
        logger.info(f"Pending/Blocked: {summary['pending']}")

    except KeyboardInterrupt:
        logger.info("Interrupted by user. Cleaning up...")
        # Terminate any active workers
        for worker in orchestrator.active_workers.values():
            worker.terminate()
        logger.info("Cleanup complete.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Orchestrator error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
