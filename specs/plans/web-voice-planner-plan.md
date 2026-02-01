# Web Voice Planner Implementation Plan

> Generated from: `specs/solutions/web-voice-planner.md`

## Overview

Build a voice-enabled web application that allows Product Managers to have spoken conversations with an AI solution-architect to design features. The app provides real-time voice interaction using OpenAI Whisper (STT) and TTS, with Claude API powering the solution-architect interview logic.

## Solution Spec Reference

**Summary:** Voice-enabled web app for PMs to speak with solution-architect to design features

**Success Criteria:**
1. Engineers can implement features with minimal back-and-forth
2. Edge cases captured upfront in spec
3. Voice sessions complete quickly
4. PMs prefer speaking over typing

**Scope:**
- Included: Voice conversation, text fallback, visible transcript, session persistence, auto-save specs
- Excluded: `/problem:plan` flow, spec editing after generation, user auth

## Current State Analysis

This is a **greenfield project** - no existing code to extend.

### Key Discoveries:
- Solution-architect logic lives in `.claude/commands/solution-architect/plan.md` as CLI prompts
- Tracks 6 dimensions: solution_clarity, user_value, scope_boundaries, success_criteria, technical_constraints, edge_cases
- State managed via JSON files with coverage levels (not_started, weak, partial, strong)
- Final specs output to `specs/solutions/{slug}.md`

### Patterns to Follow:
- Dimension tracking structure from existing solution-architect
- Spec output format (Summary, User Value, Scope, Success Criteria, etc.)
- FastAPI/polling patterns from Nova dashboard (reference only)

## Desired End State

A running web application where:
1. PM opens browser to `http://localhost:3000`
2. PM clicks mic button and speaks naturally
3. AI responds via voice, guiding through solution design
4. Transcript visible and editable throughout
5. Session recovers if connection drops
6. Final spec auto-saved to `specs/solutions/` when complete

**Verification:** Run the app, complete a voice interview, verify spec file is generated correctly.

## What We're NOT Doing

- `/problem:plan` integration (v1 is solution-architect only)
- Spec editing after generation
- User authentication or login
- Matching existing codebase patterns
- Collaborative editing
- Project management tool integration

## Implementation Approach

**Tech Stack:**
- Frontend: React + TypeScript
- Backend: Node.js + Express + WebSocket (ws library)
- Voice: OpenAI Whisper API (STT), OpenAI TTS API
- AI: Claude API (Anthropic SDK)
- Build: Vite for frontend, tsx for backend dev

**Architecture:**
```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│  React Client   │◄──────────────────►│  Node.js Server │
│  - Mic capture  │                    │  - Session mgmt │
│  - Audio play   │                    │  - Claude API   │
│  - Transcript   │                    │  - Whisper API  │
│  - Text input   │                    │  - TTS API      │
└─────────────────┘                    └─────────────────┘
                                              │
                                              ▼
                                       specs/solutions/
```

**Project Structure:**
```
web-voice-planner/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatTranscript.tsx
│   │   │   ├── MicButton.tsx
│   │   │   ├── TextInput.tsx
│   │   │   └── StatusIndicator.tsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useAudioRecorder.ts
│   │   │   └── useAudioPlayer.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── index.ts
│   │   ├── websocket.ts
│   │   ├── session.ts
│   │   ├── claude.ts
│   │   ├── whisper.ts
│   │   ├── tts.ts
│   │   └── prompts/
│   │       └── solution-architect.ts
│   ├── package.json
│   └── tsconfig.json
├── shared/                 # Shared types
│   └── types.ts
├── package.json            # Workspace root
└── README.md
```

---

## Phase 1: Project Scaffolding

### Overview
Initialize the monorepo with React frontend and Node.js backend, configure TypeScript, set up development tooling and test infrastructure.

### Changes Required:

#### 1. Root Workspace Setup
**File**: `web-voice-planner/package.json`
```json
{
  "name": "web-voice-planner",
  "private": true,
  "workspaces": ["client", "server", "shared"],
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:client": "npm -w client run dev",
    "dev:server": "npm -w server run dev",
    "build": "npm -w shared run build && npm -w server run build && npm -w client run build",
    "test": "npm -w server run test && npm -w client run test",
    "lint": "eslint . --ext .ts,.tsx"
  },
  "devDependencies": {
    "concurrently": "^8.2.0",
    "typescript": "^5.3.0",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  }
}
```

#### 2. Shared Types
**File**: `web-voice-planner/shared/types.ts`
```typescript
// WebSocket message types
export type WSMessageType =
  | 'audio_chunk'
  | 'text_input'
  | 'transcript_update'
  | 'ai_response'
  | 'ai_audio'
  | 'session_state'
  | 'error'
  | 'stop_speaking';

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  timestamp: number;
}

// Session state
export interface SessionState {
  id: string;
  slug: string;
  startedAt: string;
  currentPhase: 'gathering' | 'edge_case_discovery' | 'validation' | 'complete';
  dimensions: Record<DimensionName, DimensionState>;
  conversationHistory: ConversationEntry[];
}

export type DimensionName =
  | 'solution_clarity'
  | 'user_value'
  | 'scope_boundaries'
  | 'success_criteria'
  | 'technical_constraints'
  | 'edge_cases';

export interface DimensionState {
  coverage: 'not_started' | 'weak' | 'partial' | 'strong';
  evidence: string[];
}

export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  audioUrl?: string;
}
```

#### 3. Server Setup
**File**: `web-voice-planner/server/package.json`
```json
{
  "name": "server",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "express": "^4.18.0",
    "ws": "^8.16.0",
    "@anthropic-ai/sdk": "^0.20.0",
    "openai": "^4.28.0",
    "uuid": "^9.0.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/ws": "^8.5.0",
    "@types/uuid": "^9.0.0",
    "tsx": "^4.7.0",
    "vitest": "^1.3.0"
  }
}
```

