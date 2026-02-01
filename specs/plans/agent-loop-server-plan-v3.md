# Agent Loop Server - Implementation Plan (v3)

> **Changes from v2:**
> - Fixed async/sync boundary problem with proper threading
> - Added API key configuration and environment setup
> - Complete agent loop implementation with BAML integration
> - Added security validations (path traversal prevention)
> - Aligned frontend/backend event schemas
> - Added message history management
> - Clarified BAML setup and generated code paths
> - Better error handling throughout
> - Clear dependency installation order

## Overview

Build a web-based agent loop server using BAML framework for agent orchestration. The system enables developers to interact with an AI agent via chat interface, where the agent autonomously uses tools (both direct Python functions and proxied Claude CLI calls) to accomplish tasks.

**Key MVP Requirements:**
- ✅ Streaming agent activity (tool calls, results) in real-time
- ✅ React frontend with separate dev server (Vite)
- ✅ TDD approach: tests drive implementation
- ✅ WebSocket communication between frontend and backend
- ✅ Thread-safe async/sync boundary handling
- ✅ Secure tool execution (path validation)

## Architecture

```
Development Setup:
┌─────────────────────┐         ┌──────────────────────┐
│  Vite Dev Server    │  WS     │  FastAPI Backend     │
│  (localhost:5173)   │◄───────►│  (localhost:8000)    │
│                     │         │                      │
│  - React UI         │         │  - WebSocket /ws     │
│  - Hot reload       │         │  - BAML Agent Loop   │
│  - Auto refresh     │         │  - Tool Execution    │
└─────────────────────┘         │  - Thread Pool       │
                                └──────────────────────┘

Event Flow (Streaming):
1. User sends message via WebSocket
2. FastAPI spawns agent in thread pool
3. Agent calls BAML in sync code
4. Tool execution happens in thread
5. Events pushed to thread-safe queue
6. AsyncIO loop polls queue and broadcasts via WS
7. Frontend receives real-time updates
```

**No static file serving during development.** Frontend and backend run as separate processes.

---

## Phase 0: Environment Setup

### Dependencies Installation Order

**1. Create project structure:**
```bash
cd Nova
mkdir -p agent_loop_server/{frontend,tests}
touch agent_loop_server/{__init__.py,__main__.py,agent.py,server.py,tools.py}
```

**2. Install Node dependencies (for BAML CLI):**

**File:** `package.json` (create in project root)

```json
{
  "name": "nova-agent-loop",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "baml": "baml-cli"
  },
  "devDependencies": {
    "@boundaryml/baml": "^0.50.0"
  }
}
```

```bash
npm install
```

**3. Update Python dependencies:**

**File:** `pyproject.toml` (add to dependencies)

```toml
dependencies = [
    # ... existing ...
    "baml-py>=0.50.0",
    "fastapi>=0.104.0",
    "uvicorn[standard]>=0.24.0",
    "websockets>=12.0",
]

[tool.uv]
dev-dependencies = [
    # ... existing ...
    "pytest>=7.4.0",
    "pytest-asyncio>=0.21.0",
    "httpx>=0.25.0",  # For TestClient
]
```

```bash
uv sync
```

**4. BAML Setup:**

**File:** `baml_src/agent.baml` (new file)

```baml
// Event schema for streaming
class StreamEvent {
  type "tool_call" | "tool_result" | "agent_thinking" | "error"
  tool_name string?
  tool_args string?  // JSON string
  result string?
  message string?
}

// Message structure for conversation history
class Message {
  role "user" | "assistant"
  content string
}

// Tool call structure returned by agent
class ToolCall {
  tool_name string
  args string  // JSON string of arguments
}

// Agent can either call a tool or reply to user
class AgentResponse {
  action "use_tool" | "respond"
  tool_call ToolCall?
  message string?
  reasoning string?  // Agent's thought process
}

// Main agent loop function
function AgentLoop(
  conversation_history: Message[],
  working_dir: string,
  available_tools: string
) -> AgentResponse {
  client GPT4o

  prompt #"
    You are an AI coding agent helping developers accomplish tasks.

    Working directory: {{ working_dir }}

    Available tools:
{{ available_tools }}

    RULES:
    1. Execute ONE tool at a time (no parallel execution)
    2. After using a tool, wait for the result before deciding next action
    3. When task is complete, use action="respond" to reply to user
    4. Always explain your reasoning
    5. Never access files outside the working directory

    Conversation history:
    {% for msg in conversation_history %}
    {{ msg.role }}: {{ msg.content }}
    {% endfor %}

    What do you want to do next? Think step by step.

    Respond in this exact JSON format:
    {
      "action": "use_tool" | "respond",
      "reasoning": "explain your thinking",
      "tool_call": {
        "tool_name": "ToolName",
        "args": "{\"arg1\": \"value1\"}"
      },
      "message": "your response to user (if action=respond)"
    }
  "#
}
```

**5. Configure BAML generation:**

**File:** `baml_src/baml.config` (new file)

```json
{
  "generators": [
    {
      "language": "python",
      "output_dir": "./agent_loop_server/baml_client"
    }
  ]
}
```

**6. Generate BAML client:**

```bash
npx baml-cli generate
# This creates agent_loop_server/baml_client/ with Python code
```

**7. Set up environment variables:**

**File:** `.env.example` (new file)

