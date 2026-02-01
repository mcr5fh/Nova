# Implementation Plan: Add Voice (STT/TTS) to Agent Chat

## Overview

Add voice input/output capabilities to the existing agent chat using Pipecat framework with Deepgram (STT) and ElevenLabs (TTS). This is a **lightweight, additive change** that preserves all existing text chat functionality.

**Key Principle:** Voice runs in parallel to text chat - zero modifications to existing chat flow.

## Architecture Decision: Parallel Voice Endpoint

```
┌─────────────────────────────────────────┐
│  Existing Text Chat (UNCHANGED)        │
│  /ws → AgentLoopRunner → BAML          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  New Voice Chat (ADDED)                 │
│  /ws/voice → Pipecat Pipeline           │
│  → Deepgram STT → Claude → ElevenLabs   │
└─────────────────────────────────────────┘
```

**Benefits:**
- Zero risk to existing functionality
- Can develop/test independently
- Easy to enable/disable
- Both can share session state if needed

## Implementation Phases

### Phase 1: Backend Voice Infrastructure

#### 1.1 Add Dependencies

**File:** `pyproject.toml`

Add to `dependencies` array (line 12):
```toml
dependencies = [
    # ... existing deps ...
    "pipecat-ai>=0.0.45",
    "deepgram-sdk>=3.0.0",
    "elevenlabs>=1.0.0",
]
```

**Install:**
```bash
cd /Users/shoe/Code/Projects/Nova
uv sync
# or: pip install -e .
```

#### 1.2 Create Voice Event Types

**File:** `agent_loop_server/events.py`

Add after existing events (around line 75):
```python
@dataclass
class VoiceStateEvent:
    """Voice pipeline state change."""
    type: Literal["voice_state"] = "voice_state"
    state: str  # "listening", "processing", "speaking", "idle"

    def to_dict(self):
        return {"type": self.type, "state": self.state}


@dataclass
class TranscriptEvent:
    """Real-time transcript of user speech."""
    type: Literal["transcript"] = "transcript"
    text: str
    is_final: bool = False

    def to_dict(self):
        return {
            "type": self.type,
            "text": self.text,
            "is_final": self.is_final
        }


@dataclass
class VoiceResponseEvent:
    """Agent voice response with text."""
    type: Literal["voice_response"] = "voice_response"
    text: str  # Text being spoken

    def to_dict(self):
        return {"type": self.type, "text": self.text}
```

Update `StreamEvent` type union to include new events.

#### 1.3 Create Pipecat Voice Pipeline

**File:** `agent_loop_server/voice_pipeline.py` (NEW)

```python
"""Pipecat voice pipeline with Deepgram STT and ElevenLabs TTS."""

import os
from typing import Callable, Awaitable, Any
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.elevenlabs import ElevenLabsTTSService
from pipecat.services.anthropic import AnthropicLLMService
from pipecat.processors.aggregators.llm_response import LLMResponseAggregator
from pipecat.transports.base_transport import TransportParams

from .events import VoiceStateEvent, TranscriptEvent, VoiceResponseEvent


class VoicePipelineFactory:
    """Creates Pipecat voice pipelines for agent chat."""

    @staticmethod
    async def create_pipeline(
        on_event: Callable[[Any], Awaitable[None]]
    ) -> PipelineTask:
        """Create a voice pipeline with STT → LLM → TTS.

        Args:
            on_event: Async callback to broadcast events

        Returns:
            Configured PipelineTask ready to run
        """
        # Initialize services
        stt = DeepgramSTTService(
            api_key=os.getenv("DEEPGRAM_API_KEY"),
            language="en",
            interim_results=True,  # Stream partial transcripts
        )

        llm = AnthropicLLMService(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            model="claude-sonnet-4-5-20250929",
        )

        tts = ElevenLabsTTSService(
            api_key=os.getenv("ELEVENLABS_API_KEY"),
            voice_id=os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),  # Default: Rachel
        )

        # Aggregator for collecting LLM response
        aggregator = LLMResponseAggregator()

        # Create pipeline
        pipeline = Pipeline([
            stt,
            aggregator,
            llm,
            tts,
        ])

        # Event handlers
        @stt.event_handler("on_interim_transcript")
        async def on_interim(text: str):
            await on_event(TranscriptEvent(text=text, is_final=False))

        @stt.event_handler("on_final_transcript")
        async def on_final(text: str):
            await on_event(TranscriptEvent(text=text, is_final=True))

        @llm.event_handler("on_llm_response_start")
        async def on_speaking_start():
            await on_event(VoiceStateEvent(state="speaking"))

        @llm.event_handler("on_llm_response_end")
        async def on_speaking_end():
            await on_event(VoiceStateEvent(state="idle"))

        # Create task
        task = PipelineTask(pipeline)

        return task
```

