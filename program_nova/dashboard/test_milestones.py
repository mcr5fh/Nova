"""Tests for milestone evaluation."""

import tempfile
from pathlib import Path

import pytest
import yaml

from program_nova.dashboard.milestones import (
    MilestoneEvaluator,
    evaluate_milestones,
)


@pytest.fixture
def sample_milestones_yaml():
    """Create a sample milestones.yaml file."""
    milestones = {
        "milestones": [
            {
                "id": "foundation_complete",
                "name": "Foundation Complete",
                "trigger": {
                    "type": "all_tasks_completed",
                    "tasks": ["F1", "F2", "F3"],
                },
                "message": "Foundation layer is complete! Moving to provider layer.",
            },
            {
                "id": "half_complete",
                "name": "50% Complete",
                "trigger": {
                    "type": "percentage_complete",
                    "threshold": 50,
                },
                "message": "Halfway there! 50% of tasks completed.",
            },
            {
                "id": "first_failure",
                "name": "First Failure",
                "trigger": {
                    "type": "any_task_failed",
                },
                "message": "A task has failed. Please review.",
            },
        ]
    }

    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        yaml.dump(milestones, f)
        temp_path = f.name

    yield temp_path
    Path(temp_path).unlink(missing_ok=True)


class TestMilestoneEvaluator:
    """Test milestone evaluation logic."""

    def test_load_milestones(self, sample_milestones_yaml):
        """Load milestones from YAML file."""
        evaluator = MilestoneEvaluator(sample_milestones_yaml)
        assert len(evaluator.milestones) == 3
        assert evaluator.milestones[0]["id"] == "foundation_complete"

    def test_all_tasks_completed_trigger_true(self, sample_milestones_yaml):
        """Trigger fires when all specified tasks are completed."""
        evaluator = MilestoneEvaluator(sample_milestones_yaml)

        tasks = {
            "F1": {"status": "completed"},
            "F2": {"status": "completed"},
            "F3": {"status": "completed"},
        }

        triggered = evaluator.evaluate(tasks)
        assert "foundation_complete" in triggered
        assert triggered["foundation_complete"]["message"] == "Foundation layer is complete! Moving to provider layer."

    def test_all_tasks_completed_trigger_false(self, sample_milestones_yaml):
        """Trigger doesn't fire when not all tasks are completed."""
        evaluator = MilestoneEvaluator(sample_milestones_yaml)

        tasks = {
            "F1": {"status": "completed"},
            "F2": {"status": "in_progress"},
            "F3": {"status": "pending"},
        }

        triggered = evaluator.evaluate(tasks)
        assert "foundation_complete" not in triggered

    def test_percentage_complete_trigger_true(self, sample_milestones_yaml):
        """Trigger fires when percentage threshold is met."""
        evaluator = MilestoneEvaluator(sample_milestones_yaml)

        tasks = {
            "F1": {"status": "completed"},
            "F2": {"status": "completed"},
            "F3": {"status": "pending"},
            "F4": {"status": "pending"},
        }

        triggered = evaluator.evaluate(tasks)
        assert "half_complete" in triggered

    def test_percentage_complete_trigger_false(self, sample_milestones_yaml):
        """Trigger doesn't fire when percentage threshold is not met."""
        evaluator = MilestoneEvaluator(sample_milestones_yaml)

        tasks = {
            "F1": {"status": "completed"},
            "F2": {"status": "pending"},
            "F3": {"status": "pending"},
            "F4": {"status": "pending"},
        }

        triggered = evaluator.evaluate(tasks)
        assert "half_complete" not in triggered

    def test_any_task_failed_trigger_true(self, sample_milestones_yaml):
        """Trigger fires when any task has failed."""
        evaluator = MilestoneEvaluator(sample_milestones_yaml)

        tasks = {
            "F1": {"status": "completed"},
            "F2": {"status": "failed"},
            "F3": {"status": "pending"},
        }

        triggered = evaluator.evaluate(tasks)
        assert "first_failure" in triggered

    def test_any_task_failed_trigger_false(self, sample_milestones_yaml):
        """Trigger doesn't fire when no tasks have failed."""
        evaluator = MilestoneEvaluator(sample_milestones_yaml)

        tasks = {
            "F1": {"status": "completed"},
            "F2": {"status": "in_progress"},
            "F3": {"status": "pending"},
        }

        triggered = evaluator.evaluate(tasks)
        assert "first_failure" not in triggered

    def test_milestone_fires_once(self, sample_milestones_yaml):
        """Milestone only fires once, not on subsequent evaluations."""
        evaluator = MilestoneEvaluator(sample_milestones_yaml)

        tasks = {
            "F1": {"status": "completed"},
            "F2": {"status": "completed"},
            "F3": {"status": "completed"},
        }

        # First evaluation - should trigger
        triggered = evaluator.evaluate(tasks)
        assert "foundation_complete" in triggered

        # Second evaluation - should NOT trigger again
        triggered = evaluator.evaluate(tasks)
        assert "foundation_complete" not in triggered

    def test_empty_tasks(self, sample_milestones_yaml):
        """Handle empty tasks gracefully."""
        evaluator = MilestoneEvaluator(sample_milestones_yaml)

        tasks = {}

        triggered = evaluator.evaluate(tasks)
        # half_complete should not trigger (0% complete)
        assert "half_complete" not in triggered


def test_evaluate_milestones_function(sample_milestones_yaml):
    """Test the convenience function."""
    tasks = {
        "F1": {"status": "completed"},
        "F2": {"status": "failed"},
    }

    triggered = evaluate_milestones(sample_milestones_yaml, tasks)
    assert "first_failure" in triggered
