# Diagram Feature Testing Guide

## Pre-Test Setup

### Start Services

1. **Start BAML Service**
   ```bash
   cd /Users/mattruiters/Code/Projects/NovaHack/Nova
   baml-cli dev
   ```
   - Wait for "Server started on http://127.0.0.1:2024"

2. **Start Backend Server**
   ```bash
   cd /Users/mattruiters/Code/Projects/NovaHack/Nova/agent_loop_server
   python server.py
   ```
   - Wait for "Uvicorn running on http://0.0.0.0:8001"

3. **Start Frontend**
   ```bash
   cd /Users/mattruiters/Code/Projects/NovaHack/Nova/program_nova/dashboard/nextjs
   npm run dev
   ```
   - Wait for "Ready on http://localhost:3000"

4. **Open Browser**
   - Navigate to http://localhost:3000
   - Open DevTools (F12)
   - Switch to Console tab
   - Switch to Network tab (for WebSocket monitoring)

### Verify Setup

- [ ] BAML service running on port 2024
- [ ] Backend server running on port 8001
- [ ] Frontend accessible at localhost:3000
- [ ] No console errors in browser
- [ ] WebSocket connection established (check Network → WS tab)

---

## Test Suite

### Test 1: Basic End-to-End Flow ✓

**Objective**: Verify complete flow from user message to rendered diagram

**Steps**:
1. In chat input, type: "Create a user authentication system with email and password"
2. Click Send or press Enter
3. Wait for agent to respond

**Expected Results**:
- [ ] User message appears in chat
- [ ] Agent generates response (5-10 seconds)
- [ ] Diagram panel appears on right side
- [ ] "Generating diagrams..." loading state shows
- [ ] After 2-3 seconds, loading disappears
- [ ] Flow diagram renders in panel
- [ ] Diagram shows authentication flow (Login → Verify → Success/Error)
- [ ] No errors in console

**Verification Points**:
- Console shows: `WebSocket message:` events
- Network tab shows: `diagram_update` events (3 total - one per diagram type)
- Diagram panel shows: SVG element with flowchart

**Debug Steps if Failed**:
1. Check console for errors
2. Check Network → WS tab for WebSocket messages
3. Verify all 3 services running
4. Check server logs for API errors

---

### Test 2: All Three Diagram Types ✓

**Objective**: Verify all three diagram types generate and render correctly

**Steps**:
1. Use message from Test 1 or send new message
2. Wait for diagrams to generate
3. Click "Flow" tab (should be active by default)
4. Observe flow diagram
5. Click "ERD" tab
6. Observe ERD diagram
7. Click "System" tab
8. Observe system architecture diagram

**Expected Results**:

**Flow Tab**:
- [ ] Shows flowchart diagram
- [ ] Contains process steps (boxes)
- [ ] Contains arrows showing flow
- [ ] Contains decision points (diamonds)
- [ ] Readable labels

**ERD Tab**:
- [ ] Shows entity relationship diagram
- [ ] Contains entities (tables)
- [ ] Contains attributes (fields)
- [ ] Contains relationships (lines between entities)
- [ ] Shows cardinality (one-to-many, etc.)

**System Tab**:
- [ ] Shows architecture diagram
- [ ] Contains system components (services)
- [ ] Contains external dependencies
- [ ] Contains data flows (arrows)
- [ ] Logical grouping of components

**Verification Points**:
- Each tab shows different diagram
- Switching tabs is instant (no loading)
- Diagrams persist when switching tabs
- All diagrams are valid Mermaid syntax

**Debug Steps if Failed**:
1. Check if all 3 `diagram_update` events received
2. Inspect `diagrams` state in React DevTools
3. Check if diagram code is stored for each type
4. Verify tab switching logic in DiagramPanel

---

### Test 3: Debouncing (5-second window) ✓

**Objective**: Verify debouncing prevents excessive API calls

**Steps**:
1. Send message: "What is React?"
2. Immediately (< 1 second) send: "What is Vue?"
3. Immediately (< 1 second) send: "What is Angular?"
4. Wait and observe

**Expected Results**:
- [ ] All 3 messages appear in chat
- [ ] Agent responds to all 3 messages
- [ ] Only ONE diagram generation occurs
- [ ] Generation happens ~5 seconds after LAST message
- [ ] Console shows only one `/api/diagram/generate` call

**Timing**:
- Message 1 at T+0s
- Message 2 at T+0.5s
- Message 3 at T+1s
- Generation should trigger at T+6s (1s + 5s debounce)

**Verification Points**:
- Network tab shows ONE POST to `/api/diagram/generate`
- Server logs show: "Scheduling delayed diagram generation" messages
- Server logs show: ONE "Generating diagrams" message
- Debounce cancels previous pending tasks