#### 1.4 Add Voice WebSocket Endpoint

**File:** `agent_loop_server/server.py`

Add new endpoint after the existing `/ws` endpoint (after line 163):

```python
@app.websocket("/ws/voice")
async def voice_websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for voice chat with Pipecat.

    Expects binary audio frames (PCM 16-bit, 16kHz) from client.
    Sends back binary audio frames for playback.
    Also sends JSON events for transcripts and state changes.
    """
    await manager.connect(websocket)

    # Create event callback that broadcasts to all clients
    async def on_event(event):
        """Broadcast voice events in real-time."""
        await manager.broadcast(event.to_dict())

    try:
        # Import here to avoid loading Pipecat unless voice is used
        from .voice_pipeline import VoicePipelineFactory

        # Create voice pipeline
        task = await VoicePipelineFactory.create_pipeline(on_event)

        # Broadcast ready state
        await on_event(VoiceStateEvent(state="idle"))

        # Start pipeline task
        async def run_pipeline():
            await task.run()

        # Run pipeline in background
        pipeline_task = asyncio.create_task(run_pipeline())

        try:
            while True:
                # Receive audio data from client
                message = await websocket.receive()

                if "bytes" in message:
                    # Binary audio frame
                    audio_data = message["bytes"]
                    # Send to pipeline (Pipecat handles this via transport)
                    # Implementation depends on Pipecat's WebSocket transport API
                    await task.queue_audio_data(audio_data)

                elif "text" in message:
                    # JSON control messages
                    import json
                    data = json.loads(message["text"])
                    msg_type = data.get("type")

                    if msg_type == "start":
                        await on_event(VoiceStateEvent(state="listening"))
                    elif msg_type == "stop":
                        await on_event(VoiceStateEvent(state="idle"))
                        break

        finally:
            # Clean up pipeline
            pipeline_task.cancel()
            try:
                await pipeline_task
            except asyncio.CancelledError:
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Voice client disconnected")
    except Exception as e:
        print(f"Voice WebSocket error: {e}")
        await manager.broadcast(
            ErrorEvent(error=f"Voice error: {str(e)}").to_dict()
        )
        manager.disconnect(websocket)
```

**Note:** The exact Pipecat WebSocket integration API may need adjustment based on Pipecat's documentation. The core structure is correct.

### Phase 2: Frontend Voice UI

#### 2.1 Add Voice Event Types

**File:** `program_nova/dashboard/nextjs/src/types/chat.ts`

Add after existing event types (around line 70):

```typescript
export interface VoiceStateEvent {
  type: "voice_state";
  state: "listening" | "processing" | "speaking" | "idle";
}

export interface TranscriptEvent {
  type: "transcript";
  text: string;
  is_final: boolean;
}

export interface VoiceResponseEvent {
  type: "voice_response";
  text: string;
}

// Update ServerEvent union
export type ServerEvent =
  | UserMessageEvent
  | AgentMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | AgentThinkingEvent
  | ErrorEvent
  | VoiceStateEvent
  | TranscriptEvent
  | VoiceResponseEvent;
```

Add type guards:
```typescript
export function isVoiceStateEvent(event: ServerEvent): event is VoiceStateEvent {
  return event.type === "voice_state";
}

export function isTranscriptEvent(event: ServerEvent): event is TranscriptEvent {
  return event.type === "transcript";
}

export function isVoiceResponseEvent(event: ServerEvent): event is VoiceResponseEvent {
  return event.type === "voice_response";
}
```

#### 2.2 Create Voice Chat Hook

**File:** `program_nova/dashboard/nextjs/src/hooks/useVoiceChat.ts` (NEW)