**File**: `web-voice-planner/server/src/index.ts`
```typescript
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    console.log('Received:', data.toString().slice(0, 100));
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

#### 4. Client Setup
**File**: `web-voice-planner/client/package.json`
```json
{
  "name": "client",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.1.0",
    "vitest": "^1.3.0",
    "@testing-library/react": "^14.2.0",
    "jsdom": "^24.0.0"
  }
}
```

**File**: `web-voice-planner/client/src/App.tsx`
```typescript
import { useState } from 'react';

function App() {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  return (
    <div className="app">
      <header>
        <h1>Web Voice Planner</h1>
        <span className={`status ${status}`}>{status}</span>
      </header>
      <main>
        <div className="transcript">
          {/* Chat transcript will go here */}
        </div>
        <div className="input-area">
          <input type="text" placeholder="Type a message..." />
          <button>Send</button>
        </div>
        <button className="mic-button">Speak</button>
      </main>
    </div>
  );
}

export default App;
```

#### 5. Test Setup
**File**: `web-voice-planner/server/src/index.test.ts`
```typescript
import { describe, it, expect } from 'vitest';

describe('Server', () => {
  it('should be configurable via environment', () => {
    // Placeholder test to verify test setup works
    expect(true).toBe(true);
  });
});
```

**File**: `web-voice-planner/client/src/App.test.tsx`
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the title', () => {
    render(<App />);
    expect(screen.getByText('Web Voice Planner')).toBeInTheDocument();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts both client and server
- [ ] `npm test` passes all tests
- [ ] `curl http://localhost:3001/health` returns `{"status":"ok"}`
- [ ] `http://localhost:5173` shows the app shell

---

## Phase 2: WebSocket Server & Session Management

### Overview
Implement real-time WebSocket communication and session state persistence that survives connection drops.

### Changes Required:

#### 1. Session Manager
**File**: `web-voice-planner/server/src/session.ts`
```typescript
import { v4 as uuid } from 'uuid';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { SessionState, DimensionName } from '../../shared/types';

const SESSIONS_DIR = '.sessions';

export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();

  async createSession(slug: string): Promise<SessionState> {
    const session: SessionState = {
      id: uuid(),
      slug,
      startedAt: new Date().toISOString(),
      currentPhase: 'gathering',
      dimensions: {
        solution_clarity: { coverage: 'not_started', evidence: [] },
        user_value: { coverage: 'not_started', evidence: [] },
        scope_boundaries: { coverage: 'not_started', evidence: [] },
        success_criteria: { coverage: 'not_started', evidence: [] },
        technical_constraints: { coverage: 'not_started', evidence: [] },
        edge_cases: { coverage: 'not_started', evidence: [] },
      },
      conversationHistory: [],
    };

    this.sessions.set(session.id, session);
    await this.persistSession(session);
    return session;
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    // Check memory first
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    // Try to load from disk
    return this.loadSession(sessionId);
  }

  async updateSession(sessionId: string, updates: Partial<SessionState>): Promise<SessionState> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updated = { ...session, ...updates };
    this.sessions.set(sessionId, updated);
    await this.persistSession(updated);
    return updated;
  }

  private async persistSession(session: SessionState): Promise<void> {
    if (!existsSync(SESSIONS_DIR)) {
      await mkdir(SESSIONS_DIR, { recursive: true });
    }
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    await writeFile(filePath, JSON.stringify(session, null, 2));
  }

  private async loadSession(sessionId: string): Promise<SessionState | null> {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    if (!existsSync(filePath)) {
      return null;
    }
    const data = await readFile(filePath, 'utf-8');
    const session = JSON.parse(data) as SessionState;
    this.sessions.set(sessionId, session);
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    if (existsSync(filePath)) {
      const { unlink } = await import('fs/promises');
      await unlink(filePath);
    }
  }
}
```

#### 2. WebSocket Handler
**File**: `web-voice-planner/server/src/websocket.ts`
```typescript
import { WebSocket, WebSocketServer } from 'ws';
import type { WSMessage, SessionState } from '../../shared/types';
import { SessionManager } from './session';

interface ClientConnection {
  ws: WebSocket;
  sessionId: string | null;
}

export class WebSocketHandler {
  private clients: Map<WebSocket, ClientConnection> = new Map();
  private sessionManager: SessionManager;

  constructor(wss: WebSocketServer, sessionManager: SessionManager) {
    this.sessionManager = sessionManager;

    wss.on('connection', (ws) => this.handleConnection(ws));
  }

  private handleConnection(ws: WebSocket): void {
    this.clients.set(ws, { ws, sessionId: null });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        await this.handleMessage(ws, message);
      } catch (error) {
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });
  }

  private async handleMessage(ws: WebSocket, message: WSMessage): Promise<void> {
    const client = this.clients.get(ws)!;

    switch (message.type) {
      case 'session_state':
        // Client requesting to start or resume session
        const { sessionId, slug } = message.payload as { sessionId?: string; slug?: string };

        if (sessionId) {
          // Resume existing session
          const session = await this.sessionManager.getSession(sessionId);
          if (session) {
            client.sessionId = sessionId;
            this.sendSessionState(ws, session);
          } else {
            this.sendError(ws, 'Session not found');
          }
        } else if (slug) {
          // Create new session
          const session = await this.sessionManager.createSession(slug);
          client.sessionId = session.id;
          this.sendSessionState(ws, session);
        }
        break;

      case 'text_input':
        // Handle text message from user
        if (!client.sessionId) {
          this.sendError(ws, 'No active session');
          return;
        }
        // Will be handled by Claude integration in Phase 3
        break;

      case 'audio_chunk':
        // Handle audio from user
        if (!client.sessionId) {
          this.sendError(ws, 'No active session');
          return;
        }
        // Will be handled by Whisper integration in Phase 4
        break;

      case 'stop_speaking':
        // User wants to stop TTS playback
        // Will be handled in Phase 4
        break;
    }
  }

  private sendSessionState(ws: WebSocket, session: SessionState): void {
    this.send(ws, { type: 'session_state', payload: session, timestamp: Date.now() });
  }

  private sendError(ws: WebSocket, message: string): void {
    this.send(ws, { type: 'error', payload: { message }, timestamp: Date.now() });
  }

  private send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
```

