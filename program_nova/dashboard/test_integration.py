"""Integration tests for the complete dashboard system."""

import json
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from program_nova.dashboard.server import create_app
from program_nova.engine.state import StateManager, TaskStatus


@pytest.fixture
def cascade_file():
    """Create a CASCADE.md file for testing."""
    content = """# Test Project

## L1: Application

### L2: Foundation
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | Core Types | Define base types | - |
| F2 | Error Handling | Implement errors | F1 |
| F3 | Config Schema | Define configuration | F1 |

### L2: Provider Layer
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| P1 | Provider Interface | Define provider | F1 |
| P2 | Bedrock Client | AWS Bedrock | P1, F3 |

## L1: Infrastructure

### L2: Deployment
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| D1 | Docker Setup | Create Dockerfile | - |
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        f.write(content)
        path = f.name
    yield path
    Path(path).unlink(missing_ok=True)


@pytest.fixture
def state_file():
    """Create a temporary state file."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        path = f.name
    yield path
    Path(path).unlink(missing_ok=True)


@pytest.fixture
def milestones_file():
    """Create a milestones.yaml file for testing."""
    content = """milestones:
  - id: foundation_complete
    name: Foundation Complete
    trigger:
      type: all_tasks_completed
      tasks: ["F1", "F2", "F3"]
    message: "Foundation layer is complete!"

  - id: half_complete
    name: Half Complete
    trigger:
      type: percentage_complete
      threshold: 50
    message: "50% of tasks completed."
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write(content)
        path = f.name
    yield path
    Path(path).unlink(missing_ok=True)


@pytest.fixture
def initialized_system(state_file, cascade_file):
    """Initialize the state system with some completed tasks."""
    sm = StateManager(state_file)
    sm.initialize("Test Project", cascade_file)

    # Complete F1 and F2
    sm.update_task("F1", status=TaskStatus.COMPLETED, worker_id="w1", pid=1)
    sm.complete_task("F1", "2024-01-01T10:00:00Z", 100)
    sm.update_task_tokens("F1", input_tokens=1000, output_tokens=500)

    sm.update_task("F2", status=TaskStatus.COMPLETED, worker_id="w2", pid=2)
    sm.complete_task("F2", "2024-01-01T10:05:00Z", 150)
    sm.update_task_tokens("F2", input_tokens=2000, output_tokens=1000)

    # F3 is in progress
    sm.update_task("F3", status=TaskStatus.IN_PROGRESS, worker_id="w3", pid=3, started_at="2024-01-01T10:05:00Z")

    return state_file


def test_full_integration(initialized_system, cascade_file, milestones_file):
    """Test the full dashboard integration with rollups and milestones."""
    app = create_app(
        state_file=initialized_system,
        cascade_file=cascade_file,
        milestones_file=milestones_file,
    )
    client = TestClient(app)

    # Test /api/status endpoint
    response = client.get("/api/status")
    assert response.status_code == 200

    data = response.json()

    # Verify project info
    assert data["project"]["name"] == "Test Project"

    # Verify tasks
    assert "F1" in data["tasks"]
    assert "F2" in data["tasks"]
    assert "F3" in data["tasks"]
    assert data["tasks"]["F1"]["status"] == "completed"
    assert data["tasks"]["F3"]["status"] == "in_progress"

    # Verify rollups exist
    assert "rollups" in data
    assert "l0_rollup" in data["rollups"]
    assert "l1_rollups" in data["rollups"]
    assert "l2_rollups" in data["rollups"]

    # Verify L0 rollup (project-level)
    l0 = data["rollups"]["l0_rollup"]
    assert l0["status"] == "in_progress"  # F3 is in progress
    assert l0["duration_seconds"] == 250  # F1: 100 + F2: 150
    assert l0["token_usage"]["input_tokens"] == 3000  # F1: 1000 + F2: 2000
    assert l0["token_usage"]["output_tokens"] == 1500  # F1: 500 + F2: 1000
    assert l0["cost_usd"] > 0  # Should have computed cost

    # Verify L1 rollups (branch-level)
    assert "Application" in data["rollups"]["l1_rollups"]
    assert "Infrastructure" in data["rollups"]["l1_rollups"]

    app_rollup = data["rollups"]["l1_rollups"]["Application"]
    assert app_rollup["status"] == "in_progress"  # F3 still in progress

    # Verify L2 rollups (group-level)
    assert "Application" in data["rollups"]["l2_rollups"]
    assert "Foundation" in data["rollups"]["l2_rollups"]["Application"]

    foundation_rollup = data["rollups"]["l2_rollups"]["Application"]["Foundation"]
    assert foundation_rollup["status"] == "in_progress"  # F3 in progress

    # Verify hierarchy
    assert "hierarchy" in data
    assert "Application" in data["hierarchy"]

    # Milestones should not trigger yet (F3 not complete)
    assert "milestones" in data
    assert "foundation_complete" not in data["milestones"]


def test_milestone_trigger_on_completion(initialized_system, cascade_file, milestones_file):
    """Test that milestones trigger when conditions are met."""
    # Complete F3 to trigger the foundation_complete milestone
    sm = StateManager(initialized_system)
    sm.update_task("F3", status=TaskStatus.COMPLETED, worker_id="w3", pid=3)
    sm.complete_task("F3", "2024-01-01T10:10:00Z", 200)

    app = create_app(
        state_file=initialized_system,
        cascade_file=cascade_file,
        milestones_file=milestones_file,
    )
    client = TestClient(app)

    response = client.get("/api/status")
    assert response.status_code == 200

    data = response.json()

    # Foundation milestone should now trigger
    assert "milestones" in data
    assert "foundation_complete" in data["milestones"]
    assert data["milestones"]["foundation_complete"]["name"] == "Foundation Complete"
    assert "Foundation layer is complete!" in data["milestones"]["foundation_complete"]["message"]

    # Verify Foundation rollup is now complete
    foundation_rollup = data["rollups"]["l2_rollups"]["Application"]["Foundation"]
    assert foundation_rollup["status"] == "completed"


def test_api_status_includes_all_tasks_completed_flag(state_file, cascade_file, milestones_file):
    """Test that /api/status includes a flag indicating if all tasks are completed."""
    sm = StateManager(state_file)
    sm.initialize("Test Project", cascade_file)

    # Complete all tasks
    for task_id in ["F1", "F2", "F3", "P1", "P2", "D1"]:
        sm.update_task(task_id, status=TaskStatus.COMPLETED, worker_id=f"w{task_id}", pid=1)
        sm.complete_task(task_id, "2024-01-01T10:00:00Z", 100)

    app = create_app(
        state_file=state_file,
        cascade_file=cascade_file,
        milestones_file=milestones_file,
    )
    client = TestClient(app)

    response = client.get("/api/status")
    assert response.status_code == 200

    data = response.json()

    # Should include all_tasks_completed flag
    assert "all_tasks_completed" in data
    assert data["all_tasks_completed"] is True


def test_api_status_all_tasks_completed_false_when_tasks_pending(state_file, cascade_file, milestones_file):
    """Test that all_tasks_completed is False when tasks are still pending or in progress."""
    sm = StateManager(state_file)
    sm.initialize("Test Project", cascade_file)

    # Only complete some tasks
    sm.update_task("F1", status=TaskStatus.COMPLETED, worker_id="w1", pid=1)
    sm.complete_task("F1", "2024-01-01T10:00:00Z", 100)

    # F2 is in progress
    sm.update_task("F2", status=TaskStatus.IN_PROGRESS, worker_id="w2", pid=2, started_at="2024-01-01T10:00:00Z")

    app = create_app(
        state_file=state_file,
        cascade_file=cascade_file,
        milestones_file=milestones_file,
    )
    client = TestClient(app)

    response = client.get("/api/status")
    assert response.status_code == 200

    data = response.json()

    # Should include all_tasks_completed flag as False
    assert "all_tasks_completed" in data
    assert data["all_tasks_completed"] is False
