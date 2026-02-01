"""Agent loop orchestration using Claude Agent SDK.

Implements agent to satisfy test_agent.py.
WITH STREAMING SUPPORT AND COMPLETE IMPLEMENTATION.
FULLY ASYNC - no thread pool, no queue, just clean async/await.
"""

import json
import hashlib
import asyncio
import aiohttp
from typing import Optional, Dict, Any, Callable, Awaitable, List
from pathlib import Path
from datetime import datetime, timedelta
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
    DiagramUpdateEvent,
    DiagramErrorEvent,
)


class DiagramGenerator:
    """Generates Mermaid diagrams based on conversation history with debouncing."""

    def __init__(
        self,
        api_base_url: str = "http://localhost:8001",
        debounce_seconds: float = 5.0,
        broadcast_callback: Optional[Callable[[Any], Awaitable[None]]] = None,
    ):
        """Initialize diagram generator.

        Args:
            api_base_url: Base URL for the diagram generation API
            debounce_seconds: Minimum seconds between diagram generation calls
            broadcast_callback: Async callback to broadcast events (e.g., ConnectionManager.broadcast)
        """
        self.api_base_url = api_base_url.rstrip("/")
        self.debounce_seconds = debounce_seconds
        self.broadcast_callback = broadcast_callback
        self.conversation_history: List[Dict[str, str]] = []
        self.last_generation_time: Optional[datetime] = None
        self._pending_generation_task: Optional[asyncio.Task] = None

    async def handle_agent_message(self, event: AgentMessageEvent):
        """Handle incoming agent message event.

        Accumulates the message and triggers debounced diagram generation.

        Args:
            event: AgentMessageEvent containing the agent's message
        """
        # Add assistant message to conversation history
        self.conversation_history.append({
            "role": "assistant",
            "content": event.message
        })

        # Trigger debounced diagram generation
        await self._trigger_diagram_generation()

    def add_user_message(self, message: str):
        """Add a user message to conversation history.

        Args:
            message: User's message content
        """
        self.conversation_history.append({
            "role": "user",
            "content": message
        })

    async def _trigger_diagram_generation(self):
        """Trigger diagram generation with debouncing.

        Only generates if enough time has passed since last generation.
        Cancels any pending generation tasks.
        """
        # Cancel any pending generation task
        if self._pending_generation_task and not self._pending_generation_task.done():
            self._pending_generation_task.cancel()

        # Check if we need to debounce
        now = datetime.now()
        if self.last_generation_time:
            time_since_last = (now - self.last_generation_time).total_seconds()
            if time_since_last < self.debounce_seconds:
                # Schedule generation after remaining debounce time
                wait_time = self.debounce_seconds - time_since_last
                self._pending_generation_task = asyncio.create_task(
                    self._delayed_generate(wait_time)
                )
                return

        # Generate immediately
        self._pending_generation_task = asyncio.create_task(self._generate_diagrams())

    async def _delayed_generate(self, delay: float):
        """Generate diagrams after a delay.

        Args:
            delay: Seconds to wait before generating
        """
        await asyncio.sleep(delay)
        await self._generate_diagrams()

    async def _generate_diagrams(self):
        """Generate diagrams by calling the API and broadcasting results."""
        if not self.conversation_history:
            return

        try:
            # Update last generation time
            self.last_generation_time = datetime.now()

            # Build context from conversation history
            context = self._build_context()

            # Call the diagram generation API
            async with aiohttp.ClientSession() as session:
                url = f"{self.api_base_url}/api/diagram/generate"
                payload = {
                    "messages": self.conversation_history,
                    "context": context
                }

                async with session.post(url, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()

                        # Broadcast diagram updates for each type
                        if self.broadcast_callback:
                            # Flow diagram
                            if result.get("flow"):
                                await self.broadcast_callback(
                                    DiagramUpdateEvent(diagram=result["flow"])
                                )

                            # ERD diagram
                            if result.get("erd"):
                                await self.broadcast_callback(
                                    DiagramUpdateEvent(diagram=result["erd"])
                                )

                            # System architecture diagram
                            if result.get("system_arch"):
                                await self.broadcast_callback(
                                    DiagramUpdateEvent(diagram=result["system_arch"])
                                )
                    else:
                        error_text = await response.text()
                        if self.broadcast_callback:
                            await self.broadcast_callback(
                                DiagramErrorEvent(
                                    error=f"API error {response.status}: {error_text}"
                                )
                            )

        except asyncio.CancelledError:
            # Task was cancelled, don't propagate
            pass
        except Exception as e:
            if self.broadcast_callback:
                await self.broadcast_callback(
                    DiagramErrorEvent(error=f"Failed to generate diagram: {str(e)}")
                )

    def _build_context(self) -> str:
        """Build context string from conversation history.

        Returns:
            Formatted context string for diagram generation
        """
        # Take last 10 messages for context (balance between relevance and size)
        recent_messages = self.conversation_history[-10:]

        context_parts = []
        for msg in recent_messages:
            role = msg["role"].capitalize()
            content = msg["content"][:500]  # Truncate long messages
            context_parts.append(f"{role}: {content}")

        return "\n\n".join(context_parts)

    def clear_history(self):
        """Clear conversation history."""
        self.conversation_history.clear()


class AgentLoopRunner:
    """Runs the SDK agent loop with tool execution and streaming."""

    def __init__(
        self,
        working_dir: str = ".",
        on_event: Optional[Callable[[Any], Awaitable[None]]] = None,
        direct_to_claude: Optional[bool] = None,
        session_id: Optional[str] = None,
        history_dir: Optional[str] = None,
        diagram_generator: Optional[DiagramGenerator] = None,
    ):
        """Initialize agent loop.

        Args:
            working_dir: Directory where agent operates
            on_event: Async callback for streaming events
            direct_to_claude: Deprecated; calls always go through the SDK
            session_id: Optional session ID for history persistence
            history_dir: Optional directory for history storage
            diagram_generator: Optional DiagramGenerator instance for diagram generation
        """
        self.working_dir = Path(working_dir).resolve()
        self.session_id = session_id
        default_history_dir = self.working_dir / ".agent_loop_sessions"
        self.history_dir = Path(history_dir).resolve() if history_dir else default_history_dir
        self.conversation_history: list[Dict[str, str]] = []
        self.tool_executor = ToolExecutor(working_dir=str(self.working_dir))
        self.on_event = on_event
        self.diagram_generator = diagram_generator
        # For compatibility, keep the parameter but always route via SDK.
        self.direct_to_claude = True if direct_to_claude is None else True
        self._load_history()

    def _history_path(self) -> Optional[Path]:
        """Return path for persisted history, if enabled."""
        if not self.session_id:
            return None
        digest = hashlib.sha256(self.session_id.encode("utf-8")).hexdigest()
        return self.history_dir / f"session_{digest}.json"

    def _load_history(self):
        """Load conversation history from disk if available."""
        history_path = self._history_path()
        if not history_path or not history_path.exists():
            return
        try:
            data = json.loads(history_path.read_text(encoding="utf-8"))
            history = data.get("history")
            if isinstance(history, list):
                self.conversation_history = history
        except Exception:
            # If the history file is corrupted, start fresh.
            self.conversation_history = []

    def _persist_history(self):
        """Persist conversation history to disk."""
        history_path = self._history_path()
        if not history_path:
            return
        try:
            history_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "session_id": self.session_id,
                "history": self.conversation_history,
            }
            history_path.write_text(
                json.dumps(payload, ensure_ascii=True),
                encoding="utf-8",
            )
        except Exception:
            # Persistence is best-effort; don't break the chat.
            pass

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
        self._persist_history()

    def _add_assistant_message(self, content: str):
        """Add assistant message to conversation history."""
        self.conversation_history.append({
            "role": "assistant",
            "content": content
        })
        self._persist_history()

    def _add_tool_result(self, tool_name: str, result: str):
        """Add tool result to conversation history."""
        self.conversation_history.append({
            "role": "assistant",
            "content": f"[Tool Result from {tool_name}]\n{result}"
        })
        self._persist_history()

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

        # Add user message to diagram generator if available
        if self.diagram_generator:
            self.diagram_generator.add_user_message(user_message)

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
        saw_text_block = False
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
                            self._add_tool_result(
                                tool_name=tool_name,
                                result=result_value or "",
                            )
                            if tool_name not in  {"Read", "Glob"}:
                                await self._emit_event(ToolResultEvent(
                                    tool_name=tool_name,
                                    result=result_value or "",
                                    success=not bool(block.is_error),
                                ))
                        elif isinstance(block, TextBlock):
                            saw_text_block = True
                            response_chunks.append(block.text)
                        elif isinstance(block, ThinkingBlock):
                            await self._emit_event(AgentThinkingEvent(
                                reasoning=block.thinking,
                            ))
                elif (
                    isinstance(message, ResultMessage)
                    and message.result
                    and not saw_text_block
                ):
                    response_chunks.append(message.result)
        except Exception as e:
            success = False
            response_chunks.append(f"Error: {str(e)}")

        result = "".join(response_chunks).strip() or "No output from claude"
        self._add_assistant_message(result)

        # Create and emit agent message event
        agent_message_event = AgentMessageEvent(message=result)
        await self._emit_event(agent_message_event)

        # Trigger diagram generation if available
        if self.diagram_generator:
            await self.diagram_generator.handle_agent_message(agent_message_event)

        return result
