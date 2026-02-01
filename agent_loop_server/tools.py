"""Tool execution for agent.

Simplified to single AgentTool that proxies to claude CLI.
"""

import json
import subprocess
from typing import Dict, Callable


class ToolExecutor:
    """Executes tools called by the agent - simplified to single AgentTool."""

    def __init__(self, working_dir: str = "."):
        """Initialize tool executor.

        Args:
            working_dir: Root directory for claude CLI operations
        """
        self.working_dir = working_dir

        # Registry of available tools - now only AgentTool
        self._tools: Dict[str, Callable] = {
            "AgentTool": self._agent_tool,
        }

    def execute(self, tool_name: str, args_json: str) -> str:
        """Execute a tool and return result.

        Args:
            tool_name: Name of the tool to execute
            args_json: JSON string containing tool arguments

        Returns:
            Tool execution result as string
        """
        # Parse arguments
        try:
            args = json.loads(args_json)
        except json.JSONDecodeError as e:
            return f"Error: Invalid JSON in args: {str(e)}"

        # Get tool handler
        handler = self._tools.get(tool_name)
        if not handler:
            return f"Error: Unknown tool '{tool_name}'"

        # Execute tool with error handling
        try:
            return handler(**args)
        except TypeError as e:
            return f"Error: Invalid arguments for {tool_name}: {str(e)}"
        except Exception as e:
            return f"Error executing {tool_name}: {str(e)}"

    def get_tool_descriptions(self) -> str:
        """Get formatted descriptions of all available tools.

        Returns:
            Formatted string describing all tools
        """
        return """
- AgentTool(message: str) -> str
  Proxy to claude CLI to execute arbitrary tasks.
  Sends message to 'claude -p <message>' and returns output.
  Example: {"message": "List all Python files in current directory"}
""".strip()

    def _agent_tool(self, message: str) -> str:
        """Execute claude CLI with provided message.

        Args:
            message: Message/prompt to send to claude CLI

        Returns:
            Claude CLI output or error message
        """
        if not message:
            return "Error: message parameter is required"

        try:
            # Execute claude CLI with -p flag for prompt
            result = subprocess.run(
                ["claude", "-p", message],
                cwd=self.working_dir,
                capture_output=True,
                text=True,
                timeout=60
            )

            # Check for errors
            if result.returncode != 0:
                error_output = result.stderr.strip() or "Unknown error"
                return f"Error: Claude CLI failed: {error_output}"

            # Return stdout
            return result.stdout.strip() or "No output from claude"

        except subprocess.TimeoutExpired:
            return "Error: Claude command timed out after 60 seconds"
        except FileNotFoundError:
            return "Error: claude CLI not found on system (install via npm i -g @anthropics/claude-code)"
        except Exception as e:
            return f"Error running claude: {str(e)}"