```typescript
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { VoiceStateEvent, TranscriptEvent, VoiceResponseEvent } from "@/types/chat";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001";

type VoiceState = "disconnected" | "connecting" | "connected" | "listening" | "processing" | "speaking";

export function useVoiceChat() {
  const [voiceState, setVoiceState] = useState<VoiceState>("disconnected");
  const [transcript, setTranscript] = useState<string>("");
  const [agentResponse, setAgentResponse] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setVoiceState("connecting");

    try {
      // Connect to voice WebSocket
      const ws = new WebSocket(`${WS_URL}/voice`);

      ws.onopen = () => {
        setVoiceState("connected");
        ws.send(JSON.stringify({ type: "start" }));
      };

      ws.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          // Binary audio data - play it
          const arrayBuffer = await event.data.arrayBuffer();
          await playAudio(arrayBuffer);
        } else {
          // JSON event
          const data = JSON.parse(event.data);
          handleVoiceEvent(data);
        }
      };

      ws.onerror = (error) => {
        console.error("Voice WebSocket error:", error);
        setVoiceState("disconnected");
      };

      ws.onclose = () => {
        setVoiceState("disconnected");
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to connect:", error);
      setVoiceState("disconnected");
    }
  }, []);

  const handleVoiceEvent = useCallback((event: VoiceStateEvent | TranscriptEvent | VoiceResponseEvent) => {
    switch (event.type) {
      case "voice_state":
        setVoiceState(event.state as VoiceState);
        break;
      case "transcript":
        setTranscript(event.text);
        break;
      case "voice_response":
        setAgentResponse(event.text);
        break;
    }
  }, []);

  const playAudio = useCallback(async (arrayBuffer: ArrayBuffer) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
    }

    const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // Send audio chunk to server
          wsRef.current.send(event.data);
        }
      };

      mediaRecorder.start(100); // Send chunks every 100ms
      mediaRecorderRef.current = mediaRecorder;
      setVoiceState("listening");
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    stopRecording();

    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
      wsRef.current.close();
      wsRef.current = null;
    }

    setVoiceState("disconnected");
  }, [stopRecording]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    voiceState,
    transcript,
    agentResponse,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  };
}
```

#### 2.3 Create Voice Controls Component

**File:** `program_nova/dashboard/nextjs/src/components/chat/VoiceControls.tsx` (NEW)

