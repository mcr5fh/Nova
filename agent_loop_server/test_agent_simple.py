"""Tests for agent loop with simplified AgentTool.

Write these tests to ensure agent works with the single AgentTool.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, MagicMock

from agent_loop_server.agent import AgentLoopRunner
from agent_loop_server.events import (
    ToolCallEvent,
    ToolResultEvent,
    AgentMessageEvent,
)


class TestSimplifiedAgentLoopRunner:
    """Test agent loop execution with simplified AgentTool."""

    @pytest.fixture
    def event_list(self):
        """Create event list for testing."""
        return []

    @pytest.fixture
    def agent(self, tmp_path, event_list):
        """Create agent instance."""
        async def callback(event):
            event_list.append(event)

        return AgentLoopRunner(
            working_dir=str(tmp_path),
            on_event=callback
        )

    def test_init(self, agent, tmp_path):
        """Test agent initialization."""
        assert agent.conversation_history == []
        assert agent.working_dir == tmp_path

    @patch('agent_loop_server.agent.b')
    def test_agent_responds_without_tools(self, mock_baml, agent, event_list):
        """Test agent responding directly without using tools."""
        # Mock BAML to return a direct response
        mock_response = MagicMock()
        from agent_loop_server.baml_client.types import AgentResponseType
        mock_response.type = AgentResponseType.Reply
        mock_response.message = "Hello! How can I help?"
        mock_baml.AgentLoop.return_value = mock_response

        async def run_test():
            result = await agent.run("Hello")
            assert result == "Hello! How can I help?"
            assert len(agent.conversation_history) == 2  # user + assistant
            # Check events were collected
            assert any(e.type == "agent_message" for e in event_list)

        asyncio.run(run_test())

    @patch('agent_loop_server.agent.b')
    @patch('subprocess.run')
    def test_agent_uses_agent_tool(self, mock_subprocess, mock_baml, agent, event_list):
        """Test agent using AgentTool to proxy to claude CLI."""
        from agent_loop_server.baml_client.types import AgentResponseType, ToolName

        # Mock subprocess (claude CLI)
        mock_subprocess_result = MagicMock()
        mock_subprocess_result.returncode = 0
        mock_subprocess_result.stdout = "Python files:\n- test.py\n- main.py"
        mock_subprocess_result.stderr = ""
        mock_subprocess.return_value = mock_subprocess_result

        # Mock BAML responses
        tool_response = MagicMock()
        tool_response.type = AgentResponseType.ToolCall
        tool_response.tool_call = MagicMock()
        tool_response.tool_call.tool = ToolName.AgentTool
        tool_response.tool_call.args = '{"message": "List all Python files"}'

        final_response = MagicMock()
        final_response.type = AgentResponseType.Reply
        final_response.message = "Found 2 Python files: test.py and main.py"

        mock_baml.AgentLoop.side_effect = [tool_response, final_response]

        async def run_test():
            result = await agent.run("List Python files")
            assert "test.py" in result or "Found 2 Python files" in result
            # Check tool call and result events
            assert any(e.type == "tool_call" for e in event_list)
            assert any(e.type == "tool_result" for e in event_list)
            # Verify claude CLI was called
            mock_subprocess.assert_called_once()
            call_args = mock_subprocess.call_args[0][0]
            assert call_args[0] == 'claude'
            assert '-p' in call_args

        asyncio.run(run_test())

    def test_max_iterations_prevents_infinite_loop(self, agent):
        """Test that max iterations prevents runaway loops."""
        with patch('agent_loop_server.agent.b') as mock_baml:
            # Always return tool_call, never respond
            from agent_loop_server.baml_client.types import AgentResponseType, ToolName

            mock_response = MagicMock()
            mock_response.type = AgentResponseType.ToolCall
            mock_response.tool_call = MagicMock()
            mock_response.tool_call.tool = ToolName.AgentTool
            mock_response.tool_call.args = '{"message": "test"}'
            mock_baml.AgentLoop.return_value = mock_response

            with patch('subprocess.run') as mock_subprocess:
                mock_subprocess_result = MagicMock()
                mock_subprocess_result.returncode = 0
                mock_subprocess_result.stdout = "output"
                mock_subprocess_result.stderr = ""
                mock_subprocess.return_value = mock_subprocess_result

                async def run_test():
                    result = await agent.run("Do something", max_iterations=3)
                    # Should stop after max iterations
                    assert "max iterations" in result.lower() or "stopped" in result.lower()

                asyncio.run(run_test())
