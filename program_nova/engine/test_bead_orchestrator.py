"""
Tests for BeadOrchestrator that uses beads as task source.

Tests verify that the orchestrator correctly:
- Parses bead graph to extract tasks
- Identifies ready tasks
- Spawns workers for bead tasks
- Handles task completion and stores metrics
"""

import json
import subprocess
import threading
from pathlib import Path
from unittest.mock import Mock, patch, call, MagicMock
import pytest

from program_nova.engine.bead_orchestrator import BeadOrchestrator, compute_cost_from_tokens
from program_nova.engine.worker import Worker, WorkerStatus


class TestComputeCost:
    """Test cost computation from token usage."""

    def test_compute_cost_basic(self):
        """Test basic cost computation."""
        token_usage = {
            "input_tokens": 1000,
            "output_tokens": 500,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
        }
        cost = compute_cost_from_tokens(token_usage)
        # (1000/1M * 3.00) + (500/1M * 15.00) = 0.003 + 0.0075 = 0.0105
        assert abs(cost - 0.0105) < 1e-10

    def test_compute_cost_with_cache(self):
        """Test cost computation with cache tokens."""
        token_usage = {
            "input_tokens": 1000,
            "output_tokens": 500,
            "cache_read_tokens": 2000,
            "cache_creation_tokens": 1000,
        }
        cost = compute_cost_from_tokens(token_usage)
        # (1000/1M * 3.00) + (500/1M * 15.00) + (2000/1M * 0.30) + (1000/1M * 3.75)
        # = 0.003 + 0.0075 + 0.0006 + 0.00375 = 0.01485
        assert abs(cost - 0.01485) < 1e-10


