# Diagram Feature Quick Reference

## Architecture at a Glance

```
User Message → Agent Response → DiagramGenerator
                                      ↓
                                 5s Debounce
                                      ↓
                               BAML API Call
                                      ↓
                            3 Diagrams Generated
                                      ↓
                            WebSocket Broadcast
                                      ↓
                              useAgentChat Hook
                                      ↓
                               DiagramPanel
                                      ↓
                            MermaidRenderer
                                      ↓
                                SVG Display
```

## Key Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| DiagramGenerator | `agent_loop_server/agent.py:35-201` | Accumulates messages, triggers generation, broadcasts |
| BAML Function | `baml_src/diagrams.baml` | Generates 3 Mermaid diagrams via Claude Haiku |
| API Endpoint | `agent_loop_server/server.py:244-303` | HTTP endpoint for diagram generation |
| useAgentChat | `dashboard/nextjs/src/hooks/useAgentChat.ts` | WebSocket connection & event handling |
| DiagramPanel | `dashboard/nextjs/src/components/diagram/DiagramPanel.tsx` | State management, tab switching, UI |
| MermaidRenderer | `dashboard/nextjs/src/components/diagram/MermaidRenderer.tsx` | Renders Mermaid code to SVG |

## WebSocket Events

### Sent by Server
```typescript
// Diagram successfully generated
{
  type: "diagram_update",
  diagram: "flowchart TD\n  A --> B"
}

// Generation failed
{
  type: "diagram_error",
  error: "API error: ..."
}
```

### Sent by Client
```typescript
// Chat message (triggers agent → diagram generation)
{
  type: "chat",
  message: "Create a REST API",
  session_id?: "abc123"  // optional for session persistence
}
```

## Three Diagram Types