```bash
# OpenAI API Key (required for BAML)
OPENAI_API_KEY=sk-...

# Server Configuration
AGENT_LOOP_HOST=0.0.0.0
AGENT_LOOP_PORT=8000

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Agent Configuration
MAX_AGENT_ITERATIONS=10
AGENT_TIMEOUT_SECONDS=300
```

**File:** `.env` (create from example, gitignored)

```bash
cp .env.example .env
# Edit .env and add your actual OpenAI API key
```

**File:** `.gitignore` (update)

```gitignore
# Environment
.env

# BAML generated code
agent_loop_server/baml_client/

# Frontend build
agent_loop_server/frontend/dist/
agent_loop_server/frontend/node_modules/
```

### Success Criteria

```bash
# Verify installations
node --version
npm --version
uv --version

# Verify BAML client generated
ls agent_loop_server/baml_client/

# Verify environment
grep OPENAI_API_KEY .env  # Should show your key
```

---

## Phase 1: BAML Agent Foundation (TDD)

### Event Schema Definition

First, define the exact event schema both frontend and backend will use:

**File:** `agent_loop_server/events.py` (new file)

```python
"""Event schemas for agent streaming.

This is the contract between frontend and backend.
All WebSocket messages must conform to these schemas.
"""

from typing import Literal, Optional
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
```

### Test-First Approach

**File:** `agent_loop_server/tests/test_tools.py` (new file)

```python
"""Tests for tool executor.

Write these tests FIRST to define the tool interface.
Then implement tools.py to make them pass.
"""

import pytest
from pathlib import Path

from agent_loop_server.tools import ToolExecutor


class TestToolExecutor:
    """Test tool execution."""

    @pytest.fixture
    def temp_dir(self, tmp_path):
        """Create a temporary working directory."""
        return str(tmp_path)

    @pytest.fixture
    def executor(self, temp_dir):
        """Create tool executor instance."""
        return ToolExecutor(working_dir=temp_dir)

    def test_file_read_success(self, executor, temp_dir):
        """Test FileRead tool with valid path."""
        test_file = Path(temp_dir) / "test.txt"
        test_file.write_text("Hello World")

        result = executor.execute("FileRead", '{"path": "test.txt"}')
        assert result == "Hello World"

    def test_file_read_nested_path(self, executor, temp_dir):
        """Test FileRead with nested directory."""
        nested_dir = Path(temp_dir) / "subdir"
        nested_dir.mkdir()
        test_file = nested_dir / "nested.txt"
        test_file.write_text("Nested content")

        result = executor.execute("FileRead", '{"path": "subdir/nested.txt"}')
        assert result == "Nested content"

    def test_file_read_path_traversal_blocked(self, executor, temp_dir):
        """Test that path traversal attempts are blocked."""
        # Try to escape working directory
        result = executor.execute("FileRead", '{"path": "../../../etc/passwd"}')
        assert "Error" in result
        assert "outside working directory" in result.lower()

    def test_file_write_success(self, executor, temp_dir):
        """Test FileWrite tool."""
        result = executor.execute(
            "FileWrite",
            '{"path": "new.txt", "content": "Test content"}'
        )

        assert "Wrote" in result
        assert (Path(temp_dir) / "new.txt").read_text() == "Test content"

    def test_file_write_creates_directories(self, executor, temp_dir):
        """Test FileWrite creates parent directories."""
        result = executor.execute(
            "FileWrite",
            '{"path": "deeply/nested/file.txt", "content": "content"}'
        )

        assert "Wrote" in result
        assert (Path(temp_dir) / "deeply/nested/file.txt").exists()

    def test_file_write_path_traversal_blocked(self, executor):
        """Test FileWrite blocks path traversal."""
        result = executor.execute(
            "FileWrite",
            '{"path": "../../bad.txt", "content": "malicious"}'
        )
        assert "Error" in result

    def test_git_status(self, executor, temp_dir):
        """Test GitStatus tool."""
        # Initialize git repo
        import subprocess
        subprocess.run(
            ["git", "init"],
            cwd=temp_dir,
            capture_output=True
        )

        result = executor.execute("GitStatus", '{}')
        assert isinstance(result, str)
        # Empty repo returns empty status

    def test_run_tests(self, executor, temp_dir):
        """Test RunTests tool."""
        # Create a simple test file
        test_file = Path(temp_dir) / "test_example.py"
        test_file.write_text("""
def test_example():
    assert 1 + 1 == 2
""")

        result = executor.execute("RunTests", '{"path": "."}')
        assert "Exit code:" in result

    def test_unknown_tool_returns_error(self, executor):
        """Test unknown tool returns error."""
        result = executor.execute("UnknownTool", '{}')
        assert "Error" in result
        assert "Unknown tool" in result

    def test_invalid_json_args_returns_error(self, executor):
        """Test invalid JSON args returns error."""
        result = executor.execute("FileRead", 'invalid json{')
        assert "Error" in result
        assert "Invalid JSON" in result

    def test_missing_required_arg_returns_error(self, executor):
        """Test missing required argument returns error."""
        result = executor.execute("FileRead", '{}')
        assert "Error" in result

    def test_get_tool_descriptions(self, executor):
        """Test getting formatted tool descriptions."""
        descriptions = executor.get_tool_descriptions()
        assert "FileRead" in descriptions
        assert "FileWrite" in descriptions
        assert "GitStatus" in descriptions
        assert "RunTests" in descriptions
```

### Implementation

**File:** `agent_loop_server/tools.py` (new file)

