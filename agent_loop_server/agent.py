"""Agent loop orchestration using Claude Agent SDK.

Implements agent to satisfy test_agent.py.
WITH STREAMING SUPPORT AND COMPLETE IMPLEMENTATION.
FULLY ASYNC - no thread pool, no queue, just clean async/await.
"""

import json
from typing import Optional, Dict, Any, Callable, Awaitable
from pathlib import Path
from claude_agent_sdk.types import (
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock,
    ThinkingBlock,
    ResultMessage,
)

from .tools import ToolExecutor
from .events import (
    ToolCallEvent,
    ToolResultEvent,
    AgentThinkingEvent,
    AgentMessageEvent,
)


class AgentLoopRunner:
    """Runs the SDK agent loop with tool execution and streaming."""

    def __init__(
        self,
        working_dir: str = ".",
        on_event: Optional[Callable[[Any], Awaitable[None]]] = None,
        direct_to_claude: Optional[bool] = None,
    ):
        """Initialize agent loop.

        Args:
            working_dir: Directory where agent operates
            on_event: Async callback for streaming events
            direct_to_claude: Deprecated; calls always go through the SDK
        """
        self.working_dir = Path(working_dir).resolve()
        self.conversation_history: list[Dict[str, str]] = []
        self.tool_executor = ToolExecutor(working_dir=str(self.working_dir))
        self.on_event = on_event
        # For compatibility, keep the parameter but always route via SDK.
        self.direct_to_claude = True if direct_to_claude is None else True

    async def _emit_event(self, event):
        """Emit event via async callback.

        Args:
            event: Event object (ToolCallEvent, ToolResultEvent, etc.)
        """
        if self.on_event:
            await self.on_event(event)

    def _add_user_message(self, content: str):
        """Add user message to conversation history."""
        self.conversation_history.append({
            "role": "user",
            "content": content
        })

    def _add_assistant_message(self, content: str):
        """Add assistant message to conversation history."""
        self.conversation_history.append({
            "role": "assistant",
            "content": content
        })

    def _add_tool_result(self, tool_name: str, result: str):
        """Add tool result to conversation history."""
        self.conversation_history.append({
            "role": "assistant",
            "content": f"[Tool Result from {tool_name}]\n{result}"
        })

    async def run(self, user_message: str, max_iterations: int = 10) -> str:
        """Run agent loop for a user message.

        Fully async - streams SDK calls and emits events directly.

        Args:
            user_message: User's input message
            max_iterations: Maximum number of agent iterations

        Returns:
            Agent's final response message
        """
        # Add user message to history
        self._add_user_message(user_message)
        raw_user_message = user_message

        tool_payload = json.dumps({
            "message": raw_user_message,
            "history": self.conversation_history,
        })
        # await self._emit_event(ToolCallEvent(
        #     tool_name="AgentTool",
        #     tool_args="",
        # ))
        tool_use_names: Dict[str, str] = {}
        response_chunks: list[str] = []
        success = True
        try:
            async for message in self.tool_executor.execute_stream(
                "AgentTool",
                tool_payload,
            ):
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, ToolUseBlock):
                            tool_use_names[block.id] = block.name
                            await self._emit_event(ToolCallEvent(
                                tool_name=block.name,
                                tool_args=json.dumps(block.input),
                            ))
                        elif isinstance(block, ToolResultBlock):
                            tool_name = tool_use_names.get(
                                block.tool_use_id,
                                "unknown",
                            )
                            result_value = block.content
                            if not isinstance(result_value, str):
                                result_value = json.dumps(
                                    result_value,
                                    ensure_ascii=True,
                                )
                            await self._emit_event(ToolResultEvent(
                                tool_name=tool_name,
                                result=result_value or "",
                                success=not bool(block.is_error),
                            ))
                        elif isinstance(block, TextBlock):
                            response_chunks.append(block.text)
                        elif isinstance(block, ThinkingBlock):
                            await self._emit_event(AgentThinkingEvent(
                                reasoning=block.thinking,
                            ))
                elif isinstance(message, ResultMessage) and message.result:
                    response_chunks.append(message.result)
        except Exception as e:
            success = False
            response_chunks.append(f"Error: {str(e)}")

        result = "".join(response_chunks).strip() or "No output from claude"
        await self._emit_event(ToolResultEvent(
            tool_name="AgentTool",
            result=result,
            success=success and not result.startswith("Error:"),
        ))
        self._add_assistant_message(result)
        await self._emit_event(AgentMessageEvent(message=result))
        return result
