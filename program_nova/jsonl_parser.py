"""
JSONL Parser for Claude Code session files.

This module implements Task F2 - JSONL Parser from CASCADE.md.
Parses single JSONL lines and classifies them as human messages, tool results,
assistant responses, or queue operations.
"""

import json
from typing import Dict, Any, Optional, Literal
from enum import Enum


class MessageType(Enum):
    """Classification of JSONL message types."""
    USER = "user"              # Human messages
    ASSISTANT = "assistant"    # Assistant responses
    TOOL = "tool"              # Tool results
    QUEUE_OP = "queue_op"      # Queue operations
    UNKNOWN = "unknown"        # Unrecognized type


class ParsedMessage:
    """Represents a parsed JSONL message with classification."""

    def __init__(
        self,
        message_type: MessageType,
        raw_data: Dict[str, Any],
        content: Optional[Any] = None,
        uuid: Optional[str] = None,
        timestamp: Optional[str] = None
    ):
        self.message_type = message_type
        self.raw_data = raw_data
        self.content = content
        self.uuid = uuid
        self.timestamp = timestamp

    def is_human_message(self) -> bool:
        """
        Check if this is a real human message (for Task F3 - Message Filter).

        Returns True only if:
        - type === "user"
        - content is a string (not an array - arrays are tool results)
        """
        return (
            self.message_type == MessageType.USER
            and isinstance(self.content, str)
        )

    def __repr__(self) -> str:
        return (
            f"ParsedMessage(type={self.message_type.value}, "
            f"uuid={self.uuid}, "
            f"is_human={self.is_human_message()})"
        )


def parse_jsonl_line(line: str) -> Optional[ParsedMessage]:
    """
    Parse a single JSONL line from a Claude Code session file.

    Args:
        line: A single line from a .jsonl file

    Returns:
        ParsedMessage object with classification, or None if parsing fails

    Example JSONL structure:
        {"type": "user", "message": {"content": "Hello", "uuid": "123", ...}}
        {"type": "tool", "message": {"content": [...], "uuid": "456", ...}}
        {"type": "assistant", "message": {"content": "Hi there", ...}}
        {"type": "queue_op", ...}
    """
    # Skip empty lines
    line = line.strip()
    if not line:
        return None

    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        # Skip malformed JSON lines
        return None

    # Extract message type
    msg_type_str = data.get("type", "unknown")

    # Classify message type
    try:
        message_type = MessageType(msg_type_str)
    except ValueError:
        message_type = MessageType.UNKNOWN

    # Extract message content and metadata
    message_obj = data.get("message", {})
    content = message_obj.get("content")
    uuid = message_obj.get("uuid")
    timestamp = data.get("timestamp") or message_obj.get("timestamp")

    return ParsedMessage(
        message_type=message_type,
        raw_data=data,
        content=content,
        uuid=uuid,
        timestamp=timestamp
    )


def filter_human_messages(parsed_message: Optional[ParsedMessage]) -> bool:
    """
    Task F3 - Message Filter implementation.

    Given a parsed JSONL entry, return True only if it's a real human message.

    Filter criteria:
    - type === "user"
    - content is a string (not an array - arrays are tool results)
    - NOT a tool_result

    Args:
        parsed_message: A ParsedMessage object from parse_jsonl_line()

    Returns:
        True if this is a genuine human message, False otherwise
    """
    if parsed_message is None:
        return False

    return parsed_message.is_human_message()


# Example usage and testing
if __name__ == "__main__":
    # Example JSONL lines for testing
    test_lines = [
        # Human message (should pass filter)
        '{"type": "user", "message": {"content": "Hello Claude", "uuid": "msg-123"}}',

        # Tool result with array content (should NOT pass filter)
        '{"type": "tool", "message": {"content": [{"type": "text", "text": "output"}], "uuid": "msg-456"}}',

        # Assistant response
        '{"type": "assistant", "message": {"content": "Hi there!"}}',

        # Queue operation
        '{"type": "queue_op", "operation": "enqueue"}',

        # Malformed JSON
        '{"type": "user", invalid json',

        # Empty line
        '',

        # User message with array content (edge case - should NOT pass filter)
        '{"type": "user", "message": {"content": ["array", "content"], "uuid": "msg-789"}}'
    ]

    print("Testing JSONL Parser and Message Filter:\n")
    for i, line in enumerate(test_lines, 1):
        parsed = parse_jsonl_line(line)
        is_human = filter_human_messages(parsed)

        print(f"Line {i}: {line[:60]}...")
        print(f"  Parsed: {parsed}")
        print(f"  Is Human Message: {is_human}")
        print()
