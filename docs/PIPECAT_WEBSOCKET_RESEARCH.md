# Pipecat WebSocket API and Audio Handling Research

**Date:** 2026-02-01
**Purpose:** Research Pipecat framework's WebSocket transport and audio handling capabilities for voice integration with Nova agent chat.

## Executive Summary

Pipecat is an open-source Python framework for building real-time voice and multimodal conversational AI agents. It provides a **FastAPIWebsocketTransport** for WebSocket-based audio streaming that can integrate with:
- **Deepgram** for Speech-to-Text (STT)
- **ElevenLabs** for Text-to-Speech (TTS)
- **Anthropic Claude** for LLM reasoning
- **FastAPI** for web service infrastructure

**Key Finding:** The conceptual implementation in `VOICE_INTEGRATION_PLAN.md` needs significant adjustments based on Pipecat's actual API. The overall architecture (parallel endpoint at `/ws/voice`) is solid, but the pipeline integration code requires updates.

---

## 1. Pipecat Framework Overview

### Installation

```bash
# Basic installation
pip install "pipecat-ai[websocket]"

# Or add to pyproject.toml dependencies:
dependencies = [
    "pipecat-ai[websocket]>=0.0.45",
    "deepgram-sdk>=3.0.0",
    "elevenlabs>=1.0.0",
]
```

### Core Concepts

Pipecat uses a **pipeline architecture**:
```
Audio Input → STT Service → LLM Service → TTS Service → Audio Output
```

The transport layer (FastAPIWebsocketTransport) handles:
- WebSocket connection management
- Audio frame serialization/deserialization
- Bidirectional audio streaming
- Session lifecycle and timeouts

---

## 2. FastAPIWebsocketTransport API

### Key Components

1. **FastAPIWebsocketTransport** - Main transport class
2. **FastAPIWebsocketParams** - Configuration parameters
3. **Frame Serializers** - Message encoding/decoding (e.g., ProtobufFrameSerializer)

### Initialization Pattern

```python
from pipecat.transports.network.fastapi_websocket import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport
)
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.serializers.protobuf import ProtobufFrameSerializer

async def run_bot(websocket: WebSocket):
    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,  # Set True if client needs WAV headers
            vad_analyzer=SileroVADAnalyzer(),  # Voice Activity Detection
            serializer=ProtobufFrameSerializer(),  # Or other serializer
            session_timeout=None,  # Seconds before timeout (None = disabled)
            fixed_audio_packet_size=None,  # Optional fixed PCM frame size
        )
    )
```

### Key Parameters Explained

| Parameter | Type | Purpose |
|-----------|------|---------|
| `audio_in_enabled` | bool | Enable receiving audio from client |
| `audio_out_enabled` | bool | Enable sending audio to client |
| `add_wav_header` | bool | Wrap audio frames with WAV headers |
| `vad_analyzer` | VADAnalyzer | Voice Activity Detection for turn-taking |
| `serializer` | FrameSerializer | Message encoding/decoding protocol |
| `session_timeout` | int \| None | Connection timeout in seconds |
| `fixed_audio_packet_size` | int \| None | Fixed PCM frame packetization |

### Event Handlers

The transport emits three events:

```python
@transport.event_handler("on_client_connected")
async def handle_connected():
    print("Client connected")

@transport.event_handler("on_client_disconnected")
async def handle_disconnected():
    print("Client disconnected")

@transport.event_handler("on_session_timeout")
async def handle_timeout():
    print("Session timed out")
```

---

## 3. Audio Handling

### Audio Flow Architecture

```
Client Browser
    ↓ (Binary WebSocket frames - audio data)
FastAPIWebsocketTransport
    ↓ (Deserialize frames)
DeepgramSTTService
    ↓ (Transcribe speech → text)
LLM Service (Claude)
    ↓ (Generate response text)
ElevenLabsTTSService
    ↓ (Synthesize speech → audio)
FastAPIWebsocketTransport
    ↓ (Serialize frames with timing simulation)
Client Browser
```

### Audio Format Requirements

**Standard Format:**
- **Encoding:** PCM 16-bit
- **Sample Rate:** 16kHz (configurable)
- **Channels:** Mono

**Browser MediaRecorder:**
- Default output: WebM/Opus
- Pipecat services (Deepgram) typically support WebM/Opus
- May need conversion if using raw PCM

### Voice Activity Detection (VAD)

Pipecat includes **SileroVADAnalyzer** for turn-taking:
- Detects when user starts/stops speaking
- Prevents interruption during agent response
- Improves conversation flow

```python
from pipecat.audio.vad.silero import SileroVADAnalyzer

vad = SileroVADAnalyzer(
    min_speech_duration=0.3,  # Minimum speech duration to trigger
    padding_duration=0.5,      # Padding after speech ends
)
```

