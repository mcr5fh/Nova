# Nova Voice Interface Architecture

Web-based voice interface for the Nova conversational framework.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │
│  │  Microphone │───▶│ Web Speech  │───▶│                         │  │
│  │             │    │ API (STT)   │    │                         │  │
│  └─────────────┘    └─────────────┘    │     Voice UI            │  │
│                                        │  - Conversation view    │  │
│  ┌─────────────┐    ┌─────────────┐    │  - Progress indicators  │  │
│  │  Speakers   │◀───│ TTS Engine  │◀───│  - Voice controls       │  │
│  │             │    │ (ElevenLabs │    │  - Session state        │  │
│  └─────────────┘    │  or Web API)│    │                         │  │
│                     └─────────────┘    └───────────┬─────────────┘  │
│                                                    │                 │
│                                          WebSocket │                 │
└──────────────────────────────────────────────────┬─┴─────────────────┘
                                                   │
                                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVER (Node.js)                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    WebSocket Handler                         │    │
│  │  - Connection management                                     │    │
│  │  - Message routing                                           │    │
│  │  - Session lifecycle                                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                    │                                 │
│                                    ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  Session Manager                             │    │
│  │  - Maps WebSocket connections to Nova sessions               │    │
│  │  - Handles reconnection/resume                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                    │                                 │
│              ┌─────────────────────┴─────────────────────┐          │
│              ▼                                           ▼          │
│  ┌─────────────────────┐                   ┌─────────────────────┐  │
│  │   ProblemAdvisor    │                   │  SolutionArchitect  │  │
│  │   (existing API)    │                   │   (existing API)    │  │
│  └──────────┬──────────┘                   └──────────┬──────────┘  │
│             │                                         │              │
│             └─────────────────┬───────────────────────┘              │
│                               ▼                                      │
│                    ┌─────────────────────┐                          │
│                    │   Anthropic SDK     │                          │
│                    │   (Claude API)      │                          │
│                    └─────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Frontend (`packages/nova-web/`)

```
nova-web/
├── src/
│   ├── components/
│   │   ├── VoiceButton.tsx      # Push-to-talk or continuous listen
│   │   ├── ConversationView.tsx # Shows messages + who's speaking
│   │   ├── ProgressPanel.tsx    # Dimension coverage display
│   │   └── ModeSelector.tsx     # Problem vs Solution mode
│   ├── hooks/
│   │   ├── useSpeechRecognition.ts  # Web Speech API wrapper
│   │   ├── useTextToSpeech.ts       # TTS abstraction
│   │   └── useNovaSession.ts        # WebSocket connection
│   ├── services/
│   │   ├── tts/
│   │   │   ├── index.ts             # TTS interface
│   │   │   ├── web-speech.ts        # Browser native (free)
│   │   │   └── elevenlabs.ts        # Premium voices
│   │   └── websocket.ts             # Server connection
│   └── App.tsx
```

**Key interactions:**

```typescript
// useSpeechRecognition.ts
const useSpeechRecognition = () => {
  const recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    onResult: (callback) => { /* ... */ },
    onSpeechEnd: (callback) => { /* ... */ }
  };
};

// useNovaSession.ts
const useNovaSession = () => {
  const ws = useRef<WebSocket>();

  const sendMessage = (text: string) => {
    ws.current?.send(JSON.stringify({ type: 'user_message', text }));
  };

  const onAssistantChunk = (callback: (chunk: string) => void) => {
    // Handle streamed response chunks
  };

  return { sendMessage, onAssistantChunk, progress, sessionId };
};
```

### 2. Backend Server (`packages/nova-server/`)

```
nova-server/
├── src/
│   ├── index.ts              # Server entry point
│   ├── websocket/
│   │   ├── handler.ts        # WebSocket connection handler
│   │   └── messages.ts       # Message type definitions
│   ├── sessions/
│   │   └── manager.ts        # Session lifecycle management
│   └── routes/
│       └── api.ts            # Optional REST endpoints
```

**WebSocket message protocol:**

```typescript
// Client → Server
type ClientMessage =
  | { type: 'start_session', mode: 'problem' | 'solution', model?: string }
  | { type: 'resume_session', sessionId: string }
  | { type: 'user_message', text: string }
  | { type: 'command', cmd: '/progress' | '/export' | '/save', args?: string };

// Server → Client
type ServerMessage =
  | { type: 'session_started', sessionId: string }
  | { type: 'assistant_chunk', text: string }        // Streamed response
  | { type: 'assistant_done' }                       // End of response
  | { type: 'progress_update', dimensions: DimensionState[] }
  | { type: 'export_ready', format: string, data: string }
  | { type: 'error', message: string };
```

