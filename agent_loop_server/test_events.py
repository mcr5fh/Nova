"""Tests for event schemas.

Test that event classes match the spec and serialize correctly.
"""

import pytest
from agent_loop_server.events import (
    ToolCallEvent,
    ToolResultEvent,
    AgentThinkingEvent,
    ErrorEvent,
    UserMessageEvent,
    AgentMessageEvent,
)


class TestEventSchemas:
    """Test event dataclass schemas."""

    def test_tool_call_event_schema(self):
        """Test ToolCallEvent has correct fields and serializes."""
        event = ToolCallEvent(
            tool_name="FileRead",
            tool_args='{"path": "test.txt"}'
        )

        assert event.type == "tool_call"
        assert event.tool_name == "FileRead"
        assert event.tool_args == '{"path": "test.txt"}'

        # Test serialization
        data = event.to_dict()
        assert data["type"] == "tool_call"
        assert data["tool_name"] == "FileRead"
        assert data["tool_args"] == '{"path": "test.txt"}'

    def test_tool_result_event_schema(self):
        """Test ToolResultEvent has correct fields and serializes."""
        event = ToolResultEvent(
            tool_name="FileRead",
            result="File contents here",
            success=True
        )

        assert event.type == "tool_result"
        assert event.tool_name == "FileRead"
        assert event.result == "File contents here"
        assert event.success is True

        # Test serialization
        data = event.to_dict()
        assert data["type"] == "tool_result"
        assert data["success"] is True

    def test_tool_result_event_failure(self):
        """Test ToolResultEvent with failure state."""
        event = ToolResultEvent(
            tool_name="FileRead",
            result="Error: File not found",
            success=False
        )

        assert event.success is False
        data = event.to_dict()
        assert data["success"] is False

    def test_agent_thinking_event_schema(self):
        """Test AgentThinkingEvent has correct fields."""
        event = AgentThinkingEvent(
            reasoning="I need to read the file first"
        )

        assert event.type == "agent_thinking"
        assert event.reasoning == "I need to read the file first"

        data = event.to_dict()
        assert data["type"] == "agent_thinking"
        assert data["reasoning"] == "I need to read the file first"

    def test_error_event_schema(self):
        """Test ErrorEvent has correct fields."""
        event = ErrorEvent(
            error="Connection timeout"
        )

        assert event.type == "error"
        assert event.error == "Connection timeout"

        data = event.to_dict()
        assert data["type"] == "error"
        assert data["error"] == "Connection timeout"

    def test_user_message_event_schema(self):
        """Test UserMessageEvent has correct fields."""
        event = UserMessageEvent(
            message="What files are in the directory?"
        )

        assert event.type == "user_message"
        assert event.message == "What files are in the directory?"

        data = event.to_dict()
        assert data["type"] == "user_message"
        assert data["message"] == "What files are in the directory?"

    def test_agent_message_event_schema(self):
        """Test AgentMessageEvent has correct fields."""
        event = AgentMessageEvent(
            message="I found 5 files in the directory"
        )

        assert event.type == "agent_message"
        assert event.message == "I found 5 files in the directory"

        data = event.to_dict()
        assert data["type"] == "agent_message"
        assert data["message"] == "I found 5 files in the directory"

    def test_default_values(self):
        """Test that events have sensible defaults."""
        tool_call = ToolCallEvent()
        assert tool_call.type == "tool_call"
        assert tool_call.tool_name == ""
        assert tool_call.tool_args == ""

        tool_result = ToolResultEvent()
        assert tool_result.success is True

        error = ErrorEvent()
        assert error.type == "error"
        assert error.error == ""

    def test_event_type_literals(self):
        """Test that type fields are the correct literals."""
        # Each event should have a distinct type
        types = {
            ToolCallEvent().type,
            ToolResultEvent().type,
            AgentThinkingEvent().type,
            ErrorEvent().type,
            UserMessageEvent().type,
            AgentMessageEvent().type,
        }

        # Should have 6 unique types
        assert len(types) == 6

        # Check specific types
        assert "tool_call" in types
        assert "tool_result" in types
        assert "agent_thinking" in types
        assert "error" in types
        assert "user_message" in types
        assert "agent_message" in types