class TestBeadOrchestrator:
    """Test BeadOrchestrator initialization and task management."""

    @pytest.fixture
    def mock_subprocess_run(self):
        """Mock subprocess.run for bd commands."""
        with patch("subprocess.run") as mock_run:
            yield mock_run

    @pytest.fixture
    def sample_graph_data(self):
        """Sample bead graph data."""
        return {
            "root": {
                "id": "Nova-gyd",
                "title": "Test Epic"
            },
            "issues": [
                {
                    "id": "Nova-gyd",
                    "title": "Test Epic",
                    "type": "epic",
                    "status": "open",
                    "description": "Test epic description"
                },
                {
                    "id": "Nova-gyd.1",
                    "title": "Task 1",
                    "type": "task",
                    "status": "open",
                    "description": "First task"
                },
                {
                    "id": "Nova-gyd.2",
                    "title": "Task 2",
                    "type": "task",
                    "status": "open",
                    "description": "Second task"
                }
            ],
            "layout": {
                "Nodes": {
                    "Nova-gyd": {"DependsOn": []},
                    "Nova-gyd.1": {"DependsOn": []},
                    "Nova-gyd.2": {"DependsOn": ["Nova-gyd.1"]}
                },
                "Layers": [
                    ["Nova-gyd"],
                    ["Nova-gyd.1"],
                    ["Nova-gyd.2"]
                ]
            }
        }

    def test_init(self, mock_subprocess_run):
        """Test BeadOrchestrator initialization."""
        orch = BeadOrchestrator("Nova-gyd")
        assert orch.epic_id == "Nova-gyd"
        assert orch.active_workers == {}

    def test_get_tasks(self, mock_subprocess_run, sample_graph_data):
        """Test getting tasks from bead graph."""
        mock_subprocess_run.return_value = Mock(
            stdout=json.dumps(sample_graph_data)
        )

        orch = BeadOrchestrator("Nova-gyd")
        tasks = orch.get_tasks()

        # Should call bd graph with JSON output
        mock_subprocess_run.assert_called_once_with(
            ["bd", "graph", "Nova-gyd", "--json"],
            capture_output=True,
            text=True
        )

        # Should return tasks excluding the epic itself
        assert len(tasks) == 2
        assert "Nova-gyd.1" in tasks
        assert "Nova-gyd.2" in tasks
        assert "Nova-gyd" not in tasks  # Epic excluded

        # Verify task structure
        assert tasks["Nova-gyd.1"]["description"] == "First task"
        assert tasks["Nova-gyd.1"]["depends_on"] == []
        assert tasks["Nova-gyd.2"]["depends_on"] == ["Nova-gyd.1"]

    def test_get_tasks_uses_title_if_no_description(self, mock_subprocess_run):
        """Test that get_tasks falls back to title when description is empty."""
        graph_data = {
            "root": {"id": "Nova-gyd", "title": "Test Epic"},
            "issues": [
                {
                    "id": "Nova-gyd",
                    "title": "Test Epic",
                    "type": "epic",
                    "status": "open"
                },
                {
                    "id": "Nova-gyd.1",
                    "title": "Task Without Description",
                    "type": "task",
                    "status": "open",
                    "description": ""
                }
            ],
            "layout": {
                "Nodes": {
                    "Nova-gyd": {"DependsOn": []},
                    "Nova-gyd.1": {"DependsOn": []}
                },
                "Layers": [["Nova-gyd"], ["Nova-gyd.1"]]
            }
        }
        mock_subprocess_run.return_value = Mock(stdout=json.dumps(graph_data))

        orch = BeadOrchestrator("Nova-gyd")
        tasks = orch.get_tasks()

        assert tasks["Nova-gyd.1"]["description"] == "Task Without Description"

    def test_get_ready_tasks(self, mock_subprocess_run):
        """Test getting ready tasks from bd ready."""
        ready_data = [
            {"id": "Nova-gyd.1", "title": "Ready Task 1"},
            {"id": "Nova-xyz.1", "title": "Other Epic Task"},
            {"id": "Nova-gyd.3", "title": "Ready Task 2"}
        ]
        mock_subprocess_run.return_value = Mock(stdout=json.dumps(ready_data))

        orch = BeadOrchestrator("Nova-gyd")
        ready = orch.get_ready_tasks()

        # Should call bd ready with JSON output
        mock_subprocess_run.assert_called_once_with(
            ["bd", "ready", "--json"],
            capture_output=True,
            text=True
        )

        # Should only return tasks from our epic
        assert len(ready) == 2
        assert "Nova-gyd.1" in ready
        assert "Nova-gyd.3" in ready
        assert "Nova-xyz.1" not in ready

    @patch("program_nova.engine.bead_orchestrator.Worker")
    def test_start_worker(self, mock_worker_class, mock_subprocess_run):
        """Test starting a worker for a bead task."""
        # Mock bd show output
        bead_data = [{
            "id": "Nova-gyd.1",
            "title": "Test Task",
            "description": "Task description",
            "status": "open"
        }]
        mock_subprocess_run.return_value = Mock(stdout=json.dumps(bead_data))

        # Mock Worker instance
        mock_worker = Mock()
        mock_worker_class.return_value = mock_worker

        orch = BeadOrchestrator("Nova-gyd")
        orch.start_worker("Nova-gyd.1")

        # Should update bead to in_progress
        assert mock_subprocess_run.call_args_list[0] == call(
            ["bd", "update", "Nova-gyd.1", "--status=in_progress"]
        )

        # Should fetch bead details
        assert mock_subprocess_run.call_args_list[1] == call(
            ["bd", "show", "Nova-gyd.1", "--json"],
            capture_output=True,
            text=True
        )

        # Should create worker with correct task ID and description
        mock_worker_class.assert_called_once_with(
            task_id="Nova-gyd.1",
            task_description="Task description"
        )

        # Should start worker with correct command
        expected_command = [
            "claude",
            "--model", "sonnet",
            "--dangerously-skip-permissions",
            "--print",
            "--output-format", "json",
            "Task description",
        ]
        mock_worker.start.assert_called_once_with(expected_command)

        # Should track active worker
        assert orch.active_workers["Nova-gyd.1"] == mock_worker

    @patch("program_nova.engine.bead_orchestrator.Worker")
    def test_start_worker_uses_title_if_no_description(
        self, mock_worker_class, mock_subprocess_run
    ):
        """Test that start_worker falls back to title when description is empty."""
        bead_data = [{
            "id": "Nova-gyd.1",
            "title": "Task Title Only",
            "description": "",
            "status": "open"
        }]
        mock_subprocess_run.return_value = Mock(stdout=json.dumps(bead_data))

        mock_worker = Mock()
        mock_worker_class.return_value = mock_worker

        orch = BeadOrchestrator("Nova-gyd")
        orch.start_worker("Nova-gyd.1")

        # Should use title as description
        mock_worker_class.assert_called_once_with(
            task_id="Nova-gyd.1",
            task_description="Task Title Only"
        )

    @patch("program_nova.engine.bead_orchestrator.time.time")
    def test_complete_task(self, mock_time, mock_subprocess_run):
        """Test completing a task and storing metrics."""
        # Mock time for duration calculation
        mock_time.return_value = 1045.5  # end time

        # Create mock worker with metrics
        mock_worker = Mock(spec=Worker)
        mock_worker.get_token_usage.return_value = {
            "input_tokens": 1000,
            "output_tokens": 500,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
        }

        orch = BeadOrchestrator("Nova-gyd")
        # Simulate starting the task to record start time
        orch.task_start_times["Nova-gyd.1"] = 1000.0
        orch.complete_task("Nova-gyd.1", mock_worker)

        # Verify the metrics comment was added
        # Duration should be 45 seconds (int(45.5))
        call_args = mock_subprocess_run.call_args_list[0]
        assert call_args[0][0][:4] == ["bd", "comments", "add", "Nova-gyd.1"]

        # Parse the metrics from the comment
        metrics_json = call_args[0][0][4]
        metrics = json.loads(metrics_json)

        # Verify metrics structure and values
        assert metrics["type"] == "metrics"
        assert metrics["token_usage"]["input_tokens"] == 1000
        assert metrics["token_usage"]["output_tokens"] == 500
        assert abs(metrics["cost_usd"] - 0.0105) < 1e-10
        assert metrics["duration_seconds"] == 45

        # Should close the bead
        assert mock_subprocess_run.call_args_list[1] == call(
            ["bd", "close", "Nova-gyd.1"]
        )

        # Should clean up start time
        assert "Nova-gyd.1" not in orch.task_start_times

    @patch("program_nova.engine.bead_orchestrator.time.time")
    def test_complete_task_with_cache_tokens(self, mock_time, mock_subprocess_run):
        """Test completing a task with cache tokens."""
        # Mock time for duration calculation
        mock_time.return_value = 1120.0  # end time

        mock_worker = Mock(spec=Worker)
        mock_worker.get_token_usage.return_value = {
            "input_tokens": 1000,
            "output_tokens": 500,
            "cache_read_tokens": 2000,
            "cache_creation_tokens": 1000,
        }

        orch = BeadOrchestrator("Nova-gyd")
        # Simulate starting the task to record start time
        orch.task_start_times["Nova-gyd.1"] = 1000.0
        orch.complete_task("Nova-gyd.1", mock_worker)

        # Verify the metrics comment was added
        # Duration should be 120 seconds (int(120.0))
        call_args = mock_subprocess_run.call_args_list[0]
        assert call_args[0][0][:4] == ["bd", "comments", "add", "Nova-gyd.1"]

        # Parse the metrics from the comment
        metrics_json = call_args[0][0][4]
        metrics = json.loads(metrics_json)

        # Verify cost includes cache tokens
        # Expected cost: 0.01485 (calculated in test_compute_cost_with_cache)
        assert metrics["type"] == "metrics"
        assert metrics["token_usage"]["input_tokens"] == 1000
        assert metrics["token_usage"]["output_tokens"] == 500
        assert metrics["token_usage"]["cache_read_tokens"] == 2000
        assert metrics["token_usage"]["cache_creation_tokens"] == 1000
        assert abs(metrics["cost_usd"] - 0.01485) < 1e-10
        assert metrics["duration_seconds"] == 120

    @patch("program_nova.engine.bead_orchestrator.Worker")
    @patch("program_nova.engine.bead_orchestrator.time")
    def test_start_spawns_workers_for_ready_tasks(
        self, mock_time, mock_worker_class, mock_subprocess_run
    ):
        """Test that start() spawns workers for ready tasks."""
        # Mock time.time for duration tracking
        mock_time.time.return_value = 1000.0
        mock_time.sleep = lambda x: None  # Skip actual sleeping

        # Mock get_ready_tasks to return 2 tasks on first call, then empty
        ready_tasks_responses = [
            [{"id": "Nova-gyd.1"}, {"id": "Nova-gyd.3"}],  # First call: 2 ready tasks
            [],  # Second call: no more tasks
        ]

        # Mock bd show responses for both tasks
        bead_responses = [
            [{"id": "Nova-gyd.1", "title": "Task 1", "description": "First task", "status": "open"}],
            [{"id": "Nova-gyd.3", "title": "Task 3", "description": "Third task", "status": "open"}],
        ]

        # Setup mock responses in order
        mock_subprocess_run.side_effect = [
            # First iteration: get_ready_tasks call
            Mock(stdout=json.dumps(ready_tasks_responses[0])),
            # bd update for Nova-gyd.1
            Mock(returncode=0),
            # bd show for Nova-gyd.1
            Mock(stdout=json.dumps(bead_responses[0])),
            # bd update for Nova-gyd.3
            Mock(returncode=0),
            # bd show for Nova-gyd.3
            Mock(stdout=json.dumps(bead_responses[1])),
            # Workers complete, so complete_task is called twice
            # bd comments add for Nova-gyd.1
            Mock(returncode=0),
            # bd close for Nova-gyd.1
            Mock(returncode=0),
            # bd comments add for Nova-gyd.3
            Mock(returncode=0),
            # bd close for Nova-gyd.3
            Mock(returncode=0),
            # Second iteration: get_ready_tasks returns empty
            Mock(stdout=json.dumps(ready_tasks_responses[1])),
        ]

        # Mock Worker instances
        mock_worker1 = Mock()
        mock_worker1.is_alive.return_value = False  # Worker completed
        mock_worker1.wait.return_value = 0
        mock_worker1.get_token_usage.return_value = {
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
        }

        mock_worker2 = Mock()
        mock_worker2.is_alive.return_value = False
        mock_worker2.wait.return_value = 0
        mock_worker2.get_token_usage.return_value = {
            "input_tokens": 100,
            "output_tokens": 50,
            "cache_read_tokens": 0,
            "cache_creation_tokens": 0,
        }

        mock_worker_class.side_effect = [mock_worker1, mock_worker2]

        # Create orchestrator and run
        orch = BeadOrchestrator("Nova-gyd", max_workers=2)
        orch.start(check_interval=0.1, max_iterations=2)

        # Verify workers were created for both tasks
        assert mock_worker_class.call_count == 2
        mock_worker_class.assert_any_call(
            task_id="Nova-gyd.1",
            task_description="First task"
        )
        mock_worker_class.assert_any_call(
            task_id="Nova-gyd.3",
            task_description="Third task"
        )

        # Verify workers were started
        mock_worker1.start.assert_called_once()
        mock_worker2.start.assert_called_once()

    @patch("program_nova.engine.bead_orchestrator.Worker")
    @patch("program_nova.engine.bead_orchestrator.time")
    def test_start_respects_max_workers_limit(
        self, mock_time, mock_worker_class, mock_subprocess_run
    ):
        """Test that start() respects max_workers limit."""
        # Mock time
        mock_time.time.return_value = 1000.0
        mock_time.sleep = lambda x: None

        # Mock get_ready_tasks to return 3 tasks initially
        ready_tasks_response = [
            {"id": "Nova-gyd.1"},
            {"id": "Nova-gyd.2"},
            {"id": "Nova-gyd.3"}
        ]

        # Mock bd show for first 2 tasks (max_workers=2)
        bead_responses = [
            [{"id": "Nova-gyd.1", "title": "Task 1", "description": "First", "status": "open"}],
            [{"id": "Nova-gyd.2", "title": "Task 2", "description": "Second", "status": "open"}],
        ]

        mock_subprocess_run.side_effect = [
            # get_ready_tasks
            Mock(stdout=json.dumps(ready_tasks_response)),
            # bd update for task 1
            Mock(returncode=0),
            # bd show for task 1
            Mock(stdout=json.dumps(bead_responses[0])),
            # bd update for task 2
            Mock(returncode=0),
            # bd show for task 2
            Mock(stdout=json.dumps(bead_responses[1])),
            # Workers complete, so complete_task is called twice
            # bd comments add for task 1
            Mock(returncode=0),
            # bd close for task 1
            Mock(returncode=0),
            # bd comments add for task 2
            Mock(returncode=0),
            # bd close for task 2
            Mock(returncode=0),
            # Second iteration: get_ready_tasks returns empty
            Mock(stdout="[]"),
        ]

        # Mock workers
        mock_worker1 = Mock()
        mock_worker1.is_alive.return_value = False
        mock_worker1.wait.return_value = 0
        mock_worker1.get_token_usage.return_value = {"input_tokens": 100, "output_tokens": 50, "cache_read_tokens": 0, "cache_creation_tokens": 0}

        mock_worker2 = Mock()
        mock_worker2.is_alive.return_value = False
        mock_worker2.wait.return_value = 0
        mock_worker2.get_token_usage.return_value = {"input_tokens": 100, "output_tokens": 50, "cache_read_tokens": 0, "cache_creation_tokens": 0}

        mock_worker_class.side_effect = [mock_worker1, mock_worker2]

        # Create orchestrator with max_workers=2
        orch = BeadOrchestrator("Nova-gyd", max_workers=2)
        orch.start(check_interval=0.1, max_iterations=2)

        # Should only start 2 workers even though 3 tasks were ready
        assert mock_worker_class.call_count == 2

    @patch("program_nova.engine.bead_orchestrator.Worker")
    @patch("program_nova.engine.bead_orchestrator.time")
    def test_stop_flag_initialized(self, mock_time, mock_worker_class, mock_subprocess_run):
        """Test that stop_flag is initialized as threading.Event."""
        orch = BeadOrchestrator("Nova-gyd")
        assert hasattr(orch, "stop_flag")
        assert isinstance(orch.stop_flag, threading.Event)
        assert not orch.stop_flag.is_set()

    @patch("program_nova.engine.bead_orchestrator.Worker")
    @patch("program_nova.engine.bead_orchestrator.time")
    def test_stop_method_sets_flag(self, mock_time, mock_worker_class, mock_subprocess_run):
        """Test that stop() method sets the stop_flag."""
        orch = BeadOrchestrator("Nova-gyd")
        assert not orch.stop_flag.is_set()
        orch.stop()
        assert orch.stop_flag.is_set()

    @patch("program_nova.engine.bead_orchestrator.Worker")
    @patch("program_nova.engine.bead_orchestrator.time")
    def test_start_exits_on_stop_flag(self, mock_time, mock_worker_class, mock_subprocess_run):
        """Test that start() exits when stop_flag is set."""
        # Mock time
        mock_time.time.return_value = 1000.0
        mock_time.sleep = lambda x: None

        # Mock get_ready_tasks to return tasks
        ready_tasks_response = [{"id": "Nova-gyd.1"}]
        mock_subprocess_run.return_value = Mock(stdout=json.dumps(ready_tasks_response))

        orch = BeadOrchestrator("Nova-gyd")

        # Set stop flag before starting
        orch.stop_flag.set()

        # start() should exit immediately without starting workers
        orch.start(check_interval=0.1, max_iterations=10)

        # No workers should be created
        assert mock_worker_class.call_count == 0

    @patch("program_nova.engine.bead_orchestrator.Worker")
    @patch("program_nova.engine.bead_orchestrator.time")
    def test_start_can_be_stopped_during_execution(
        self, mock_time, mock_worker_class, mock_subprocess_run
    ):
        """Test that start() can be stopped during execution."""
        # Mock time
        mock_time.time.return_value = 1000.0

        # Track sleep calls to trigger stop after first iteration
        sleep_count = [0]
        def mock_sleep(duration):
            sleep_count[0] += 1
            # Stop after first sleep (first iteration complete)
            if sleep_count[0] == 1:
                orch.stop()
        mock_time.sleep = mock_sleep

        # Mock get_ready_tasks to keep returning tasks
        ready_tasks_response = [{"id": "Nova-gyd.1"}]

        # Mock bd show response
        bead_response = [{"id": "Nova-gyd.1", "title": "Task 1", "description": "First", "status": "open"}]

        mock_subprocess_run.side_effect = [
            # First iteration: get_ready_tasks
            Mock(stdout=json.dumps(ready_tasks_response)),
            # bd update
            Mock(returncode=0),
            # bd show
            Mock(stdout=json.dumps(bead_response)),
            # Second iteration: get_ready_tasks (but we stop during sleep)
            Mock(stdout=json.dumps(ready_tasks_response)),
        ]

        # Mock worker that stays alive
        mock_worker = Mock()
        mock_worker.is_alive.return_value = True
        mock_worker_class.return_value = mock_worker

        orch = BeadOrchestrator("Nova-gyd")
        orch.start(check_interval=0.1, max_iterations=10)

        # Should have created exactly 1 worker before stopping
        assert mock_worker_class.call_count == 1
        # Sleep should have been called once
        assert sleep_count[0] == 1
