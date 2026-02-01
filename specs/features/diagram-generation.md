# Diagram Generation Feature

## Overview

The diagram generation feature automatically creates and updates Mermaid diagrams based on agent conversation context. As users interact with the agent, the system generates three types of diagrams that visualize different aspects of the conversation: flowcharts, entity relationship diagrams, and system architecture diagrams.

## Architecture

### System Components

```
User Message → WebSocket → Server → Agent Loop → DiagramGenerator
                  ↓                        ↓
                  ↓                  BAML API (Haiku)
                  ↓                        ↓
                  ↓                   3 Diagrams Generated
                  ↓                        ↓
                  ← WebSocket Broadcast ←  ←
                  ↓
           useAgentChat Hook
                  ↓
            DiagramPanel
                  ↓
          MermaidRenderer
                  ↓
            Rendered SVG
```

### Flow Sequence

1. **User Message** → WebSocket connection sends chat message
2. **Server Processing** → Agent processes message and generates response
3. **Diagram Trigger** → DiagramGenerator receives agent message event
4. **Debouncing** → 5-second debounce prevents excessive API calls
5. **Generation** → BAML API called with conversation history (last 10 messages)
6. **Broadcast** → 3 separate diagram events sent via WebSocket
7. **UI Update** → React components receive and render diagrams
8. **User View** → Diagrams displayed in side panel with tab navigation

## Diagram Types

### 1. Flow Diagram
- **Purpose**: Visualizes process flows, decision trees, and sequential operations
- **Syntax**: Mermaid flowchart (`flowchart TD`, `flowchart LR`)
- **Elements**: Process steps, decision points, flow arrows
- **Use Cases**: Algorithm flows, user journeys, process documentation

### 2. Entity Relationship Diagram (ERD)
- **Purpose**: Shows data models, database schemas, and entity relationships
- **Syntax**: Mermaid ERD (`erDiagram`)
- **Elements**: Entities, attributes, cardinality relationships (one-to-one, one-to-many, etc.)
- **Use Cases**: Database design, data modeling, API schema visualization

### 3. System Architecture
- **Purpose**: Illustrates system components, services, and interactions
- **Syntax**: Mermaid graph/flowchart for architectural elements
- **Elements**: Services, components, external dependencies, data flows
- **Use Cases**: System design, service architecture, component interaction diagrams

## Key Features

### Debouncing (5-second interval)
- Prevents excessive API calls during rapid conversation
- Cancels pending generation when new messages arrive
- Generates immediately if 5+ seconds elapsed since last generation
- Schedules delayed generation if within debounce window

**Implementation**: `agent_loop_server/agent.py:86-109`

### Session Persistence
- Each WebSocket session maintains its own DiagramGenerator instance
- Conversation history persists across multiple messages in same session
- Session ID can be passed via WebSocket message for session reuse
- Default session created if no ID provided

**Implementation**: `agent_loop_server/server.py:68-106`

### Context Window
- Last 10 messages used for diagram generation
- Each message truncated to 1000 characters max
- Prevents token overflow in BAML API
- Maintains recent context relevance

**Implementation**: `agent_loop_server/agent.py:181-201`

### Error Handling
- **Server-side**: API errors, generation failures, WebSocket disconnects
- **Client-side**: Rendering errors, invalid syntax, type guard validation
- **Component-level**: Error boundaries prevent UI crashes
- **User feedback**: Error messages displayed in diagram panel

### Real-time Updates
- WebSocket broadcasts to all connected clients
- React state updates trigger immediate re-render
- Loading states during generation
- Smooth transitions between diagram updates

## API Endpoints

### POST /api/diagram/generate