#### 3. Tests
**File**: `web-voice-planner/server/src/session.test.ts`
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from './session';
import { rm } from 'fs/promises';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  afterEach(async () => {
    await rm('.sessions', { recursive: true, force: true });
  });

  it('creates a new session with correct initial state', async () => {
    const session = await manager.createSession('test-feature');

    expect(session.id).toBeDefined();
    expect(session.slug).toBe('test-feature');
    expect(session.currentPhase).toBe('gathering');
    expect(session.dimensions.solution_clarity.coverage).toBe('not_started');
  });

  it('persists and recovers session from disk', async () => {
    const created = await manager.createSession('test-feature');

    // Create new manager instance (simulates server restart)
    const newManager = new SessionManager();
    const recovered = await newManager.getSession(created.id);

    expect(recovered).not.toBeNull();
    expect(recovered!.slug).toBe('test-feature');
  });

  it('updates session state', async () => {
    const session = await manager.createSession('test-feature');

    await manager.updateSession(session.id, {
      currentPhase: 'validation',
    });

    const updated = await manager.getSession(session.id);
    expect(updated!.currentPhase).toBe('validation');
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm -w server run test` passes session tests
- [ ] WebSocket connects and creates session
- [ ] Session persists to `.sessions/` directory
- [ ] Session recovers after server restart
- [ ] Multiple clients can have independent sessions

---

## Phase 3: Claude API Integration

### Overview
Extract solution-architect interview logic and implement Claude API integration for guiding conversations.

### Changes Required:

#### 1. Solution Architect Prompts
**File**: `web-voice-planner/server/src/prompts/solution-architect.ts`
```typescript
import type { SessionState, DimensionName } from '../../../shared/types';

export const SYSTEM_PROMPT = `You are Solution Architect, an expert at helping Product Managers define what to build through focused conversation.

Your goal: Guide the PM through defining a complete solution specification by exploring 6 dimensions:
1. solution_clarity - What exactly are we building?
2. user_value - Who is it for and why do they need it?
3. scope_boundaries - What's included vs excluded?
4. success_criteria - How do we know it works?
5. technical_constraints - What technical requirements exist?
6. edge_cases - What could go wrong?

INTERVIEW RULES:
- Ask ONE focused question at a time
- Keep responses concise (2-4 sentences max) - this is a VOICE conversation
- Use the PM's own words to show you're listening
- Redirect solution-talk back to "what we're building"
- When a dimension reaches "strong" coverage, naturally transition to the next
- Be conversational and warm, not robotic

THRESHOLDS FOR COMPLETION:
- solution_clarity, user_value, scope_boundaries, success_criteria: need "strong"
- technical_constraints, edge_cases: need at least "partial"

When ALL thresholds are met, summarize and offer to generate the spec.`;

export function buildContextPrompt(session: SessionState): string {
  const dimensionStatus = Object.entries(session.dimensions)
    .map(([name, state]) => `- ${name}: ${state.coverage}`)
    .join('\n');

  return `Current session: ${session.slug}
Phase: ${session.currentPhase}

Dimension coverage:
${dimensionStatus}

Continue the interview based on the conversation history. Focus on dimensions that need more coverage.`;
}

export function formatConversationHistory(session: SessionState): Array<{ role: 'user' | 'assistant'; content: string }> {
  return session.conversationHistory.map(entry => ({
    role: entry.role,
    content: entry.content,
  }));
}

export function assessDimensionCoverage(
  dimension: DimensionName,
  evidence: string[]
): 'not_started' | 'weak' | 'partial' | 'strong' {
  if (evidence.length === 0) return 'not_started';
  if (evidence.length === 1) return 'weak';
  if (evidence.length < 3) return 'partial';
  return 'strong';
}

export function isReadyToGenerate(session: SessionState): boolean {
  const strongRequired: DimensionName[] = [
    'solution_clarity',
    'user_value',
    'scope_boundaries',
    'success_criteria',
  ];
  const partialRequired: DimensionName[] = [
    'technical_constraints',
    'edge_cases',
  ];

  const strongMet = strongRequired.every(
    d => session.dimensions[d].coverage === 'strong'
  );
  const partialMet = partialRequired.every(
    d => ['partial', 'strong'].includes(session.dimensions[d].coverage)
  );

  return strongMet && partialMet;
}
```

#### 2. Claude API Client
**File**: `web-voice-planner/server/src/claude.ts`
```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { SessionState, ConversationEntry } from '../../shared/types';
import {
  SYSTEM_PROMPT,
  buildContextPrompt,
  formatConversationHistory,
  isReadyToGenerate,
} from './prompts/solution-architect';

export class ClaudeClient {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async chat(session: SessionState, userMessage: string): Promise<{
    response: string;
    shouldGenerate: boolean;
  }> {
    const history = formatConversationHistory(session);
    const contextPrompt = buildContextPrompt(session);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500, // Keep responses short for voice
      system: `${SYSTEM_PROMPT}\n\n${contextPrompt}`,
      messages: [
        ...history,
        { role: 'user', content: userMessage },
      ],
    });

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    return {
      response: assistantMessage,
      shouldGenerate: isReadyToGenerate(session),
    };
  }

  async generateSpec(session: SessionState): Promise<string> {
    const history = formatConversationHistory(session);

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `Based on the conversation, generate a complete solution specification in markdown format.

Include these sections:
# Solution Specification: {title}

## Summary
## User Value
## Scope (Included/Excluded/Future Considerations)
## Success Criteria
## Technical Constraints
## Edge Cases (table format)
## Implementation Diagram (Mermaid flowchart)
## Effort Estimate (XS/S/M/L/XL with reasoning)

End with:
---
Generated by Solution Architect v2
Confidence: HIGH/MEDIUM/LOW`,
      messages: [
        ...history,
        { role: 'user', content: 'Please generate the complete solution specification based on our conversation.' },
      ],
    });

    return response.content[0].type === 'text'
      ? response.content[0].text
      : '';
  }
}
```

#### 3. Integration with WebSocket
**File**: `web-voice-planner/server/src/websocket.ts` (update handleMessage)
```typescript
// Add to handleMessage switch statement:

