"""Integration tests for end-to-end token/duration/cost tracking.

Tests the complete pipeline from task data through rollup computation
and cost calculation to verify that metrics are correctly tracked and
aggregated throughout the dashboard hierarchy.
"""

import pytest
from program_nova.dashboard.rollup import (
    compute_hierarchy_rollups,
    compute_rollup_metrics,
    PRICE_INPUT_TOKENS,
    PRICE_OUTPUT_TOKENS,
    PRICE_CACHE_READ_TOKENS,
    PRICE_CACHE_CREATION_TOKENS,
)


class TestEndToEndTracking:
    """Test complete token/duration/cost tracking through the hierarchy."""

    def test_complete_hierarchy_tracking(self):
        """Verify metrics aggregate correctly through L2 -> L1 -> L0."""
        # Simulate a realistic project with multiple branches and groups
        tasks = {
            # Branch A - Group 1
            "task_a1": {
                "status": "completed",
                "duration_seconds": 120,
                "token_usage": {
                    "input_tokens": 50000,
                    "output_tokens": 10000,
                    "cache_read_tokens": 5000,
                    "cache_creation_tokens": 1000,
                },
            },
            "task_a2": {
                "status": "completed",
                "duration_seconds": 180,
                "token_usage": {
                    "input_tokens": 75000,
                    "output_tokens": 15000,
                    "cache_read_tokens": 8000,
                    "cache_creation_tokens": 2000,
                },
            },
            # Branch A - Group 2
            "task_a3": {
                "status": "in_progress",
                "duration_seconds": 90,
                "token_usage": {
                    "input_tokens": 30000,
                    "output_tokens": 5000,
                    "cache_read_tokens": 2000,
                    "cache_creation_tokens": 500,
                },
            },
            # Branch B - Group 1
            "task_b1": {
                "status": "completed",
                "duration_seconds": 240,
                "token_usage": {
                    "input_tokens": 100000,
                    "output_tokens": 20000,
                    "cache_read_tokens": 10000,
                    "cache_creation_tokens": 3000,
                },
            },
        }

        hierarchy = {
            "BranchA": {
                "Group1": ["task_a1", "task_a2"],
                "Group2": ["task_a3"],
            },
            "BranchB": {
                "Group1": ["task_b1"],
            },
        }

        rollups = compute_hierarchy_rollups(tasks, hierarchy)

        # Verify L2 rollups (groups)
        group_a1 = rollups["l2_rollups"]["BranchA"]["Group1"]
        assert group_a1["status"] == "completed"
        assert group_a1["duration_seconds"] == 300  # 120 + 180
        assert group_a1["token_usage"]["input_tokens"] == 125000  # 50k + 75k
        assert group_a1["token_usage"]["output_tokens"] == 25000  # 10k + 15k

        group_a2 = rollups["l2_rollups"]["BranchA"]["Group2"]
        assert group_a2["status"] == "in_progress"
        assert group_a2["duration_seconds"] == 90

        # Verify L1 rollups (branches)
        branch_a = rollups["l1_rollups"]["BranchA"]
        assert branch_a["status"] == "in_progress"  # Group2 is in_progress
        assert branch_a["duration_seconds"] == 390  # 300 + 90
        assert branch_a["token_usage"]["input_tokens"] == 155000  # 125k + 30k

        branch_b = rollups["l1_rollups"]["BranchB"]
        assert branch_b["status"] == "completed"
        assert branch_b["duration_seconds"] == 240

        # Verify L0 rollup (project)
        project = rollups["l0_rollup"]
        assert project["status"] == "in_progress"  # BranchA is in_progress
        assert project["duration_seconds"] == 630  # 390 + 240
        assert project["token_usage"]["input_tokens"] == 255000  # 155k + 100k
        assert project["token_usage"]["output_tokens"] == 50000  # 25k + 5k + 20k

    def test_cost_calculation_accuracy(self):
        """Verify cost calculations use correct pricing model."""
        # Test with exactly 1 million of each token type for easy verification
        tasks = {
            "task1": {
                "status": "completed",
                "duration_seconds": 100,
                "token_usage": {
                    "input_tokens": 1_000_000,
                    "output_tokens": 1_000_000,
                    "cache_read_tokens": 1_000_000,
                    "cache_creation_tokens": 1_000_000,
                },
            },
        }

        metrics = compute_rollup_metrics(tasks, ["task1"])

        # Expected cost:
        # Input: 1M * $3.00 = $3.00
        # Output: 1M * $15.00 = $15.00
        # Cache Read: 1M * $0.30 = $0.30
        # Cache Creation: 1M * $3.75 = $3.75
        # Total: $22.05
        expected_cost = (
            PRICE_INPUT_TOKENS
            + PRICE_OUTPUT_TOKENS
            + PRICE_CACHE_READ_TOKENS
            + PRICE_CACHE_CREATION_TOKENS
        )
        assert metrics["cost_usd"] == pytest.approx(expected_cost, abs=0.01)
        assert metrics["cost_usd"] == pytest.approx(22.05, abs=0.01)

    def test_cost_precision_small_values(self):
        """Verify cost precision for small token counts."""
        # Test with small token counts to verify rounding
        tasks = {
            "task1": {
                "status": "completed",
                "duration_seconds": 10,
                "token_usage": {
                    "input_tokens": 1234,
                    "output_tokens": 567,
                    "cache_read_tokens": 890,
                    "cache_creation_tokens": 123,
                },
            },
        }

        metrics = compute_rollup_metrics(tasks, ["task1"])

        # Expected cost:
        # Input: 1234/1M * $3.00 = $0.003702
        # Output: 567/1M * $15.00 = $0.008505
        # Cache Read: 890/1M * $0.30 = $0.000267
        # Cache Creation: 123/1M * $3.75 = $0.00046125
        # Total: $0.01293525 -> rounds to $0.0129
        expected = (
            1234 / 1_000_000 * PRICE_INPUT_TOKENS
            + 567 / 1_000_000 * PRICE_OUTPUT_TOKENS
            + 890 / 1_000_000 * PRICE_CACHE_READ_TOKENS
            + 123 / 1_000_000 * PRICE_CACHE_CREATION_TOKENS
        )
        assert metrics["cost_usd"] == pytest.approx(expected, abs=0.0001)

    def test_zero_token_usage(self):
        """Verify cost is zero when no tokens are used."""
        tasks = {
            "task1": {
                "status": "pending",
                "duration_seconds": 0,
                "token_usage": {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "cache_read_tokens": 0,
                    "cache_creation_tokens": 0,
                },
            },
        }

        metrics = compute_rollup_metrics(tasks, ["task1"])
        assert metrics["cost_usd"] == 0.0
        assert metrics["duration_seconds"] == 0

    def test_partial_token_types(self):
        """Verify cost calculation when only some token types are present."""
        # Simulate scenario where only input/output tokens are used (no cache)
        tasks = {
            "task1": {
                "status": "completed",
                "duration_seconds": 45,
                "token_usage": {
                    "input_tokens": 50000,
                    "output_tokens": 10000,
                    "cache_read_tokens": 0,
                    "cache_creation_tokens": 0,
                },
            },
        }

        metrics = compute_rollup_metrics(tasks, ["task1"])

        # Expected: (50k/1M * 3) + (10k/1M * 15) = 0.15 + 0.15 = 0.30
        expected = 50000 / 1_000_000 * PRICE_INPUT_TOKENS + 10000 / 1_000_000 * PRICE_OUTPUT_TOKENS
        assert metrics["cost_usd"] == pytest.approx(expected, abs=0.01)
        assert metrics["cost_usd"] == pytest.approx(0.30, abs=0.01)

    def test_duration_aggregation_various_states(self):
        """Verify duration aggregates correctly across task states."""
        tasks = {
            "completed": {
                "status": "completed",
                "duration_seconds": 100,
                "token_usage": {},
            },
            "in_progress": {
                "status": "in_progress",
                "duration_seconds": 50,  # Partial duration
                "token_usage": {},
            },
            "pending": {
                "status": "pending",
                "duration_seconds": 0,
                "token_usage": {},
            },
            "failed": {
                "status": "failed",
                "duration_seconds": 75,  # Duration before failure
                "token_usage": {},
            },
        }

        metrics = compute_rollup_metrics(tasks, list(tasks.keys()))
        assert metrics["duration_seconds"] == 225  # 100 + 50 + 0 + 75

    def test_empty_hierarchy(self):
        """Verify handling of empty hierarchy."""
        tasks = {}
        hierarchy = {}

        rollups = compute_hierarchy_rollups(tasks, hierarchy)

        # Should have empty rollups but not crash
        assert rollups["l2_rollups"] == {}
        assert rollups["l1_rollups"] == {}
        assert rollups["l0_rollup"]["status"] == "pending"
        assert rollups["l0_rollup"]["duration_seconds"] == 0
        assert rollups["l0_rollup"]["cost_usd"] == 0.0

    def test_realistic_claude_usage(self):
        """Test with realistic Claude Sonnet 4.5 token usage."""
        # Simulate a typical agent conversation with cache usage
        tasks = {
            "agent_task": {
                "status": "completed",
                "duration_seconds": 300,  # 5 minutes
                "token_usage": {
                    "input_tokens": 25000,  # ~25k input
                    "output_tokens": 3500,   # ~3.5k output
                    "cache_read_tokens": 150000,  # ~150k cache reads
                    "cache_creation_tokens": 25000,  # ~25k cache creation
                },
            },
        }

        metrics = compute_rollup_metrics(tasks, ["agent_task"])

        # Expected cost:
        # Input: 25k/1M * 3 = $0.075
        # Output: 3.5k/1M * 15 = $0.0525
        # Cache Read: 150k/1M * 0.30 = $0.045
        # Cache Creation: 25k/1M * 3.75 = $0.09375
        # Total: $0.26625
        expected = (
            25000 / 1_000_000 * PRICE_INPUT_TOKENS
            + 3500 / 1_000_000 * PRICE_OUTPUT_TOKENS
            + 150000 / 1_000_000 * PRICE_CACHE_READ_TOKENS
            + 25000 / 1_000_000 * PRICE_CACHE_CREATION_TOKENS
        )
        assert metrics["cost_usd"] == pytest.approx(expected, abs=0.0001)
        assert 0.26 < metrics["cost_usd"] < 0.27  # Sanity check
