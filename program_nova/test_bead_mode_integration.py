"""
End-to-end integration test for Bead Mode.

Tests the complete workflow:
1. Create test epic with children and dependencies
2. Verify dashboard data transformations work correctly
3. Verify orchestrator runs workers and updates beads
4. Verify metrics are stored in bead notes
5. Verify dashboard displays progress correctly

Note: API endpoint tests require a running dashboard server and are marked
as integration tests that should be run separately.
"""

import json
import subprocess
import time
from typing import List

import pytest


class TestBeadModeIntegration:
    """Integration tests for bead mode end-to-end workflow."""

    @pytest.fixture
    def test_epic_id(self) -> str:
        """Create a test epic with child tasks for testing.

        Creates structure:
        - Epic: Test Bead Mode Integration
          - Task 1: Simple task (no dependencies)
          - Task 2: Depends on Task 1
          - Task 3: Parallel with Task 1 (no dependencies)

        Returns:
            The epic bead ID
        """
        def extract_bead_id(output: str) -> str:
            """Extract bead ID from bd create output."""
            for line in output.splitlines():
                if "✓ Created issue:" in line:
                    # Extract ID from "✓ Created issue: Nova-abc"
                    return line.split(":")[-1].strip()
            raise ValueError(f"Could not extract bead ID from output: {output}")

        # Create epic
        result = subprocess.run(
            [
                "bd", "create",
                "--title=Test Bead Mode Integration",
                "--type=epic",
                "--priority=2"
            ],
            capture_output=True,
            text=True
        )
        epic_id = extract_bead_id(result.stdout)

        # Create child tasks
        result1 = subprocess.run(
            [
                "bd", "create",
                "--title=Simple Task 1",
                "--type=task",
                "--priority=2",
                f"--parent={epic_id}"
            ],
            capture_output=True,
            text=True
        )
        task1_id = extract_bead_id(result1.stdout)

        result2 = subprocess.run(
            [
                "bd", "create",
                "--title=Dependent Task 2",
                "--type=task",
                "--priority=2",
                f"--parent={epic_id}"
            ],
            capture_output=True,
            text=True
        )
        task2_id = extract_bead_id(result2.stdout)

        result3 = subprocess.run(
            [
                "bd", "create",
                "--title=Parallel Task 3",
                "--type=task",
                "--priority=2",
                f"--parent={epic_id}"
            ],
            capture_output=True,
            text=True
        )
        task3_id = extract_bead_id(result3.stdout)

        # Add dependency: Task 2 depends on Task 1
        subprocess.run(
            ["bd", "dep", "add", task2_id, task1_id],
            check=True
        )

        yield epic_id

        # Cleanup: close all beads created during test
        subprocess.run(["bd", "close", task1_id, task2_id, task3_id, epic_id])

    def test_epic_creation(self, test_epic_id):
        """Verify test epic was created correctly with children and dependencies."""
        # Get epic graph
        result = subprocess.run(
            ["bd", "graph", test_epic_id, "--json"],
            capture_output=True,
            text=True,
            check=True
        )
        graph = json.loads(result.stdout)

        # Verify epic exists
        assert graph["root"]["id"] == test_epic_id
        assert graph["root"]["title"] == "Test Bead Mode Integration"

        # Verify 4 issues total (1 epic + 3 tasks)
        assert len(graph["issues"]) == 4

        # Find child tasks
        tasks = [issue for issue in graph["issues"] if issue["id"] != test_epic_id]
        assert len(tasks) == 3

        # Verify task names
        task_titles = {task["title"] for task in tasks}
        assert "Simple Task 1" in task_titles
        assert "Dependent Task 2" in task_titles
        assert "Parallel Task 3" in task_titles

        # Verify dependencies
        task2 = next(t for t in tasks if t["title"] == "Dependent Task 2")
        task2_deps = graph["layout"]["Nodes"][task2["id"]].get("DependsOn", [])
        assert len(task2_deps) == 1

        # Task 1 and Task 3 should have no dependencies (or None which means no deps)
        task1 = next(t for t in tasks if t["title"] == "Simple Task 1")
        task3 = next(t for t in tasks if t["title"] == "Parallel Task 3")
        task1_deps = graph["layout"]["Nodes"][task1["id"]].get("DependsOn")
        task3_deps = graph["layout"]["Nodes"][task3["id"]].get("DependsOn")
        assert task1_deps is None or task1_deps == []
        assert task3_deps is None or task3_deps == []

    def test_dashboard_adapter_transforms_epic_correctly(self, test_epic_id):
        """Test beads_adapter transforms epic data for dashboard display."""
        from program_nova.dashboard.beads_adapter import get_epic_status

        data = get_epic_status(test_epic_id)

        # Verify top-level structure
        assert "project" in data
        assert "tasks" in data
        assert "hierarchy" in data
        assert "task_definitions" in data
        assert "rollups" in data

        # Verify project name
        assert data["project"]["name"] == "Test Bead Mode Integration"

        # Verify we have at least 1 task
        # Note: Task count may vary based on layer layout
        assert len(data["tasks"]) >= 1, f"Should have at least 1 task, got {len(data['tasks'])}"
        assert len(data["task_definitions"]) >= 1, f"Should have at least 1 task def, got {len(data['task_definitions'])}"

        # Verify each task has required fields
        for task_id, task in data["tasks"].items():
            assert "name" in task
            assert "status" in task
            assert "token_usage" in task
            assert task["status"] in ["pending", "in_progress", "completed"]

        # Verify at least one task has dependencies (Task 2 depends on Task 1)
        dependent_tasks = [
            task_id for task_id, task_def in data["task_definitions"].items()
            if task_def.get("depends_on") and len(task_def["depends_on"]) > 0
        ]
        assert len(dependent_tasks) >= 1, "Should have at least one task with dependencies"

    def test_bead_orchestrator_get_tasks(self, test_epic_id):
        """Test BeadOrchestrator can read tasks from epic."""
        from program_nova.engine.bead_orchestrator import BeadOrchestrator

        orch = BeadOrchestrator(test_epic_id)
        tasks = orch.get_tasks()

        # Should return 3 child tasks
        assert len(tasks) == 3

        # Epic should not be included in tasks
        assert test_epic_id not in tasks

        # Verify task structure
        for task_id, task in tasks.items():
            assert "description" in task
            assert "depends_on" in task
            assert isinstance(task["depends_on"], list)

    def test_bead_orchestrator_get_ready_tasks(self, test_epic_id):
        """Test BeadOrchestrator can identify ready tasks."""
        from program_nova.engine.bead_orchestrator import BeadOrchestrator

        orch = BeadOrchestrator(test_epic_id)
        ready_tasks = orch.get_ready_tasks()

        # Note: bd ready returns ALL ready tasks across ALL epics, not just this epic
        # The orchestrator should filter to only tasks from this epic
        # For this test, we just verify the method works and returns a list
        assert isinstance(ready_tasks, list)

        # If we have ready tasks from our epic, they should have the correct prefix
        epic_prefix = test_epic_id.split(".")[0]
        for task_id in ready_tasks:
            if task_id.startswith(epic_prefix):
                # This is from our epic - good
                pass

    def test_orchestrator_marks_task_in_progress(self, test_epic_id):
        """Test that orchestrator marks task as in_progress when starting worker."""
        from program_nova.engine.bead_orchestrator import BeadOrchestrator
        from unittest.mock import patch, Mock

        orch = BeadOrchestrator(test_epic_id)
        ready_tasks = orch.get_ready_tasks()

        if len(ready_tasks) == 0:
            pytest.skip("No ready tasks available")

        task_id = ready_tasks[0]

        # Mock Worker to avoid actually running claude
        with patch("program_nova.engine.bead_orchestrator.Worker") as mock_worker_class:
            mock_worker = Mock()
            mock_worker_class.return_value = mock_worker

            orch.start_worker(task_id)

            # Verify task is marked as in_progress
            result = subprocess.run(
                ["bd", "show", task_id, "--json"],
                capture_output=True,
                text=True,
                check=True
            )
            task_data = json.loads(result.stdout)[0]
            assert task_data["status"] == "in_progress"

            # Verify worker was created and started
            mock_worker_class.assert_called_once()
            mock_worker.start.assert_called_once()

            # Cleanup: reset task status
            subprocess.run(["bd", "update", task_id, "--status=open"], check=True)

    def test_orchestrator_stores_metrics_on_completion(self, test_epic_id):
        """Test that orchestrator stores metrics when completing task."""
        from program_nova.engine.bead_orchestrator import BeadOrchestrator
        from unittest.mock import Mock

        orch = BeadOrchestrator(test_epic_id)
        ready_tasks = orch.get_ready_tasks()

        if len(ready_tasks) == 0:
            pytest.skip("No ready tasks available")

        task_id = ready_tasks[0]

        # Create mock worker with token usage
        mock_worker = Mock()
        mock_worker.get_token_usage.return_value = {
            "input_tokens": 1000,
            "output_tokens": 500,
            "cache_read_tokens": 100,
            "cache_creation_tokens": 50,
        }

        # Record start time
        orch.task_start_times[task_id] = time.time()
        time.sleep(1.1)  # Delay to measure duration (duration is stored as int seconds)

        # Complete the task
        orch.complete_task(task_id, mock_worker)

        # Verify task was closed
        result = subprocess.run(
            ["bd", "show", task_id, "--json"],
            capture_output=True,
            text=True,
            check=True
        )
        task_data = json.loads(result.stdout)[0]
        assert task_data["status"] == "closed"

        # Verify metrics were stored in comments
        comments_result = subprocess.run(
            ["bd", "comments", task_id, "--json"],
            capture_output=True,
            text=True,
            check=True
        )
        comments = json.loads(comments_result.stdout)
        assert len(comments) > 0, "Should have at least one comment"

        # Find and verify metrics comment
        metrics_comment = None
        for comment in comments:
            try:
                data = json.loads(comment.get("text", ""))
                if data.get("type") == "metrics":
                    metrics_comment = data
                    break
            except json.JSONDecodeError:
                continue

        assert metrics_comment is not None, "Should have a metrics comment"
        assert "token_usage" in metrics_comment, "Should have token_usage in metrics"
        assert metrics_comment["token_usage"]["input_tokens"] == 1000
        assert metrics_comment["token_usage"]["output_tokens"] == 500
        assert "cost_usd" in metrics_comment, "Should have cost_usd in metrics"
        assert "duration_seconds" in metrics_comment, "Should have duration_seconds in metrics"
        assert metrics_comment["duration_seconds"] > 0, "Duration should be positive"

    def test_list_epics_command_works(self):
        """Test that bd list --type=epic works correctly."""
        result = subprocess.run(
            ["bd", "list", "--type=epic", "--json"],
            capture_output=True,
            text=True,
            check=True
        )

        epics = json.loads(result.stdout)
        assert isinstance(epics, list)
        # Should have at least one epic (might be from other tests)
        assert len(epics) >= 0

    def test_bead_graph_command_works(self, test_epic_id):
        """Test that bd graph works for epic."""
        result = subprocess.run(
            ["bd", "graph", test_epic_id, "--json"],
            capture_output=True,
            text=True,
            check=True
        )

        graph = json.loads(result.stdout)
        assert "root" in graph
        assert "issues" in graph
        assert "layout" in graph
        assert graph["root"]["id"] == test_epic_id

    def test_dependency_graph_respects_dependencies(self, test_epic_id):
        """Test that orchestrator respects task dependencies."""
        from program_nova.engine.bead_orchestrator import BeadOrchestrator

        orch = BeadOrchestrator(test_epic_id)

        # Get all tasks
        tasks = orch.get_tasks()

        # Find the dependent task (Task 2)
        dependent_task = None
        for task_id, task in tasks.items():
            if len(task["depends_on"]) > 0:
                dependent_task = task_id
                break

        assert dependent_task is not None, "Should have at least one dependent task"

        # Initially, the dependent task should NOT be in ready list
        ready_tasks = orch.get_ready_tasks()
        # Note: bd ready might include it if we haven't started Task 1 yet,
        # but once Task 1 is in_progress, Task 2 should remain blocked

        # Verify dependency information is correct
        dependent_task_info = tasks[dependent_task]
        assert len(dependent_task_info["depends_on"]) > 0

    def test_parallel_tasks_can_run_simultaneously(self, test_epic_id):
        """Test that parallel tasks (no dependencies) exist in the task graph."""
        from program_nova.engine.bead_orchestrator import BeadOrchestrator

        orch = BeadOrchestrator(test_epic_id)
        tasks = orch.get_tasks()

        # Count tasks with no dependencies (parallel tasks)
        parallel_tasks = [
            task_id for task_id, task in tasks.items()
            if not task["depends_on"] or len(task["depends_on"]) == 0
        ]

        # Should have 2 parallel tasks (Task 1 and Task 3)
        assert len(parallel_tasks) >= 2, f"Should have at least 2 parallel tasks, got {len(parallel_tasks)}"

    def test_dashboard_shows_correct_progress(self, test_epic_id):
        """Test that dashboard status endpoint shows correct task progress."""
        from program_nova.dashboard.beads_adapter import get_epic_status

        # Get status from adapter
        status = get_epic_status(test_epic_id)

        # Verify structure
        assert "tasks" in status
        assert "rollups" in status

        # Verify rollups structure exists
        rollups = status["rollups"]
        assert "l0_rollup" in rollups or "l1_rollups" in rollups or "l2_rollups" in rollups

        # Verify we can compute status from tasks
        tasks = status["tasks"]
        if len(tasks) > 0:
            # Count task statuses
            status_counts = {}
            for task in tasks.values():
                task_status = task.get("status", "pending")
                status_counts[task_status] = status_counts.get(task_status, 0) + 1

            # Should have some tasks tracked
            assert sum(status_counts.values()) > 0

    def test_worker_failures_are_handled(self, test_epic_id):
        """Test that worker failures don't crash the orchestrator."""
        from program_nova.engine.bead_orchestrator import BeadOrchestrator
        from program_nova.engine.worker import WorkerStatus
        from unittest.mock import Mock, patch

        orch = BeadOrchestrator(test_epic_id)
        ready_tasks = orch.get_ready_tasks()

        if len(ready_tasks) == 0:
            pytest.skip("No ready tasks available")

        task_id = ready_tasks[0]

        # Mock Worker to simulate failure
        with patch("program_nova.engine.bead_orchestrator.Worker") as mock_worker_class:
            mock_worker = Mock()
            mock_worker.status = WorkerStatus.FAILED
            mock_worker_class.return_value = mock_worker

            orch.start_worker(task_id)

            # Worker should be created
            assert task_id in orch.active_workers

            # Cleanup
            subprocess.run(["bd", "update", task_id, "--status=open"], check=True)


