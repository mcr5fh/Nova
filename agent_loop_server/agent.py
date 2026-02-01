"""Agent loop orchestration using BAML.

Implements agent to satisfy test_agent.py.
WITH STREAMING SUPPORT AND COMPLETE IMPLEMENTATION.
FULLY ASYNC - no thread pool, no queue, just clean async/await.
"""

import os
from typing import Optional, Dict, Any, Callable, Awaitable
from pathlib import Path

# BAML imports (generated code)
from agent_loop_server.baml_client import b
from agent_loop_server.baml_client.types import Message, MessageRole, AgentResponseType

from .tools import ToolExecutor
from .events import (
    ToolCallEvent,
    ToolResultEvent,
    AgentThinkingEvent,
    AgentMessageEvent,
    ErrorEvent,
)


class AgentLoopRunner:
    """Runs the BAML agent loop with tool execution and streaming."""

    def __init__(
        self,
        working_dir: str = ".",
        on_event: Optional[Callable[[Any], Awaitable[None]]] = None,
        direct_to_claude: Optional[bool] = None
    ):
        """Initialize agent loop.

        Args:
            working_dir: Directory where agent operates
            on_event: Async callback for streaming events
        """
        self.working_dir = Path(working_dir).resolve()
        self.conversation_history: list[Dict[str, str]] = []
        self.tool_executor = ToolExecutor(working_dir=str(self.working_dir))
        self.on_event = on_event
        if direct_to_claude is None:
            direct_to_claude = os.getenv("AGENT_DIRECT_TO_CLAUDE", "").lower() in {
                "1", "true", "yes", "on"
            }
        self.direct_to_claude = True

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

        Fully async - awaits BAML calls and emits events directly.

        Args:
            user_message: User's input message
            max_iterations: Maximum number of agent iterations

        Returns:
            Agent's final response message
        """
        # Add user message to history
        self._add_user_message(user_message)
        raw_user_message = user_message

        if self.direct_to_claude:
            await self._emit_event(ToolCallEvent(
                tool_name="AgentTool",
                tool_args=raw_user_message
            ))
            result = self.tool_executor.execute("AgentTool", raw_user_message)
            success = not result.startswith("Error:")
            await self._emit_event(ToolResultEvent(
                tool_name="AgentTool",
                result=result,
                success=success
            ))
            self._add_assistant_message(result)
            await self._emit_event(AgentMessageEvent(message=result))
            return result

        # Agent loop
        for iteration in range(max_iterations):
            try:
                # Convert history to BAML Message format
                messages = [
                    Message(
                        role=MessageRole(msg["role"].capitalize()),
                        content=msg["content"]
                    )
                    for msg in self.conversation_history
                ]

                # Call BAML agent (AWAIT the async call)
                response = await b.AgentLoop(
                    messages=messages,
                    working_dir=str(self.working_dir)
                )

                # Check agent action
                if response.type == AgentResponseType.Done:
                    # Agent is done, return final message
                    final_message = response.message or "Task complete"
                    self._add_assistant_message(final_message)

                    await self._emit_event(AgentMessageEvent(
                        message=final_message
                    ))

                    return final_message

                elif response.type == AgentResponseType.ToolCall:
                    # Agent wants to use a tool
                    if not response.tool_call:
                        error_msg = "Error: Agent requested tool use but didn't specify tool"
                        await self._emit_event(ErrorEvent(error=error_msg))
                        return error_msg

                    tool_name = response.tool_call.tool.value
                    tool_args = response.tool_call.args
                    if tool_name == "AgentTool":
                        # Bypass BAML tool args and send raw user input directly.
                        tool_args = raw_user_message

                    # Emit tool call event
                    await self._emit_event(ToolCallEvent(
                        tool_name=tool_name,
                        tool_args=tool_args
                    ))

                    # Execute tool
                    try:
                        result = self.tool_executor.execute(tool_name, tool_args)
                        success = not result.startswith("Error:")
                        await self._emit_event(ToolResultEvent(
                                tool_name=tool_name,
                                result=result,
                                success=success
                            ))
                        if tool_name == "AgentTool":
                            # Send Claude output straight to user; don't re-run BAML.
                            self._add_assistant_message(result)
                            await self._emit_event(AgentMessageEvent(
                                message="User request: " + result
                            ))
                            return result
                        else:
                            # Emit tool result event
                            print(f"Tool result for {tool_name}: {result}")

                        # Add tool result to history
                        self._add_tool_result(tool_name, result)

                    except Exception as e:
                        error_result = f"Error executing tool: {str(e)}"
                        await self._emit_event(ToolResultEvent(
                            tool_name=tool_name,
                            result=error_result,
                            success=False
                        ))
                        self._add_tool_result(tool_name, error_result)

                else:
                    error_msg = f"Error: Unknown agent response type '{response.type}'"
                    await self._emit_event(ErrorEvent(error=error_msg))
                    return error_msg

            except Exception as e:
                error_msg = f"Error in agent loop: {str(e)}"
                await self._emit_event(ErrorEvent(error=error_msg))
                return error_msg

        # Max iterations reached
        final_msg = (
            f"Agent stopped after {max_iterations} iterations. "
            "The task may be too complex or unclear."
        )
        await self._emit_event(AgentMessageEvent(message=final_msg))
        return final_msg