**Debug Steps if Failed**:
1. Check server logs for debounce messages
2. Verify `debounce_seconds=5.0` in DiagramGenerator init
3. Check `_trigger_diagram_generation` logic
4. Verify `asyncio.create_task` and `cancel()` working

---

### Test 4: Error Handling - Server Error ✓

**Objective**: Verify graceful error handling when generation fails

**Steps**:
1. Stop BAML service (Ctrl+C in BAML terminal)
2. Send message: "Create a REST API"
3. Wait for agent response
4. Observe diagram panel

**Expected Results**:
- [ ] Agent responds normally (diagram generation independent)
- [ ] Diagram panel shows loading state
- [ ] After timeout, error message appears:
  - "Failed to generate diagram: [error details]"
  - OR "API error 500: [error text]"
- [ ] Error has red/warning styling
- [ ] Chat remains functional
- [ ] User can send more messages

**Verification Points**:
- Console shows: `diagram_error` event
- Error message in DiagramPanel
- `diagrams[activeTab].error` set in state
- No UI crash or white screen

**Recovery Steps**:
1. Restart BAML service
2. Send new message
3. Verify diagrams generate successfully

**Debug Steps if Failed**:
1. Check if `diagram_error` event broadcast
2. Verify error handling in DiagramGenerator
3. Check if error displayed in UI
4. Verify error state management in DiagramPanel

---

### Test 5: Error Handling - Invalid Syntax ✓

**Objective**: Verify rendering errors handled gracefully

**Steps**:
1. Open React DevTools
2. Find DiagramPanel component
3. Edit state: `diagrams.flow.code` to invalid syntax:
   ```
   flowchart TD
   A[Start] --> B[End
   ```
   (Note missing closing bracket)
4. Observe diagram panel

**Expected Results**:
- [ ] Error message displayed: "Invalid diagram syntax"
- [ ] OR specific Mermaid error: "Parse error on line X"
- [ ] Diagram area cleared (no broken SVG)
- [ ] Error has red/warning styling
- [ ] Other tabs still functional
- [ ] Page doesn't crash

**Verification Points**:
- Console shows: Mermaid rendering error
- Error caught by try-catch in MermaidRenderer
- Error state set in component
- Error boundary doesn't trigger (component-level error only)

**Debug Steps if Failed**:
1. Check if error caught in `mermaid.render()` try-catch
2. Verify error state set correctly
3. Check if error displayed in UI
4. Verify error boundary wrapping component

---

### Test 6: Visibility Toggle ✓

**Objective**: Verify panel can be collapsed/expanded

**Steps**:
1. Generate diagrams (send any message)
2. Wait for diagrams to render
3. Click collapse icon (ChevronRight) in panel header
4. Observe panel
5. Click expand icon (ChevronDown)
6. Observe panel

**Expected Results**:

**After Collapse**:
- [ ] Panel height reduces to minimum
- [ ] Tabs still visible (Flow, ERD, System)
- [ ] Diagram content hidden
- [ ] Icon changes to ChevronDown
- [ ] Smooth transition animation

**After Expand**:
- [ ] Panel expands to full height
- [ ] Diagram content visible again
- [ ] Same diagram as before (state persisted)
- [ ] Icon changes to ChevronRight
- [ ] Smooth transition animation

**Verification Points**:
- `isVisible` state toggles
- CSS class changes for height
- Diagram state persists during toggle
- No re-render or re-fetch of diagrams

---

### Test 7: Clear Functionality ✓

**Objective**: Verify clear button resets all diagrams

**Steps**:
1. Generate diagrams (send any message)
2. Wait for all 3 diagrams to render
3. Switch to "ERD" tab
4. Click "Clear" button in panel header
5. Observe all tabs

**Expected Results**:
- [ ] All diagram content cleared
- [ ] Empty state message appears: "Send a message to generate diagrams"
- [ ] All 3 tabs show empty state
- [ ] No errors
- [ ] Chat messages remain (only diagrams cleared)

**Verification Points**:
- All `diagrams[type].code` reset to empty string
- All `diagrams[type].error` reset to null
- All `diagrams[type].loading` reset to false
- `processedMessageCount` reset to 0 (optional)

**Recovery Steps**:
1. Send new message
2. Verify diagrams generate fresh

---

### Test 8: Tab Switching Performance ✓

**Objective**: Verify smooth tab switching without re-rendering

**Steps**:
1. Generate diagrams (send any message)
2. Wait for all diagrams to render
3. Rapidly switch between tabs:
   - Click "Flow"
   - Click "ERD"
   - Click "System"
   - Click "Flow"
   - Repeat 5-10 times quickly

