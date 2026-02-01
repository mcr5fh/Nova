"""FastAPI server for agent loop.

Implements server to satisfy test_server.py.
FULLY ASYNC STREAMING - no threads, no queues, just clean async/await.
NO STATIC FILE SERVING (separate Vite dev server).
"""

import os
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Set, List, Dict, Any
from pydantic import BaseModel
from dotenv import load_dotenv

from .agent import AgentLoopRunner
from .events import UserMessageEvent, ErrorEvent
from .baml_client import b
from .baml_client.types import Message, MessageRole

# Load environment variables
load_dotenv()


class ConnectionManager:
    """Manages WebSocket connections with async event broadcasting."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.session_agents: dict[str, AgentLoopRunner] = {}

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

    def get_session_agent(self, session_id: str, on_event) -> AgentLoopRunner:
        """Get or create an agent for a logical session."""
        agent = self.session_agents.get(session_id)
        if agent is None:
            agent = AgentLoopRunner(
                working_dir=".",
                on_event=on_event,
                session_id=session_id,
            )
            self.session_agents[session_id] = agent
        else:
            agent.on_event = on_event
        return agent


manager = ConnectionManager()


# Request/Response models for diagram generation
class DiagramGenerateRequest(BaseModel):
    """Request body for diagram generation."""
    messages: List[Dict[str, str]]  # List of {role: str, content: str}
    context: str


class DiagramGenerateResponse(BaseModel):
    """Response body for diagram generation."""
    flow: str
    erd: str
    system_arch: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan events for FastAPI app."""
    print("=" * 60)
    print("Agent Loop Server starting")
    print("=" * 60)
    print(f"Backend: http://localhost:{os.getenv('AGENT_LOOP_PORT', 8001)}")
    print(f"WebSocket: ws://localhost:{os.getenv('AGENT_LOOP_PORT', 8001)}/ws")
    print()
    print("NOTE: Run Vite dev server separately for frontend:")
    print("  cd agent_loop_server/frontend && npm run dev")
    print("=" * 60)
    yield
    print("\nAgent Loop Server shutting down...")


app = FastAPI(title="Agent Loop Server", lifespan=lifespan)

# CORS middleware (allow Vite dev server and CLI clients to connect)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development (CLI + browser)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for chat with streaming.

    Fully async - agent runs with await, events broadcast directly.
    """
    await manager.connect(websocket)

    # Create event callback that broadcasts to all clients
    async def on_event(event):
        """Broadcast agent events in real-time."""
        await manager.broadcast(event.to_dict())

    # Default agent (per-connection, non-persistent across reconnects)
    default_agent = AgentLoopRunner(
        working_dir=".",
        on_event=on_event,
    )

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "chat":
                user_message = data.get("message", "").strip()
                session_id = (data.get("session_id") or "").strip()

                if not user_message:
                    await manager.broadcast(
                        ErrorEvent(error="Empty message received").to_dict()
                    )
                    continue

                # Broadcast user message
                await manager.broadcast(
                    UserMessageEvent(message=user_message).to_dict()
                )

                # Run agent (fully async - no threads!)
                if session_id:
                    agent = manager.get_session_agent(session_id, on_event)
                else:
                    agent = default_agent
                await agent.run(user_message)

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


@app.post("/api/diagram/generate", response_model=DiagramGenerateResponse)
async def generate_diagrams(request: DiagramGenerateRequest):
    """Generate Mermaid diagrams based on conversation context.

    Accepts a list of messages and context string, returns three types of diagrams:
    - flow: Flowchart showing process flow
    - erd: Entity Relationship Diagram showing data models
    - system_arch: System architecture diagram showing components

    Args:
        request: DiagramGenerateRequest with messages and context

    Returns:
        DiagramGenerateResponse with three Mermaid diagram strings

    Raises:
        HTTPException: If diagram generation fails
    """
    try:
        # Convert request messages to BAML Message objects
        baml_messages = []
        for msg in request.messages:
            role_str = msg.get("role", "").lower()
            content = msg.get("content", "")

            # Map role string to MessageRole enum
            if role_str == "user":
                role = MessageRole.User
            elif role_str == "assistant":
                role = MessageRole.Assistant
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid message role: {role_str}. Must be 'user' or 'assistant'"
                )

            baml_messages.append(Message(role=role, content=content))

        # Call BAML function to generate diagrams
        result = await b.GenerateMermaidDiagrams(
            messages=baml_messages,
            context=request.context
        )

        # Return the generated diagrams
        return DiagramGenerateResponse(
            flow=result.flow,
            erd=result.erd,
            system_arch=result.system_arch
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        # Catch all other exceptions and return 500
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate diagrams: {str(e)}"
        )
