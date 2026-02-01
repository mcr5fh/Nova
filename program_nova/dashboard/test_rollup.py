"""Tests for rollup.py aggregation logic."""

import pytest
from program_nova.dashboard.rollup import compute_rollup_status, compute_rollup_metrics


class TestRollupStatus:
    """Test status aggregation across task hierarchies."""

    def test_all_completed(self):
        """All tasks completed -> completed."""
        tasks = {
            "F1": {"status": "completed"},
            "F2": {"status": "completed"},
        }
        task_ids = ["F1", "F2"]
        assert compute_rollup_status(tasks, task_ids) == "completed"

    def test_all_pending(self):
        """All tasks pending -> pending."""
        tasks = {
            "F1": {"status": "pending"},
            "F2": {"status": "pending"},
        }
        task_ids = ["F1", "F2"]
        assert compute_rollup_status(tasks, task_ids) == "pending"

    def test_any_failed(self):
        """Any task failed -> failed."""
        tasks = {
            "F1": {"status": "completed"},
            "F2": {"status": "failed"},
            "F3": {"status": "in_progress"},
        }
        task_ids = ["F1", "F2", "F3"]
        assert compute_rollup_status(tasks, task_ids) == "failed"

    def test_any_in_progress(self):
        """Any task in_progress (no failures) -> in_progress."""
        tasks = {
            "F1": {"status": "completed"},
            "F2": {"status": "in_progress"},
            "F3": {"status": "pending"},
        }
        task_ids = ["F1", "F2", "F3"]
        assert compute_rollup_status(tasks, task_ids) == "in_progress"

    def test_mixed_no_failures(self):
        """Mix of completed/pending (no in_progress/failed) -> pending."""
        tasks = {
            "F1": {"status": "completed"},
            "F2": {"status": "pending"},
        }
        task_ids = ["F1", "F2"]
        assert compute_rollup_status(tasks, task_ids) == "pending"

    def test_empty_task_list(self):
        """Empty task list -> pending."""
        tasks = {}
        task_ids = []
        assert compute_rollup_status(tasks, task_ids) == "pending"

    def test_missing_task_ids(self):
        """Task IDs not in tasks dict -> treats as pending."""
        tasks = {
            "F1": {"status": "completed"},
        }
        task_ids = ["F1", "F2"]  # F2 doesn't exist
        # Should treat missing F2 as pending
        assert compute_rollup_status(tasks, task_ids) == "pending"


class TestRollupMetrics:
    """Test metrics aggregation (duration, tokens, cost)."""

    def test_sum_duration(self):
        """Sum duration across multiple tasks."""
        tasks = {
            "F1": {"duration_seconds": 100, "token_usage": {"input_tokens": 0, "output_tokens": 0}},
            "F2": {"duration_seconds": 200, "token_usage": {"input_tokens": 0, "output_tokens": 0}},
        }
        task_ids = ["F1", "F2"]
        metrics = compute_rollup_metrics(tasks, task_ids)
        assert metrics["duration_seconds"] == 300

    def test_sum_token_usage(self):
        """Sum token usage across multiple tasks."""
        tasks = {
            "F1": {
                "duration_seconds": 0,
                "token_usage": {
                    "input_tokens": 1000,
                    "output_tokens": 500,
                    "cache_read_tokens": 200,
                    "cache_creation_tokens": 100,
                },
            },
            "F2": {
                "duration_seconds": 0,
                "token_usage": {
                    "input_tokens": 2000,
                    "output_tokens": 1000,
                    "cache_read_tokens": 400,
                    "cache_creation_tokens": 200,
                },
            },
        }
        task_ids = ["F1", "F2"]
        metrics = compute_rollup_metrics(tasks, task_ids)
        assert metrics["token_usage"]["input_tokens"] == 3000
        assert metrics["token_usage"]["output_tokens"] == 1500
        assert metrics["token_usage"]["cache_read_tokens"] == 600
        assert metrics["token_usage"]["cache_creation_tokens"] == 300

    def test_compute_cost(self):
        """Compute cost from token usage."""
        tasks = {
            "F1": {
                "duration_seconds": 0,
                "token_usage": {
                    "input_tokens": 1000000,  # $3 per MTok
                    "output_tokens": 1000000,  # $15 per MTok
                    "cache_read_tokens": 1000000,  # $0.30 per MTok
                    "cache_creation_tokens": 1000000,  # $3.75 per MTok
                },
            },
        }
        task_ids = ["F1"]
        metrics = compute_rollup_metrics(tasks, task_ids)
        # Expected: 1M*3 + 1M*15 + 1M*0.30 + 1M*3.75 = $22.05
        assert metrics["cost_usd"] == pytest.approx(22.05, rel=0.01)

    def test_empty_tasks(self):
        """Empty task list returns zero metrics."""
        tasks = {}
        task_ids = []
        metrics = compute_rollup_metrics(tasks, task_ids)
        assert metrics["duration_seconds"] == 0
        assert metrics["token_usage"]["input_tokens"] == 0
        assert metrics["cost_usd"] == 0.0

    def test_missing_fields(self):
        """Handle tasks with missing fields gracefully."""
        tasks = {
            "F1": {},  # Missing all fields
            "F2": {"duration_seconds": 100},  # Missing token_usage
        }
        task_ids = ["F1", "F2"]
        metrics = compute_rollup_metrics(tasks, task_ids)
        assert metrics["duration_seconds"] == 100
        assert metrics["token_usage"]["input_tokens"] == 0
        assert metrics["cost_usd"] == 0.0
