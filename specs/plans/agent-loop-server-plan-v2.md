# Agent Loop Server - Implementation Plan (v2)

> **Changes from v1:**
> - Streaming is part of MVP (not Phase 4)
> - TDD approach: tests written before/alongside implementation
> - Fixed frontend architecture: separate dev servers (Vite + FastAPI)
> - Removed static file serving from development setup

## Overview

Build a web-based agent loop server using BAML framework for agent orchestration. The system enables developers to interact with an AI agent via chat interface, where the agent autonomously uses tools (both direct Python functions and proxied Claude CLI calls) to accomplish tasks.

**Key MVP Requirements:**
- ✅ Streaming agent activity (tool calls, results) in real-time
- ✅ React frontend with separate dev server (Vite)
- ✅ TDD approach: tests drive implementation
- ✅ WebSocket communication between frontend and backend

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
└─────────────────────┘         └──────────────────────┘
```

**No static file serving during development.** Frontend and backend run as separate processes.

---

## Phase 1: BAML Agent Foundation (TDD)

### Test-First Approach

**Create test structure first:**

**File:** `agent_loop_server/test_tools.py` (new file)

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
        return str(tmp_path)

    @pytest.fixture
    def executor(self, temp_dir):
        return ToolExecutor(working_dir=temp_dir)

    def test_file_read(self, executor, temp_dir):
        """Test FileRead tool."""
        test_file = Path(temp_dir) / "test.txt"
        test_file.write_text("Hello World")

        result = executor.execute("FileRead", '{"path": "test.txt"}')
        assert result == "Hello World"

    def test_file_write(self, executor, temp_dir):
        """Test FileWrite tool."""
        result = executor.execute(
            "FileWrite",
            '{"path": "new.txt", "content": "Test content"}'
        )

        assert "Wrote" in result
        assert (Path(temp_dir) / "new.txt").read_text() == "Test content"

    def test_unknown_tool(self, executor):
        """Test unknown tool returns error."""
        result = executor.execute("UnknownTool", '{}')
        assert "Error: Unknown tool" in result

    def test_invalid_json_args(self, executor):
        """Test invalid JSON args returns error."""
        result = executor.execute("FileRead", 'invalid json')
        assert "Error" in result
```

**File:** `agent_loop_server/test_agent.py` (new file)

```python
"""Tests for agent loop.

Write these tests FIRST to define the agent interface.
Then implement agent.py to make them pass.
"""

import pytest
from unittest.mock import Mock, patch

from agent_loop_server.agent import AgentLoopRunner


class TestAgentLoopRunner:
    """Test agent loop execution."""

    @pytest.fixture
    def agent(self, tmp_path):
        """Create agent instance."""
        return AgentLoopRunner(working_dir=str(tmp_path))

    def test_init(self, agent, tmp_path):
        """Test agent initialization."""
        assert agent.messages == []
        assert agent.on_event is None

    def test_streaming_callback(self, tmp_path):
        """Test agent calls callback on events."""
        events = []

        def on_event(event):
            events.append(event)

        agent = AgentLoopRunner(
            working_dir=str(tmp_path),
            on_event=on_event
        )

        # Agent should emit events via callback
        # (Implementation will make this pass)
        agent._emit_event("tool_call", {"tool_name": "FileRead"})

        assert len(events) == 1
        assert events[0]["type"] == "tool_call"
```

### Implementation

Now implement to make tests pass:

**File:** `agent_loop_server/tools.py` (new file)

```python
"""Tool execution for agent.

Implements tools to satisfy test_tools.py.
"""

import json
import subprocess
from pathlib import Path
from typing import Dict, Any


class ToolExecutor:
    """Executes tools called by the agent."""

    def __init__(self, working_dir: str = "."):
        self.working_dir = Path(working_dir).resolve()

    def execute(self, tool_name: str, args_json: str) -> str:
        """Execute a tool and return result."""
        try:
            args = json.loads(args_json)
        except json.JSONDecodeError as e:
            return f"Error: Invalid JSON in args: {str(e)}"

        handlers = {
            "FileRead": self._file_read,
            "FileWrite": self._file_write,
            "GitStatus": self._git_status,
            "RunTests": self._run_tests,
        }

        handler = handlers.get(tool_name)
        if not handler:
            return f"Error: Unknown tool '{tool_name}'"

        try:
            return handler(**args)
        except Exception as e:
            return f"Error executing {tool_name}: {str(e)}"

    def _file_read(self, path: str) -> str:
        """Read file contents."""
        file_path = self.working_dir / path
        return file_path.read_text()

    def _file_write(self, path: str, content: str) -> str:
        """Write file contents."""
        file_path = self.working_dir / path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content)
        return f"Wrote {len(content)} bytes to {path}"

    def _git_status(self) -> str:
        """Get git status."""
        result = subprocess.run(
            ["git", "status", "--short"],
            cwd=str(self.working_dir),
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.stdout or "No changes"

    def _run_tests(self, path: str = ".") -> str:
        """Run pytest on path."""
        result = subprocess.run(
            ["uv", "run", "pytest", path, "-v"],
            cwd=str(self.working_dir),
            capture_output=True,
            text=True,
            timeout=60
        )
        return f"Exit code: {result.returncode}\n\n{result.stdout}\n{result.stderr}"
```