| Type | Purpose | Mermaid Syntax | Example |
|------|---------|----------------|---------|
| **flow** | Process flows, algorithms | `flowchart TD` | Login → Validate → Success |
| **erd** | Data models, schemas | `erDiagram` | User ||--o{ Order : places |
| **system** | Architecture, services | Graph/flowchart | Client → API → DB |

## Configuration Values

```python
# Server-side (agent_loop_server/agent.py)
DEBOUNCE_SECONDS = 5.0           # Wait time between generations
MAX_MESSAGES = 10                # Context window size
MAX_MESSAGE_LENGTH = 1000        # Chars per message in context
API_BASE_URL = "http://localhost:8001"

# Client-side (dashboard/nextjs/src/components/diagram/MermaidRenderer.tsx)
MERMAID_CONFIG = {
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'monospace',
}
```

## Common Operations

### Add Diagram Generation to Agent

```python
from agent import DiagramGenerator, AgentLoopRunner

# Create diagram generator with broadcast callback
diagram_generator = DiagramGenerator(
    api_base_url="http://localhost:8001",
    debounce_seconds=5.0,
    broadcast_callback=manager.broadcast_event,
)

# Attach to agent
agent = AgentLoopRunner(
    working_dir=".",
    on_event=on_event,
    diagram_generator=diagram_generator,
)

# Agent automatically triggers generation after responses
```

### Use in React Component

```typescript
import { useAgentChat } from '@/hooks/useAgentChat';
import { DiagramPanel } from '@/components/diagram/DiagramPanel';

export default function ChatPage() {
  const { messages, sendMessage, isLoading } = useAgentChat({
    wsUrl: 'ws://localhost:8001/ws',
    onDiagramUpdate: (diagram) => {
      console.log('Diagram received:', diagram);
    },
    onDiagramError: (error) => {
      console.error('Diagram error:', error);
    },
  });

  return (
    <div className="flex">
      <ChatArea messages={messages} onSend={sendMessage} />
      <DiagramPanel messages={messages} />
    </div>
  );
}
```

### Modify BAML Prompt

```baml
// baml_src/diagrams.baml

function GenerateMermaidDiagrams(
  messages: Message[],
  context: string
) -> DiagramSet {
  client "Haiku"
  prompt #"
    Generate three Mermaid diagrams based on the conversation:

    1. flow: Flowchart showing the main process flow
    2. erd: Entity Relationship Diagram for data modeling
    3. system_arch: System architecture showing components

    Rules:
    - Valid Mermaid syntax only
    - No markdown code fences
    - Max 10-15 nodes per diagram
    - If not applicable: create simple placeholder

    Context: {{ context }}

    Recent conversation:
    {{ messages }}
  "#
}
```

## Debugging

### Check WebSocket Messages
```javascript
// Browser DevTools Console
// Monitor all WebSocket events
const ws = new WebSocket('ws://localhost:8001/ws');
ws.onmessage = (e) => console.log('WS:', JSON.parse(e.data));
```

### Check Diagram State
```javascript
// React DevTools
// Find DiagramPanel component
// Inspect state: diagrams.flow, diagrams.erd, diagrams.system
```

### Check Server Logs
```bash
# In agent_loop_server terminal
# Look for these messages:
"Triggering diagram generation immediately"
"Scheduling delayed diagram generation"
"Generating diagrams..."
"Broadcasting diagram update"
"Failed to generate diagram: [error]"
```

### Test BAML Directly
```bash
# Test BAML function without full flow
curl -X POST http://localhost:2024/api/diagram/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Create a REST API"}
    ],
    "context": "Building a web application"
  }'
```

## Performance Tips

### Reduce Generation Frequency
```python
# Increase debounce time
diagram_generator = DiagramGenerator(
    debounce_seconds=10.0,  # Wait 10 seconds instead of 5
)
```

### Limit Context Size
```python
# In DiagramGenerator._build_context()
context_messages = self.conversation_history[-5:]  # Last 5 instead of 10
```

### Optimize Mermaid Rendering
```typescript
// Use memoization to prevent unnecessary re-renders
const MermaidRenderer = React.memo(({ code, diagramType }) => {
  // ... rendering logic
}, (prev, next) => {
  return prev.code === next.code && prev.diagramType === next.diagramType;
});
```

## Common Issues & Fixes

### Issue: Diagrams not generating

**Symptoms**: No `diagram_update` events

**Fixes**:
- ✅ Check BAML service running: `baml-cli dev`
- ✅ Check backend server running: `python server.py`
- ✅ Verify DiagramGenerator attached to agent
- ✅ Check server logs for errors
- ✅ Verify WebSocket connection in DevTools

### Issue: Rendering errors

**Symptoms**: Error message in diagram panel

**Fixes**:
- ✅ Test diagram in Mermaid Live Editor: https://mermaid.live
- ✅ Check for syntax errors in BAML prompt
- ✅ Verify mermaid.js version: `npm list mermaid`
- ✅ Check browser console for detailed error

### Issue: Slow performance

**Symptoms**: > 5 second generation time

**Fixes**:
- ✅ Reduce context size (fewer messages)
- ✅ Increase debounce time
- ✅ Check BAML API response time
- ✅ Monitor network latency

### Issue: Memory leaks

**Symptoms**: Increasing memory usage over time

**Fixes**:
- ✅ Ensure SVG elements cleaned up on re-render
- ✅ Remove event listeners in useEffect cleanup
- ✅ Use React.memo for expensive components
- ✅ Clear diagram state when unmounting

## Type Definitions

```typescript
// Key types from dashboard/nextjs/src/types/chat.ts

export type DiagramType = 'flow' | 'erd' | 'system';

export interface DiagramUpdateEvent {
  type: "diagram_update";
  diagram: string;  // Mermaid code
}

export interface DiagramErrorEvent {
  type: "diagram_error";
  error: string;
}

export interface DiagramState {
  code: string;
  loading: boolean;
  error: string | null;
}

// Type guards
export function isDiagramUpdateEvent(event: ServerEvent): event is DiagramUpdateEvent;
export function isDiagramErrorEvent(event: ServerEvent): event is DiagramErrorEvent;
```

## API Reference

### POST /api/diagram/generate

**Request Body**:
```json
{
  "messages": [
    {
      "role": "user" | "assistant",
      "content": "string"
    }
  ],
  "context": "string"
}
```

**Response** (200 OK):
```json
{
  "flow": "flowchart TD\n  A --> B",
  "erd": "erDiagram\n  User ||--o{ Order : places",
  "system_arch": "flowchart LR\n  Client --> API"
}
```

**Response** (500 Error):
```json
{
  "detail": "BAML generation failed: [error]"
}
```

## File Structure

```
Nova/
├── agent_loop_server/
│   ├── agent.py                    # DiagramGenerator class
│   ├── server.py                   # WebSocket server + API endpoint
│   └── events.py                   # Event dataclasses
├── baml_src/
│   └── diagrams.baml               # BAML function definition
├── program_nova/dashboard/nextjs/src/
│   ├── hooks/
│   │   └── useAgentChat.ts         # WebSocket hook
│   ├── types/
│   │   └── chat.ts                 # TypeScript types
│   ├── components/diagram/
│   │   ├── DiagramPanel.tsx        # Main container
│   │   ├── DiagramTabs.tsx         # Tab switcher
│   │   └── MermaidRenderer.tsx     # SVG renderer
│   └── app/
│       └── page.tsx                # Main page (uses DiagramPanel)
└── specs/features/
    ├── diagram-generation.md       # Full documentation
    ├── diagram-testing-guide.md    # Test suite
    └── diagram-quick-reference.md  # This file
```

## Useful Commands

```bash
# Start all services
baml-cli dev                           # Terminal 1: BAML service
cd agent_loop_server && python server.py   # Terminal 2: Backend
cd program_nova/dashboard/nextjs && npm run dev  # Terminal 3: Frontend

# Test BAML function
curl http://localhost:2024/health     # Check BAML alive

# Monitor logs
tail -f agent_loop_server/logs/*.log  # If logging configured

# Build frontend
npm run build                         # Production build
npm run start                         # Production server

# Run tests (if configured)
npm test                              # Jest tests
npm run test:e2e                      # E2E tests (Playwright/Cypress)
```

## Next Steps for New Developers

1. ✅ Read `diagram-generation.md` for full architecture
2. ✅ Run through "Quick Smoke Test" in `diagram-testing-guide.md`
3. ✅ Inspect code in key files (see "Key Components" above)
4. ✅ Make small change: Modify BAML prompt and observe results
5. ✅ Debug: Add console.logs to trace event flow
6. ✅ Extend: Add new diagram type or customize styling

## Contributing

When adding features to diagram system:

1. **Update BAML** if changing diagram generation logic
2. **Update Types** in `chat.ts` if adding new events
3. **Update Tests** in testing guide for new functionality
4. **Update Docs** in this quick reference and main docs
5. **Test Performance** - verify < 3 second generation time
6. **Check Memory** - ensure no leaks with Chrome DevTools

## Resources

- [Mermaid.js Documentation](https://mermaid.js.org/)
- [BAML Documentation](https://docs.boundaryml.com/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Mermaid Live Editor](https://mermaid.live) - Test diagrams
