"""CASCADE.md parser for Program Nova.

Parses a hierarchical task breakdown file (CASCADE.md) into:
- Task graph with dependencies
- Hierarchy mapping (L0/L1/L2/L3)
- DAG for dependency resolution
"""

import re
from pathlib import Path
from typing import Dict, List, Set, Optional
from collections import defaultdict, deque


class DAG:
    """Directed Acyclic Graph for dependency resolution."""

    def __init__(self, tasks: Dict[str, Dict]):
        """Initialize DAG from task dictionary.

        Args:
            tasks: Dictionary of task_id -> task_info

        Raises:
            ValueError: If a cycle is detected in dependencies
        """
        self.tasks = tasks
        self._validate_no_cycles()

    def _validate_no_cycles(self):
        """Check for cycles in the dependency graph using DFS.

        Raises:
            ValueError: If a cycle is detected
        """
        visited = set()
        rec_stack = set()

        def has_cycle(task_id: str) -> bool:
            """DFS to detect cycles."""
            if task_id in rec_stack:
                return True
            if task_id in visited:
                return False

            visited.add(task_id)
            rec_stack.add(task_id)

            for dep in self.tasks.get(task_id, {}).get('depends_on', []):
                if dep not in self.tasks:
                    continue
                if has_cycle(dep):
                    return True

            rec_stack.remove(task_id)
            return False

        for task_id in self.tasks:
            if task_id not in visited:
                if has_cycle(task_id):
                    raise ValueError(f"Cyclic dependency detected involving task {task_id}")

    def get_ready_tasks(self, completed_tasks: Dict[str, str]) -> List[str]:
        """Get list of tasks that are ready to execute.

        A task is ready if:
        - It hasn't been completed yet
        - All its dependencies have been completed

        Args:
            completed_tasks: Dict mapping task_id -> status for completed tasks

        Returns:
            List of task IDs that are ready to execute
        """
        ready = []

        for task_id, task_info in self.tasks.items():
            # Skip if already completed
            if task_id in completed_tasks:
                continue

            # Check if all dependencies are satisfied
            dependencies = task_info.get('depends_on', [])
            all_deps_complete = all(
                dep in completed_tasks and completed_tasks[dep] == 'completed'
                for dep in dependencies
            )

            if all_deps_complete:
                ready.append(task_id)

        return ready

    def get_task_depth(self, task_id: str, memo: Optional[Dict[str, int]] = None) -> int:
        """Calculate the depth of a task in the dependency tree.

        Tasks with no dependencies have depth 0.
        Other tasks have depth = 1 + max(depth of dependencies).

        Args:
            task_id: ID of the task
            memo: Memoization dictionary for computed depths

        Returns:
            Depth of the task
        """
        if memo is None:
            memo = {}

        if task_id in memo:
            return memo[task_id]

        task_info = self.tasks.get(task_id, {})
        dependencies = task_info.get('depends_on', [])

        if not dependencies:
            depth = 0
        else:
            depth = 1 + max(
                self.get_task_depth(dep, memo)
                for dep in dependencies
                if dep in self.tasks
            )

        memo[task_id] = depth
        return depth


class CascadeParser:
    """Parser for CASCADE.md files."""

    # Regex patterns for parsing
    L0_PATTERN = re.compile(r'^#\s+(.+)$')  # Project name
    L1_PATTERN = re.compile(r'^##\s+L1:\s+(.+)$')  # L1 branches
    L2_PATTERN = re.compile(r'^###\s+L2:\s+(.+)$')  # L2 groups
    TABLE_HEADER = re.compile(r'^\|\s*Task ID\s*\|')
    TABLE_ROW = re.compile(r'^\|\s*(\S+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|')

    def __init__(self, cascade_file: str):
        """Initialize parser with CASCADE.md file path.

        Args:
            cascade_file: Path to CASCADE.md file
        """
        self.cascade_file = Path(cascade_file)
        if not self.cascade_file.exists():
            raise FileNotFoundError(f"CASCADE file not found: {cascade_file}")

    def parse(self) -> Dict:
        """Parse CASCADE.md file into task graph and hierarchy.

        Returns:
            Dictionary containing:
            - project_name: str
            - tasks: Dict[task_id, task_info]
            - hierarchy: Dict[L1, Dict[L2, List[task_id]]]
            - dag: DAG instance for dependency resolution
        """
        with open(self.cascade_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        project_name = None
        current_l1 = None
        current_l2 = None
        tasks = {}
        hierarchy = defaultdict(lambda: defaultdict(list))
        in_table = False

        for line in lines:
            line = line.rstrip()

            # Parse project name (L0)
            l0_match = self.L0_PATTERN.match(line)
            if l0_match and project_name is None:
                project_name = l0_match.group(1).strip()
                continue

            # Parse L1 branch
            l1_match = self.L1_PATTERN.match(line)
            if l1_match:
                current_l1 = l1_match.group(1).strip()
                current_l2 = None
                in_table = False
                continue

            # Parse L2 group
            l2_match = self.L2_PATTERN.match(line)
            if l2_match:
                current_l2 = l2_match.group(1).strip()
                in_table = False
                continue

            # Detect table header
            if self.TABLE_HEADER.match(line):
                in_table = True
                continue

            # Skip table separator line
            if in_table and line.startswith('|---'):
                continue

            # Parse table row
            if in_table and current_l1 and current_l2:
                row_match = self.TABLE_ROW.match(line)
                if row_match:
                    task_id = row_match.group(1).strip()
                    task_name = row_match.group(2).strip()
                    description = row_match.group(3).strip()
                    depends_on_raw = row_match.group(4).strip()

                    # Parse dependencies
                    depends_on = self._parse_dependencies(depends_on_raw)

                    # Store task
                    tasks[task_id] = {
                        'id': task_id,
                        'name': task_name,
                        'description': description,
                        'depends_on': depends_on,
                        'group': current_l2,
                        'branch': current_l1,
                    }

                    # Update hierarchy
                    hierarchy[current_l1][current_l2].append(task_id)

        # Convert defaultdict to regular dict for cleaner output
        hierarchy = {
            l1: dict(l2_dict)
            for l1, l2_dict in hierarchy.items()
        }

        # Build DAG
        dag = DAG(tasks)

        return {
            'project_name': project_name or 'Unnamed Project',
            'tasks': tasks,
            'hierarchy': hierarchy,
            'dag': dag,
        }

    def _parse_dependencies(self, depends_on_raw: str) -> List[str]:
        """Parse the 'Depends On' field into a list of task IDs.

        Args:
            depends_on_raw: Raw string from Depends On column

        Returns:
            List of task IDs (empty if '-' or empty)
        """
        # Handle empty or '-' case
        if not depends_on_raw or depends_on_raw.strip() == '-':
            return []

        # Split by comma and strip whitespace
        dependencies = [
            dep.strip()
            for dep in depends_on_raw.split(',')
            if dep.strip() and dep.strip() != '-'
        ]

        return dependencies


def parse_cascade(cascade_file: str) -> Dict:
    """Convenience function to parse a CASCADE.md file.

    Args:
        cascade_file: Path to CASCADE.md file

    Returns:
        Parsed cascade data (project_name, tasks, hierarchy, dag)
    """
    parser = CascadeParser(cascade_file)
    return parser.parse()