**File:** `agent_loop_server/agent.py` (new file)

```python
"""Agent loop orchestration using BAML.

Implements agent to satisfy test_agent.py.
WITH STREAMING SUPPORT FROM THE START.
"""

from typing import List, Callable, Optional
from pathlib import Path

# Note: BAML imports will be added after BAML setup
# from baml_client import b
# from baml_client.types import Message, AgentResponse

from .tools import ToolExecutor


class AgentLoopRunner:
    """Runs the BAML agent loop with tool execution and streaming."""

    def __init__(
        self,
        working_dir: str = ".",
        on_event: Optional[Callable[[dict], None]] = None
    ):
        """Initialize agent loop.

        Args:
            working_dir: Directory where agent operates
            on_event: Callback for streaming events (tool_call, tool_result)
        """
        self.working_dir = Path(working_dir).resolve()
        self.messages: List = []  # Will be List[Message] after BAML setup
        self.tool_executor = ToolExecutor(working_dir=str(self.working_dir))
        self.on_event = on_event

    def _emit_event(self, event_type: str, data: dict):
        """Emit event via callback for streaming."""
        if self.on_event:
            self.on_event({"type": event_type, **data})

    def run(self, user_message: str, max_iterations: int = 10) -> str:
        """Run agent loop for a user message.

        Streams events via on_event callback as agent works.

        Returns:
            Agent's final response message
        """
        # Implementation will call BAML agent in loop
        # and emit events for each tool call/result

        # Placeholder for now (will implement after BAML setup)
        return "Agent loop not yet implemented"
```

### BAML Setup

**Install dependencies:**

```toml
# pyproject.toml
dependencies = [
    # ... existing ...
    "baml-py>=0.50.0",
]
```

```json
// package.json (create in project root)
{
  "name": "nova-agent-loop",
  "version": "0.1.0",
  "scripts": {
    "baml": "baml-cli"
  },
  "devDependencies": {
    "@boundaryml/baml": "^0.50.0"
  }
}
```

**Commands:**
```bash
npm install
uv pip install baml-py
```

**BAML Agent Definition:**

**File:** `baml_src/agent.baml` (new file)

```baml
// Message structure for conversation history
class Message {
  role "user" | "assistant" | "tool"
  content string
  tool_call_id string?
  tool_name string?
}

// Tool definitions
enum ToolName {
  FileRead
  FileWrite
  GitStatus
  RunTests
}

// Tool call structure
class ToolCall {
  tool ToolName
  args string  // JSON string of arguments
}

// Agent can either call a tool or reply to user
class AgentResponse {
  type "tool_call" | "reply"
  tool_call ToolCall?
  message string?
}

// Main agent loop function
function AgentLoop(
  messages: Message[],
  working_dir: string
) -> AgentResponse {
  client "openai/gpt-4o"

  prompt #"
    You are an AI coding agent helping developers accomplish tasks.

    Working directory: {{ working_dir }}

    You have access to these tools:
    - FileRead(path: str) -> str: Read file contents
    - FileWrite(path: str, content: str) -> str: Write file contents
    - GitStatus() -> str: Check git status
    - RunTests(path: str) -> str: Run pytest on path

    Execute ONE tool at a time (no parallel execution).
    After using a tool, wait for the result before deciding next action.
    When task is complete, respond with type="reply".

    Conversation history:
    {% for msg in messages %}
    {{ msg.role }}: {{ msg.content }}
    {% endfor %}

    What do you want to do next?

    Respond in this format:
    {
      "type": "tool_call" | "reply",
      "tool_call": {
        "tool": "ToolName",
        "args": "{\"arg1\": \"value1\"}"
      },
      "message": "Your response to user"
    }
  "#
}
```