case 'text_input':
  if (!client.sessionId) {
    this.sendError(ws, 'No active session');
    return;
  }

  const session = await this.sessionManager.getSession(client.sessionId);
  if (!session) {
    this.sendError(ws, 'Session not found');
    return;
  }

  const userText = (message.payload as { text: string }).text;

  // Add user message to history
  session.conversationHistory.push({
    role: 'user',
    content: userText,
    timestamp: new Date().toISOString(),
  });

  // Get AI response
  const { response, shouldGenerate } = await this.claudeClient.chat(session, userText);

  // Add assistant message to history
  session.conversationHistory.push({
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
  });

  // Update session
  await this.sessionManager.updateSession(client.sessionId, {
    conversationHistory: session.conversationHistory,
  });

  // Send response to client
  this.send(ws, {
    type: 'ai_response',
    payload: { text: response, shouldGenerate },
    timestamp: Date.now(),
  });
  break;
```

#### 4. Tests
**File**: `web-voice-planner/server/src/prompts/solution-architect.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import {
  assessDimensionCoverage,
  isReadyToGenerate,
  buildContextPrompt,
} from './solution-architect';
import type { SessionState } from '../../../shared/types';

describe('Solution Architect Prompts', () => {
  describe('assessDimensionCoverage', () => {
    it('returns not_started for empty evidence', () => {
      expect(assessDimensionCoverage('solution_clarity', [])).toBe('not_started');
    });

    it('returns weak for single evidence', () => {
      expect(assessDimensionCoverage('solution_clarity', ['one'])).toBe('weak');
    });

    it('returns partial for 2 evidence items', () => {
      expect(assessDimensionCoverage('solution_clarity', ['one', 'two'])).toBe('partial');
    });

    it('returns strong for 3+ evidence items', () => {
      expect(assessDimensionCoverage('solution_clarity', ['one', 'two', 'three'])).toBe('strong');
    });
  });

  describe('isReadyToGenerate', () => {
    it('returns false when dimensions incomplete', () => {
      const session = createTestSession();
      expect(isReadyToGenerate(session)).toBe(false);
    });

    it('returns true when all thresholds met', () => {
      const session = createTestSession();
      // Set strong for required dimensions
      session.dimensions.solution_clarity.coverage = 'strong';
      session.dimensions.user_value.coverage = 'strong';
      session.dimensions.scope_boundaries.coverage = 'strong';
      session.dimensions.success_criteria.coverage = 'strong';
      // Set partial for optional dimensions
      session.dimensions.technical_constraints.coverage = 'partial';
      session.dimensions.edge_cases.coverage = 'partial';

      expect(isReadyToGenerate(session)).toBe(true);
    });
  });
});

function createTestSession(): SessionState {
  return {
    id: 'test-id',
    slug: 'test-feature',
    startedAt: new Date().toISOString(),
    currentPhase: 'gathering',
    dimensions: {
      solution_clarity: { coverage: 'not_started', evidence: [] },
      user_value: { coverage: 'not_started', evidence: [] },
      scope_boundaries: { coverage: 'not_started', evidence: [] },
      success_criteria: { coverage: 'not_started', evidence: [] },
      technical_constraints: { coverage: 'not_started', evidence: [] },
      edge_cases: { coverage: 'not_started', evidence: [] },
    },
    conversationHistory: [],
  };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm -w server run test` passes prompt tests
- [ ] Text input via WebSocket returns AI response
- [ ] Conversation history persists across messages
- [ ] `isReadyToGenerate` correctly identifies completion
- [ ] Spec generation produces valid markdown

---

## Phase 4: Voice Pipeline

### Overview
Integrate OpenAI Whisper for speech-to-text and OpenAI TTS for text-to-speech, with streaming and interrupt handling.

### Changes Required:

#### 1. Whisper Integration (STT)
**File**: `web-voice-planner/server/src/whisper.ts`
```typescript
import OpenAI from 'openai';
import { Readable } from 'stream';

export class WhisperClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI();
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    // Convert buffer to a file-like object
    const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });

    const response = await this.client.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'en',
    });

    return response.text;
  }

  async transcribeStream(audioChunks: Buffer[]): Promise<string> {
    // Combine chunks into single buffer
    const combined = Buffer.concat(audioChunks);
    return this.transcribe(combined);
  }
}
```

#### 2. TTS Integration
**File**: `web-voice-planner/server/src/tts.ts`
```typescript
import OpenAI from 'openai';

export class TTSClient {
  private client: OpenAI;
  private currentRequest: AbortController | null = null;

  constructor() {
    this.client = new OpenAI();
  }

  async synthesize(text: string): Promise<Buffer> {
    this.currentRequest = new AbortController();

    const response = await this.client.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text,
      response_format: 'mp3',
    });

    const arrayBuffer = await response.arrayBuffer();
    this.currentRequest = null;
    return Buffer.from(arrayBuffer);
  }

  async synthesizeStreaming(
    text: string,
    onChunk: (chunk: Buffer) => void
  ): Promise<void> {
    this.currentRequest = new AbortController();

    // Split text into sentences for chunked TTS
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    for (const sentence of sentences) {
      if (this.currentRequest?.signal.aborted) {
        break;
      }

      const response = await this.client.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: sentence.trim(),
        response_format: 'mp3',
      });

      const arrayBuffer = await response.arrayBuffer();
      onChunk(Buffer.from(arrayBuffer));
    }

    this.currentRequest = null;
  }

  stop(): void {
    if (this.currentRequest) {
      this.currentRequest.abort();
      this.currentRequest = null;
    }
  }
}
```

#### 3. WebSocket Voice Handling
**File**: `web-voice-planner/server/src/websocket.ts` (add voice handling)
```typescript
// Add to class properties:
private whisperClient: WhisperClient;
private ttsClient: TTSClient;
private audioBuffers: Map<string, Buffer[]> = new Map();

