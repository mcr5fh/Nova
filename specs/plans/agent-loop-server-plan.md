# Agent Loop Server - Implementation Plan

> Generated from: `specs/solutions/ai-orchaestration-command-center.md`
> Inspired by: https://github.com/ai-that-works/ai-that-works/blob/main/2025-10-21-agentic-rag-context-engineering/

## Overview

Build a web-based agent loop server using BAML framework for agent orchestration. The system enables developers to interact with an AI agent via chat interface, where the agent autonomously uses tools (both direct Python functions and proxied Claude CLI calls) to accomplish tasks.

## Solution Spec Reference

**Summary:** Web-based command center for AI agent task execution with real-time monitoring
**Success Criteria:**
- Agent executes tasks autonomously via tool calling
- Real-time visibility into agent actions via web UI
- Tools include both direct operations and proxied `claude -p` calls

**Scope:**
- IN: Chat interface, BAML agent loop, tool execution, WebSocket streaming
- OUT: Intervention handling, plan validation, PR automation (future phases)

## Current State Analysis

### Key Discoveries:

**Existing Infrastructure:**
- FastAPI backend pattern: `program_nova/dashboard/server.py`
- WebSocket pattern: `web-voice-planner/server/src/websocket.ts` (Node.js)
- Subprocess management: `program_nova/engine/worker.py` (spawns `claude` CLI)
- State management: `program_nova/engine/state.py` (fcntl-locked JSON)

**Testing Patterns:**
- Pytest with colocated tests: `module.py` → `test_module.py`
- Fixture-based setup with `tmp_path`
- FastAPI TestClient for API testing

**No existing BAML infrastructure** - we're adding this fresh.

## Desired End State

**Developer experience:**
1. Start server: `uv run python -m agent_loop_server`
2. Open web UI: `http://localhost:8000`
3. Chat with agent: "Implement authentication for the API"
4. Agent uses tools autonomously (FileRead, CodeImplementation, RunTests)
5. Watch real-time tool calls and responses in chat UI
6. Agent completes task and reports results

**Verification:**
- Server accepts WebSocket connections
- Agent loop processes messages and calls tools
- Tool calls execute (both direct and proxy to `claude -p`)
- Frontend displays chat history with tool calls
- All tests pass: `uv run pytest agent_loop_server -v`

## What We're NOT Doing

- Full implementation plan orchestration (future phase)
- PR creation automation (future phase)
- Intervention handling / human-in-the-loop (future phase)
- Voice interface (out of scope)
- Multi-user support (single-user MVP)

## Implementation Approach

**Architecture Pattern:** BAML agent loop (like `ai-that-works` repo)

```
Frontend (React) ←WebSocket→ FastAPI Server ←calls→ BAML Agent
                                                        ↓
                                                    Tools:
                                                    - FileRead
                                                    - FileWrite
                                                    - CodeImplementation (claude -p)
                                                    - RunTests
```

**Key Technologies:**
- **BAML**: Agent definition and LLM orchestration
- **FastAPI**: WebSocket server
- **React**: Chat UI
- **subprocess**: Execute `claude -p` for proxy tools

---

## Phase 1: BAML Agent Foundation

### Overview
Set up BAML framework, define agent structure, and implement basic agent loop in Python.

### Changes Required:

#### 1. Install BAML and Dependencies

**File**: `pyproject.toml`

**Changes**: Add BAML dependencies

```toml
dependencies = [
    # ... existing dependencies ...
    "baml-py>=0.50.0",      # BAML Python client
]
```

**File**: `package.json` (create in project root)

**Changes**: BAML requires Node.js for code generation

