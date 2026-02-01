"""Tests for simplified AgentTool that uses Claude Agent SDK."""

import pytest
from unittest.mock import patch

from claude_agent_sdk.types import AssistantMessage, TextBlock, ResultMessage

from agent_loop_server.tools import ToolExecutor


class TestSimplifiedToolExecutor:
    """Test simplified tool executor with single AgentTool."""

    @pytest.fixture
    def temp_dir(self, tmp_path):
        return str(tmp_path)

    @pytest.fixture
    def executor(self, temp_dir):
        return ToolExecutor(working_dir=temp_dir)

    @pytest.mark.asyncio
    @patch("agent_loop_server.tools.query")
    async def test_agent_tool_executes_agent_sdk(self, mock_query, executor):
        """Test AgentTool proxies to Claude Agent SDK."""
        async def fake_query(prompt, options):
            yield AssistantMessage(content=[TextBlock(text="Claude's response")])
            yield ResultMessage(
                subtype="success",
                duration_ms=1,
                duration_api_ms=1,
                is_error=False,
                num_turns=1,
                session_id="test"
            )

        mock_query.side_effect = fake_query

        result = await executor.execute(
            "AgentTool",
            '{"message": "List files in current directory"}'
        )

        mock_query.assert_called_once()
        _, kwargs = mock_query.call_args
        options = kwargs["options"]
        assert "project" in (options.setting_sources or [])
        assert "Claude's response" in result

    @pytest.mark.asyncio
    @patch("agent_loop_server.tools.query")
    async def test_agent_tool_with_multiline_message(self, mock_query, executor):
        """Test AgentTool handles multiline messages."""
        async def fake_query(prompt, options):
            yield AssistantMessage(content=[TextBlock(text="Response")])

        mock_query.side_effect = fake_query

        # Use proper JSON escaping for newlines
        message = "Line 1\\nLine 2\\nLine 3"
        result = await executor.execute(
            "AgentTool",
            f'{{"message": "{message}"}}'
        )

        mock_query.assert_called_once()
        assert "Response" in result

    @pytest.mark.asyncio
    @patch("agent_loop_server.tools.query")
    async def test_agent_tool_handles_sdk_error(self, mock_query, executor):
        """Test AgentTool handles SDK errors gracefully."""
        async def fake_query(prompt, options):
            raise RuntimeError("Invalid prompt")

        mock_query.side_effect = fake_query

        result = await executor.execute(
            "AgentTool",
            '{"message": "test"}'
        )

        assert "Error" in result
        assert "Invalid prompt" in result

    def test_only_agent_tool_available(self, executor):
        """Test that only AgentTool is available."""
        descriptions = executor.get_tool_descriptions()

        assert "AgentTool" in descriptions
        # Old tools should NOT be present
        assert "FileRead" not in descriptions
        assert "FileWrite" not in descriptions
        assert "GitStatus" not in descriptions
        assert "RunTests" not in descriptions

    @pytest.mark.asyncio
    async def test_old_tools_return_error(self, executor):
        """Test that old tools return error."""
        result = await executor.execute("FileRead", '{"path": "test.txt"}')
        assert "Error: Unknown tool" in result

        result = await executor.execute(
            "FileWrite",
            '{"path": "test.txt", "content": "hi"}'
        )
        assert "Error: Unknown tool" in result

    @pytest.mark.asyncio
    async def test_invalid_json_args(self, executor):
        """Test invalid JSON args returns error."""
        result = await executor.execute("AgentTool", 'invalid json')
        assert "Error" in result

    @pytest.mark.asyncio
    async def test_missing_message_parameter(self, executor):
        """Test missing message parameter returns error."""
        result = await executor.execute("AgentTool", '{}')
        assert "Error" in result