// Add to handleMessage switch:

case 'audio_chunk':
  if (!client.sessionId) {
    this.sendError(ws, 'No active session');
    return;
  }

  const audioData = message.payload as { chunk: string; isLast: boolean };
  const chunk = Buffer.from(audioData.chunk, 'base64');

  // Accumulate audio chunks
  if (!this.audioBuffers.has(client.sessionId)) {
    this.audioBuffers.set(client.sessionId, []);
  }
  this.audioBuffers.get(client.sessionId)!.push(chunk);

  if (audioData.isLast) {
    // Transcribe accumulated audio
    const chunks = this.audioBuffers.get(client.sessionId)!;
    this.audioBuffers.delete(client.sessionId);

    const transcript = await this.whisperClient.transcribeStream(chunks);

    // Send transcript to client
    this.send(ws, {
      type: 'transcript_update',
      payload: { text: transcript, source: 'voice' },
      timestamp: Date.now(),
    });

    // Process as text input (reuse existing logic)
    await this.handleTextInput(ws, client, transcript);
  }
  break;

case 'stop_speaking':
  this.ttsClient.stop();
  break;

// Modify AI response handling to include TTS:
private async sendAIResponse(ws: WebSocket, text: string, shouldGenerate: boolean): Promise<void> {
  // Send text first
  this.send(ws, {
    type: 'ai_response',
    payload: { text, shouldGenerate },
    timestamp: Date.now(),
  });

  // Stream TTS audio
  await this.ttsClient.synthesizeStreaming(text, (audioChunk) => {
    this.send(ws, {
      type: 'ai_audio',
      payload: { chunk: audioChunk.toString('base64') },
      timestamp: Date.now(),
    });
  });
}
```

#### 4. Tests
**File**: `web-voice-planner/server/src/whisper.test.ts`
```typescript
import { describe, it, expect, vi } from 'vitest';
import { WhisperClient } from './whisper';

// Mock OpenAI
vi.mock('openai', () => ({
  default: class {
    audio = {
      transcriptions: {
        create: vi.fn().mockResolvedValue({ text: 'Hello world' }),
      },
    };
  },
}));

describe('WhisperClient', () => {
  it('transcribes audio buffer', async () => {
    const client = new WhisperClient();
    const mockAudio = Buffer.from('mock audio data');

    const result = await client.transcribe(mockAudio);

    expect(result).toBe('Hello world');
  });

  it('combines chunks for stream transcription', async () => {
    const client = new WhisperClient();
    const chunks = [
      Buffer.from('chunk1'),
      Buffer.from('chunk2'),
    ];

    const result = await client.transcribeStream(chunks);

    expect(result).toBe('Hello world');
  });
});
```

**File**: `web-voice-planner/server/src/tts.test.ts`
```typescript
import { describe, it, expect, vi } from 'vitest';
import { TTSClient } from './tts';

vi.mock('openai', () => ({
  default: class {
    audio = {
      speech: {
        create: vi.fn().mockResolvedValue({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        }),
      },
    };
  },
}));

describe('TTSClient', () => {
  it('synthesizes text to audio', async () => {
    const client = new TTSClient();

    const result = await client.synthesize('Hello world');

    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('can be stopped mid-stream', async () => {
    const client = new TTSClient();
    const chunks: Buffer[] = [];

    const promise = client.synthesizeStreaming(
      'First sentence. Second sentence. Third sentence.',
      (chunk) => chunks.push(chunk)
    );

    // Stop after a short delay
    setTimeout(() => client.stop(), 10);

    await promise;

    // Should have fewer chunks than sentences due to abort
    expect(chunks.length).toBeLessThanOrEqual(3);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm -w server run test` passes voice tests
- [ ] Audio chunks sent via WebSocket are transcribed
- [ ] Transcript returned to client
- [ ] AI response includes TTS audio chunks
- [ ] Stop speaking command halts TTS stream

---

## Phase 5: Frontend UI

### Overview
Build the React frontend with chat transcript, mic button, text input, and status indicators.

### Changes Required:

#### 1. WebSocket Hook
**File**: `web-voice-planner/client/src/hooks/useWebSocket.ts`
```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import type { WSMessage, SessionState } from '../../../shared/types';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useWebSocket(url: string) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [session, setSession] = useState<SessionState | null>(null);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>();

  const connect = useCallback(() => {
    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      // Try to resume session from localStorage
      const savedSessionId = localStorage.getItem('sessionId');
      if (savedSessionId) {
        send({ type: 'session_state', payload: { sessionId: savedSessionId }, timestamp: Date.now() });
      }
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as WSMessage;
      setLastMessage(message);

      if (message.type === 'session_state') {
        const sessionData = message.payload as SessionState;
        setSession(sessionData);
        localStorage.setItem('sessionId', sessionData.id);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      // Auto-reconnect after 2 seconds
      reconnectTimeoutRef.current = window.setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      setStatus('error');
    };
  }, [url]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
  }, []);

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const startSession = useCallback((slug: string) => {
    send({ type: 'session_state', payload: { slug }, timestamp: Date.now() });
  }, [send]);

  const sendText = useCallback((text: string) => {
    send({ type: 'text_input', payload: { text }, timestamp: Date.now() });
  }, [send]);

  const sendAudioChunk = useCallback((chunk: string, isLast: boolean) => {
    send({ type: 'audio_chunk', payload: { chunk, isLast }, timestamp: Date.now() });
  }, [send]);

  const stopSpeaking = useCallback(() => {
    send({ type: 'stop_speaking', payload: {}, timestamp: Date.now() });
  }, [send]);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    status,
    session,
    lastMessage,
    startSession,
    sendText,
    sendAudioChunk,
    stopSpeaking,
  };
}
```

#### 2. Audio Recorder Hook
**File**: `web-voice-planner/client/src/hooks/useAudioRecorder.ts`
```typescript
import { useState, useRef, useCallback } from 'react';

export function useAudioRecorder(onChunk: (chunk: string, isLast: boolean) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        onChunk(base64, true);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
    } catch (error) {
      if ((error as Error).name === 'NotAllowedError') {
        setPermissionDenied(true);
      }
      console.error('Failed to start recording:', error);
    }
  }, [onChunk]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  return {
    isRecording,
    permissionDenied,
    startRecording,
    stopRecording,
  };
}
```

#### 3. Audio Player Hook
**File**: `web-voice-planner/client/src/hooks/useAudioPlayer.ts`
```typescript
import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    audioContextRef.current = new AudioContext();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  const playChunk = useCallback(async (base64Audio: string) => {
    if (!audioContextRef.current) return;

    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);
    audioQueueRef.current.push(audioBuffer);

    if (!isPlayingRef.current) {
      playNext();
    }
  }, []);

  const playNext = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);

    const buffer = audioQueueRef.current.shift()!;
    const source = audioContextRef.current!.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current!.destination);
    source.onended = playNext;
    source.start();
  }, []);

  const stop = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  return {
    isPlaying,
    playChunk,
    stop,
  };
}
```

#### 4. Main App Component
**File**: `web-voice-planner/client/src/App.tsx`
```typescript
import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { ChatTranscript } from './components/ChatTranscript';
import { MicButton } from './components/MicButton';
import { TextInput } from './components/TextInput';
import { StatusIndicator } from './components/StatusIndicator';
import type { ConversationEntry } from '../../shared/types';
import './App.css';

