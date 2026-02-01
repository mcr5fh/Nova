"""
Bead Orchestrator for Program Nova execution engine.

Uses beads as task source instead of CASCADE.md file.
Main responsibilities:
1. Query bead graph to get task dependencies
2. Identify ready tasks using bd ready
3. Spawn workers for ready bead tasks
4. Monitor worker progress and update bead status
5. Store execution metrics as structured JSON comments
6. Close beads when tasks complete
"""

import json
import subprocess
import threading
import time
from typing import Dict, List, Optional

from program_nova.engine.worker import Worker


# Pricing for Sonnet 4.5 (per million tokens)
PRICE_INPUT_TOKENS = 3.00
PRICE_OUTPUT_TOKENS = 15.00
PRICE_CACHE_READ_TOKENS = 0.30
PRICE_CACHE_CREATION_TOKENS = 3.75


def compute_cost_from_tokens(token_usage: Dict[str, int]) -> float:
    """
    Compute cost in USD from token usage.

    Args:
        token_usage: Dictionary with keys: input_tokens, output_tokens,
                     cache_read_tokens, cache_creation_tokens

    Returns:
        Cost in USD
    """
    cost_usd = (
        token_usage.get("input_tokens", 0) / 1_000_000 * PRICE_INPUT_TOKENS
        + token_usage.get("output_tokens", 0) / 1_000_000 * PRICE_OUTPUT_TOKENS
        + token_usage.get("cache_read_tokens", 0) / 1_000_000 * PRICE_CACHE_READ_TOKENS
        + token_usage.get("cache_creation_tokens", 0) / 1_000_000 * PRICE_CACHE_CREATION_TOKENS
    )
    return cost_usd


class BeadOrchestrator:
    """Orchestrator that uses beads as task source."""

    def __init__(self, epic_id: str, max_workers: int = 3):
        """
        Initialize the bead orchestrator.

        Args:
            epic_id: ID of the bead epic containing child tasks
            max_workers: Maximum number of concurrent workers (default: 3)
        """
        self.epic_id = epic_id
        self.max_workers = max_workers
        self.active_workers: Dict[str, Worker] = {}
        self.task_start_times: Dict[str, float] = {}
        self.stop_flag = threading.Event()

    def get_tasks(self) -> Dict[str, dict]:
        """
        Get tasks from bead children.

        Returns:
            Dictionary mapping bead_id to task info with keys:
            - description: Task description or title
            - depends_on: List of dependency bead IDs
        """
        result = subprocess.run(
            ["bd", "graph", self.epic_id, "--json"],
            capture_output=True,
            text=True
        )
        graph = json.loads(result.stdout)

        tasks = {}
        for issue in graph["issues"]:
            if issue["id"] != self.epic_id:  # Skip the epic itself
                tasks[issue["id"]] = {
                    "description": issue.get("description") or issue["title"],
                    "depends_on": graph["layout"]["Nodes"][issue["id"]].get("DependsOn") or []
                }
        return tasks

    def get_ready_tasks(self) -> List[str]:
        """
        Get tasks ready to execute (open + no blockers).

        Returns:
            List of bead IDs that are ready to start
        """
        result = subprocess.run(
            ["bd", "ready", "--json"],
            capture_output=True,
            text=True
        )
        ready = json.loads(result.stdout)
        # Filter to only children of our epic
        return [b["id"] for b in ready if b["id"].startswith(self.epic_id)]

    def start_worker(self, bead_id: str):
        """
        Start worker for a bead task.

        Args:
            bead_id: ID of the bead to execute

        Side effects:
            - Marks bead as in_progress
            - Creates and starts Worker subprocess
            - Tracks worker in active_workers
            - Records start time for duration calculation
        """
        # Mark bead as in_progress
        subprocess.run(["bd", "update", bead_id, "--status=in_progress"])

        # Get task description
        result = subprocess.run(
            ["bd", "show", bead_id, "--json"],
            capture_output=True,
            text=True
        )
        bead = json.loads(result.stdout)[0]
        description = bead.get("description") or bead["title"]

        # Record start time
        self.task_start_times[bead_id] = time.time()

        # Spawn worker (same as cascade mode)
        worker = Worker(task_id=bead_id, task_description=description)
        command = [
            "claude",
            "--model", "sonnet",
            "--dangerously-skip-permissions",
            "--print",
            "--output-format", "json",
            description,
        ]
        worker.start(command)
        self.active_workers[bead_id] = worker

    def complete_task(self, bead_id: str, worker: Worker):
        """
        Mark bead complete and store metrics.

        Args:
            bead_id: ID of the bead that completed
            worker: Worker instance that executed the task

        Side effects:
            - Adds structured JSON metrics comment to bead
            - Closes the bead
        """
        token_usage = worker.get_token_usage()

        # Calculate duration
        start_time = self.task_start_times.get(bead_id)
        if start_time:
            duration = time.time() - start_time
        else:
            duration = 0.0

        cost = compute_cost_from_tokens(token_usage)

        # Store metrics as structured JSON comment
        metrics = {
            "type": "metrics",
            "token_usage": token_usage,
            "cost_usd": cost,
            "duration_seconds": int(duration)
        }
        metrics_json = json.dumps(metrics)

        # Add metrics comment to the bead
        subprocess.run([
            "bd", "comments", "add", bead_id, metrics_json
        ])

        # Close the bead
        subprocess.run(["bd", "close", bead_id])

        # Clean up start time tracking
        self.task_start_times.pop(bead_id, None)

    def stop(self):
        """
        Signal the orchestrator to stop gracefully.

        Sets the stop_flag to signal the main loop to exit.
        Workers will be allowed to complete their current tasks.
        """
        self.stop_flag.set()

    def start(self, check_interval: float = 2.0, max_iterations: Optional[int] = None):
        """
        Start the orchestrator main loop.

        This method will:
        1. Get ready tasks
        2. Start workers (up to max_workers limit)
        3. Monitor workers for completion
        4. Complete tasks when workers finish
        5. Repeat until no more tasks are ready or stop_flag is set

        Args:
            check_interval: Time in seconds between status checks (default: 2.0)
            max_iterations: Maximum number of iterations (None = unlimited)

        Side effects:
            - Starts workers for ready tasks
            - Updates bead statuses
            - Stores metrics in bead notes
        """
        iteration = 0

        while not self.stop_flag.is_set():
            # Check iteration limit
            if max_iterations is not None and iteration >= max_iterations:
                break

            iteration += 1

            # Get ready tasks
            ready_tasks = self.get_ready_tasks()

            # Start workers for ready tasks (respecting max_workers limit)
            available_slots = self.max_workers - len(self.active_workers)
            for task_id in ready_tasks[:available_slots]:
                if task_id not in self.active_workers:
                    self.start_worker(task_id)

            # Check status of active workers
            completed_workers = []
            for task_id, worker in list(self.active_workers.items()):
                if not worker.is_alive():
                    exit_code = worker.wait()
                    if exit_code == 0:
                        self.complete_task(task_id, worker)
                    completed_workers.append(task_id)

            # Remove completed workers from active list
            for task_id in completed_workers:
                self.active_workers.pop(task_id, None)

            # Exit if no more work to do
            if not self.active_workers and not ready_tasks:
                break

            # Wait before next iteration
            time.sleep(check_interval)