```json
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

**Commands to run:**
```bash
npm install
uv pip install baml-py
```

#### 2. Create BAML Agent Definition

**File**: `baml_src/agent.baml` (new file)

**Changes**: Define agent loop, tools, and message types

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
  CodeImplementation
  RunTests
  GitStatus
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
    - CodeImplementation(task: str, files: list[str]) -> str: Implement code using Claude CLI
    - RunTests(path: str) -> str: Run pytest on path
    - GitStatus() -> str: Check git status

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

#### 3. Generate BAML Client

**Command to run:**
```bash
npx baml-cli generate
```

This creates `baml_client/` directory with Python bindings.

#### 4. Create Python Agent Loop Runner

**File**: `agent_loop_server/agent.py` (new file)

**Changes**: Implement agent loop pattern from `ai-that-works` repo

```python
"""Agent loop orchestration using BAML.

Responsibilities:
- Maintain conversation state (messages)
- Call BAML agent in loop
- Execute tools based on agent decisions
- Return final response when agent replies
"""

from typing import List, Dict, Any, Optional
import json
from pathlib import Path

from baml_client import b
from baml_client.types import Message, AgentResponse

from .tools import ToolExecutor


class AgentLoopRunner:
    """Runs the BAML agent loop with tool execution."""

    def __init__(self, working_dir: str = "."):
        """Initialize agent loop.

        Args:
            working_dir: Directory where agent operates (for file operations)
        """
        self.working_dir = Path(working_dir).resolve()
        self.messages: List[Message] = []
        self.tool_executor = ToolExecutor(working_dir=str(self.working_dir))

    def run(self, user_message: str, max_iterations: int = 10) -> str:
        """Run agent loop for a user message.

        Args:
            user_message: User's request
            max_iterations: Max tool calls before stopping (prevents infinite loops)

        Returns:
            Agent's final response message
        """
        # Add user message to history
        self.messages.append(Message(
            role="user",
            content=user_message
        ))

        iteration = 0
        while iteration < max_iterations:
            iteration += 1

            # Call BAML agent
            response: AgentResponse = b.AgentLoop(
                messages=self.messages,
                working_dir=str(self.working_dir)
            )

            if response.type == "reply":
                # Agent is done
                self.messages.append(Message(
                    role="assistant",
                    content=response.message
                ))
                return response.message

            elif response.type == "tool_call":
                # Execute tool
                tool_call = response.tool_call

                # Add tool call to messages
                self.messages.append(Message(
                    role="assistant",
                    content=f"Calling {tool_call.tool}",
                    tool_name=tool_call.tool,
                    tool_call_id=f"call_{iteration}"
                ))

                # Execute the tool
                tool_result = self.tool_executor.execute(
                    tool_name=tool_call.tool,
                    args_json=tool_call.args
                )

                # Add tool result to messages
                self.messages.append(Message(
                    role="tool",
                    content=tool_result,
                    tool_call_id=f"call_{iteration}"
                ))

        # Max iterations reached
        return "Agent exceeded maximum iterations. Please try a simpler request."
```

#### 5. Create Tool Executor

**File**: `agent_loop_server/tools.py` (new file)

**Changes**: Implement tool execution (direct + proxy)

```python
"""Tool execution for agent.

Responsibilities:
- Execute direct tools (FileRead, FileWrite, RunTests, GitStatus)
- Execute proxy tools (CodeImplementation via claude -p)
- Return tool results as strings
"""

import json
import subprocess
from pathlib import Path
from typing import Dict, Any