**Expected Results**:
- [ ] Instant tab switching (no loading)
- [ ] Each tab shows correct diagram immediately
- [ ] No flickering or re-rendering
- [ ] No diagram regeneration
- [ ] Smooth transitions
- [ ] No console errors

**Verification Points**:
- `activeTab` state updates
- Conditional rendering based on `activeTab`
- Diagrams stored separately for each type
- No unnecessary re-renders (check React DevTools Profiler)

---

### Test 9: Multiple Sessions (Broadcast) ✓

**Objective**: Verify WebSocket broadcasts to all connected clients

**Steps**:
1. Open two browser tabs/windows to http://localhost:3000
2. In Tab 1: Send message "Create a database schema"
3. Observe both tabs

**Expected Results**:

**Tab 1** (sender):
- [ ] Message sent
- [ ] Agent responds
- [ ] Diagrams generate
- [ ] All events appear

**Tab 2** (receiver):
- [ ] Same message appears (broadcast)
- [ ] Same agent response appears
- [ ] Same diagrams appear
- [ ] All events synchronized

**Verification Points**:
- Both tabs receive all WebSocket events
- Both tabs have same conversation state
- Both tabs have same diagrams
- ConnectionManager broadcasts to all connections

**Note**: Both tabs will show the same session by default. For separate sessions, need to implement session ID logic.

---

### Test 10: Session Persistence ✓

**Objective**: Verify session and conversation history persists

**Steps**:
1. Send message: "Design a shopping cart"
2. Wait for diagrams
3. Send follow-up: "Add payment integration"
4. Wait for diagrams
5. Observe diagram changes

**Expected Results**:
- [ ] First message generates diagrams about shopping cart
- [ ] Second message updates diagrams to include payment
- [ ] Diagrams show evolution (shopping cart + payment)
- [ ] Context from first message influences second diagrams
- [ ] No duplicate nodes or disconnected components

**Verification Points**:
- `conversation_history` accumulates messages
- BAML receives full conversation (last 10 messages)
- Context parameter includes relevant summary
- Diagrams show logical progression

**Debug Steps if Failed**:
1. Check `add_user_message` and conversation history
2. Verify messages sent to BAML API
3. Check context building in `_build_context`
4. Verify message truncation (1000 chars)

---

## Performance Tests

### Test 11: Render Time Measurement ⏱️

**Objective**: Verify 2-3 second render time

**Steps**:
1. Open browser DevTools → Network tab
2. Filter by "WS" (WebSocket)
3. Send message: "Create a microservices architecture"
4. Note timestamps

**Measure**:
1. **Agent Response Time**: Time from send to `agent_message` event
2. **Diagram Generation Time**: Time from `agent_message` to `diagram_update` event
3. **Diagram Render Time**: Time from `diagram_update` to SVG in DOM

**Expected Results**:
- [ ] Agent response: 5-15 seconds (varies by complexity)
- [ ] Diagram generation: 2-3 seconds
- [ ] Diagram render: < 100ms
- [ ] Total (generation + render): 2-3 seconds

**Measurement Tools**:
- Network tab → WS messages → timestamps
- Console.time/timeEnd in code
- Performance API: `performance.now()`

**Acceptance Criteria**:
- 90% of generations complete in < 4 seconds
- 95% of renders complete in < 200ms
- No render blocking the main thread

---

### Test 12: Chat Responsiveness During Generation ✓

**Objective**: Verify chat remains responsive during diagram generation

**Steps**:
1. Send message: "Explain React hooks in detail" (long response)
2. While agent is responding:
   - Try scrolling chat
   - Try clicking messages
   - Try typing in input
3. While diagrams are generating:
   - Try sending another message
   - Try scrolling chat
   - Try switching tabs in diagram panel

**Expected Results**:
- [ ] Chat scrolling smooth during generation
- [ ] Can type in input during generation
- [ ] Can send new messages during generation
- [ ] Can interact with UI elements
- [ ] No blocking or freezing
- [ ] No "page unresponsive" warnings

**Verification Points**:
- Async operations don't block main thread
- UI updates smoothly
- Event handlers remain responsive
- No long-running synchronous operations

---

### Test 13: Memory Leak Check 💾

**Objective**: Verify no memory leaks from repeated generations

**Steps**:
1. Open DevTools → Memory tab
2. Take heap snapshot (baseline)
3. Generate 10 diagram updates:
   - Send message
   - Wait for diagrams
   - Clear diagrams
   - Repeat 9 more times
4. Take second heap snapshot
5. Compare snapshots

**Expected Results**:
- [ ] Memory increase < 10MB
- [ ] No retained detached DOM elements
- [ ] SVG elements properly cleaned up
- [ ] Event listeners removed
- [ ] No growing arrays/objects