```python
"""Tool execution for agent.

Implements tools to satisfy test_tools.py.
"""

import json
import subprocess
from pathlib import Path
from typing import Dict, Any, Callable


class ToolExecutor:
    """Executes tools called by the agent with security validations."""

    def __init__(self, working_dir: str = "."):
        """Initialize tool executor.

        Args:
            working_dir: Root directory for file operations
        """
        self.working_dir = Path(working_dir).resolve()

        # Registry of available tools
        self._tools: Dict[str, Callable] = {
            "FileRead": self._file_read,
            "FileWrite": self._file_write,
            "GitStatus": self._git_status,
            "RunTests": self._run_tests,
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
- FileRead(path: str) -> str
  Read contents of a file relative to working directory.
  Example: {"path": "src/main.py"}

- FileWrite(path: str, content: str) -> str
  Write content to a file (creates directories if needed).
  Example: {"path": "output.txt", "content": "Hello"}

- GitStatus() -> str
  Get current git status of the working directory.
  Example: {}

- RunTests(path: str = ".") -> str
  Run pytest on specified path.
  Example: {"path": "tests/"}
""".strip()

    def _validate_path(self, path: str) -> Path:
        """Validate and resolve a path within working directory.

        Args:
            path: Relative path to validate

        Returns:
            Resolved absolute Path object

        Raises:
            ValueError: If path escapes working directory
        """
        # Resolve to absolute path
        full_path = (self.working_dir / path).resolve()

        # Check if path is within working directory
        try:
            full_path.relative_to(self.working_dir)
        except ValueError:
            raise ValueError(
                f"Path '{path}' is outside working directory. "
                f"Access denied for security reasons."
            )

        return full_path

    def _file_read(self, path: str) -> str:
        """Read file contents.

        Args:
            path: Relative path to file

        Returns:
            File contents as string
        """
        file_path = self._validate_path(path)

        if not file_path.exists():
            return f"Error: File '{path}' does not exist"

        if not file_path.is_file():
            return f"Error: '{path}' is not a file"

        return file_path.read_text()

    def _file_write(self, path: str, content: str) -> str:
        """Write file contents.

        Args:
            path: Relative path to file
            content: Content to write

        Returns:
            Success message with byte count
        """
        file_path = self._validate_path(path)

        # Create parent directories if needed
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Write content
        file_path.write_text(content)

        return f"Wrote {len(content)} bytes to {path}"

    def _git_status(self) -> str:
        """Get git status.

        Returns:
            Git status output or error message
        """
        try:
            result = subprocess.run(
                ["git", "status", "--short"],
                cwd=str(self.working_dir),
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode != 0:
                return f"Git error: {result.stderr}"

            return result.stdout.strip() or "No changes"

        except subprocess.TimeoutExpired:
            return "Error: Git command timed out"
        except FileNotFoundError:
            return "Error: Git not found on system"
        except Exception as e:
            return f"Error running git: {str(e)}"

    def _run_tests(self, path: str = ".") -> str:
        """Run pytest on path.

        Args:
            path: Relative path to test directory/file

        Returns:
            Pytest output with exit code
        """
        test_path = self._validate_path(path)

        if not test_path.exists():
            return f"Error: Test path '{path}' does not exist"

        try:
            result = subprocess.run(
                ["uv", "run", "pytest", str(test_path), "-v"],
                cwd=str(self.working_dir),
                capture_output=True,
                text=True,
                timeout=60
            )

            output = f"Exit code: {result.returncode}\n\n"
            output += f"STDOUT:\n{result.stdout}\n"
            if result.stderr:
                output += f"\nSTDERR:\n{result.stderr}"

            return output

        except subprocess.TimeoutExpired:
            return "Error: Tests timed out after 60 seconds"
        except FileNotFoundError:
            return "Error: uv or pytest not found on system"
        except Exception as e:
            return f"Error running tests: {str(e)}"
```

### Agent Implementation with Message History

**File:** `agent_loop_server/tests/test_agent.py` (new file)