class ToolExecutor:
    """Executes tools called by the agent."""

    def __init__(self, working_dir: str = "."):
        """Initialize tool executor.

        Args:
            working_dir: Directory for file operations
        """
        self.working_dir = Path(working_dir).resolve()

    def execute(self, tool_name: str, args_json: str) -> str:
        """Execute a tool and return result.

        Args:
            tool_name: Name of tool to execute
            args_json: JSON string of tool arguments

        Returns:
            Tool result as string
        """
        args = json.loads(args_json)

        # Map tool name to handler
        handlers = {
            "FileRead": self._file_read,
            "FileWrite": self._file_write,
            "CodeImplementation": self._code_implementation,
            "RunTests": self._run_tests,
            "GitStatus": self._git_status,
        }

        handler = handlers.get(tool_name)
        if not handler:
            return f"Error: Unknown tool '{tool_name}'"

        try:
            return handler(**args)
        except Exception as e:
            return f"Error executing {tool_name}: {str(e)}"

    # Direct tools (Python implementations)

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

    def _run_tests(self, path: str = "agent_loop_server") -> str:
        """Run pytest on path."""
        result = subprocess.run(
            ["uv", "run", "pytest", path, "-v"],
            cwd=str(self.working_dir),
            capture_output=True,
            text=True,
            timeout=60
        )
        return f"Exit code: {result.returncode}\n\n{result.stdout}\n{result.stderr}"

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

    # Proxy tools (delegate to claude -p)

    def _code_implementation(self, task: str, files: list) -> str:
        """Implement code via Claude CLI.

        Args:
            task: Description of what to implement
            files: List of files to modify

        Returns:
            Claude's response
        """
        prompt = f"Implement the following:\n\nTask: {task}\n\nFiles to modify: {', '.join(files)}"

        result = subprocess.run(
            [
                "claude",
                "-p", prompt,
                "--model", "sonnet",
                "--dangerously-skip-permissions",
                "--output-format", "json"
            ],
            cwd=str(self.working_dir),
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout for code implementation
        )

        if result.returncode != 0:
            return f"Error: Claude CLI failed with exit code {result.returncode}\n{result.stderr}"

        return result.stdout
```

### Success Criteria:

#### Automated Verification:
- [ ] BAML client generates successfully: `npx baml-cli generate`
- [ ] Python can import BAML client: `python -c "from baml_client import b"`
- [ ] Unit tests pass: `uv run pytest agent_loop_server/test_agent.py -v`

#### Manual Testing:
```python
from agent_loop_server.agent import AgentLoopRunner

runner = AgentLoopRunner()
response = runner.run("What files are in the current directory?")
print(response)  # Should see agent use FileRead or similar tool
```

---

## Phase 2: FastAPI WebSocket Server

### Overview
Create FastAPI backend with WebSocket support for real-time agent communication.

### Changes Required:

#### 1. Create FastAPI Server

**File**: `agent_loop_server/server.py` (new file)

**Changes**: FastAPI app with WebSocket endpoint

```python
"""FastAPI server for agent loop.

Responsibilities:
- WebSocket endpoint for chat
- Run agent loop in background
- Broadcast agent activity to connected clients
- Serve static frontend files
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import json
from typing import Dict, Set
from pathlib import Path

from .agent import AgentLoopRunner


# WebSocket connection manager
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

        # Clean up dead connections
        self.active_connections -= dead_connections


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for FastAPI app."""
    # Startup
    print("Agent Loop Server starting...")
    yield
    # Shutdown
    print("Agent Loop Server shutting down...")