### Audio Timing Simulation

Pipecat's output transport implements **timing simulation** to emulate an audio device:
- Prevents rapid packet flooding
- Maintains realistic playback timing
- Synchronizes with audio duration

This is automatic and built into `FastAPIWebsocketOutputTransport`.

---

## 4. Service Integration

### Deepgram STT Service

```python
from pipecat.services.deepgram import DeepgramSTTService

stt = DeepgramSTTService(
    api_key=os.getenv("DEEPGRAM_API_KEY"),
    language="en",
    interim_results=True,  # Stream partial transcripts
    model="nova-2",  # Latest model (optional)
)

# Event handlers for transcripts
@stt.event_handler("on_interim_transcript")
async def on_interim(text: str):
    print(f"Partial: {text}")

@stt.event_handler("on_final_transcript")
async def on_final(text: str):
    print(f"Final: {text}")
```

### Anthropic LLM Service

```python
from pipecat.services.anthropic import AnthropicLLMService

llm = AnthropicLLMService(
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    model="claude-sonnet-4-5-20250929",  # Or "haiku" for faster
)

# Event handlers for response lifecycle
@llm.event_handler("on_llm_response_start")
async def on_start():
    print("Agent started speaking")

@llm.event_handler("on_llm_response_end")
async def on_end():
    print("Agent finished speaking")
```

### ElevenLabs TTS Service

```python
from pipecat.services.elevenlabs import ElevenLabsTTSService

tts = ElevenLabsTTSService(
    api_key=os.getenv("ELEVENLABS_API_KEY"),
    voice_id=os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),  # Rachel
    model_id="eleven_turbo_v2",  # Faster model
)
```

---

## 5. Pipeline and Task Pattern

### Correct Pipeline Pattern

The VOICE_INTEGRATION_PLAN.md shows a conceptual pipeline, but here's the **actual Pipecat pattern**:

```python
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask

async def create_voice_pipeline(transport):
    # Initialize services
    stt = DeepgramSTTService(...)
    llm = AnthropicLLMService(...)
    tts = ElevenLabsTTSService(...)

    # Create pipeline
    pipeline = Pipeline([
        transport.input(),  # Get audio from client
        stt,                # Transcribe to text
        llm,                # Generate response
        tts,                # Synthesize speech
        transport.output(), # Send audio to client
    ])

    # Create task
    task = PipelineTask(pipeline)

    return task
```

### Running the Task

```python
# Option 1: Run directly (blocks)
await task.run()

# Option 2: Run in background
task_handle = asyncio.create_task(task.run())
```

---

## 6. FastAPI Integration Example

Here's a **corrected implementation** for Nova's `/ws/voice` endpoint:

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pipecat.transports.network.fastapi_websocket import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport
)
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.anthropic import AnthropicLLMService
from pipecat.services.elevenlabs import ElevenLabsTTSService
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.serializers.protobuf import ProtobufFrameSerializer
import os

app = FastAPI()

@app.websocket("/ws/voice")
async def voice_websocket_endpoint(websocket: WebSocket):
    """Voice chat endpoint using Pipecat."""
    await websocket.accept()

    try:
        # Create transport
        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                add_wav_header=False,
                vad_analyzer=SileroVADAnalyzer(),
                serializer=ProtobufFrameSerializer(),
            )
        )

        # Initialize services
        stt = DeepgramSTTService(
            api_key=os.getenv("DEEPGRAM_API_KEY"),
            language="en",
            interim_results=True,
        )

        llm = AnthropicLLMService(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            model="claude-sonnet-4-5-20250929",
        )

        tts = ElevenLabsTTSService(
            api_key=os.getenv("ELEVENLABS_API_KEY"),
            voice_id=os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
        )

        # Event handlers for broadcasting state
        @stt.event_handler("on_interim_transcript")
        async def on_interim(text: str):
            # Broadcast transcript event to all connected clients
            await manager.broadcast({
                "type": "transcript",
                "text": text,
                "is_final": False
            })

        @stt.event_handler("on_final_transcript")
        async def on_final(text: str):
            await manager.broadcast({
                "type": "transcript",
                "text": text,
                "is_final": True
            })

        @llm.event_handler("on_llm_response_start")
        async def on_speaking_start():
            await manager.broadcast({
                "type": "voice_state",
                "state": "speaking"
            })

        @llm.event_handler("on_llm_response_end")
        async def on_speaking_end():
            await manager.broadcast({
                "type": "voice_state",
                "state": "idle"
            })

        # Create pipeline
        pipeline = Pipeline([
            transport.input(),
            stt,
            llm,
            tts,
            transport.output(),
        ])

        # Create and run task
        task = PipelineTask(pipeline)

        # Broadcast ready state
        await manager.broadcast({
            "type": "voice_state",
            "state": "idle"
        })

        # Run pipeline (blocks until connection closes)
        await task.run()

    except WebSocketDisconnect:
        print("Voice client disconnected")
    except Exception as e:
        print(f"Voice WebSocket error: {e}")
        raise