```python
"""Tests for agent loop.

Write these tests FIRST to define the agent interface.
Then implement agent.py to make them pass.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from queue import Queue

from agent_loop_server.agent import AgentLoopRunner
from agent_loop_server.events import (
    ToolCallEvent,
    ToolResultEvent,
    AgentMessageEvent,
)


class TestAgentLoopRunner:
    """Test agent loop execution."""

    @pytest.fixture
    def event_queue(self):
        """Create event queue for testing."""
        return Queue()

    @pytest.fixture
    def agent(self, tmp_path, event_queue):
        """Create agent instance."""
        return AgentLoopRunner(
            working_dir=str(tmp_path),
            event_queue=event_queue
        )

    def test_init(self, agent, tmp_path):
        """Test agent initialization."""
        assert agent.conversation_history == []
        assert agent.working_dir == tmp_path

    def test_message_history_accumulates(self, agent):
        """Test that messages accumulate in history."""
        assert len(agent.conversation_history) == 0

        agent._add_user_message("Hello")
        assert len(agent.conversation_history) == 1
        assert agent.conversation_history[0]["role"] == "user"
        assert agent.conversation_history[0]["content"] == "Hello"

        agent._add_assistant_message("Hi there")
        assert len(agent.conversation_history) == 2
        assert agent.conversation_history[1]["role"] == "assistant"

    @patch('agent_loop_server.agent.b')
    def test_agent_responds_without_tools(self, mock_baml, agent, event_queue):
        """Test agent responding directly without using tools."""
        # Mock BAML to return a direct response
        mock_response = MagicMock()
        mock_response.action = "respond"
        mock_response.message = "Hello! How can I help?"
        mock_response.reasoning = "User greeted me"
        mock_baml.AgentLoop.return_value = mock_response

        result = agent.run("Hello")

        assert result == "Hello! How can I help?"
        assert len(agent.conversation_history) == 2  # user + assistant

        # Check events were queued
        events = []
        while not event_queue.empty():
            events.append(event_queue.get())

        assert any(e.type == "agent_message" for e in events)

    @patch('agent_loop_server.agent.b')
    def test_agent_uses_tool(self, mock_baml, agent, event_queue, tmp_path):
        """Test agent using a tool."""
        # Create test file
        test_file = tmp_path / "test.txt"
        test_file.write_text("File contents")

        # Mock BAML responses
        tool_response = MagicMock()
        tool_response.action = "use_tool"
        tool_response.reasoning = "Need to read file"
        tool_response.tool_call = MagicMock()
        tool_response.tool_call.tool_name = "FileRead"
        tool_response.tool_call.args = '{"path": "test.txt"}'

        final_response = MagicMock()
        final_response.action = "respond"
        final_response.message = "The file contains: File contents"
        final_response.reasoning = "Read the file successfully"

        mock_baml.AgentLoop.side_effect = [tool_response, final_response]

        result = agent.run("What's in test.txt?")

        assert "File contents" in result

        # Check tool call and result events
        events = []
        while not event_queue.empty():
            events.append(event_queue.get())

        assert any(e.type == "tool_call" for e in events)
        assert any(e.type == "tool_result" for e in events)

    def test_max_iterations_prevents_infinite_loop(self, agent):
        """Test that max iterations prevents runaway loops."""
        with patch('agent_loop_server.agent.b') as mock_baml:
            # Always return tool_call, never respond
            mock_response = MagicMock()
            mock_response.action = "use_tool"
            mock_response.tool_call = MagicMock()
            mock_response.tool_call.tool_name = "GitStatus"
            mock_response.tool_call.args = '{}'
            mock_baml.AgentLoop.return_value = mock_response

            result = agent.run("Do something", max_iterations=3)

            # Should stop after max iterations
            assert "max iterations" in result.lower() or "stopped" in result.lower()
```

**File:** `agent_loop_server/agent.py` (new file)

```python
"""Agent loop orchestration using BAML.

Implements agent to satisfy test_agent.py.
WITH STREAMING SUPPORT AND COMPLETE IMPLEMENTATION.
"""

import os
from typing import Optional, Dict, Any
from pathlib import Path
from queue import Queue

# BAML imports (generated code)
from agent_loop_server.baml_client import b
from agent_loop_server.baml_client.types import Message

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
        event_queue: Optional[Queue] = None
    ):
        """Initialize agent loop.

        Args:
            working_dir: Directory where agent operates
            event_queue: Thread-safe queue for streaming events
        """
        self.working_dir = Path(working_dir).resolve()
        self.conversation_history: list[Dict[str, str]] = []
        self.tool_executor = ToolExecutor(working_dir=str(self.working_dir))
        self.event_queue = event_queue or Queue()

    def _emit_event(self, event):
        """Emit event to queue for async consumption.

        Args:
            event: Event object (ToolCallEvent, ToolResultEvent, etc.)
        """
        self.event_queue.put(event)

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

    def run(self, user_message: str, max_iterations: int = 10) -> str:
        """Run agent loop for a user message.

        This method runs synchronously in a thread pool.
        Events are pushed to queue for async consumption.

        Args:
            user_message: User's input message
            max_iterations: Maximum number of agent iterations

        Returns:
            Agent's final response message
        """
        # Add user message to history
        self._add_user_message(user_message)

        # Get tool descriptions for agent prompt
        tool_descriptions = self.tool_executor.get_tool_descriptions()

        # Agent loop
        for iteration in range(max_iterations):
            try:
                # Convert history to BAML Message format
                messages = [
                    Message(role=msg["role"], content=msg["content"])
                    for msg in self.conversation_history
                ]

                # Call BAML agent
                response = b.AgentLoop(
                    conversation_history=messages,
                    working_dir=str(self.working_dir),
                    available_tools=tool_descriptions
                )

                # Emit thinking event
                if hasattr(response, 'reasoning') and response.reasoning:
                    self._emit_event(AgentThinkingEvent(
                        reasoning=response.reasoning
                    ))

                # Check agent action
                if response.action == "respond":
                    # Agent is done, return final message
                    final_message = response.message or "Task complete"
                    self._add_assistant_message(final_message)

                    self._emit_event(AgentMessageEvent(
                        message=final_message
                    ))

                    return final_message

                elif response.action == "use_tool":
                    # Agent wants to use a tool
                    if not response.tool_call:
                        error_msg = "Error: Agent requested tool use but didn't specify tool"
                        self._emit_event(ErrorEvent(error=error_msg))
                        return error_msg

                    tool_name = response.tool_call.tool_name
                    tool_args = response.tool_call.args

                    # Emit tool call event
                    self._emit_event(ToolCallEvent(
                        tool_name=tool_name,
                        tool_args=tool_args
                    ))

                    # Execute tool
                    try:
                        result = self.tool_executor.execute(tool_name, tool_args)
                        success = not result.startswith("Error:")

                        # Emit tool result event
                        self._emit_event(ToolResultEvent(
                            tool_name=tool_name,
                            result=result,
                            success=success
                        ))

                        # Add tool result to history
                        self._add_tool_result(tool_name, result)

                    except Exception as e:
                        error_result = f"Error executing tool: {str(e)}"
                        self._emit_event(ToolResultEvent(
                            tool_name=tool_name,
                            result=error_result,
                            success=False
                        ))
                        self._add_tool_result(tool_name, error_result)

                else:
                    error_msg = f"Error: Unknown agent action '{response.action}'"
                    self._emit_event(ErrorEvent(error=error_msg))
                    return error_msg

            except Exception as e:
                error_msg = f"Error in agent loop: {str(e)}"
                self._emit_event(ErrorEvent(error=error_msg))
                return error_msg

        # Max iterations reached
        final_msg = (
            f"Agent stopped after {max_iterations} iterations. "
            "The task may be too complex or unclear."
        )
        self._emit_event(AgentMessageEvent(message=final_msg))
        return final_msg
```