**Verification Points**:
- Heap snapshot comparison shows minimal growth
- Detached DOM nodes: < 10
- Event listeners properly cleaned up
- React components unmount correctly

**Tools**:
- Chrome DevTools → Memory → Heap snapshot
- Performance monitor → JS heap size

---

## Edge Cases

### Test 14: Empty/Invalid Response from BAML ⚠️

**Objective**: Handle empty or malformed BAML responses

**Steps**:
1. Modify BAML prompt to return empty strings
2. Send message
3. Observe behavior

**Expected Results**:
- [ ] No crash or error
- [ ] Empty state message shown
- [ ] OR placeholder diagram shown
- [ ] User notified gracefully

---

### Test 15: Very Long Conversation (Context Limit) 📏

**Objective**: Verify context window truncation works

**Steps**:
1. Send 15+ messages in sequence
2. Observe diagram quality

**Expected Results**:
- [ ] Only last 10 messages used for generation
- [ ] No token overflow errors
- [ ] Diagrams still relevant to recent context
- [ ] No performance degradation

**Verification Points**:
- `_build_context` limits to 10 messages
- Each message truncated to 1000 chars
- Total context size reasonable (< 10K chars)

---

### Test 16: Rapid Tab Switching During Generation ⚡

**Objective**: Verify no race conditions during tab switching

**Steps**:
1. Send message to trigger generation
2. Immediately start rapidly switching tabs (before diagrams arrive)
3. Continue switching as diagrams arrive

**Expected Results**:
- [ ] No duplicate diagrams
- [ ] No wrong diagram in wrong tab
- [ ] No state corruption
- [ ] Eventually all tabs show correct diagrams

---

### Test 17: WebSocket Reconnection 🔌

**Objective**: Verify reconnection after disconnect

**Steps**:
1. Establish connection and generate diagrams
2. Stop backend server
3. Observe UI behavior
4. Restart backend server
5. Refresh page or wait for auto-reconnect
6. Send new message

**Expected Results**:
- [ ] UI shows disconnected state
- [ ] Graceful error message
- [ ] After reconnect: normal operation resumes
- [ ] New messages work correctly

---

## Regression Tests

### Test 18: Existing Chat Functionality Unaffected ✓

**Objective**: Verify diagram feature doesn't break existing chat

**Steps**:
1. Send message: "What is 2+2?"
2. Verify agent response
3. Send message: "Tell me a joke"
4. Verify agent response

**Expected Results**:
- [ ] All existing chat features work
- [ ] Messages send/receive normally
- [ ] Thinking states display
- [ ] Tool calls work
- [ ] No console errors related to chat

---

### Test 19: Tool Calls Still Work ✓

**Objective**: Verify diagram feature doesn't interfere with tool execution

**Steps**:
1. Send message that triggers tool call: "Read the package.json file"
2. Observe tool call events
3. Verify tool results appear

**Expected Results**:
- [ ] Tool call event appears
- [ ] Tool result event appears
- [ ] Tool output displayed correctly
- [ ] Diagrams still generate (if applicable)

---

## Test Results Template

```markdown
## Test Results - [Date]

Tester: [Name]
Environment: [Browser + Version, OS]
Commit: [Git SHA]

| Test # | Name | Status | Notes |
|--------|------|--------|-------|
| 1 | Basic E2E Flow | ✅ | All good |
| 2 | Three Diagram Types | ✅ | - |
| 3 | Debouncing | ✅ | - |
| 4 | Server Error | ✅ | - |
| 5 | Invalid Syntax | ✅ | - |
| 6 | Visibility Toggle | ✅ | - |
| 7 | Clear Function | ✅ | - |
| 8 | Tab Switching | ✅ | - |
| 9 | Multi-Session | ⚠️ | Sessions not isolated yet |
| 10 | Session Persist | ✅ | - |
| 11 | Render Time | ⏱️ | 2.8s avg |
| 12 | Chat Responsive | ✅ | - |
| 13 | Memory Leak | ✅ | < 5MB increase |

### Issues Found
- [Issue #1 description]
- [Issue #2 description]

### Overall Assessment
[Summary of test results and readiness for production]
```

---

## Quick Smoke Test (5 minutes)

For rapid verification after changes:

1. **Start services** (BAML, backend, frontend)
2. **Send message**: "Create a user authentication system"
3. **Verify**:
   - ✅ Agent responds
   - ✅ Diagrams generate
   - ✅ All 3 tabs work
   - ✅ No console errors
4. **Send second message**: "Add password reset"
5. **Verify**:
   - ✅ Diagrams update with new context
   - ✅ No errors

If all pass → Basic functionality working ✓