```typescript
"use client";

import { useState } from "react";
import { useVoiceChat } from "@/hooks/useVoiceChat";

export function VoiceControls() {
  const {
    voiceState,
    transcript,
    agentResponse,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  } = useVoiceChat();

  const [isVoiceMode, setIsVoiceMode] = useState(false);

  const handleToggleVoice = async () => {
    if (!isVoiceMode) {
      await connect();
      await startRecording();
      setIsVoiceMode(true);
    } else {
      stopRecording();
      disconnect();
      setIsVoiceMode(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleToggleVoice}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          isVoiceMode
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-blue-500 hover:bg-blue-600 text-white"
        }`}
      >
        {isVoiceMode ? (
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Stop Voice
          </span>
        ) : (
          <span className="flex items-center gap-2">
            🎤 Start Voice
          </span>
        )}
      </button>

      {/* Voice state indicator */}
      {isVoiceMode && (
        <div className="text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>State:</span>
            <span className="font-medium">{voiceState}</span>
          </div>

          {transcript && (
            <div className="mt-2">
              <span className="font-medium">You:</span> {transcript}
            </div>
          )}

          {agentResponse && (
            <div className="mt-2">
              <span className="font-medium">Agent:</span> {agentResponse}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

#### 2.4 Add Voice Mode to Chat Input

**File:** `program_nova/dashboard/nextjs/src/components/chat/ChatInput.tsx`

Add voice mode toggle to the component. Insert after the textarea (around line 68):

```typescript
import { VoiceControls } from "./VoiceControls";
import { useState } from "react";

// ... existing imports and component code ...

// Add state for mode
const [mode, setMode] = useState<"text" | "voice">("text");

// In the JSX, replace the form section:
return (
  <div className="p-4 border-t">
    {/* Mode toggle */}
    <div className="flex gap-2 mb-2">
      <button
        onClick={() => setMode("text")}
        className={`px-3 py-1 rounded text-sm ${
          mode === "text"
            ? "bg-blue-500 text-white"
            : "bg-gray-200 text-gray-700"
        }`}
      >
        Text
      </button>
      <button
        onClick={() => setMode("voice")}
        className={`px-3 py-1 rounded text-sm ${
          mode === "voice"
            ? "bg-blue-500 text-white"
            : "bg-gray-200 text-gray-700"
        }`}
      >
        Voice
      </button>
    </div>

    {/* Conditional rendering based on mode */}
    {mode === "text" ? (
      <form onSubmit={handleSubmit} className="flex gap-2">
        {/* ... existing textarea and send button ... */}
      </form>
    ) : (
      <VoiceControls />
    )}
  </div>
);
```

### Phase 3: Environment Configuration

**File:** `.env` (add these variables)

```bash
# Existing
ANTHROPIC_API_KEY=sk-ant-...

# Voice Services (NEW)
DEEPGRAM_API_KEY=your_deepgram_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Rachel (default), change to your preferred voice
```

Update `.env.example` with the same variables (without actual keys).

## Critical Files Modified

### Backend (Python)
1. **MODIFIED** `pyproject.toml` - Add 3 dependencies
2. **MODIFIED** `agent_loop_server/server.py` - Add `/ws/voice` endpoint (~50 lines)
3. **MODIFIED** `agent_loop_server/events.py` - Add 3 voice event types (~30 lines)
4. **NEW** `agent_loop_server/voice_pipeline.py` - Pipecat pipeline setup (~100 lines)

### Frontend (TypeScript/React)
1. **MODIFIED** `program_nova/dashboard/nextjs/src/types/chat.ts` - Add voice types (~30 lines)
2. **MODIFIED** `program_nova/dashboard/nextjs/src/components/chat/ChatInput.tsx` - Add mode toggle (~20 lines)
3. **NEW** `program_nova/dashboard/nextjs/src/hooks/useVoiceChat.ts` - Voice WebSocket hook (~150 lines)
4. **NEW** `program_nova/dashboard/nextjs/src/components/chat/VoiceControls.tsx` - Voice UI (~80 lines)

### Configuration
1. **MODIFIED** `.env` - Add Deepgram and ElevenLabs keys
2. **MODIFIED** `.env.example` - Document new env vars

## Testing Strategy

### Phase 1: Backend Voice Endpoint
```bash
# Start server
cd /Users/shoe/Code/Projects/Nova
python -m agent_loop_server.server

# Test WebSocket connection (in another terminal)
wscat -c ws://localhost:8001/ws/voice

# Should see: voice_state event with state="idle"
```

### Phase 2: Frontend Voice Mode
```bash
# Start Next.js dev server
cd program_nova/dashboard/nextjs
npm run dev

# Open browser to http://localhost:3000
# Click "Voice" mode toggle
# Click "Start Voice" button
# Speak into microphone
# Verify: transcript appears, agent responds with voice
```

### Phase 3: End-to-End Voice Conversation
1. Click Voice mode
2. Start recording
3. Say: "Hello, what can you help me with?"
4. Verify: Real-time transcript appears
5. Verify: Agent voice response plays
6. Verify: Agent response text displays
7. Continue conversation
8. Switch back to Text mode - verify text chat still works

### Phase 4: Both Modes Simultaneously
1. Open chat in text mode
2. Send text message
3. Switch to voice mode
4. Send voice message
5. Verify: Both conversation threads work
6. Verify: No interference between modes

## Rollback Plan

If voice integration causes issues:

1. **Disable voice endpoint:** Comment out `@app.websocket("/ws/voice")` in `server.py`
2. **Hide voice UI:** Set `const VOICE_ENABLED = false` in `ChatInput.tsx`
3. **Remove dependencies:** Comment out `pipecat-ai`, `deepgram-sdk`, `elevenlabs` in `pyproject.toml`

Text chat continues working normally with zero impact.

## Success Criteria

- ✅ Text chat works exactly as before (no regressions)
- ✅ Voice mode connects to `/ws/voice` endpoint
- ✅ Microphone captures audio and sends to server
- ✅ Deepgram transcribes speech in real-time
- ✅ Transcript displays in UI
- ✅ Claude generates response via Anthropic API
- ✅ ElevenLabs speaks response
- ✅ Audio plays in browser
- ✅ Can switch between text and voice modes seamlessly
- ✅ Voice state indicators update correctly (listening, processing, speaking, idle)

## Implementation Order

1. **Backend first** (Phase 1) - Get voice pipeline working standalone
2. **Frontend second** (Phase 2) - Add UI controls and connect to backend
3. **Integration testing** (Phase 3) - Test end-to-end flow
4. **Polish** - Add error handling, loading states, better UI

## Notes

- Pipecat's WebSocket transport API may differ from this plan - refer to their docs for exact integration
- Audio encoding/decoding may require additional utilities (PCM conversion, etc.)
- ElevenLabs voice ID can be customized - list available voices via their API
- Deepgram interim results provide real-time transcription feedback
- Consider adding VAD (Voice Activity Detection) for better UX
- Consider adding interrupt handling (user talking over agent)

## Estimated Complexity

- Backend: **Medium** - Pipecat integration has some learning curve
- Frontend: **Low** - Standard WebSocket + Web Audio API patterns
- Overall: **Medium** - Well-isolated change with clear boundaries
