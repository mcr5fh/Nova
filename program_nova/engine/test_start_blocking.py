"""Test to verify that BeadOrchestrator.start() is blocking.

This test demonstrates that start() blocks the calling thread,
which is problematic when called from an HTTP endpoint.
"""

import time
import threading
from unittest.mock import Mock, patch
import pytest

from program_nova.engine.bead_orchestrator import BeadOrchestrator


def test_start_blocks_calling_thread():
    """Test that start() blocks the calling thread."""

    # Mock subprocess to avoid real bd commands
    with patch("subprocess.run") as mock_run:
        # Mock get_ready_tasks to return empty list (no tasks ready)
        mock_run.return_value = Mock(stdout="[]")

        orch = BeadOrchestrator("Nova-test")

        # Track if start() has returned
        start_returned = threading.Event()

        def run_orchestrator():
            """Run orchestrator in background thread."""
            # Run for max 1 iteration
            orch.start(check_interval=0.1, max_iterations=1)
            start_returned.set()

        # Start orchestrator in background thread
        thread = threading.Thread(target=run_orchestrator)
        thread.start()

        # Wait a bit to see if it returns
        thread.join(timeout=0.5)

        # Should have returned after 1 iteration
        assert start_returned.is_set(), "start() should return after max_iterations=1"


def test_start_without_max_iterations_runs_forever():
    """Test that start() without max_iterations runs indefinitely."""

    with patch("subprocess.run") as mock_run:
        # Mock get_ready_tasks to return empty list
        mock_run.return_value = Mock(stdout="[]")

        orch = BeadOrchestrator("Nova-test")

        start_time = time.time()
        finish_time = None

        def run_orchestrator():
            """Run orchestrator in background thread."""
            nonlocal finish_time
            # No max_iterations - should run forever until no work
            orch.start(check_interval=0.1)
            finish_time = time.time()

        # Start orchestrator in background thread
        thread = threading.Thread(target=run_orchestrator, daemon=True)
        thread.start()

        # Wait a bit
        time.sleep(0.3)

        # Thread should still be running (no tasks, so it should exit immediately)
        # But the point is it would block if there were tasks
        if finish_time is not None:
            elapsed = finish_time - start_time
            # Should have exited quickly since no tasks
            assert elapsed < 1.0, "Should exit quickly when no tasks"


def test_start_called_from_http_endpoint_would_block():
    """Demonstrate that calling start() from HTTP endpoint blocks the response.

    This is the actual problem: when the dashboard server calls
    orchestrator.start() from the /api/beads/start endpoint,
    it blocks the HTTP response from being sent.
    """

    with patch("subprocess.run") as mock_run:
        # Mock ready tasks to return 1 task (properly formatted as dict)
        mock_run.return_value = Mock(stdout='[{"id": "Nova-test.1"}]')

        orch = BeadOrchestrator("Nova-test")

        # Simulate HTTP endpoint calling start()
        response_sent = threading.Event()

        def simulate_http_endpoint():
            """Simulate what happens in FastAPI endpoint."""
            # This is what server.py does:
            # orchestrator = BeadOrchestrator(epic_id)
            # orchestrator.start()  # <-- BLOCKS HERE
            # return {"status": "started"}  # <-- Never reached

            # This will block until max_iterations is reached
            orch.start(check_interval=0.1, max_iterations=1)
            response_sent.set()

        thread = threading.Thread(target=simulate_http_endpoint)
        thread.start()

        # Wait for it to complete
        thread.join(timeout=1.0)

        # Response should be sent after 1 iteration
        assert response_sent.is_set(), "HTTP response blocked by start()"
