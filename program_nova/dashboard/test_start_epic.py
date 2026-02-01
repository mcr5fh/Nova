"""Test for /api/beads/start endpoint actually starting workers.

This test verifies that the endpoint doesn't just return 200 OK,
but actually instantiates and starts a BeadOrchestrator.
"""

from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from program_nova.dashboard.server import create_app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    app = create_app()
    return TestClient(app)


def test_start_epic_instantiates_orchestrator(client):
    """POST /api/beads/start should instantiate and start BeadOrchestrator."""
    epic_id = "Nova-test-epic"

    # Mock BeadOrchestrator class
    with patch("program_nova.dashboard.server.BeadOrchestrator") as mock_orchestrator_class:
        mock_orchestrator_instance = MagicMock()
        mock_orchestrator_class.return_value = mock_orchestrator_instance

        # Make the request
        response = client.post(
            "/api/beads/start",
            json={"epic_id": epic_id}
        )

        # Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "started"
        assert data["epic_id"] == epic_id

        # Verify BeadOrchestrator was instantiated with epic_id
        mock_orchestrator_class.assert_called_once_with(epic_id)

        # Verify start() method was called on the orchestrator
        mock_orchestrator_instance.start.assert_called_once()


def test_start_epic_handles_orchestrator_errors(client):
    """POST /api/beads/start should handle orchestrator errors gracefully."""
    epic_id = "Nova-test-epic"

    # Mock BeadOrchestrator to raise an exception
    with patch("program_nova.dashboard.server.BeadOrchestrator") as mock_orchestrator_class:
        mock_orchestrator_class.side_effect = Exception("Failed to start orchestrator")

        # Make the request
        response = client.post(
            "/api/beads/start",
            json={"epic_id": epic_id}
        )

        # Should return 500 error
        assert response.status_code == 500
        assert "error" in response.json()["detail"].lower()
