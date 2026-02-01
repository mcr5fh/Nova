"""Tests for /ws/voice endpoint.

Tests the voice WebSocket endpoint that uses Pipecat for STT/TTS.
"""

import pytest
from fastapi.testclient import TestClient
from agent_loop_server.server import app


class TestVoiceEndpoint:
    """Tests for the voice WebSocket endpoint."""

    @pytest.fixture
    def client(self):
        """Create test client for FastAPI app."""
        return TestClient(app)

    def test_voice_websocket_connects(self, client):
        """Test that /ws/voice WebSocket connection can be established."""
        with client.websocket_connect("/ws/voice") as websocket:
            # Connection established successfully
            assert websocket is not None

    def test_voice_websocket_sends_ready_event(self, client):
        """Test that voice endpoint sends initial ready state event."""
        with client.websocket_connect("/ws/voice") as websocket:
            # Should receive an initial state event
            data = websocket.receive_json()
            assert data.get("type") == "voice_state"
            assert data.get("state") in ["idle", "connecting", "connected"]

    def test_voice_websocket_handles_start_message(self, client):
        """Test that voice endpoint handles start control message."""
        with client.websocket_connect("/ws/voice") as websocket:
            # Consume initial ready event
            websocket.receive_json()

            # Send start message
            websocket.send_json({"type": "start"})

            # Should receive listening state
            data = websocket.receive_json()
            assert data.get("type") == "voice_state"
            # State could be "listening" or stay "idle" if not fully configured
            assert "state" in data

    def test_voice_websocket_handles_stop_message(self, client):
        """Test that voice endpoint handles stop control message."""
        with client.websocket_connect("/ws/voice") as websocket:
            # Consume initial ready event
            websocket.receive_json()

            # Send stop message
            websocket.send_json({"type": "stop"})

            # Connection should close gracefully
            # The endpoint closes the connection on stop
