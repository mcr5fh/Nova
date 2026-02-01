"""Milestone evaluation for Program Nova.

Evaluates trigger conditions from milestones.yaml and returns
messages when milestones are reached.
"""

from pathlib import Path
from typing import Dict, List, Any, Set

import yaml


class MilestoneEvaluator:
    """Evaluates milestones based on task states."""

    def __init__(self, milestones_file: str):
        """Initialize evaluator with milestones YAML file.

        Args:
            milestones_file: Path to milestones.yaml
        """
        self.milestones_file = Path(milestones_file)
        self.milestones = self._load_milestones()
        self.triggered_milestones: Set[str] = set()

    def _load_milestones(self) -> List[Dict[str, Any]]:
        """Load milestones from YAML file.

        Returns:
            List of milestone definitions
        """
        if not self.milestones_file.exists():
            return []

        with open(self.milestones_file, 'r') as f:
            data = yaml.safe_load(f)

        return data.get("milestones", [])

    def _evaluate_trigger(
        self, trigger: Dict[str, Any], tasks: Dict[str, Dict]
    ) -> bool:
        """Evaluate a trigger condition.

        Args:
            trigger: Trigger definition
            tasks: Current task states

        Returns:
            True if trigger condition is met
        """
        trigger_type = trigger.get("type")

        if trigger_type == "all_tasks_completed":
            # Check if all specified tasks are completed
            required_tasks = trigger.get("tasks", [])
            return all(
                tasks.get(task_id, {}).get("status") == "completed"
                for task_id in required_tasks
            )

        elif trigger_type == "percentage_complete":
            # Check if percentage of completed tasks meets threshold
            if not tasks:
                return False

            threshold = trigger.get("threshold", 100)
            total_tasks = len(tasks)
            completed_tasks = sum(
                1 for task in tasks.values()
                if task.get("status") == "completed"
            )
            percentage = (completed_tasks / total_tasks) * 100
            return percentage >= threshold

        elif trigger_type == "any_task_failed":
            # Check if any task has failed
            return any(
                task.get("status") == "failed"
                for task in tasks.values()
            )

        return False

    def evaluate(self, tasks: Dict[str, Dict]) -> Dict[str, Dict[str, str]]:
        """Evaluate all milestones against current task states.

        Args:
            tasks: Dictionary of task_id -> task_data

        Returns:
            Dictionary of triggered milestone_id -> {name, message}
        """
        triggered = {}

        for milestone in self.milestones:
            milestone_id = milestone.get("id")

            # Skip if already triggered
            if milestone_id in self.triggered_milestones:
                continue

            trigger = milestone.get("trigger", {})
            if self._evaluate_trigger(trigger, tasks):
                # Mark as triggered
                self.triggered_milestones.add(milestone_id)

                triggered[milestone_id] = {
                    "name": milestone.get("name", milestone_id),
                    "message": milestone.get("message", "Milestone reached"),
                }

        return triggered


def evaluate_milestones(
    milestones_file: str, tasks: Dict[str, Dict]
) -> Dict[str, Dict[str, str]]:
    """Convenience function to evaluate milestones.

    Args:
        milestones_file: Path to milestones.yaml
        tasks: Dictionary of task_id -> task_data

    Returns:
        Dictionary of triggered milestone_id -> {name, message}
    """
    evaluator = MilestoneEvaluator(milestones_file)
    return evaluator.evaluate(tasks)