```

---

## 7. Key Differences from Conceptual Plan

The `VOICE_INTEGRATION_PLAN.md` needs these corrections:

### 1. Transport Integration

**Conceptual (Incorrect):**
```python
# This doesn't exist in Pipecat API
await task.queue_audio_data(audio_data)
```

**Actual (Correct):**
```python
# Transport handles audio automatically via pipeline
# No manual queuing needed - WebSocket frames flow through transport
pipeline = Pipeline([
    transport.input(),  # This receives WebSocket audio
    # ... services ...
    transport.output(), # This sends WebSocket audio
])
```

### 2. Pipeline Creation

**Conceptual:**
```python
# Missing transport.input() and transport.output()
pipeline = Pipeline([stt, aggregator, llm, tts])
```

**Actual:**
```python
# Must include transport input/output
pipeline = Pipeline([
    transport.input(),
    stt,
    llm,
    tts,
    transport.output(),
])
```

### 3. Serialization

**Conceptual:**
```python
# No serializer specified - Pipecat defaults may not work
```

**Actual:**
```python
# Explicitly configure serializer for WebSocket protocol
params=FastAPIWebsocketParams(
    serializer=ProtobufFrameSerializer(),  # Or appropriate serializer
)
```

### 4. Audio Handling

**Conceptual:**
```python
# Manual receive loop - not needed
while True:
    message = await websocket.receive()
    if "bytes" in message:
        await task.queue_audio_data(message["bytes"])
```

**Actual:**
```python
# Transport handles WebSocket receive automatically
# Just run the task - it manages the WebSocket lifecycle
await task.run()
```

---

## 8. Frontend Client Considerations

### Browser Audio Encoding

**MediaRecorder Output:**
- Default: `audio/webm` with Opus codec
- Deepgram supports WebM/Opus directly
- No conversion needed if using standard config

**Example MediaRecorder Setup:**

```typescript
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: "audio/webm;codecs=opus",
});

mediaRecorder.ondataavailable = (event) => {
  if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
    ws.send(event.data);  // Send as binary blob
  }
};

mediaRecorder.start(100); // Send chunks every 100ms
```

### WebSocket Message Format

With **ProtobufFrameSerializer**, messages are binary (not JSON):
- **Outgoing:** Binary audio blobs
- **Incoming:** Binary audio frames + JSON events

May need to handle mixed message types:
```typescript
ws.onmessage = async (event) => {
  if (event.data instanceof Blob) {
    // Binary audio - decode and play
    const arrayBuffer = await event.data.arrayBuffer();
    await playAudio(arrayBuffer);
  } else {
    // JSON event (transcript, state changes)
    const data = JSON.parse(event.data);
    handleEvent(data);
  }
};
```

### Audio Playback

The incoming audio is typically **PCM 16-bit, 16kHz**:

```typescript
async function playAudio(arrayBuffer: ArrayBuffer) {
  if (!audioContext) {
    audioContext = new AudioContext({ sampleRate: 16000 });
  }

  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();
}
```

---

## 9. Testing Strategy

### Phase 1: Verify Pipecat Installation

```bash
pip install "pipecat-ai[websocket]>=0.0.45"
python -c "import pipecat; print(pipecat.__version__)"
```

### Phase 2: Test Individual Services

```python
# Test Deepgram STT
from pipecat.services.deepgram import DeepgramSTTService
stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))

# Test ElevenLabs TTS
from pipecat.services.elevenlabs import ElevenLabsTTSService
tts = ElevenLabsTTSService(api_key=os.getenv("ELEVENLABS_API_KEY"))

# Test Anthropic LLM
from pipecat.services.anthropic import AnthropicLLMService
llm = AnthropicLLMService(api_key=os.getenv("ANTHROPIC_API_KEY"))
```

### Phase 3: Test WebSocket Endpoint

```bash
# Start server
python -m agent_loop_server.server

# Test connection
wscat -c ws://localhost:8001/ws/voice
```

### Phase 4: Test Full Pipeline

1. Open browser to frontend
2. Enable voice mode
3. Start recording
4. Verify transcript events
5. Verify agent response audio

---

## 10. Production Considerations

### WebSocket vs WebRTC

**Pipecat Documentation Warning:**
> "WebSocket transports are best suited for prototyping and controlled network environments. For production client-server applications, we recommend WebRTC-based transports for better network handling, NAT traversal, and media optimization."

**Recommendation:**
- **Development/MVP:** Use WebSocket (simpler, faster to implement)
- **Production:** Consider migrating to WebRTC for:
  - Better NAT traversal
  - Adaptive bitrate
  - Packet loss recovery
  - Lower latency

### Scalability

**Current Architecture:**
- One pipeline per WebSocket connection
- Services (Deepgram, ElevenLabs) called per connection
- LLM streaming per connection

**For Scale:**
- Consider connection pooling
- Implement rate limiting
- Monitor API usage (Deepgram, ElevenLabs costs)
- Use faster/cheaper models (Haiku instead of Sonnet)

### Error Handling

Add robust error handling:
```python
try:
    await task.run()
