"""Tests for static file serving."""

import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from program_nova.dashboard.server import create_app
from program_nova.engine.state import StateManager


@pytest.fixture
def cascade_file():
    """Create a minimal CASCADE.md file for testing."""
    content = """# Test Project

## L1: Application

### L2: Foundation
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | Core Types | Define base types | - |
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
        f.write(content)
        path = f.name
    yield path
    Path(path).unlink(missing_ok=True)


@pytest.fixture
def state_file(cascade_file):
    """Create a temporary state file."""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        path = f.name

    # Initialize the state
    sm = StateManager(path)
    sm.initialize("Test Project", cascade_file)

    yield path
    Path(path).unlink(missing_ok=True)


@pytest.fixture
def milestones_file():
    """Create a minimal milestones.yaml file for testing."""
    content = """milestones: []
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        f.write(content)
        path = f.name
    yield path
    Path(path).unlink(missing_ok=True)


def test_static_html_served(state_file, cascade_file, milestones_file):
    """Test that the index.html file is served at the root."""
    app = create_app(state_file, cascade_file, milestones_file)
    client = TestClient(app)

    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert b"Program Nova Dashboard" in response.content


def test_static_css_accessible(state_file, cascade_file, milestones_file):
    """Test that the CSS file is accessible."""
    app = create_app(state_file, cascade_file, milestones_file)
    client = TestClient(app)

    response = client.get("/static/styles.css")
    assert response.status_code == 200
    assert "text/css" in response.headers["content-type"]


def test_static_js_accessible(state_file, cascade_file, milestones_file):
    """Test that the JS file is accessible."""
    app = create_app(state_file, cascade_file, milestones_file)
    client = TestClient(app)

    response = client.get("/static/app.js")
    assert response.status_code == 200
    # FastAPI serves JS as application/javascript or text/javascript
    assert "javascript" in response.headers["content-type"]


def test_api_and_static_coexist(state_file, cascade_file, milestones_file):
    """Test that API endpoints and static files can coexist."""
    app = create_app(state_file, cascade_file, milestones_file)
    client = TestClient(app)

    # Test API endpoint
    api_response = client.get("/api/status")
    assert api_response.status_code == 200
    assert api_response.json()["project"]["name"] == "Test Project"

    # Test static file
    static_response = client.get("/")
    assert static_response.status_code == 200
    assert "text/html" in static_response.headers["content-type"]