**Generate BAML client:**
```bash
npx baml-cli generate
```

### Success Criteria

```bash
# Tests should pass
uv run pytest agent_loop_server/test_tools.py -v
uv run pytest agent_loop_server/test_agent.py -v
```

---

## Phase 2: FastAPI WebSocket Server (TDD + Streaming)

### Test-First Approach

**File:** `agent_loop_server/test_server.py` (new file)

```python
"""Tests for FastAPI server.

Write these tests FIRST to define the server interface.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock, AsyncMock

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
    def test_websocket_streaming(self, mock_agent_class, client):
        """Test WebSocket streams agent events in real-time."""
        # Mock agent that emits events via callback
        mock_agent = Mock()

        def mock_run(user_message):
            # Simulate agent emitting events during execution
            if mock_agent.on_event:
                mock_agent.on_event({"type": "tool_call", "tool_name": "FileRead"})
                mock_agent.on_event({"type": "tool_result", "result": "contents"})
            return "Done"

        mock_agent.run.side_effect = mock_run
        mock_agent_class.return_value = mock_agent

        with client.websocket_connect("/ws") as websocket:
            # Send chat message
            websocket.send_json({
                "type": "chat",
                "message": "Read file"
            })

            # Should receive user message echo
            data1 = websocket.receive_json()
            assert data1["type"] == "user_message"

            # Should receive streaming tool call
            data2 = websocket.receive_json()
            assert data2["type"] == "tool_call"

            # Should receive streaming tool result
            data3 = websocket.receive_json()
            assert data3["type"] == "tool_result"

            # Should receive final agent message
            data4 = websocket.receive_json()
            assert data4["type"] == "agent_message"
```

### Implementation

**File:** `agent_loop_server/server.py` (new file)

```python
"""FastAPI server for agent loop.

Implements server to satisfy test_server.py.
WITH STREAMING SUPPORT.
NO STATIC FILE SERVING (separate Vite dev server).
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from typing import Set

from .agent import AgentLoopRunner


class ConnectionManager:
    """Manages WebSocket connections."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        """Send message to all connected clients."""
        dead_connections = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                dead_connections.add(connection)
        self.active_connections -= dead_connections


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for FastAPI app."""
    print("Agent Loop Server starting on http://localhost:8000")
    print("WebSocket endpoint: ws://localhost:8000/ws")
    print("\nNOTE: Run Vite dev server separately for frontend:")
    print("  cd agent_loop_server/frontend && npm run dev")
    yield
    print("Agent Loop Server shutting down...")


app = FastAPI(title="Agent Loop Server", lifespan=lifespan)

# CORS middleware (allow Vite dev server to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for chat with streaming."""
    await manager.connect(websocket)

    # Event callback for streaming agent events
    async def on_agent_event(event: dict):
        """Broadcast agent events to all clients in real-time."""
        await manager.broadcast(event)

    # Create agent runner with streaming callback
    agent = AgentLoopRunner(
        working_dir=".",
        on_event=lambda e: asyncio.create_task(on_agent_event(e))
    )

    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "chat":
                user_message = data.get("message")

                # Broadcast user message
                await manager.broadcast({
                    "type": "user_message",
                    "message": user_message
                })

                # Run agent in background thread
                # Events will stream via on_event callback
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    agent.run,
                    user_message
                )

                # Broadcast final response
                await manager.broadcast({
                    "type": "agent_message",
                    "message": response
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
```

**File:** `agent_loop_server/__main__.py` (new file)

```python
"""Entry point for agent loop server."""

import uvicorn


def main():
    """Run the server."""
    uvicorn.run(
        "agent_loop_server.server:app",
        host="0.0.0.0",
        port=8000,
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
# Start server
uv run python -m agent_loop_server

# In another terminal
curl http://localhost:8000/api/health

# Tests pass
uv run pytest agent_loop_server/test_server.py -v
```

---

## Phase 3: React Frontend (TDD)

### Test-First Approach

Since frontend tests are more complex, we'll use a pragmatic TDD approach:
1. Define component interfaces and types first
2. Build components
3. Manual testing + automated tests for critical paths

### Setup

```bash
# Create Vite React TypeScript project
cd agent_loop_server
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### Implementation

**File:** `agent_loop_server/frontend/src/hooks/useWebSocket.ts` (new file)

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

// Define message types (interface-first TDD)
interface Message {
  type: 'user_message' | 'agent_message' | 'tool_call' | 'tool_result';
  message?: string;
  tool_name?: string;
  tool_args?: string;
  tool_result?: string;
}

export function useWebSocket(url: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prev) => [...prev, data]);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [url]);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        message,
      }));
    }
  }, []);

  return { messages, isConnected, sendMessage };
}
```