### Success Criteria

```bash
# Tests should pass
uv run pytest agent_loop_server/tests/test_tools.py -v
uv run pytest agent_loop_server/tests/test_agent.py -v
```

---

## Phase 2: FastAPI WebSocket Server (Thread-Safe Streaming)

### Test-First Approach

**File:** `agent_loop_server/tests/test_server.py` (new file)

```python
"""Tests for FastAPI server.

Write these tests FIRST to define the server interface.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock, MagicMock
import json

from agent_loop_server.server import app


class TestServer:
    """Test FastAPI server endpoints."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_health_check(self, client):
        """Test health check endpoint."""
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_websocket_connection(self, client):
        """Test WebSocket connection."""
        with client.websocket_connect("/ws") as websocket:
            assert websocket is not None

    @patch('agent_loop_server.server.AgentLoopRunner')
    def test_websocket_message_flow(self, mock_agent_class, client):
        """Test complete WebSocket message flow."""
        # Mock agent
        mock_agent = Mock()
        mock_agent.run.return_value = "Task completed"
        mock_agent_class.return_value = mock_agent

        with client.websocket_connect("/ws") as websocket:
            # Send chat message
            websocket.send_json({
                "type": "chat",
                "message": "Hello"
            })

            # Should receive user message echo
            data1 = websocket.receive_json()
            assert data1["type"] == "user_message"
            assert data1["message"] == "Hello"

            # Should receive agent message
            data2 = websocket.receive_json()
            assert data2["type"] == "agent_message"

    def test_websocket_invalid_message_type(self, client):
        """Test WebSocket handles invalid message type gracefully."""
        with client.websocket_connect("/ws") as websocket:
            websocket.send_json({
                "type": "invalid_type",
                "data": "test"
            })

            # Should receive error
            data = websocket.receive_json()
            assert data["type"] == "error"

    def test_cors_headers(self, client):
        """Test CORS headers are set correctly."""
        response = client.options(
            "/api/health",
            headers={"Origin": "http://localhost:5173"}
        )
        assert "access-control-allow-origin" in response.headers
```

### Implementation

**File:** `agent_loop_server/server.py` (new file)

```python
"""FastAPI server for agent loop.

Implements server to satisfy test_server.py.
WITH THREAD-SAFE STREAMING SUPPORT.
NO STATIC FILE SERVING (separate Vite dev server).
"""

import os
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Set
from queue import Queue, Empty
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

from .agent import AgentLoopRunner
from .events import UserMessageEvent, ErrorEvent

# Load environment variables
load_dotenv()


class ConnectionManager:
    """Manages WebSocket connections with thread-safe event broadcasting."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.executor = ThreadPoolExecutor(max_workers=4)

    async def connect(self, websocket: WebSocket):
        """Accept and register a WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        """Unregister a WebSocket connection."""
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        """Send message to all connected clients.

        Args:
            message: Dictionary to send as JSON
        """
        dead_connections = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Failed to send to client: {e}")
                dead_connections.add(connection)

        # Clean up dead connections
        self.active_connections -= dead_connections

    async def run_agent_with_streaming(
        self,
        websocket: WebSocket,
        user_message: str,
        working_dir: str = "."
    ):
        """Run agent in thread pool and stream events.

        This solves the async/sync boundary problem by:
        1. Running agent synchronously in thread pool
        2. Agent pushes events to thread-safe Queue
        3. Async loop polls queue and broadcasts events

        Args:
            websocket: WebSocket connection
            user_message: User's chat message
            working_dir: Working directory for agent
        """
        # Create thread-safe queue for events
        event_queue: Queue = Queue()

        # Create agent with queue
        agent = AgentLoopRunner(
            working_dir=working_dir,
            event_queue=event_queue
        )

        # Run agent in thread pool (non-blocking)
        loop = asyncio.get_event_loop()
        agent_task = loop.run_in_executor(
            self.executor,
            agent.run,
            user_message
        )

        # Poll queue and broadcast events until agent completes
        while not agent_task.done():
            try:
                # Check queue for new events (non-blocking)
                event = event_queue.get(block=False)
                await self.broadcast(event.to_dict())
            except Empty:
                # No events, sleep briefly
                await asyncio.sleep(0.05)

        # Drain any remaining events
        while not event_queue.empty():
            try:
                event = event_queue.get(block=False)
                await self.broadcast(event.to_dict())
            except Empty:
                break

        # Wait for agent to complete
        await agent_task


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for FastAPI app."""
    print("=" * 60)
    print("Agent Loop Server starting")
    print("=" * 60)
    print(f"Backend: http://localhost:{os.getenv('AGENT_LOOP_PORT', 8000)}")
    print(f"WebSocket: ws://localhost:{os.getenv('AGENT_LOOP_PORT', 8000)}/ws")
    print()
    print("NOTE: Run Vite dev server separately for frontend:")
    print("  cd agent_loop_server/frontend && npm run dev")
    print("=" * 60)
    yield
    print("\nAgent Loop Server shutting down...")
    manager.executor.shutdown(wait=True)


app = FastAPI(title="Agent Loop Server", lifespan=lifespan)

# CORS middleware (allow Vite dev server to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for chat with streaming.

    Thread-safe event streaming:
    - Agent runs in thread pool (sync)
    - Events pushed to Queue from thread
    - Async loop polls queue and broadcasts
    """
    await manager.connect(websocket)

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "chat":
                user_message = data.get("message", "").strip()

                if not user_message:
                    await manager.broadcast(
                        ErrorEvent(error="Empty message received").to_dict()
                    )
                    continue

                # Broadcast user message
                await manager.broadcast(
                    UserMessageEvent(message=user_message).to_dict()
                )

                # Run agent with streaming
                # (This handles the async/sync boundary correctly)
                await manager.run_agent_with_streaming(
                    websocket=websocket,
                    user_message=user_message,
                    working_dir="."
                )

            else:
                # Unknown message type
                await manager.broadcast(
                    ErrorEvent(
                        error=f"Unknown message type: {message_type}"
                    ).to_dict()
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await manager.broadcast(
            ErrorEvent(error=f"Server error: {str(e)}").to_dict()
        )
        manager.disconnect(websocket)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/api/config")
async def get_config():
    """Get client configuration."""
    return {
        "max_iterations": int(os.getenv("MAX_AGENT_ITERATIONS", 10)),
        "working_dir": os.getcwd()
    }
```

