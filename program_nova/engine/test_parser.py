"""Tests for CASCADE.md parser."""
import unittest
from pathlib import Path
import tempfile
from program_nova.engine.parser import CascadeParser


class TestCascadeParser(unittest.TestCase):
    """Test cases for CascadeParser."""

    def setUp(self):
        """Create a temporary CASCADE.md file for testing."""
        self.test_cascade = """# Test Project

## L1: Application

### L2: Foundation
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | Core Types | Define base types | - |
| F2 | Error Handling | Implement errors | F1 |
| F3 | Config Schema | Define config | F1 |

### L2: Provider Layer
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| P1 | Provider Interface | Define provider | F1 |
| P2 | Bedrock Client | Implement Bedrock | P1, F3 |

## L1: Infrastructure

### L2: Deployment
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| D1 | Docker Setup | Create Docker files | - |
| D2 | CI Pipeline | Setup CI | D1, F2 |
"""
        self.temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.md')
        self.temp_file.write(self.test_cascade)
        self.temp_file.close()
        self.parser = CascadeParser(self.temp_file.name)

    def tearDown(self):
        """Clean up temporary file."""
        Path(self.temp_file.name).unlink()

    def test_parse_project_name(self):
        """Test that project name is correctly extracted."""
        result = self.parser.parse()
        self.assertEqual(result['project_name'], 'Test Project')

    def test_parse_task_graph(self):
        """Test that all tasks are extracted with correct attributes."""
        result = self.parser.parse()
        tasks = result['tasks']

        # Check total number of tasks
        self.assertEqual(len(tasks), 7)

        # Check F1 task
        self.assertIn('F1', tasks)
        f1 = tasks['F1']
        self.assertEqual(f1['id'], 'F1')
        self.assertEqual(f1['name'], 'Core Types')
        self.assertEqual(f1['description'], 'Define base types')
        self.assertEqual(f1['depends_on'], [])
        self.assertEqual(f1['group'], 'Foundation')
        self.assertEqual(f1['branch'], 'Application')

        # Check F2 task with dependency
        self.assertIn('F2', tasks)
        f2 = tasks['F2']
        self.assertEqual(f2['depends_on'], ['F1'])

        # Check P2 task with multiple dependencies
        self.assertIn('P2', tasks)
        p2 = tasks['P2']
        self.assertSetEqual(set(p2['depends_on']), {'P1', 'F3'})

    def test_parse_hierarchy(self):
        """Test that hierarchy mapping is correctly built."""
        result = self.parser.parse()
        hierarchy = result['hierarchy']

        # Check L1 branches
        self.assertIn('Application', hierarchy)
        self.assertIn('Infrastructure', hierarchy)

        # Check L2 groups under Application
        app_groups = hierarchy['Application']
        self.assertIn('Foundation', app_groups)
        self.assertIn('Provider Layer', app_groups)

        # Check tasks under Foundation
        foundation_tasks = app_groups['Foundation']
        self.assertSetEqual(set(foundation_tasks), {'F1', 'F2', 'F3'})

        # Check tasks under Provider Layer
        provider_tasks = app_groups['Provider Layer']
        self.assertSetEqual(set(provider_tasks), {'P1', 'P2'})

    def test_dependency_resolution(self):
        """Test that DAG correctly identifies ready tasks."""
        result = self.parser.parse()
        dag = result['dag']

        # Initially, only tasks with no dependencies should be ready
        ready = dag.get_ready_tasks({})
        self.assertSetEqual(set(ready), {'F1', 'D1'})

        # After F1 completes, F2, F3, and P1 should be ready
        completed = {'F1': 'completed'}
        ready = dag.get_ready_tasks(completed)
        self.assertSetEqual(set(ready), {'F2', 'F3', 'P1', 'D1'})

        # After F1, F3, and P1 complete, P2 should be ready
        completed = {'F1': 'completed', 'F3': 'completed', 'P1': 'completed'}
        ready = dag.get_ready_tasks(completed)
        self.assertIn('P2', ready)

    def test_cyclic_dependency_detection(self):
        """Test that parser detects cyclic dependencies."""
        cyclic_cascade = """# Test Project

## L1: Application

### L2: Foundation
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | Task 1 | Description | F2 |
| F2 | Task 2 | Description | F1 |
"""
        temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.md')
        temp_file.write(cyclic_cascade)
        temp_file.close()

        parser = CascadeParser(temp_file.name)
        with self.assertRaises(ValueError) as context:
            parser.parse()

        self.assertIn('cyclic', str(context.exception).lower())
        Path(temp_file.name).unlink()

    def test_empty_depends_on(self):
        """Test that tasks with '-' or empty Depends On are handled correctly."""
        result = self.parser.parse()
        tasks = result['tasks']

        # F1 has '-' in Depends On, should have empty list
        self.assertEqual(tasks['F1']['depends_on'], [])

        # D1 has '-' in Depends On, should have empty list
        self.assertEqual(tasks['D1']['depends_on'], [])


if __name__ == '__main__':
    unittest.main()
