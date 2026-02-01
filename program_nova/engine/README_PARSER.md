# CASCADE.md Parser

Parser for hierarchical task breakdown files (CASCADE.md) used in Program Nova.

## Overview

The parser extracts:
- **Task Graph**: All tasks with their dependencies
- **Hierarchy**: L0 (project) → L1 (branches) → L2 (groups) → L3 (leaf tasks)
- **DAG**: Directed Acyclic Graph for dependency resolution

## Usage

```python
from parser import CascadeParser

# Parse a CASCADE.md file
parser = CascadeParser('path/to/CASCADE.md')
result = parser.parse()

# Access parsed data
project_name = result['project_name']
tasks = result['tasks']
hierarchy = result['hierarchy']
dag = result['dag']

# Get ready tasks (those with all dependencies satisfied)
completed = {'F1': 'completed', 'F2': 'completed'}
ready_tasks = dag.get_ready_tasks(completed)
```

## CASCADE.md Format

The parser expects CASCADE.md files in the following format:

```markdown
# Project Name

## L1: Branch Name

### L2: Group Name
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | Task Name | Description | - |
| F2 | Task Name | Description | F1 |
| F3 | Task Name | Description | F1, F2 |
```

### Rules:
- **L0**: Single `#` heading is the project name
- **L1**: `## L1: <branch>` defines major system branches
- **L2**: `### L2: <group>` defines component groups
- **L3**: Table rows define leaf tasks (the actual work items)
- **Dependencies**: Comma-separated task IDs, or `-` for no dependencies

## Data Structures

### Task Structure
```python
{
    'id': 'F1',
    'name': 'Core Types',
    'description': 'Define base types and interfaces',
    'depends_on': ['F0'],  # List of task IDs (empty if no dependencies)
    'group': 'Foundation',  # L2 group name
    'branch': 'Application'  # L1 branch name
}
```

### Hierarchy Structure
```python
{
    'Application': {
        'Foundation': ['F1', 'F2', 'F3'],
        'Provider Layer': ['P1', 'P2']
    },
    'Infrastructure': {
        'Deployment': ['D1', 'D2']
    }
}
```

## DAG Operations

### Get Ready Tasks
Returns tasks that can be executed (all dependencies satisfied):

```python
completed = {'F1': 'completed', 'F3': 'completed'}
ready = dag.get_ready_tasks(completed)
# Returns: ['F2', 'F4'] (assuming F2 depends on F1, F4 depends on F1 and F3)
```

### Get Task Depth
Calculate the depth of a task in the dependency tree:

```python
depth = dag.get_task_depth('F4')
# Returns: 2 (if F4 depends on F3, which depends on F1)
```

### Cycle Detection
The parser automatically detects circular dependencies and raises `ValueError`:

```python
# CASCADE.md with cycle:
# F1 depends on F2
# F2 depends on F1

parser = CascadeParser('cycle.md')
parser.parse()  # Raises: ValueError("Cyclic dependency detected involving task F1")
```

## Testing

Run the test suite:

```bash
cd program_nova/engine
python3 -m pytest test_parser.py -v
```

## Implementation Notes

- **Regex-based parsing**: Uses regex patterns to match headings and table rows
- **Robust dependency parsing**: Handles various formats (spaces, commas, dashes)
- **Memoized depth calculation**: Efficient depth computation with caching
- **DFS cycle detection**: Validates DAG property during initialization