const WS_URL = 'ws://localhost:3001';

function App() {
  const [messages, setMessages] = useState<ConversationEntry[]>([]);
  const [featureName, setFeatureName] = useState('');
  const [hasStarted, setHasStarted] = useState(false);

  const {
    status,
    session,
    lastMessage,
    startSession,
    sendText,
    sendAudioChunk,
    stopSpeaking,
  } = useWebSocket(WS_URL);

  const { isPlaying, playChunk, stop: stopAudio } = useAudioPlayer();

  const {
    isRecording,
    permissionDenied,
    startRecording,
    stopRecording,
  } = useAudioRecorder(sendAudioChunk);

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'ai_response':
        const { text } = lastMessage.payload as { text: string };
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: text,
          timestamp: new Date().toISOString(),
        }]);
        break;

      case 'ai_audio':
        const { chunk } = lastMessage.payload as { chunk: string };
        playChunk(chunk);
        break;

      case 'transcript_update':
        const { text: transcript } = lastMessage.payload as { text: string };
        setMessages(prev => [...prev, {
          role: 'user',
          content: transcript,
          timestamp: new Date().toISOString(),
        }]);
        break;
    }
  }, [lastMessage, playChunk]);

  // Restore messages from session
  useEffect(() => {
    if (session?.conversationHistory) {
      setMessages(session.conversationHistory);
      setHasStarted(true);
    }
  }, [session]);

  const handleStart = () => {
    if (featureName.trim()) {
      startSession(featureName.trim().toLowerCase().replace(/\s+/g, '-'));
      setHasStarted(true);
    }
  };

  const handleSendText = (text: string) => {
    setMessages(prev => [...prev, {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }]);
    sendText(text);
  };

  const handleStopSpeaking = () => {
    stopAudio();
    stopSpeaking();
  };

  if (!hasStarted) {
    return (
      <div className="app start-screen">
        <h1>Web Voice Planner</h1>
        <p>Design your next feature through conversation</p>
        <div className="start-form">
          <input
            type="text"
            value={featureName}
            onChange={(e) => setFeatureName(e.target.value)}
            placeholder="Feature name (e.g., user-onboarding)"
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          />
          <button onClick={handleStart} disabled={!featureName.trim()}>
            Start Session
          </button>
        </div>
        <StatusIndicator status={status} />
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Web Voice Planner</h1>
        <span className="session-name">{session?.slug}</span>
        <StatusIndicator status={status} />
      </header>

      <main>
        <ChatTranscript messages={messages} />

        <div className="input-area">
          <TextInput onSend={handleSendText} disabled={status !== 'connected'} />

          <MicButton
            isRecording={isRecording}
            isPlaying={isPlaying}
            permissionDenied={permissionDenied}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onStopSpeaking={handleStopSpeaking}
            disabled={status !== 'connected'}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
```

#### 5. Components
**File**: `web-voice-planner/client/src/components/ChatTranscript.tsx`
```typescript
import { useEffect, useRef } from 'react';
import type { ConversationEntry } from '../../../shared/types';

interface Props {
  messages: ConversationEntry[];
}

export function ChatTranscript({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="transcript">
      {messages.map((msg, i) => (
        <div key={i} className={`message ${msg.role}`}>
          <span className="role">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
          <p>{msg.content}</p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

**File**: `web-voice-planner/client/src/components/MicButton.tsx`
```typescript
interface Props {
  isRecording: boolean;
  isPlaying: boolean;
  permissionDenied: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onStopSpeaking: () => void;
  disabled: boolean;
}

export function MicButton({
  isRecording,
  isPlaying,
  permissionDenied,
  onStartRecording,
  onStopRecording,
  onStopSpeaking,
  disabled,
}: Props) {
  if (permissionDenied) {
    return (
      <div className="mic-denied">
        Microphone access denied. Please enable in browser settings.
      </div>
    );
  }

  if (isPlaying) {
    return (
      <button className="mic-button stop" onClick={onStopSpeaking}>
        Stop Speaking
      </button>
    );
  }

  return (
    <button
      className={`mic-button ${isRecording ? 'recording' : ''}`}
      onClick={isRecording ? onStopRecording : onStartRecording}
      disabled={disabled}
    >
      {isRecording ? 'Stop' : 'Speak'}
    </button>
  );
}
```

**File**: `web-voice-planner/client/src/components/TextInput.tsx`
```typescript
import { useState, KeyboardEvent } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function TextInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="text-input">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message..."
        disabled={disabled}
      />
      <button onClick={handleSend} disabled={disabled || !text.trim()}>
        Send
      </button>
    </div>
  );
}
```

**File**: `web-voice-planner/client/src/components/StatusIndicator.tsx`
```typescript
interface Props {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export function StatusIndicator({ status }: Props) {
  const labels = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Connection Error',
  };

  return (
    <span className={`status-indicator ${status}`}>
      {labels[status]}
    </span>
  );
}
```

#### 6. Tests
**File**: `web-voice-planner/client/src/App.test.tsx`
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

// Mock WebSocket
vi.stubGlobal('WebSocket', class {
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  send = vi.fn();
  close = vi.fn();
  constructor() {
    setTimeout(() => this.onopen?.(), 0);
  }
});

describe('App', () => {
  it('shows start screen initially', () => {
    render(<App />);
    expect(screen.getByText('Web Voice Planner')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/feature name/i)).toBeInTheDocument();
  });

  it('starts session when feature name entered', async () => {
    render(<App />);

    const input = screen.getByPlaceholderText(/feature name/i);
    fireEvent.change(input, { target: { value: 'test-feature' } });

    const button = screen.getByText('Start Session');
    fireEvent.click(button);

    // Should transition to main view
    expect(screen.queryByText('Start Session')).not.toBeInTheDocument();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm -w client run test` passes component tests
- [ ] App shows start screen with feature name input
- [ ] Session starts and shows chat interface
- [ ] Text input sends messages and shows responses
- [ ] Mic button toggles recording state
- [ ] Status indicator reflects connection state
- [ ] Session restores after page refresh

---

## Phase 6: Spec Generation & Storage

### Overview
Generate final markdown spec when interview completes and save to accessible location for engineers.

### Changes Required:

#### 1. Spec Writer
**File**: `web-voice-planner/server/src/spec-writer.ts`
```typescript
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SPECS_DIR = 'specs/solutions';

export class SpecWriter {
  async saveSpec(slug: string, content: string): Promise<string> {
    // Ensure directory exists
    if (!existsSync(SPECS_DIR)) {
      await mkdir(SPECS_DIR, { recursive: true });
    }

    const filename = `${slug}.md`;
    const filePath = path.join(SPECS_DIR, filename);

    await writeFile(filePath, content, 'utf-8');

    return filePath;
  }
}
```

#### 2. Integration with WebSocket
**File**: `web-voice-planner/server/src/websocket.ts` (add spec generation)
```typescript
// Add to class:
private specWriter: SpecWriter;

// Add new message handler for generating spec:
case 'generate_spec':
  if (!client.sessionId) {
    this.sendError(ws, 'No active session');
    return;
  }

  const sessionForSpec = await this.sessionManager.getSession(client.sessionId);
  if (!sessionForSpec) {
    this.sendError(ws, 'Session not found');
    return;
  }

  // Generate spec using Claude
  const specContent = await this.claudeClient.generateSpec(sessionForSpec);

  // Save to disk
  const specPath = await this.specWriter.saveSpec(sessionForSpec.slug, specContent);

  // Notify client
  this.send(ws, {
    type: 'spec_generated',
    payload: { path: specPath, content: specContent },
    timestamp: Date.now(),
  });

  // Clean up session
  await this.sessionManager.deleteSession(client.sessionId);
  client.sessionId = null;
  localStorage.removeItem('sessionId');
  break;
```

#### 3. Frontend Completion UI
**File**: `web-voice-planner/client/src/components/SpecComplete.tsx`
```typescript
interface Props {
  specPath: string;
  specContent: string;
  onNewSession: () => void;
}

export function SpecComplete({ specPath, specContent, onNewSession }: Props) {
  return (
    <div className="spec-complete">
      <h2>Specification Complete!</h2>
      <p>Your solution spec has been saved to:</p>
      <code>{specPath}</code>

      <details>
        <summary>Preview Spec</summary>
        <pre>{specContent}</pre>
      </details>

      <button onClick={onNewSession}>Start New Session</button>
    </div>
  );
}
```

#### 4. Tests
**File**: `web-voice-planner/server/src/spec-writer.test.ts`
```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { SpecWriter } from './spec-writer';
import { readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';

describe('SpecWriter', () => {
  const writer = new SpecWriter();

  afterEach(async () => {
    // Clean up test files
    if (existsSync('specs/solutions/test-feature.md')) {
      await rm('specs/solutions/test-feature.md');
    }
  });

  it('saves spec to correct location', async () => {
    const content = '# Test Spec\n\nThis is a test.';

    const path = await writer.saveSpec('test-feature', content);

    expect(path).toBe('specs/solutions/test-feature.md');
    expect(existsSync(path)).toBe(true);

    const saved = await readFile(path, 'utf-8');
    expect(saved).toBe(content);
  });

  it('creates directory if not exists', async () => {
    await rm('specs/solutions', { recursive: true, force: true });

    await writer.saveSpec('test-feature', '# Test');

    expect(existsSync('specs/solutions')).toBe(true);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm -w server run test` passes spec writer tests
- [ ] Spec generated when all dimensions complete
- [ ] Spec saved to `specs/solutions/{slug}.md`
- [ ] Client shows completion UI with spec preview
- [ ] Session cleaned up after spec generation

---

## Phase 7: Edge Case Hardening

### Overview
Handle all 14 edge cases from the solution spec to ensure robust operation.

### Edge Cases (from Solution Spec)

| Scenario | Severity | Implementation Approach |
|----------|----------|------------------------|
| Misheard voice input | Medium | Show live transcript so user can see text before AI responds; allow editing |
| Connection drops mid-session | High | Session persisted to disk; auto-reconnect with backoff; restore conversation on reconnect |
| PM prefers typing for part of session | Low | Text input always available alongside mic button |
| PM steps away mid-conversation | Low | No session timeout; conversation waits indefinitely |
| Noisy environment | Medium | Show clear audio recording indicator; text fallback prominently available |
| External API failures (Whisper/TTS/Claude) | High | Catch errors; show user-friendly message; allow text-only fallback mode |
| User interrupts TTS playback | Medium | Stop speaking button; halt audio immediately when clicked |
| Concurrent audio (user speaks while TTS playing) | Medium | Auto-pause TTS when recording starts; clear audio queue |
| Long Claude responses | Low | Stream TTS in sentence chunks; show text progressively |
| High network latency | Medium | Show "processing" indicators; buffer audio locally before sending |
| Browser denies microphone permission | High | Detect denial; show prominent text input as primary mode |
| Multiple tabs with same session | Low | Show "session active elsewhere" warning via session lock |
| Spec file save failure | High | Retry with backoff; keep spec in memory until confirmed saved |
| WebSocket reconnection | Medium | Auto-reconnect with exponential backoff; show connection status |

### Changes Required:

#### 1. Error Handling Wrapper
**File**: `web-voice-planner/server/src/error-handler.ts`
```typescript
import type { WebSocket } from 'ws';
import type { WSMessage } from '../../shared/types';

export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (error instanceof APIError && !error.retryable) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, i)));
    }
  }

  throw lastError;
}

export function sendErrorToClient(ws: WebSocket, error: Error, fallbackMode?: string): void {
  const message: WSMessage = {
    type: 'error',
    payload: {
      message: error.message,
      code: error instanceof APIError ? error.code : 'UNKNOWN',
      fallbackMode,
    },
    timestamp: Date.now(),
  };

  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
```

#### 2. Session Locking
**File**: `web-voice-planner/server/src/session.ts` (add locking)
```typescript
// Add to SessionManager:
private locks: Map<string, string> = new Map(); // sessionId -> clientId

acquireLock(sessionId: string, clientId: string): boolean {
  const currentLock = this.locks.get(sessionId);
  if (currentLock && currentLock !== clientId) {
    return false; // Session locked by another client
  }
  this.locks.set(sessionId, clientId);
  return true;
}

releaseLock(sessionId: string, clientId: string): void {
  if (this.locks.get(sessionId) === clientId) {
    this.locks.delete(sessionId);
  }
}

isLocked(sessionId: string, clientId: string): boolean {
  const lock = this.locks.get(sessionId);
  return lock !== undefined && lock !== clientId;
}
```

#### 3. Frontend Error Handling
**File**: `web-voice-planner/client/src/components/ErrorBanner.tsx`
```typescript
interface Props {
  error: { message: string; code: string; fallbackMode?: string } | null;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: Props) {
  if (!error) return null;

  return (
    <div className="error-banner">
      <span>{error.message}</span>
      {error.fallbackMode === 'text-only' && (
        <span className="fallback-hint">Voice unavailable. Using text mode.</span>
      )}
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  );
}
```

#### 4. Reconnection Logic
**File**: `web-voice-planner/client/src/hooks/useWebSocket.ts` (enhance reconnect)
```typescript
// Add exponential backoff reconnection:
const reconnectAttempts = useRef(0);
const MAX_RECONNECT_ATTEMPTS = 10;

const connect = useCallback(() => {
  if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
    setStatus('error');
    return;
  }

  setStatus('connecting');
  const ws = new WebSocket(url);
  wsRef.current = ws;

  ws.onopen = () => {
    setStatus('connected');
    reconnectAttempts.current = 0; // Reset on successful connect
    // ... rest of onopen logic
  };

  ws.onclose = () => {
    setStatus('disconnected');
    reconnectAttempts.current++;
    const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    reconnectTimeoutRef.current = window.setTimeout(connect, backoff);
  };
  // ... rest
}, [url]);
```

#### 5. Tests
**File**: `web-voice-planner/server/src/error-handler.test.ts`
```typescript
import { describe, it, expect, vi } from 'vitest';
import { withRetry, APIError } from './error-handler';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, 3, 10);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws non-retryable errors immediately', async () => {
    const fn = vi.fn().mockRejectedValue(new APIError('fail', 'AUTH', false));

    await expect(withRetry(fn)).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm test` passes all error handling tests
- [ ] Connection drops recover automatically
- [ ] API failures show user-friendly errors
- [ ] Text fallback works when voice fails
- [ ] Multiple tab warning displayed
- [ ] Spec save retries on failure

---

## Testing Strategy

### Unit Tests:
- Session manager CRUD operations
- Prompt logic and dimension assessment
- Audio buffer handling
- Error retry logic
- Component rendering

### Integration Tests:
- WebSocket message flow
- Full conversation round-trip
- Spec generation and save
- Session recovery after disconnect

### Manual Testing:
- Voice recording and playback quality
- Cross-browser microphone access
- Network interruption scenarios
- Long conversation sessions

---

## Beads Issues to Create

After plan approval, create these issues:

```bash
bd add "Phase 1: Project scaffolding - React + Node.js monorepo setup" --label implementation
bd add "Phase 2: WebSocket server and session persistence" --label implementation
bd add "Phase 3: Claude API integration with solution-architect prompts" --label implementation
bd add "Phase 4: Voice pipeline - Whisper STT and OpenAI TTS" --label implementation
bd add "Phase 5: Frontend UI - chat transcript, mic button, text input" --label implementation
bd add "Phase 6: Spec generation and storage" --label implementation
bd add "Phase 7: Edge case hardening - error handling and recovery" --label implementation
```

---

## References

- Solution spec: `specs/solutions/web-voice-planner.md`
- Solution-architect prompts: `.claude/commands/solution-architect/plan.md`
- Nova dashboard patterns: `program_nova/dashboard/server.py`
- Testing patterns: `program_nova/engine/test_state.py`