**File:** `agent_loop_server/frontend/src/components/Chat.tsx` (new file)

```typescript
import { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import './Chat.css';

export function Chat() {
  const { messages, isConnected, sendMessage } = useWebSocket('ws://localhost:8000/ws');
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
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Agent Loop Chat</h1>
        <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </div>
      </div>

      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.type}`}>
            {msg.type === 'user_message' && (
              <div className="user-message">
                <strong>You:</strong> {msg.message}
              </div>
            )}
            {msg.type === 'agent_message' && (
              <div className="agent-message">
                <strong>Agent:</strong> {msg.message}
              </div>
            )}
            {msg.type === 'tool_call' && (
              <div className="tool-call">
                <strong>🔧 Tool Call:</strong> {msg.tool_name}
                {msg.tool_args && <pre>{msg.tool_args}</pre>}
              </div>
            )}
            {msg.type === 'tool_result' && (
              <div className="tool-result">
                <strong>✓ Result:</strong>
                <pre>{msg.tool_result}</pre>
              </div>
            )}
          </div>
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
        <button type="submit" disabled={!isConnected}>
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
  max-width: 1000px;
  margin: 0 auto;
  background: #1e1e1e;
  color: #d4d4d4;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
}

.chat-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.status {
  font-size: 0.9rem;
}

.status.connected {
  color: #4ec9b0;
}

.status.disconnected {
  color: #f48771;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  padding: 0.75rem;
  border-radius: 8px;
}

.user-message {
  background: #264f78;
  align-self: flex-end;
  max-width: 70%;
}

.agent-message {
  background: #1e3a5f;
  align-self: flex-start;
  max-width: 70%;
}

.tool-call {
  background: #3a3a3c;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  border-left: 3px solid #4ec9b0;
}

.tool-result {
  background: #2d2d30;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  border-left: 3px solid #569cd6;
}

.tool-result pre,
.tool-call pre {
  margin: 0.5rem 0 0 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  background: #1a1a1a;
  padding: 0.5rem;
  border-radius: 4px;
}

.input-form {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: #252526;
  border-top: 1px solid #3e3e42;
}

.input-form input {
  flex: 1;
  padding: 0.75rem;
  background: #3c3c3c;
  border: 1px solid #555;
  border-radius: 4px;
  color: #d4d4d4;
  font-size: 1rem;
}

.input-form input:focus {
  outline: none;
  border-color: #007acc;
}

.input-form button {
  padding: 0.75rem 1.5rem;
  background: #007acc;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.input-form button:hover:not(:disabled) {
  background: #005a9e;
}

.input-form button:disabled {
  background: #555;
  cursor: not-allowed;
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

### Success Criteria

```bash
# Terminal 1: Start backend
uv run python -m agent_loop_server

# Terminal 2: Start frontend
cd agent_loop_server/frontend
npm run dev

# Open browser to http://localhost:5173
# Test streaming:
#   - Send: "What files are in the current directory?"
#   - Verify you see tool calls and results appear in real-time
```

---

## Production Build (Future)

When ready for production:

```bash
# Build frontend
cd agent_loop_server/frontend
npm run build

# This creates agent_loop_server/frontend/dist/
# Then you can serve from FastAPI or nginx
```

But for development MVP, keep servers separate.

---

## Summary of Changes from v1

| Change | Reason |
|--------|--------|
| Streaming in Phases 1-2 (not 4) | MVP requirement |
| Removed static file serving | Development uses separate Vite server |
| Tests in each phase | TDD approach |
| Simplified Phase 4 | Now just "polish and edge cases" |
| Added CORS config | Allow Vite dev server to connect |
| Callback support from start | Streaming is core to MVP |

---

## Development Workflow

**Running the full stack:**

```bash
# Terminal 1: Backend server
uv run python -m agent_loop_server

# Terminal 2: Frontend dev server
cd agent_loop_server/frontend
npm run dev

# Browser: http://localhost:5173
# Backend API: http://localhost:8000
# WebSocket: ws://localhost:8000/ws
```

**Running tests:**

```bash
# Backend tests
uv run pytest agent_loop_server -v

# Frontend tests (add later with Vitest)
cd agent_loop_server/frontend
npm run test
```

---

## Next Steps

1. Review this plan
2. Approve or request changes
3. Create beads issues for each phase
4. Start Phase 1 with TDD approach
