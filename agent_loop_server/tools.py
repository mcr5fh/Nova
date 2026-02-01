"""Tool execution for agent.

Simplified to single AgentTool that uses Claude Agent SDK.
"""

import json
from typing import Dict, Callable, List, Optional, AsyncIterator, Any

from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import Message, AssistantMessage, TextBlock, ResultMessage


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

    async def execute(self, tool_name: str, args_json: str) -> str:
        """Execute a tool and return result.

        Args:
            tool_name: Name of the tool to execute
            args_json: JSON string containing tool arguments

        Returns:
            Tool execution result as string
        """
        response_chunks: List[str] = []
        try:
            async for message in self.execute_stream(tool_name, args_json):
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            response_chunks.append(block.text)
                if isinstance(message, ResultMessage) and message.result:
                    response_chunks.append(message.result)
        except Exception as e:
            return f"Error executing {tool_name}: {str(e)}"

        final_text = "".join(response_chunks).strip()
        return final_text or "No output from claude"

    def get_tool_descriptions(self) -> str:
        """Get formatted descriptions of all available tools.

        Returns:
            Formatted string describing all tools
        """
        return """
- AgentTool(message: str, history?: list[dict]) -> str
  Proxy to Claude Agent SDK to execute arbitrary tasks.
  Sends message and optional history to the SDK and returns output.
  Example: {"message": "List all Python files", "history": [{"role":"user","content":"Hi"}]}
""".strip()

    async def execute_stream(
        self,
        tool_name: str,
        args_json: str
    ) -> AsyncIterator[Message]:
        """Execute a tool and yield SDK messages as they arrive."""
        args = self._parse_args(args_json)
        handler = self._tools.get(tool_name)
        if not handler:
            raise ValueError(f"Error: Unknown tool '{tool_name}'")

        try:
            async for message in handler(**args):
                yield message
        except TypeError as e:
            raise ValueError(
                f"Error: Invalid arguments for {tool_name}: {str(e)}"
            ) from e

    def _parse_args(self, args_json: str) -> Dict[str, Any]:
        """Parse tool arguments with legacy fallback behavior."""
        try:
            return json.loads(args_json)
        except json.JSONDecodeError:
            if isinstance(args_json, str) and args_json.strip():
                return {"message": args_json}
            raise ValueError("Error: Invalid JSON in args: empty or unparsable")

    async def _agent_tool(
        self,
        message: str,
        history: Optional[List[Dict[str, str]]] = None
    ) -> AsyncIterator[Message]:
        """Execute Claude Agent SDK with provided message.

        Args:
            message: Message/prompt to send to SDK
            history: Prior conversation history for context

        Returns:
            Async iterator of SDK messages
        """
        if not message:
            raise ValueError("Error: message parameter is required")

        prompt = message
        if history:
            trimmed_history = history
            last_entry = history[-1] if history else None
            if (
                last_entry
                and last_entry.get("role") == "user"
                and last_entry.get("content") == message
            ):
                trimmed_history = history[:-1]

            history_lines = []
            for entry in trimmed_history:
                role = entry.get("role", "unknown").capitalize()
                content = entry.get("content", "")
                history_lines.append(f"{role}: {content}")
            prompt = (
                "Conversation history:\n"
                + "\n".join(history_lines)
                + "\n\nCurrent user message:\n"
                + message
            )

        options = ClaudeAgentOptions(
            cwd=self.working_dir,
            tools={"type": "preset", "preset": "claude_code"},
            system_prompt={"type": "preset", "preset": "claude_code"},
            permission_mode="bypassPermissions",
            setting_sources=["project", "local"],
        )

        async for message_obj in query(prompt=prompt, options=options):
            yield message_obj
