# Agent Chat WebSocket API Spec

This document defines the request/response payloads used by the agent chat loop WebSocket.

## Transport

- Protocol: WebSocket
- Endpoint: `ws://<host>:<port>/ws`
- Content type: JSON objects (one message per WebSocket frame)

## Client -> Server Messages

### Chat Request

Send a chat message to the agent.

```json
{
  "type": "chat",
  "message": "Hello agent",
  "session_id": "optional-session-id"
}
```

Fields:
- `type` (string, required): Must be `"chat"`.
- `message` (string, required): User input. Empty/whitespace-only messages are rejected.
- `session_id` (string, optional): Stable session identifier for conversation continuity across reconnects.

Server behavior:
- Empty/whitespace-only `message` triggers an `error` event.
- Unknown `type` triggers an `error` event.
- If `session_id` is provided, the server reuses conversation history for that session.
- If `session_id` is omitted, continuity only exists while the WebSocket connection remains open.

## Server -> Client Events

All server events include a `type` field. Events are broadcast to all connected clients.

### User Message Event

Echo of the user's message (broadcast after the server accepts a `chat`).

```json
{
  "type": "user_message",
  "message": "Hello agent"
}
```

Fields:
- `type` (string, required): `"user_message"`
- `message` (string, required)

### Agent Message Event

Agent response content.

```json
{
  "type": "agent_message",
  "message": "Hi! How can I help?"
}
```

Fields:
- `type` (string, required): `"agent_message"`
- `message` (string, required)

### Tool Call Event

Agent initiated tool execution.

```json
{
  "type": "tool_call",
  "tool_name": "Search",
  "tool_args": "{\"query\":\"weather\"}"
}
```

Fields:
- `type` (string, required): `"tool_call"`
- `tool_name` (string, required)
- `tool_args` (string, required): JSON-encoded string

### Tool Result Event

Tool execution result.

```json
{
  "type": "tool_result",
  "tool_name": "Search",
  "result": "Sunny, 70F",
  "success": true
}
```

Fields:
- `type` (string, required): `"tool_result"`
- `tool_name` (string, required)
- `result` (string, required)
- `success` (boolean, required)

### Agent Thinking Event

Agent reasoning/debug stream.

```json
{
  "type": "agent_thinking",
  "reasoning": "Planning tool usage..."
}
```

Fields:
- `type` (string, required): `"agent_thinking"`
- `reasoning` (string, required)

### Error Event

Server-side error or validation error.

```json
{
  "type": "error",
  "error": "Empty message received"
}
```

Fields:
- `type` (string, required): `"error"`
- `error` (string, required)

## Notes

- Payloads are defined by the server event schemas in `agent_loop_server/events.py`.
- Tool arguments and results are strings; tools may embed JSON as a string in `tool_args`.
- The server currently broadcasts all events to all connected WebSocket clients.