**File:** `agent_loop_server/__main__.py` (new file)

```python
"""Entry point for agent loop server."""

import os
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def main():
    """Run the server."""
    host = os.getenv("AGENT_LOOP_HOST", "0.0.0.0")
    port = int(os.getenv("AGENT_LOOP_PORT", 8000))

    uvicorn.run(
        "agent_loop_server.server:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )


if __name__ == "__main__":
    main()
```

**File:** `agent_loop_server/__init__.py` (new file)

```python
"""Agent Loop Server - BAML-based chat agent with tools."""

__version__ = "0.1.0"

from .agent import AgentLoopRunner
from .tools import ToolExecutor

__all__ = ["AgentLoopRunner", "ToolExecutor"]
```

### Success Criteria

```bash
# Verify environment
cat .env | grep OPENAI_API_KEY

# Start server
uv run python -m agent_loop_server

# In another terminal - test health
curl http://localhost:8000/api/health

# Tests pass
uv run pytest agent_loop_server/tests/test_server.py -v
```

---

## Phase 3: React Frontend (Type-Safe Event Handling)

### Setup

```bash
# Create Vite React TypeScript project
cd agent_loop_server
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### Implementation

**File:** `agent_loop_server/frontend/src/types/events.ts` (new file)

```typescript
/**
 * Event types matching backend events.py schema.
 * This ensures type safety across frontend/backend boundary.
 */

export type MessageType =
  | 'user_message'
  | 'agent_message'
  | 'tool_call'
  | 'tool_result'
  | 'agent_thinking'
  | 'error';

export interface BaseEvent {
  type: MessageType;
}

export interface UserMessageEvent extends BaseEvent {
  type: 'user_message';
  message: string;
}

export interface AgentMessageEvent extends BaseEvent {
  type: 'agent_message';
  message: string;
}

export interface ToolCallEvent extends BaseEvent {
  type: 'tool_call';
  tool_name: string;
  tool_args: string;  // JSON string
}

export interface ToolResultEvent extends BaseEvent {
  type: 'tool_result';
  tool_name: string;
  result: string;
  success: boolean;
}

export interface AgentThinkingEvent extends BaseEvent {
  type: 'agent_thinking';
  reasoning: string;
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  error: string;
}

export type StreamEvent =
  | UserMessageEvent
  | AgentMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | AgentThinkingEvent
  | ErrorEvent;
```

**File:** `agent_loop_server/frontend/src/hooks/useWebSocket.ts` (new file)

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { StreamEvent } from '../types/events';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

export function useWebSocket() {
  const [messages, setMessages] = useState<StreamEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data: StreamEvent = JSON.parse(event.data);
        setMessages((prev) => [...prev, data]);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('Connection error');
    };

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        message,
      }));
    } else {
      setError('Not connected to server');
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isConnected, error, sendMessage, clearMessages };
}
```

**File:** `agent_loop_server/frontend/src/components/MessageItem.tsx` (new file)

