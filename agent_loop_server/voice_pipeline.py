"""Pipecat voice pipeline with Deepgram STT and ElevenLabs TTS.

This module creates voice pipelines using the Pipecat framework for
real-time voice interaction with Claude agents.

Based on Pipecat's actual API (not conceptual):
- FastAPIWebsocketTransport handles WebSocket audio streaming
- Pipeline includes transport.input() and transport.output()
- No manual audio queueing - transport handles frames automatically
- Event handlers attach to services for state broadcasting
"""

import os
from typing import Callable, Awaitable, Any
from fastapi import WebSocket

from pipecat.transports.network.fastapi_websocket import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport
)
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.elevenlabs import ElevenLabsTTSService
from pipecat.services.anthropic import AnthropicLLMService
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.serializers.protobuf import ProtobufFrameSerializer


class VoicePipelineFactory:
    """Creates Pipecat voice pipelines for agent chat."""

    @staticmethod
    async def create_pipeline(
        websocket: WebSocket,
        on_event: Callable[[Any], Awaitable[None]]
    ) -> tuple[PipelineTask, FastAPIWebsocketTransport]:
        """Create a voice pipeline with STT → LLM → TTS.

        Args:
            websocket: FastAPI WebSocket connection
            on_event: Async callback to broadcast events

        Returns:
            Tuple of (PipelineTask, Transport) ready to run
        """
        # Create transport with WebSocket
        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                add_wav_header=False,  # Client handles raw PCM
                vad_analyzer=SileroVADAnalyzer(),  # Voice Activity Detection
                serializer=ProtobufFrameSerializer(),  # Binary protocol
                session_timeout=None,  # No timeout
            )
        )

        # Initialize services
        stt = DeepgramSTTService(
            api_key=os.getenv("DEEPGRAM_API_KEY"),
            language="en",
            interim_results=True,  # Stream partial transcripts
            model="nova-2",  # Latest Deepgram model
        )

        llm = AnthropicLLMService(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
            model="claude-sonnet-4-5-20250929",  # Can use "haiku" for faster
        )

        tts = ElevenLabsTTSService(
            api_key=os.getenv("ELEVENLABS_API_KEY"),
            voice_id=os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM"),
            model_id="eleven_turbo_v2",  # Faster model
        )

        # Event handlers for transcripts
        @stt.event_handler("on_interim_transcript")
        async def on_interim(text: str):
            """Handle partial transcript from STT."""
            await on_event({
                "type": "transcript",
                "text": text,
                "is_final": False
            })

        @stt.event_handler("on_final_transcript")
        async def on_final(text: str):
            """Handle final transcript from STT."""
            await on_event({
                "type": "transcript",
                "text": text,
                "is_final": True
            })

        # Event handlers for LLM state
        @llm.event_handler("on_llm_response_start")
        async def on_speaking_start():
            """Handle agent starting to speak."""
            await on_event({
                "type": "voice_state",
                "state": "speaking"
            })

        @llm.event_handler("on_llm_response_end")
        async def on_speaking_end():
            """Handle agent finishing speaking."""
            await on_event({
                "type": "voice_state",
                "state": "idle"
            })

        # Create pipeline with transport input/output
        # CRITICAL: Must include transport.input() and transport.output()
        pipeline = Pipeline([
            transport.input(),  # Receive audio from WebSocket
            stt,                # Transcribe speech to text
            llm,                # Generate response with Claude
            tts,                # Synthesize speech from text
            transport.output(), # Send audio to WebSocket
        ])

        # Create task
        task = PipelineTask(pipeline)

        return task, transport


async def run_voice_pipeline(
    websocket: WebSocket,
    on_event: Callable[[Any], Awaitable[None]]
) -> None:
    """Run voice pipeline for a WebSocket connection.

    Args:
        websocket: FastAPI WebSocket connection
        on_event: Async callback to broadcast events

    This function:
    1. Creates the voice pipeline
    2. Broadcasts initial idle state
    3. Runs the pipeline (blocks until disconnect)
    """
    # Create pipeline
    task, transport = await VoicePipelineFactory.create_pipeline(
        websocket=websocket,
        on_event=on_event
    )

    # Broadcast ready state
    await on_event({
        "type": "voice_state",
        "state": "idle"
    })

    # Run pipeline (blocks until connection closes)
    # Transport handles all WebSocket receive/send automatically
    await task.run()