Generates all three diagram types based on conversation context.

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Create a user authentication system"
    },
    {
      "role": "assistant",
      "content": "I'll design an authentication system..."
    }
  ],
  "context": "Conversation context summary"
}
```

**Response:**
```json
{
  "flow": "flowchart TD\n  A[Start] --> B[Login]...",
  "erd": "erDiagram\n  User ||--o{ Session : has...",
  "system_arch": "flowchart LR\n  Client --> API..."
}
```

**Status Codes:**
- 200: Success - returns all three diagrams
- 500: Server error - BAML generation failed
- 400: Bad request - invalid input format

## WebSocket Events

### diagram_update
Sent when a diagram is successfully generated.

```typescript
{
  type: "diagram_update",
  diagram: "flowchart TD\n  A[Start] --> B[Process]..."
}
```

### diagram_error
Sent when diagram generation fails.

```typescript
{
  type: "diagram_error",
  error: "Failed to generate diagram: API error"
}
```

## UI Components

### DiagramPanel
Container component managing diagram state and display.

**Location**: `dashboard/nextjs/src/components/diagram/DiagramPanel.tsx`

**Features:**
- State management for 3 diagram types
- Tab switching between diagrams
- Visibility toggle
- Clear functionality
- Loading and error states
- Message processing from WebSocket

**Props:**
```typescript
interface DiagramPanelProps {
  className?: string;
  initialVisible?: boolean;
  initialTab?: DiagramType;
  messages?: ServerEvent[];
}
```

### DiagramTabs
Tab navigation component for switching between diagram types.

**Location**: `dashboard/nextjs/src/components/diagram/DiagramTabs.tsx`

**Features:**
- 3 tabs: Flow, ERD, System
- Active tab highlighting
- Tooltips with descriptions
- Keyboard navigation support

### MermaidRenderer
Core rendering component using mermaid.js.

**Location**: `dashboard/nextjs/src/components/diagram/MermaidRenderer.tsx`

**Features:**
- Mermaid initialization with custom config
- SVG generation from diagram code
- Error handling and display
- Error boundary for crash prevention
- Dynamic re-rendering on code changes

**Props:**
```typescript
interface MermaidRendererProps {
  code: string;
  diagramType: DiagramType;
}
```

## Hook Integration

### useAgentChat
Main hook for WebSocket communication and event handling.

**Location**: `dashboard/nextjs/src/hooks/useAgentChat.ts`

**Diagram Callbacks:**
```typescript
{
  onDiagramUpdate?: (diagram: string) => void,
  onDiagramError?: (error: string) => void
}
```

**Usage in page:**
```typescript
const { messages, sendMessage } = useAgentChat({
  onDiagramUpdate: (diagram) => {
    // Diagram received - handled by DiagramPanel
  },
  onDiagramError: (error) => {
    // Error occurred - handled by DiagramPanel
  }
});

