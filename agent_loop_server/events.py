"""Event schemas for agent streaming.

This is the contract between frontend and backend.
All WebSocket messages must conform to these schemas.
"""

from typing import Literal
from dataclasses import dataclass, asdict


@dataclass
class ToolCallEvent:
    """Event when agent calls a tool."""
    type: Literal["tool_call"] = "tool_call"
    tool_name: str = ""
    tool_args: str = ""  # JSON string

    def to_dict(self):
        return asdict(self)


@dataclass
class ToolResultEvent:
    """Event when tool execution completes."""
    type: Literal["tool_result"] = "tool_result"
    tool_name: str = ""
    result: str = ""
    success: bool = True

    def to_dict(self):
        return asdict(self)


@dataclass
class AgentThinkingEvent:
    """Event when agent is reasoning."""
    type: Literal["agent_thinking"] = "agent_thinking"
    reasoning: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class ErrorEvent:
    """Event when an error occurs."""
    type: Literal["error"] = "error"
    error: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class UserMessageEvent:
    """Event when user sends a message."""
    type: Literal["user_message"] = "user_message"
    message: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class AgentMessageEvent:
    """Event when agent responds to user."""
    type: Literal["agent_message"] = "agent_message"
    message: str = ""

    def to_dict(self):
        return asdict(self)


# Type alias for all event types
StreamEvent = (
    ToolCallEvent
    | ToolResultEvent
    | AgentThinkingEvent
    | ErrorEvent
    | UserMessageEvent
    | AgentMessageEvent
)