```typescript
import { StreamEvent } from '../types/events';
import './MessageItem.css';

interface Props {
  event: StreamEvent;
}

export function MessageItem({ event }: Props) {
  switch (event.type) {
    case 'user_message':
      return (
        <div className="message user-message">
          <div className="message-header">You</div>
          <div className="message-content">{event.message}</div>
        </div>
      );

    case 'agent_message':
      return (
        <div className="message agent-message">
          <div className="message-header">Agent</div>
          <div className="message-content">{event.message}</div>
        </div>
      );

    case 'tool_call':
      return (
        <div className="message tool-call">
          <div className="message-header">🔧 Tool Call: {event.tool_name}</div>
          <div className="message-content">
            <pre>{formatJson(event.tool_args)}</pre>
          </div>
        </div>
      );

    case 'tool_result':
      return (
        <div className={`message tool-result ${event.success ? 'success' : 'error'}`}>
          <div className="message-header">
            {event.success ? '✓' : '✗'} Result: {event.tool_name}
          </div>
          <div className="message-content">
            <pre>{event.result}</pre>
          </div>
        </div>
      );

    case 'agent_thinking':
      return (
        <div className="message agent-thinking">
          <div className="message-header">💭 Agent Thinking</div>
          <div className="message-content">{event.reasoning}</div>
        </div>
      );

    case 'error':
      return (
        <div className="message error-message">
          <div className="message-header">❌ Error</div>
          <div className="message-content">{event.error}</div>
        </div>
      );

    default:
      return null;
  }
}

function formatJson(jsonString: string): string {
  try {
    return JSON.stringify(JSON.parse(jsonString), null, 2);
  } catch {
    return jsonString;
  }
}
```

**File:** `agent_loop_server/frontend/src/components/MessageItem.css` (new file)

```css
.message {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-header {
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.message-content {
  line-height: 1.5;
}

.message-content pre {
  margin: 0.5rem 0 0 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.5rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
}

.user-message {
  background: #264f78;
  margin-left: auto;
  max-width: 70%;
}

.agent-message {
  background: #1e3a5f;
  margin-right: auto;
  max-width: 70%;
}

.tool-call {
  background: #3a3a3c;
  border-left: 3px solid #4ec9b0;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

.tool-result {
  background: #2d2d30;
  border-left: 3px solid #569cd6;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
}

.tool-result.error {
  border-left-color: #f48771;
}

.agent-thinking {
  background: #2a2a2c;
  border-left: 3px solid #dcdcaa;
  font-style: italic;
  opacity: 0.9;
}

.error-message {
  background: #5a1e1e;
  border-left: 3px solid #f48771;
}
```

**File:** `agent_loop_server/frontend/src/components/Chat.tsx` (new file)

```typescript
import { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { MessageItem } from './MessageItem';
import './Chat.css';

export function Chat() {
  const { messages, isConnected, error, sendMessage, clearMessages } = useWebSocket();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && isConnected) {
      sendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Agent Loop Chat</h1>
        <div className="header-actions">
          <button
            onClick={clearMessages}
            className="clear-button"
            title="Clear messages"
          >
            Clear
          </button>
          <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>No messages yet. Ask the agent to do something!</p>
            <p className="empty-state-hint">
              Try: "What files are in this directory?" or "Run the tests"
            </p>
          </div>
        )}

        {messages.map((event, idx) => (
          <MessageItem key={idx} event={event} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent to do something..."
          disabled={!isConnected}
        />
        <button type="submit" disabled={!isConnected || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
```

**File:** `agent_loop_server/frontend/src/components/Chat.css` (new file)

```css
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  background: #1e1e1e;
  color: #d4d4d4;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
}

.chat-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.clear-button {
  padding: 0.5rem 1rem;
  background: #3c3c3c;
  border: 1px solid #555;
  border-radius: 4px;
  color: #d4d4d4;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.clear-button:hover {
  background: #505050;
}

.status {
  font-size: 0.9rem;
  padding: 0.5rem 1rem;
  border-radius: 4px;
}

.status.connected {
  color: #4ec9b0;
  background: rgba(78, 201, 176, 0.1);
}

.status.disconnected {
  color: #f48771;
  background: rgba(244, 135, 113, 0.1);
}

.error-banner {
  padding: 1rem;
  background: #5a1e1e;
  color: #f48771;
  text-align: center;
  border-bottom: 1px solid #3e3e42;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #888;
}

.empty-state p {
  margin: 0.5rem 0;
}

.empty-state-hint {
  font-size: 0.9rem;
  font-style: italic;
}

.input-form {
  display: flex;
  gap: 0.75rem;
  padding: 1.5rem;
  background: #252526;
  border-top: 1px solid #3e3e42;
}

.input-form input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: #3c3c3c;
  border: 1px solid #555;
  border-radius: 6px;
  color: #d4d4d4;
  font-size: 1rem;
}

.input-form input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
}

.input-form input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-form button {
  padding: 0.75rem 2rem;
  background: #007acc;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.input-form button:hover:not(:disabled) {
  background: #005a9e;
}

.input-form button:disabled {
  background: #555;
  cursor: not-allowed;
  opacity: 0.5;
}
```

**File:** `agent_loop_server/frontend/src/App.tsx`

```typescript
import { Chat } from './components/Chat'
import './App.css'

function App() {
  return <Chat />
}

export default App
```

**File:** `agent_loop_server/frontend/src/App.css`

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  width: 100%;
  height: 100vh;
}
```

**File:** `agent_loop_server/frontend/.env.example`

```bash
# Backend WebSocket URL
VITE_WS_URL=ws://localhost:8000/ws
```

**File:** `agent_loop_server/frontend/.env`

```bash
VITE_WS_URL=ws://localhost:8000/ws
```

### Success Criteria

```bash
# Terminal 1: Start backend
uv run python -m agent_loop_server

