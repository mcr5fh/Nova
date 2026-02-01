# DiagramGenerator Implementation Summary

## Overview

Added `DiagramGenerator` class to `agent_loop_server/agent.py` that automatically generates Mermaid diagrams based on agent conversation history.

## Key Features

### 1. DiagramGenerator Class

**Location**: `agent_loop_server/agent.py`

**Capabilities**:
- Listens to `AgentMessageEvent` from the agent loop
- Accumulates conversation history (both user and assistant messages)
- Calls `/api/diagram/generate` endpoint with conversation context
- Broadcasts `DiagramUpdateEvent` via `ConnectionManager`
- Implements debouncing (max once per 5 seconds) to avoid API spam

**Key Methods**:
- `__init__(api_base_url, debounce_seconds, broadcast_callback)` - Initialize with configuration
- `handle_agent_message(event)` - Process incoming agent messages
- `add_user_message(message)` - Add user messages to history
- `_trigger_diagram_generation()` - Trigger generation with debouncing
- `_generate_diagrams()` - Call API and broadcast results
- `_build_context()` - Build context string from last 10 messages
- `clear_history()` - Clear conversation history

### 2. Integration with AgentLoopRunner

**Changes to `AgentLoopRunner`**:
- Added `diagram_generator` parameter to `__init__`
- Passes user messages to diagram generator
- Triggers diagram generation on `AgentMessageEvent`

**Location**: `agent_loop_server/agent.py:228-237, 367-374`

### 3. Integration with Server

**Changes to `ConnectionManager`** (`agent_loop_server/server.py`):
- Added `session_diagram_generators` dictionary to track generators per session
- Added `broadcast_event(event)` method for event objects
- Added `get_session_diagram_generator(session_id)` to get/create generators
- Updated `get_session_agent(session_id, on_event)` to pass diagram generator to agents

**WebSocket Endpoint Changes**:
- Creates diagram generator for default (non-session) agents
- Passes generator to all agents (both session and default)

## Architecture

```
User Message
    ↓
AgentLoopRunner.run()
    ↓
DiagramGenerator.add_user_message()  ← Accumulate user message
    ↓
Agent Processing...
    ↓
AgentMessageEvent emitted
    ↓
DiagramGenerator.handle_agent_message()  ← Accumulate assistant message
    ↓
[Debouncing - wait 5 seconds]
    ↓
DiagramGenerator._generate_diagrams()
    ↓
POST /api/diagram/generate
    ↓
Response: {flow, erd, system_arch}
    ↓
Broadcast DiagramUpdateEvent (×3) or DiagramErrorEvent
    ↓
WebSocket → Frontend
```

## Debouncing Strategy

The implementation uses a smart debouncing mechanism:

1. **On each agent message**: Cancel any pending generation task
2. **Check last generation time**:
   - If < 5 seconds ago: schedule generation after remaining time
   - If ≥ 5 seconds ago: generate immediately
3. **Benefits**:
   - Prevents API spam during rapid conversations
   - Ensures diagrams are eventually generated
   - Cancels outdated generation requests

## Event Flow

### Input Events
- `AgentMessageEvent` - Triggers diagram generation

### Output Events
- `DiagramUpdateEvent` - Broadcasts generated diagram (3× for flow, erd, system_arch)
- `DiagramErrorEvent` - Broadcasts errors if generation fails

## Configuration

### Environment Variables
- `AGENT_LOOP_PORT` - Used to construct API base URL (default: 8001)

### Diagram Generator Settings
- `api_base_url` - Base URL for diagram API (default: "http://localhost:8001")
- `debounce_seconds` - Minimum time between generations (default: 5.0)
- `broadcast_callback` - Async callback for broadcasting events

### Context Building
- Uses last **10 messages** from conversation history
- Truncates message content to **500 characters** max
- Format: `Role: content\n\nRole: content...`

## Dependencies

### New Dependencies Added
- `aiohttp>=3.9.0` - For async HTTP requests to diagram API

Added to `requirements.txt`

### Existing Dependencies Used
- `asyncio` - For async/await and debouncing
- `datetime` - For timestamp tracking
- `typing` - For type hints

## Testing

Created `test_diagram_generator.py` with tests for:
1. Basic functionality (message accumulation)
2. Debouncing behavior (ensures single generation from rapid messages)

Run tests with:
```bash
python test_diagram_generator.py
```

## Integration Points

### For Future Frontend Integration

The frontend should listen for these WebSocket events:

```javascript
// Diagram update event
{
  "type": "diagram_update",
  "diagram": "graph TD\n  A[Start] --> B[End]"  // Mermaid string
}

// Diagram error event
{
  "type": "diagram_error",
  "error": "Failed to generate diagram: ..."
}
```

Each diagram generation may produce up to 3 `diagram_update` events (flow, erd, system_arch).

### For Backend Developers

To use DiagramGenerator in custom agents:

```python
from agent_loop_server.agent import DiagramGenerator, AgentLoopRunner

# Create generator
async def my_broadcast(event):
    # Handle event broadcast
    pass

generator = DiagramGenerator(
    api_base_url="http://localhost:8001",
    debounce_seconds=5.0,
    broadcast_callback=my_broadcast
)

# Pass to agent
agent = AgentLoopRunner(
    working_dir=".",
    diagram_generator=generator
)

# Run normally - diagrams generated automatically
await agent.run("Create a user authentication system")
```

## Files Modified

1. `agent_loop_server/agent.py`
   - Added `DiagramGenerator` class
   - Integrated with `AgentLoopRunner`

2. `agent_loop_server/server.py`
   - Updated `ConnectionManager` to manage diagram generators
   - Integrated generators with agents

3. `requirements.txt`
   - Added `aiohttp>=3.9.0`

## Files Created

1. `test_diagram_generator.py` - Unit tests for diagram generator
2. `DIAGRAM_GENERATOR_IMPLEMENTATION.md` - This documentation

## Future Enhancements

Potential improvements:
- Configurable context window size (currently 10 messages)
- Configurable message truncation length (currently 500 chars)
- Per-session debounce configuration
- Diagram caching to avoid regenerating identical contexts
- Support for custom diagram types beyond flow/erd/system_arch
- Rate limiting per session
- Metrics/telemetry for diagram generation performance