<DiagramPanel messages={messages} />
```

## Configuration

### BAML Configuration
**Location**: `baml_src/diagrams.baml`

```baml
function GenerateMermaidDiagrams(
  messages: Message[],
  context: string
) -> DiagramSet {
  client "Haiku"
  prompt #"
    Generate three Mermaid diagrams...
    - flow: Flowchart showing process flow
    - erd: Entity Relationship Diagram
    - system_arch: System architecture
  "#
}
```

### Mermaid Configuration
**Location**: `dashboard/nextjs/src/components/diagram/MermaidRenderer.tsx:27-37`

```typescript
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'monospace',
});
```

## Performance

### Timing
- **Debounce**: 5 seconds between generations
- **Generation**: 2-3 seconds average (BAML API + Haiku model)
- **Rendering**: < 100ms (mermaid.render)
- **Total**: ~2-3 seconds from trigger to display

### Optimization
- Debouncing prevents excessive API calls
- Context truncation (10 messages, 1000 chars each)
- Session reuse reduces initialization overhead
- WebSocket broadcast to multiple clients efficient
- React state updates only on diagram changes

### Chat Responsiveness
- Agent continues processing during diagram generation
- Non-blocking async operations
- UI remains interactive during generation
- Loading states provide user feedback
- Errors don't block conversation flow

## Error Handling

### Server-Side Errors

1. **API Response Errors**
   - HTTP status != 200
   - Broadcasts `DiagramErrorEvent` with status and error text
   - Logged to console

2. **Generation Exceptions**
   - Network errors, timeouts
   - BAML API failures
   - Broadcasts `DiagramErrorEvent` with exception message

3. **Debounce Cancellation**
   - `asyncio.CancelledError` silently handled
   - Normal operation during rapid messages

### Client-Side Errors

1. **WebSocket Errors**
   - Connection failures
   - Callbacks: `onError`, `onClose`
   - Automatic reconnection attempts

2. **Rendering Errors**
   - Invalid Mermaid syntax
   - Try-catch in `mermaid.render()`
   - Error message displayed in UI
   - Container cleared on error

3. **Type Guard Validation**
   - Runtime type checking for events
   - Prevents invalid state updates
   - Console warnings for unexpected types

4. **Error Boundaries**
   - React Error Boundary wraps MermaidRenderer
   - Prevents component errors from crashing app
   - Fallback UI displayed on error

## Testing

### Manual Test Plan

#### Test 1: Basic Flow
1. Start server and client
2. Send message: "Create a user authentication system"
3. Wait for agent response
4. **Verify**: Diagram panel shows loading state
5. **Verify**: After 2-3 seconds, flow diagram appears
6. **Verify**: Switch to ERD tab - ERD diagram visible
7. **Verify**: Switch to System tab - architecture diagram visible

#### Test 2: Debouncing
1. Send 3 rapid messages in < 5 seconds
2. **Verify**: Only one diagram generation triggered
3. Wait 5+ seconds
4. Send another message
5. **Verify**: New diagram generation triggered immediately

#### Test 3: Error Handling
1. Stop BAML service
2. Send message to trigger generation
3. **Verify**: Error message displayed in diagram panel
4. **Verify**: Chat remains functional
5. Restart BAML service
6. Send message
7. **Verify**: Diagrams generate successfully

#### Test 4: Tab Switching
1. Generate diagrams (any message)
2. Click "Flow" tab
3. **Verify**: Flow diagram displayed
4. Click "ERD" tab
5. **Verify**: ERD diagram displayed
6. Click "System" tab
7. **Verify**: System architecture diagram displayed

#### Test 5: Clear Functionality
1. Generate diagrams
2. Click "Clear" button
3. **Verify**: All diagrams reset to empty state
4. **Verify**: Empty state message displayed
5. Send new message
6. **Verify**: New diagrams populate

#### Test 6: Visibility Toggle
1. Generate diagrams
2. Click collapse icon
3. **Verify**: Panel collapses (only tabs visible)
4. Click expand icon
5. **Verify**: Panel expands (full diagram visible)

#### Test 7: Invalid Syntax
1. Manually inject invalid Mermaid code (dev tools)
2. **Verify**: Error message displayed
3. **Verify**: Error boundary prevents crash
4. **Verify**: Other UI elements remain functional

#### Test 8: Multiple Sessions
1. Open two browser tabs
2. Send message in tab 1
3. **Verify**: Diagrams appear in tab 1
4. Send message in tab 2
5. **Verify**: Diagrams appear in tab 2
6. **Verify**: Tab 1 receives tab 2's diagrams (broadcast)

### Performance Verification

#### Render Time
1. Open browser DevTools Network tab
2. Send message to trigger generation
3. **Measure**: Time from agent_message to diagram_update event
4. **Expected**: 2-3 seconds
5. **Measure**: Time from diagram_update to SVG render
6. **Expected**: < 100ms

#### Chat Responsiveness
1. Send message to trigger long agent response
2. **Verify**: Diagram generation doesn't block message display
3. **Verify**: User can send new messages during generation
4. **Verify**: UI remains interactive (scrolling, clicking)

#### Memory Usage
1. Generate 10+ diagram updates
2. Open browser DevTools Memory profiler
3. **Verify**: No significant memory leaks
4. **Verify**: Old SVG elements properly cleaned up

## Troubleshooting

### Diagrams Not Generating

**Symptoms**: No diagram_update events received

**Possible Causes:**
1. BAML service not running
2. DiagramGenerator not attached to agent
3. Debounce window still active

**Debug Steps:**
1. Check server logs for errors
2. Verify BAML service running: `baml-cli dev`
3. Check WebSocket connection in browser DevTools
4. Look for diagram_error events

### Rendering Errors

**Symptoms**: Error message in diagram panel

**Possible Causes:**
1. Invalid Mermaid syntax from BAML
2. Unsupported diagram type
3. Browser compatibility issue

**Debug Steps:**
1. Copy diagram code from error message
2. Test in Mermaid Live Editor: https://mermaid.live
3. Check browser console for detailed error
4. Verify mermaid.js version compatibility

### Performance Issues

**Symptoms**: Slow generation, UI lag

**Possible Causes:**
1. Large conversation history
2. Complex diagrams
3. Network latency

**Debug Steps:**
1. Check context size in server logs
2. Verify debouncing working correctly
3. Monitor BAML API response times
4. Check browser DevTools Performance tab

## Future Enhancements

### Diagram Customization
- User-selectable themes
- Zoom and pan controls
- Export to PNG/SVG/PDF
- Diagram editing and annotations

### Advanced Features
- Diagram history and versioning
- Collaborative diagram editing
- Custom diagram templates
- Integration with other diagram types (sequence, state, etc.)

### Performance Improvements
- Incremental updates (diff-based)
- Client-side caching
- Progressive rendering for large diagrams
- WebWorker for rendering

### AI Enhancements
- Better context understanding
- Multi-turn diagram refinement
- User feedback integration
- Custom prompt templates

## References

### Documentation
- [Mermaid.js Docs](https://mermaid.js.org/)
- [BAML Documentation](https://docs.boundaryml.com/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

### Key Files
- `agent_loop_server/agent.py` - DiagramGenerator class
- `agent_loop_server/server.py` - WebSocket server and API
- `baml_src/diagrams.baml` - BAML configuration
- `dashboard/nextjs/src/hooks/useAgentChat.ts` - WebSocket hook
- `dashboard/nextjs/src/components/diagram/` - UI components
- `dashboard/nextjs/src/types/chat.ts` - TypeScript types

## License

This feature is part of the Nova project and follows the same license.