# Terminal 2: Start frontend
cd agent_loop_server/frontend
npm run dev

# Open browser to http://localhost:5173
# Test streaming:
#   1. Type: "What files are in the current directory?"
#   2. Verify you see:
#      - User message appears
#      - Agent thinking appears
#      - Tool call appears with FileRead
#      - Tool result appears with file list
#      - Agent message appears with summary
```

---

## Phase 4: Integration Testing & Polish

### Integration Tests

**File:** `agent_loop_server/tests/test_integration.py` (new file)

```python
"""Integration tests that run the full stack."""

import pytest
import subprocess
import time
import requests
from pathlib import Path


@pytest.fixture(scope="module")
def server_running():
    """Start server for integration tests."""
    # Start server in background
    process = subprocess.Popen(
        ["uv", "run", "python", "-m", "agent_loop_server"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # Wait for server to start
    for _ in range(10):
        try:
            response = requests.get("http://localhost:8000/api/health")
            if response.status_code == 200:
                break
        except requests.ConnectionError:
            time.sleep(0.5)

    yield

    # Shutdown server
    process.terminate()
    process.wait()


def test_health_endpoint(server_running):
    """Test health endpoint is accessible."""
    response = requests.get("http://localhost:8000/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_config_endpoint(server_running):
    """Test config endpoint returns settings."""
    response = requests.get("http://localhost:8000/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "max_iterations" in data
    assert "working_dir" in data
```

### Documentation

**File:** `agent_loop_server/README.md` (new file)

```markdown
# Agent Loop Server

Web-based AI agent with tool execution and real-time streaming.

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your OpenAI API key
nano .env
```

### 2. Install Dependencies

```bash
# Install Node dependencies (for BAML CLI)
npm install

# Install Python dependencies
uv sync

# Generate BAML client
npx baml-cli generate
```

### 3. Run Development Stack

**Terminal 1 - Backend:**
```bash
uv run python -m agent_loop_server
```

**Terminal 2 - Frontend:**
```bash
cd agent_loop_server/frontend
npm run dev
```

**Terminal 3 - Tests:**
```bash
uv run pytest agent_loop_server/tests -v
```

### 4. Open Browser

Navigate to http://localhost:5173

## Architecture

- **Backend**: FastAPI + BAML + WebSocket streaming
- **Frontend**: React + TypeScript + Vite
- **Tools**: File operations, Git, Pytest runner

## Event Flow

1. User sends message via WebSocket
2. Backend spawns agent in thread pool
3. Agent calls BAML (sync) which calls OpenAI
4. Agent executes tools and pushes events to queue
5. Async loop polls queue and broadcasts to frontend
6. Frontend displays events in real-time

## Available Tools

- **FileRead**: Read file contents
- **FileWrite**: Write file (creates dirs if needed)
- **GitStatus**: Get git status
- **RunTests**: Run pytest on path

## Security

- Path traversal protection (files stay in working_dir)
- API key loaded from .env (not committed)
- CORS restricted to frontend URL

## Development

```bash
# Run tests
uv run pytest -v

# Run specific test file
uv run pytest agent_loop_server/tests/test_tools.py -v

# Regenerate BAML client after schema changes
npx baml-cli generate
```
```

### Success Criteria

```bash
# All tests pass
uv run pytest agent_loop_server/tests -v

# Integration tests pass
uv run pytest agent_loop_server/tests/test_integration.py -v

# Full stack runs without errors
# - Backend starts on :8000
# - Frontend starts on :5173
# - WebSocket connects successfully
# - Agent can execute all tools
# - Events stream in real-time
```

---

## Summary of Improvements from v2

| Issue | Solution |
|-------|----------|
| Async/sync boundary bug | Thread-safe Queue + polling in async loop |
| Missing API key config | .env file with OPENAI_API_KEY |
| Incomplete agent loop | Full BAML integration with iteration logic |
| Path traversal security | Path validation in ToolExecutor |
| Message schema mismatch | Shared event schema (events.py + types/events.ts) |
| No message history | conversation_history list in agent |
| Unclear BAML setup | Complete setup with config and generation |
| Missing error handling | Try/catch throughout with error events |
| Unclear install order | Phase 0 with numbered steps |
| Weak tests | Integration tests + full coverage |

---

## Development Workflow

### Running the Full Stack

```bash
# Terminal 1: Backend
uv run python -m agent_loop_server

# Terminal 2: Frontend
cd agent_loop_server/frontend && npm run dev

# Browser
open http://localhost:5173
```

### Running Tests

```bash
# All tests
uv run pytest -v

# Specific test file
uv run pytest agent_loop_server/tests/test_agent.py -v

# With coverage
uv run pytest --cov=agent_loop_server
```

### Regenerating BAML Client

```bash
# After editing baml_src/agent.baml
npx baml-cli generate

# Verify generation
ls agent_loop_server/baml_client/
```

---

## Next Steps

1. ✅ Review this plan
2. ✅ Approve or request changes
3. Create beads issues for each phase:
   - `bd create --title="Phase 0: Environment Setup" --type=task`
   - `bd create --title="Phase 1: BAML Agent Foundation" --type=feature`
   - `bd create --title="Phase 2: FastAPI WebSocket Server" --type=feature`
   - `bd create --title="Phase 3: React Frontend" --type=feature`
   - `bd create --title="Phase 4: Integration Testing" --type=task`
4. Start Phase 0 with environment setup