except WebSocketDisconnect:
    logger.info("Client disconnected")
except DeepgramError as e:
    logger.error(f"Deepgram error: {e}")
    await manager.broadcast({"type": "error", "error": "STT service unavailable"})
except Exception as e:
    logger.error(f"Pipeline error: {e}")
    await manager.broadcast({"type": "error", "error": str(e)})
```

---

## 11. Environment Variables

Required API keys:

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM  # Optional, defaults to Rachel
```

### Getting API Keys

1. **Anthropic:** https://console.anthropic.com/
2. **Deepgram:** https://console.deepgram.com/
3. **ElevenLabs:** https://elevenlabs.io/

---

## 12. Next Steps for Implementation

Based on this research, here's the recommended implementation order:

### 1. Update Dependencies (5 min)
```bash
# Add to pyproject.toml
"pipecat-ai[websocket]>=0.0.45",
"deepgram-sdk>=3.0.0",
"elevenlabs>=1.0.0",

# Install
uv sync
```

### 2. Create Voice Pipeline Module (30 min)
- Create `agent_loop_server/voice_pipeline.py`
- Use corrected Pipecat patterns from this research
- Include event handlers for state broadcasting

### 3. Add `/ws/voice` Endpoint (20 min)
- Update `agent_loop_server/server.py`
- Use corrected FastAPI integration pattern
- Handle connection lifecycle properly

### 4. Update Event Types (15 min)
- Update `agent_loop_server/events.py` (backend)
- Update `program_nova/dashboard/nextjs/src/types/chat.ts` (frontend)

### 5. Implement Frontend Voice UI (60 min)
- Create `useVoiceChat.ts` hook
- Create `VoiceControls.tsx` component
- Update `ChatInput.tsx` with mode toggle
- Handle binary WebSocket frames properly

### 6. Test End-to-End (30 min)
- Test STT transcription
- Test LLM response generation
- Test TTS playback
- Test state transitions

**Total Estimated Time:** ~2.5 hours for MVP

---

## 13. Resources and References

### Official Documentation
- [Pipecat GitHub Repository](https://github.com/pipecat-ai/pipecat)
- [Pipecat Documentation](https://docs.pipecat.ai/getting-started/quickstart)
- [WebSocket Transports Guide](https://docs.pipecat.ai/server/services/transport/websocket-server)
- [FastAPIWebsocketTransport Reference](https://docs.pipecat.ai/server/services/transport/fastapi-websocket)
- [API Reference](https://reference-server.pipecat.ai/en/stable/api/pipecat.transports.websocket.fastapi.html)

### Example Code
- [Pipecat Examples Repository](https://github.com/pipecat-ai/pipecat-examples)
- [AWS/Deepgram Workshop Examples](https://github.com/pipecat-ai/aws-deepgram-workshop)

### Related Issues and Discussions
- [FastAPIWebSocketTransport not working in non-Twilio settings #296](https://github.com/pipecat-ai/pipecat/issues/296)
- [FastAPIWebsocketTransport: fix to work with text and binary #791](https://github.com/pipecat-ai/pipecat/pull/791)
- [Deepgram not transcribing #2630](https://github.com/pipecat-ai/pipecat/issues/2630)

### Blog Posts
- [Building Voice Agents with Pipecat: Real-Time LLM Conversations in Python](https://medium.com/@bravekjh/building-voice-agents-with-pipecat-real-time-llm-conversations-in-python-a15de1a8fc6a)

---

## 14. Conclusion

Pipecat provides a robust framework for voice agent implementation with:
- ✅ Clean FastAPI WebSocket integration
- ✅ Built-in support for Deepgram, ElevenLabs, and Anthropic
- ✅ Audio timing simulation and VAD
- ✅ Event-driven architecture for state broadcasting

**Main Correction Needed:**
The `VOICE_INTEGRATION_PLAN.md` needs updates to reflect Pipecat's actual API, particularly:
1. Transport must be included in pipeline via `transport.input()` and `transport.output()`
2. No manual audio queueing - transport handles WebSocket frames automatically
3. Task runs as a single `await task.run()` - no manual receive loop
4. Serializer must be explicitly configured
5. Event handlers attach to services, not transport

The overall architecture (parallel endpoint, event broadcasting) remains solid and should work well with these API corrections.