**Session handler:**

```typescript
// websocket/handler.ts
async function handleConnection(ws: WebSocket) {
  let session: ProblemAdvisor | SolutionArchitect | null = null;

  ws.on('message', async (raw) => {
    const msg: ClientMessage = JSON.parse(raw);

    switch (msg.type) {
      case 'start_session':
        session = msg.mode === 'problem'
          ? new ProblemAdvisor({ model: msg.model })
          : new SolutionArchitect({ model: msg.model });
        await session.startSession();
        ws.send(JSON.stringify({ type: 'session_started', sessionId: session.sessionId }));
        break;

      case 'user_message':
        // Stream response chunks back to client
        for await (const chunk of session.chatStream(msg.text)) {
          ws.send(JSON.stringify({ type: 'assistant_chunk', text: chunk }));
        }
        ws.send(JSON.stringify({ type: 'assistant_done' }));

        // Send updated progress
        const progress = session.getProgress();
        ws.send(JSON.stringify({ type: 'progress_update', dimensions: progress }));
        break;
    }
  });
}
```

### 3. Voice Flow

```
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌────────────┐
│  User   │────▶│ Web Speech   │────▶│ WebSocket│────▶│   Nova     │
│ speaks  │     │ API (STT)    │     │  send()  │     │  Advisor   │
└─────────┘     └──────────────┘     └──────────┘     └─────┬──────┘
                                                            │
                                                            ▼
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌────────────┐
│  User   │◀────│ TTS Engine   │◀────│ Accumulate│◀───│  Streamed  │
│ hears   │     │ speaks text  │     │ + speak  │     │  response  │
└─────────┘     └──────────────┘     └──────────┘     └────────────┘
```

**Voice state machine:**

```
        ┌──────────────────────────────────────────┐
        │                                          │
        ▼                                          │
    ┌───────┐  user starts   ┌───────────┐        │
    │ IDLE  │ ─────────────▶ │ LISTENING │        │
    └───────┘   speaking     └─────┬─────┘        │
        ▲                          │              │
        │                    speech ends          │
        │                          │              │
        │                          ▼              │
        │                    ┌───────────┐        │
        │                    │ PROCESSING│        │
        │                    └─────┬─────┘        │
        │                          │              │
        │                    response starts      │
        │                          │              │
        │                          ▼              │
        │                    ┌───────────┐        │
        └────────────────────│ SPEAKING  │────────┘
            TTS complete     └───────────┘
```

## TTS Strategy

For conversational voice, you want the AI to start speaking before the full response is ready:

```typescript
// Sentence-based TTS streaming
class StreamingTTS {
  private buffer = '';
  private speaking = false;
  private queue: string[] = [];

  addChunk(text: string) {
    this.buffer += text;

    // Split on sentence boundaries
    const sentences = this.buffer.split(/(?<=[.!?])\s+/);

    if (sentences.length > 1) {
      // Queue complete sentences for speech
      this.queue.push(...sentences.slice(0, -1));
      this.buffer = sentences[sentences.length - 1];
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.speaking || this.queue.length === 0) return;

    this.speaking = true;
    const sentence = this.queue.shift()!;
    await this.speak(sentence);  // Web Speech API or ElevenLabs
    this.speaking = false;
    this.processQueue();
  }
}
```

## Tech Stack Recommendation

| Layer | Technology | Reason |
|-------|------------|--------|
| Frontend | React + Vite | Fast dev, good ecosystem |
| STT | Web Speech API | Free, good enough for English |
| TTS | ElevenLabs (optional fallback to Web Speech) | Natural voice, streaming API |
| Transport | WebSocket (ws) | Bi-directional streaming |
| Server | Node.js + existing Nova | Reuse all existing code |

## File Structure Summary

```
packages/
├── nova/                    # Existing - no changes needed
│   └── src/
│       ├── problem/api/     # ProblemAdvisor class
│       └── solution/api/    # SolutionArchitect class
│
├── nova-server/             # NEW - WebSocket server
│   ├── package.json
│   └── src/
│       ├── index.ts
│       └── websocket/
│
└── nova-web/                # NEW - Voice frontend
    ├── package.json
    ├── index.html
    └── src/
        ├── App.tsx
        ├── components/
        ├── hooks/
        └── services/
```