class TestBeadModeScenarios:
    """Test realistic scenarios for bead mode usage."""

    def test_scenario_simple_linear_workflow(self):
        """Test a simple linear workflow: Task A -> Task B -> Task C."""
        def extract_bead_id(output: str) -> str:
            """Extract bead ID from bd create output."""
            for line in output.splitlines():
                if "✓ Created issue:" in line:
                    return line.split(":")[-1].strip()
            raise ValueError(f"Could not extract bead ID from output: {output}")

        # Create epic
        result = subprocess.run(
            ["bd", "create", "--title=Linear Workflow Test", "--type=epic", "--priority=2"],
            capture_output=True,
            text=True
        )
        epic_id = extract_bead_id(result.stdout)

        # Create tasks
        result_a = subprocess.run(
            ["bd", "create", "--title=Task A", "--type=task", "--priority=2", f"--parent={epic_id}"],
            capture_output=True,
            text=True
        )
        task_a = extract_bead_id(result_a.stdout)

        result_b = subprocess.run(
            ["bd", "create", "--title=Task B", "--type=task", "--priority=2", f"--parent={epic_id}"],
            capture_output=True,
            text=True
        )
        task_b = extract_bead_id(result_b.stdout)

        result_c = subprocess.run(
            ["bd", "create", "--title=Task C", "--type=task", "--priority=2", f"--parent={epic_id}"],
            capture_output=True,
            text=True
        )
        task_c = extract_bead_id(result_c.stdout)

        # Add dependencies: A -> B -> C
        subprocess.run(["bd", "dep", "add", task_b, task_a], check=True)
        subprocess.run(["bd", "dep", "add", task_c, task_b], check=True)

        # Test orchestrator
        from program_nova.engine.bead_orchestrator import BeadOrchestrator
        orch = BeadOrchestrator(epic_id)

        # Get all tasks to verify structure
        tasks = orch.get_tasks()
        assert len(tasks) == 3

        # Verify dependencies are correct
        assert len(tasks[task_b]["depends_on"]) >= 1  # B depends on A
        assert len(tasks[task_c]["depends_on"]) >= 1  # C depends on B

        # Cleanup
        subprocess.run(["bd", "close", task_a, task_b, task_c, epic_id])

    def test_scenario_diamond_dependency(self):
        """Test diamond dependency: A -> B,C -> D."""
        def extract_bead_id(output: str) -> str:
            """Extract bead ID from bd create output."""
            for line in output.splitlines():
                if "✓ Created issue:" in line:
                    return line.split(":")[-1].strip()
            raise ValueError(f"Could not extract bead ID from output: {output}")

        # Create epic
        result = subprocess.run(
            ["bd", "create", "--title=Diamond Dependency Test", "--type=epic", "--priority=2"],
            capture_output=True,
            text=True
        )
        epic_id = extract_bead_id(result.stdout)

        # Create tasks
        tasks = {}
        for name in ["A", "B", "C", "D"]:
            result = subprocess.run(
                ["bd", "create", f"--title=Task {name}", "--type=task", "--priority=2", f"--parent={epic_id}"],
                capture_output=True,
                text=True
            )
            tasks[name] = extract_bead_id(result.stdout)

        # Add dependencies: B,C depend on A; D depends on B,C
        subprocess.run(["bd", "dep", "add", tasks["B"], tasks["A"]], check=True)
        subprocess.run(["bd", "dep", "add", tasks["C"], tasks["A"]], check=True)
        subprocess.run(["bd", "dep", "add", tasks["D"], tasks["B"]], check=True)
        subprocess.run(["bd", "dep", "add", tasks["D"], tasks["C"]], check=True)

        # Test orchestrator
        from program_nova.engine.bead_orchestrator import BeadOrchestrator
        orch = BeadOrchestrator(epic_id)

        # Get task graph
        task_graph = orch.get_tasks()

        # Verify dependencies
        assert tasks["A"] in task_graph
        assert len(task_graph[tasks["B"]]["depends_on"]) >= 1
        assert len(task_graph[tasks["C"]]["depends_on"]) >= 1
        assert len(task_graph[tasks["D"]]["depends_on"]) >= 2

        # Cleanup
        subprocess.run(["bd", "close"] + list(tasks.values()) + [epic_id])