app = FastAPI(title="Agent Loop Server", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for chat."""
    await manager.connect(websocket)

    # Create agent runner
    agent = AgentLoopRunner(working_dir=".")

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()

            message_type = data.get("type")

            if message_type == "chat":
                user_message = data.get("message")

                # Echo user message to all clients
                await manager.broadcast({
                    "type": "user_message",
                    "message": user_message
                })

                # Run agent loop in thread pool executor
                # Why executor? agent.run() is blocking (calls BAML, subprocess, etc.)
                # FastAPI is async, so we run blocking code in a thread pool
                # to avoid blocking the event loop and freezing other WebSocket clients

                # Phase 2 MVP: Run entire agent loop, get final response
                # Phase 4 upgrade: Add callbacks to stream intermediate steps

                # Get current event loop
                loop = asyncio.get_event_loop()

                # Run agent.run() in default ThreadPoolExecutor
                # - None = use default executor (ThreadPoolExecutor)
                # - agent.run = function to call in thread
                # - user_message = argument to agent.run()
                #
                # This runs in background thread while FastAPI event loop continues
                # serving other requests/WebSocket messages
                response = await loop.run_in_executor(
                    None,           # executor (None = default ThreadPoolExecutor)
                    agent.run,      # function to run in thread
                    user_message    # arg passed to agent.run()
                )

                # At this point, agent loop has completed:
                # - BAML called claude CLI multiple times
                # - Tools were executed (FileRead, CodeImplementation, etc.)
                # - Agent decided to send final reply
                # response = agent's final message to user

                # Send agent response
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


# Serve frontend static files
frontend_path = Path(__file__).parent / "frontend" / "dist"

if frontend_path.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_path / "assets")), name="assets")

    @app.get("/")
    async def serve_frontend():
        return FileResponse(str(frontend_path / "index.html"))
```

#### 2. Create Server Entry Point

**File**: `agent_loop_server/__main__.py` (new file)

**Changes**: Entry point to run server

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

#### 3. Create Package Init

**File**: `agent_loop_server/__init__.py` (new file)

**Changes**: Package exports

```python
"""Agent Loop Server - BAML-based chat agent with tools."""

__version__ = "0.1.0"

from .agent import AgentLoopRunner
from .tools import ToolExecutor

__all__ = ["AgentLoopRunner", "ToolExecutor"]
```

### Success Criteria:

#### Automated Verification:
- [ ] Server starts: `uv run python -m agent_loop_server`
- [ ] Health check works: `curl http://localhost:8000/api/health`
- [ ] WebSocket connects: Use `wscat -c ws://localhost:8000/ws`

#### Manual Testing:
```bash
# Terminal 1: Start server
uv run python -m agent_loop_server

# Terminal 2: Test WebSocket
echo '{"type":"chat","message":"What is 2+2?"}' | wscat -c ws://localhost:8000/ws
```

---

## Phase 3: React Chat Frontend

### Overview
Build React chat UI with WebSocket client for real-time agent interaction.

### Changes Required:

#### 1. Initialize React Project

**Commands to run:**
```bash
cd agent_loop_server
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

#### 2. Create WebSocket Hook

**File**: `agent_loop_server/frontend/src/hooks/useWebSocket.ts` (new file)

**Changes**: React hook for WebSocket connection

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';

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

#### 3. Create Chat Component

**File**: `agent_loop_server/frontend/src/components/Chat.tsx` (new file)

**Changes**: Chat UI component

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
                <strong>Tool Call:</strong> {msg.tool_name}({msg.tool_args})
              </div>
            )}
            {msg.type === 'tool_result' && (
              <div className="tool-result">
                <strong>Result:</strong> <pre>{msg.tool_result}</pre>
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

#### 4. Create Styles

**File**: `agent_loop_server/frontend/src/components/Chat.css` (new file)

**Changes**: Basic chat styling

```css
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
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
}

.tool-result {
  background: #2d2d30;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
}

.tool-result pre {
  margin: 0.5rem 0 0 0;
  white-space: pre-wrap;
  word-wrap: break-word;
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
}

.input-form button:hover:not(:disabled) {
  background: #005a9e;
}

.input-form button:disabled {
  background: #555;
  cursor: not-allowed;
}
```

#### 5. Update App Component

**File**: `agent_loop_server/frontend/src/App.tsx`

**Changes**: Replace default content with Chat component

```typescript
import { Chat } from './components/Chat'
import './App.css'

function App() {
  return <Chat />
}

export default App
```

#### 6. Update Global Styles

**File**: `agent_loop_server/frontend/src/App.css`

**Changes**: Dark theme global styles

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

#### 7. Build Script

**File**: `agent_loop_server/frontend/package.json`

**Changes**: Add build script

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Frontend builds: `cd agent_loop_server/frontend && npm run build`
- [ ] No TypeScript errors: `npm run build` exits with code 0

#### Manual Testing:
```bash
# Terminal 1: Start backend
uv run python -m agent_loop_server

# Terminal 2: Start frontend dev server
cd agent_loop_server/frontend
npm run dev

# Open browser to http://localhost:5173
# Test chat: "What is 2+2?"
# Verify messages appear
```

---

## Phase 4: Streaming Agent Activity

### Overview
Enhance agent loop to stream intermediate steps (tool calls, tool results) to WebSocket clients in real-time.

### Changes Required:

#### 1. Add Callback Support to Agent

**File**: `agent_loop_server/agent.py`

**Changes**: Add callback for streaming events

```python
from typing import Callable, Optional

class AgentLoopRunner:
    """Runs the BAML agent loop with tool execution."""

    def __init__(
        self,
        working_dir: str = ".",
        on_event: Optional[Callable[[dict], None]] = None
    ):
        """Initialize agent loop.

        Args:
            working_dir: Directory where agent operates
            on_event: Callback for streaming events (tool_call, tool_result, etc.)
        """
        self.working_dir = Path(working_dir).resolve()
        self.messages: List[Message] = []
        self.tool_executor = ToolExecutor(working_dir=str(self.working_dir))
        self.on_event = on_event

    def _emit_event(self, event_type: str, data: dict):
        """Emit event via callback."""
        if self.on_event:
            self.on_event({"type": event_type, **data})

    def run(self, user_message: str, max_iterations: int = 10) -> str:
        """Run agent loop for a user message."""
        # Add user message
        self.messages.append(Message(role="user", content=user_message))

        iteration = 0
        while iteration < max_iterations:
            iteration += 1

            # Call BAML agent
            response: AgentResponse = b.AgentLoop(
                messages=self.messages,
                working_dir=str(self.working_dir)
            )

            if response.type == "reply":
                # Agent is done
                self.messages.append(Message(role="assistant", content=response.message))
                return response.message

            elif response.type == "tool_call":
                tool_call = response.tool_call

                # Emit tool call event
                self._emit_event("tool_call", {
                    "tool_name": tool_call.tool,
                    "tool_args": tool_call.args
                })

                # Add to messages
                self.messages.append(Message(
                    role="assistant",
                    content=f"Calling {tool_call.tool}",
                    tool_name=tool_call.tool,
                    tool_call_id=f"call_{iteration}"
                ))

                # Execute tool
                tool_result = self.tool_executor.execute(
                    tool_name=tool_call.tool,
                    args_json=tool_call.args
                )

                # Emit tool result event
                self._emit_event("tool_result", {
                    "tool_name": tool_call.tool,
                    "tool_result": tool_result
                })

                # Add to messages
                self.messages.append(Message(
                    role="tool",
                    content=tool_result,
                    tool_call_id=f"call_{iteration}"
                ))

        return "Agent exceeded maximum iterations."
```

#### 2. Update Server to Use Callbacks

**File**: `agent_loop_server/server.py`

**Changes**: Wire up agent callbacks to WebSocket broadcast

```python
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for chat."""
    await manager.connect(websocket)

    # Event callback for agent
    async def on_agent_event(event: dict):
        """Broadcast agent events to all clients."""
        await manager.broadcast(event)

    # Create agent runner with callback
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

                # Run agent (events will stream via callback)
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(None, agent.run, user_message)

                # Broadcast final response
                await manager.broadcast({
                    "type": "agent_message",
                    "message": response
                })

    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

### Success Criteria:

#### Manual Testing:
```bash
# Start server
uv run python -m agent_loop_server

# Open frontend
# Send: "Read the file README.md"
# Verify you see:
#   - User message
#   - Tool call: FileRead(path="README.md")
#   - Tool result: <file contents>
#   - Agent message: "Here's what's in README.md: ..."
```

---

## Phase 5: Testing

### Overview
Add comprehensive tests for agent loop, tools, and server.

### Changes Required:

#### 1. Test Agent Loop

**File**: `agent_loop_server/test_agent.py` (new file)

**Changes**: Unit tests for agent loop

```python
"""Tests for agent loop."""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch

from agent_loop_server.agent import AgentLoopRunner
from baml_client.types import AgentResponse, ToolCall, Message


class TestAgentLoopRunner:
    """Test agent loop execution."""

    @pytest.fixture
    def temp_dir(self, tmp_path):
        """Create temporary working directory."""
        return str(tmp_path)

    @pytest.fixture
    def agent(self, temp_dir):
        """Create agent instance."""
        return AgentLoopRunner(working_dir=temp_dir)

    def test_init_creates_runner(self, agent, temp_dir):
        """Test agent initialization."""
        assert str(agent.working_dir) == str(Path(temp_dir).resolve())
        assert agent.messages == []

    @patch('agent_loop_server.agent.b.AgentLoop')
    def test_run_with_immediate_reply(self, mock_agent, agent):
        """Test agent that replies immediately without tools."""
        mock_agent.return_value = AgentResponse(
            type="reply",
            message="Hello!"
        )

        response = agent.run("Hi")

        assert response == "Hello!"
        assert len(agent.messages) == 2  # User + assistant
        assert agent.messages[0].role == "user"
        assert agent.messages[1].role == "assistant"

    @patch('agent_loop_server.agent.b.AgentLoop')
    def test_run_with_tool_call(self, mock_agent, agent, temp_dir):
        """Test agent using a tool."""
        # Create test file
        test_file = Path(temp_dir) / "test.txt"
        test_file.write_text("Hello World")

        # Mock agent responses
        mock_agent.side_effect = [
            # First call: agent decides to use FileRead
            AgentResponse(
                type="tool_call",
                tool_call=ToolCall(
                    tool="FileRead",
                    args='{"path": "test.txt"}'
                )
            ),
            # Second call: agent replies with result
            AgentResponse(
                type="reply",
                message="The file contains: Hello World"
            )
        ]

        response = agent.run("What's in test.txt?")

        assert "Hello World" in response
        assert mock_agent.call_count == 2
```

#### 2. Test Tools

**File**: `agent_loop_server/test_tools.py` (new file)

**Changes**: Unit tests for tool executor

```python
"""Tests for tool executor."""

import pytest
from pathlib import Path
from unittest.mock import patch, Mock
import subprocess

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
        # Create test file
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

    @patch('subprocess.run')
    def test_git_status(self, mock_run, executor):
        """Test GitStatus tool."""
        mock_run.return_value = Mock(
            stdout=" M file.txt\n",
            returncode=0
        )

        result = executor.execute("GitStatus", '{}')
        assert "M file.txt" in result

    @patch('subprocess.run')
    def test_code_implementation_proxy(self, mock_run, executor):
        """Test CodeImplementation proxies to claude CLI."""
        mock_run.return_value = Mock(
            stdout="Implementation complete",
            stderr="",
            returncode=0
        )

        result = executor.execute(
            "CodeImplementation",
            '{"task": "Add auth", "files": ["auth.py"]}'
        )

        # Verify claude CLI was called
        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        assert call_args[0] == "claude"
        assert "-p" in call_args
        assert "Add auth" in call_args[call_args.index("-p") + 1]
```

#### 3. Test Server

**File**: `agent_loop_server/test_server.py` (new file)

**Changes**: Integration tests for FastAPI server

```python
"""Tests for FastAPI server."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock

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
            # Connection successful
            assert websocket is not None

    @patch('agent_loop_server.server.AgentLoopRunner')
    def test_websocket_chat(self, mock_agent_class, client):
        """Test WebSocket chat flow."""
        # Mock agent
        mock_agent = Mock()
        mock_agent.run.return_value = "Agent response"
        mock_agent_class.return_value = mock_agent

        with client.websocket_connect("/ws") as websocket:
            # Send chat message
            websocket.send_json({
                "type": "chat",
                "message": "Hello"
            })

            # Receive echoed user message
            data1 = websocket.receive_json()
            assert data1["type"] == "user_message"
            assert data1["message"] == "Hello"

            # Receive agent response
            data2 = websocket.receive_json()
            assert data2["type"] == "agent_message"
            assert data2["message"] == "Agent response"
```

### Success Criteria:

#### Automated Verification:
- [ ] All tests pass: `uv run pytest agent_loop_server -v`
- [ ] Coverage > 80%: `uv run pytest agent_loop_server --cov=agent_loop_server`

---

## Edge Cases

| Scenario | Severity | Implementation Approach |
|----------|----------|------------------------|
| BAML agent exceeds max iterations | High | Return error message after 10 iterations, suggest simpler request |
| Tool execution timeout | High | Set timeout on subprocess calls (5min for claude, 1min for tests), return timeout error |
| WebSocket disconnect during agent run | Medium | Agent continues in background, result lost. Future: store in session state |
| File path outside working_dir | High | Validate paths are relative, reject absolute or .. paths |
| Claude CLI not installed | Critical | Check on startup, return helpful error with install instructions |
| Multiple clients send messages | Low | Each WebSocket gets own agent instance (isolated state) |
| Tool returns huge output | Medium | Truncate tool results to 10KB, add "... truncated" message |
| Invalid JSON in tool args | Medium | Catch JSON parse errors, return error to agent |

---

## Testing Strategy

### Unit Tests:
- `test_agent.py`: Agent loop logic, message handling, tool calling
- `test_tools.py`: Each tool (FileRead, FileWrite, CodeImplementation, etc.)
- `test_server.py`: FastAPI endpoints, WebSocket connection, message handling

### Integration Tests:
- End-to-end flow: User message → Agent → Tool execution → Response
- WebSocket message flow with real agent (not mocked)
- Frontend integration: Manual testing of full UI

### Manual Testing Checklist:
- [ ] Start server without errors
- [ ] WebSocket connects from frontend
- [ ] Send simple message, receive response
- [ ] Agent calls FileRead tool successfully
- [ ] Agent calls CodeImplementation (claude -p) successfully
- [ ] Tool call and result appear in UI
- [ ] Multiple messages in conversation
- [ ] Error handling (bad file path, etc.)

---

## Beads Issues to Create

After plan approval, create these issues:

```bash
bd create --title="Phase 1: BAML Agent Foundation" --type=task --priority=2
bd create --title="Phase 2: FastAPI WebSocket Server" --type=task --priority=2
bd create --title="Phase 3: React Chat Frontend" --type=task --priority=2
bd create --title="Phase 4: Streaming Agent Activity" --type=task --priority=2
bd create --title="Phase 5: Testing" --type=task --priority=2

# Add dependencies
bd dep add beads-002 beads-001  # Server depends on agent
bd dep add beads-003 beads-002  # Frontend depends on server
bd dep add beads-004 beads-003  # Streaming depends on frontend
bd dep add beads-005 beads-004  # Testing depends on streaming
```

---

## References

- Solution spec: `specs/solutions/ai-orchaestration-command-center.md`
- BAML pattern inspiration: https://github.com/ai-that-works/ai-that-works/blob/main/2025-10-21-agentic-rag-context-engineering/main.py
- Similar implementation (Nova orchestrator): `program_nova/engine/orchestrator.py:1`
- WebSocket pattern: `web-voice-planner/server/src/websocket.ts:1`
- Worker subprocess pattern: `program_nova/engine/worker.py:45`

---

## Post-Implementation Verification

After completing all phases:

1. **Smoke Test**:
   ```bash
   # Start server
   uv run python -m agent_loop_server

   # Open browser to http://localhost:8000
   # Send: "What files are in the current directory?"
   # Verify: Agent uses FileRead or GitStatus, shows results
   ```

2. **Full Workflow Test**:
   ```bash
   # Message: "Create a file called hello.txt with content 'Hello World'"
   # Verify: Agent uses FileWrite tool
   # Check: File exists with correct content

   # Message: "Read hello.txt"
   # Verify: Agent uses FileRead, shows content
   ```

3. **Proxy Tool Test**:
   ```bash
   # Message: "Implement a simple hello function in test.py"
   # Verify: Agent uses CodeImplementation (claude -p)
   # Check: File created with function
   ```

4. **Error Handling**:
   ```bash
   # Message: "Read nonexistent.txt"
   # Verify: Tool returns error, agent handles gracefully
   ```
