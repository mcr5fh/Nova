"""Tests for simplified AgentTool that proxies to claude CLI.

Write these tests FIRST to define the new interface.
Then implement the simplified tools.py to make them pass.
"""

import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
import subprocess

from agent_loop_server.tools import ToolExecutor


class TestSimplifiedToolExecutor:
    """Test simplified tool executor with single AgentTool."""

    @pytest.fixture
    def temp_dir(self, tmp_path):
        return str(tmp_path)

    @pytest.fixture
    def executor(self, temp_dir):
        return ToolExecutor(working_dir=temp_dir)

    @patch('subprocess.run')
    def test_agent_tool_executes_claude_cli(self, mock_run, executor):
        """Test AgentTool proxies to claude CLI."""
        # Mock subprocess response
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Claude's response to the prompt"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        result = executor.execute(
            "AgentTool",
            '{"message": "List files in current directory"}'
        )

        # Verify claude CLI was called
        mock_run.assert_called_once()
        call_args = mock_run.call_args

        # Check that 'claude' command was invoked
        assert call_args[0][0][0] == 'claude'
        assert '-p' in call_args[0][0]

        # Check result contains stdout
        assert "Claude's response" in result

    @patch('subprocess.run')
    def test_agent_tool_with_multiline_message(self, mock_run, executor):
        """Test AgentTool handles multiline messages."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "Response"
        mock_result.stderr = ""
        mock_run.return_value = mock_result

        # Use proper JSON escaping for newlines
        message = "Line 1\\nLine 2\\nLine 3"
        result = executor.execute(
            "AgentTool",
            f'{{"message": "{message}"}}'
        )

        mock_run.assert_called_once()
        assert "Response" in result

    @patch('subprocess.run')
    def test_agent_tool_handles_claude_error(self, mock_run, executor):
        """Test AgentTool handles claude CLI errors gracefully."""
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "Error: Invalid prompt"
        mock_run.return_value = mock_result

        result = executor.execute(
            "AgentTool",
            '{"message": "test"}'
        )

        assert "Error" in result
        assert "Invalid prompt" in result

    @patch('subprocess.run')
    def test_agent_tool_handles_timeout(self, mock_run, executor):
        """Test AgentTool handles timeout."""
        mock_run.side_effect = subprocess.TimeoutExpired('claude', 60)

        result = executor.execute(
            "AgentTool",
            '{"message": "test"}'
        )

        assert "Error" in result
        assert "timed out" in result.lower()

    def test_only_agent_tool_available(self, executor):
        """Test that only AgentTool is available."""
        descriptions = executor.get_tool_descriptions()

        assert "AgentTool" in descriptions
        # Old tools should NOT be present
        assert "FileRead" not in descriptions
        assert "FileWrite" not in descriptions
        assert "GitStatus" not in descriptions
        assert "RunTests" not in descriptions

    def test_old_tools_return_error(self, executor):
        """Test that old tools return error."""
        result = executor.execute("FileRead", '{"path": "test.txt"}')
        assert "Error: Unknown tool" in result

        result = executor.execute("FileWrite", '{"path": "test.txt", "content": "hi"}')
        assert "Error: Unknown tool" in result

    def test_invalid_json_args(self, executor):
        """Test invalid JSON args returns error."""
        result = executor.execute("AgentTool", 'invalid json')
        assert "Error" in result

    def test_missing_message_parameter(self, executor):
        """Test missing message parameter returns error."""
        result = executor.execute("AgentTool", '{}')
        assert "Error" in result
