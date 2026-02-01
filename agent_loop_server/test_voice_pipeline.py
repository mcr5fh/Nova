"""Tests for voice_pipeline.py.

Tests verify:
1. VoicePipelineFactory creates proper pipeline with all services
2. Pipeline includes transport input/output
3. Event handlers are properly registered
4. run_voice_pipeline broadcasts initial state and runs task
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from fastapi import WebSocket

from agent_loop_server.voice_pipeline import VoicePipelineFactory, run_voice_pipeline


@pytest.fixture
def mock_websocket():
    """Create a mock WebSocket."""
    websocket = MagicMock(spec=WebSocket)
    return websocket


@pytest.fixture
def mock_event_callback():
    """Create a mock event callback."""
    return AsyncMock()


@pytest.fixture
def mock_env_vars():
    """Set up environment variables for testing."""
    with patch.dict(os.environ, {
        "DEEPGRAM_API_KEY": "test_deepgram_key",
        "ANTHROPIC_API_KEY": "test_anthropic_key",
        "ELEVENLABS_API_KEY": "test_elevenlabs_key",
        "ELEVENLABS_VOICE_ID": "test_voice_id",
    }):
        yield


@pytest.mark.asyncio
async def test_create_pipeline_returns_task_and_transport(
    mock_websocket,
    mock_event_callback,
    mock_env_vars
):
    """Test that create_pipeline returns a PipelineTask and Transport."""
    with patch("agent_loop_server.voice_pipeline.FastAPIWebsocketTransport") as mock_transport_class, \
         patch("agent_loop_server.voice_pipeline.DeepgramSTTService") as mock_stt_class, \
         patch("agent_loop_server.voice_pipeline.AnthropicLLMService") as mock_llm_class, \
         patch("agent_loop_server.voice_pipeline.ElevenLabsTTSService") as mock_tts_class, \
         patch("agent_loop_server.voice_pipeline.Pipeline") as mock_pipeline_class, \
         patch("agent_loop_server.voice_pipeline.PipelineTask") as mock_task_class, \
         patch("agent_loop_server.voice_pipeline.SileroVADAnalyzer") as mock_vad_class, \
         patch("agent_loop_server.voice_pipeline.ProtobufFrameSerializer") as mock_serializer_class:

        # Setup mocks
        mock_transport = MagicMock()
        mock_transport.input.return_value = "transport_input"
        mock_transport.output.return_value = "transport_output"
        mock_transport_class.return_value = mock_transport

        mock_stt = MagicMock()
        mock_stt.event_handler = lambda event_name: lambda func: func
        mock_stt_class.return_value = mock_stt

        mock_llm = MagicMock()
        mock_llm.event_handler = lambda event_name: lambda func: func
        mock_llm_class.return_value = mock_llm

        mock_tts = MagicMock()
        mock_tts_class.return_value = mock_tts

        mock_pipeline = MagicMock()
        mock_pipeline_class.return_value = mock_pipeline

        mock_task = MagicMock()
        mock_task_class.return_value = mock_task

        # Call function
        task, transport = await VoicePipelineFactory.create_pipeline(
            websocket=mock_websocket,
            on_event=mock_event_callback
        )

        # Verify task and transport are returned
        assert task == mock_task
        assert transport == mock_transport


@pytest.mark.asyncio
async def test_create_pipeline_initializes_services_with_env_vars(
    mock_websocket,
    mock_event_callback,
    mock_env_vars
):
    """Test that services are initialized with correct API keys from environment."""
    with patch("agent_loop_server.voice_pipeline.FastAPIWebsocketTransport"), \
         patch("agent_loop_server.voice_pipeline.DeepgramSTTService") as mock_stt_class, \
         patch("agent_loop_server.voice_pipeline.AnthropicLLMService") as mock_llm_class, \
         patch("agent_loop_server.voice_pipeline.ElevenLabsTTSService") as mock_tts_class, \
         patch("agent_loop_server.voice_pipeline.Pipeline"), \
         patch("agent_loop_server.voice_pipeline.PipelineTask"), \
         patch("agent_loop_server.voice_pipeline.SileroVADAnalyzer"), \
         patch("agent_loop_server.voice_pipeline.ProtobufFrameSerializer"):

        # Setup event_handler mock
        for mock_class in [mock_stt_class, mock_llm_class, mock_tts_class]:
            mock_instance = MagicMock()
            mock_instance.event_handler = lambda event_name: lambda func: func
            mock_class.return_value = mock_instance

        # Call function
        await VoicePipelineFactory.create_pipeline(
            websocket=mock_websocket,
            on_event=mock_event_callback
        )

        # Verify services initialized with correct API keys
        mock_stt_class.assert_called_once()
        assert mock_stt_class.call_args.kwargs["api_key"] == "test_deepgram_key"
        assert mock_stt_class.call_args.kwargs["language"] == "en"
        assert mock_stt_class.call_args.kwargs["interim_results"] is True

        mock_llm_class.assert_called_once()
        assert mock_llm_class.call_args.kwargs["api_key"] == "test_anthropic_key"
        assert mock_llm_class.call_args.kwargs["model"] == "claude-sonnet-4-5-20250929"

        mock_tts_class.assert_called_once()
        assert mock_tts_class.call_args.kwargs["api_key"] == "test_elevenlabs_key"
        assert mock_tts_class.call_args.kwargs["voice_id"] == "test_voice_id"


@pytest.mark.asyncio
async def test_create_pipeline_includes_transport_input_output(
    mock_websocket,
    mock_event_callback,
    mock_env_vars
):
    """Test that pipeline includes transport.input() and transport.output()."""
    with patch("agent_loop_server.voice_pipeline.FastAPIWebsocketTransport") as mock_transport_class, \
         patch("agent_loop_server.voice_pipeline.DeepgramSTTService") as mock_stt_class, \
         patch("agent_loop_server.voice_pipeline.AnthropicLLMService") as mock_llm_class, \
         patch("agent_loop_server.voice_pipeline.ElevenLabsTTSService") as mock_tts_class, \
         patch("agent_loop_server.voice_pipeline.Pipeline") as mock_pipeline_class, \
         patch("agent_loop_server.voice_pipeline.PipelineTask"), \
         patch("agent_loop_server.voice_pipeline.SileroVADAnalyzer"), \
         patch("agent_loop_server.voice_pipeline.ProtobufFrameSerializer"):

        # Setup mocks
        mock_transport = MagicMock()
        mock_transport.input.return_value = "transport_input"
        mock_transport.output.return_value = "transport_output"
        mock_transport_class.return_value = mock_transport

        mock_stt = MagicMock()
        mock_stt.event_handler = lambda event_name: lambda func: func
        mock_stt_class.return_value = mock_stt

        mock_llm = MagicMock()
        mock_llm.event_handler = lambda event_name: lambda func: func
        mock_llm_class.return_value = mock_llm

        mock_tts = MagicMock()
        mock_tts_class.return_value = mock_tts

        # Call function
        await VoicePipelineFactory.create_pipeline(
            websocket=mock_websocket,
            on_event=mock_event_callback
        )

        # Verify Pipeline was created with correct components including transport input/output
        mock_pipeline_class.assert_called_once()
        pipeline_components = mock_pipeline_class.call_args[0][0]

        # Should be: [transport.input(), stt, llm, tts, transport.output()]
        assert len(pipeline_components) == 5
        assert pipeline_components[0] == "transport_input"
        assert pipeline_components[1] == mock_stt
        assert pipeline_components[2] == mock_llm
        assert pipeline_components[3] == mock_tts
        assert pipeline_components[4] == "transport_output"


@pytest.mark.asyncio
async def test_run_voice_pipeline_broadcasts_idle_state(
    mock_websocket,
    mock_event_callback,
    mock_env_vars
):
    """Test that run_voice_pipeline broadcasts initial idle state."""
    with patch("agent_loop_server.voice_pipeline.VoicePipelineFactory.create_pipeline") as mock_create:
        # Setup mocks
        mock_task = MagicMock()
        mock_task.run = AsyncMock()
        mock_transport = MagicMock()
        mock_create.return_value = (mock_task, mock_transport)

        # Call function
        await run_voice_pipeline(
            websocket=mock_websocket,
            on_event=mock_event_callback
        )

        # Verify idle state was broadcast
        assert mock_event_callback.call_count >= 1
        idle_call = None
        for call_obj in mock_event_callback.call_args_list:
            args = call_obj[0]
            if args and args[0].get("type") == "voice_state":
                idle_call = args[0]
                break

        assert idle_call is not None
        assert idle_call["type"] == "voice_state"
        assert idle_call["state"] == "idle"


@pytest.mark.asyncio
async def test_run_voice_pipeline_runs_task(
    mock_websocket,
    mock_event_callback,
    mock_env_vars
):
    """Test that run_voice_pipeline runs the task."""
    with patch("agent_loop_server.voice_pipeline.VoicePipelineFactory.create_pipeline") as mock_create:
        # Setup mocks
        mock_task = MagicMock()
        mock_task.run = AsyncMock()
        mock_transport = MagicMock()
        mock_create.return_value = (mock_task, mock_transport)

        # Call function
        await run_voice_pipeline(
            websocket=mock_websocket,
            on_event=mock_event_callback
        )

        # Verify task.run() was called
        mock_task.run.assert_called_once()


@pytest.mark.asyncio
async def test_create_pipeline_uses_default_voice_id_when_not_set(
    mock_websocket,
    mock_event_callback
):
    """Test that default voice ID is used when ELEVENLABS_VOICE_ID is not set."""
    with patch.dict(os.environ, {
        "DEEPGRAM_API_KEY": "test_deepgram_key",
        "ANTHROPIC_API_KEY": "test_anthropic_key",
        "ELEVENLABS_API_KEY": "test_elevenlabs_key",
        # ELEVENLABS_VOICE_ID not set
    }, clear=True):
        with patch("agent_loop_server.voice_pipeline.FastAPIWebsocketTransport"), \
             patch("agent_loop_server.voice_pipeline.DeepgramSTTService") as mock_stt_class, \
             patch("agent_loop_server.voice_pipeline.AnthropicLLMService") as mock_llm_class, \
             patch("agent_loop_server.voice_pipeline.ElevenLabsTTSService") as mock_tts_class, \
             patch("agent_loop_server.voice_pipeline.Pipeline"), \
             patch("agent_loop_server.voice_pipeline.PipelineTask"), \
             patch("agent_loop_server.voice_pipeline.SileroVADAnalyzer"), \
             patch("agent_loop_server.voice_pipeline.ProtobufFrameSerializer"):

            # Setup event_handler mock
            for mock_class in [mock_stt_class, mock_llm_class, mock_tts_class]:
                mock_instance = MagicMock()
                mock_instance.event_handler = lambda event_name: lambda func: func
                mock_class.return_value = mock_instance

            # Call function
            await VoicePipelineFactory.create_pipeline(
                websocket=mock_websocket,
                on_event=mock_event_callback
            )

            # Verify default voice_id is used (Rachel)
            mock_tts_class.assert_called_once()
            assert mock_tts_class.call_args.kwargs["voice_id"] == "21m00Tcm4TlvDq8ikWAM"


@pytest.mark.asyncio
async def test_create_pipeline_configures_transport_correctly(
    mock_websocket,
    mock_event_callback,
    mock_env_vars
):
    """Test that transport is configured with correct parameters."""
    with patch("agent_loop_server.voice_pipeline.FastAPIWebsocketTransport") as mock_transport_class, \
         patch("agent_loop_server.voice_pipeline.DeepgramSTTService") as mock_stt_class, \
         patch("agent_loop_server.voice_pipeline.AnthropicLLMService") as mock_llm_class, \
         patch("agent_loop_server.voice_pipeline.ElevenLabsTTSService") as mock_tts_class, \
         patch("agent_loop_server.voice_pipeline.Pipeline"), \
         patch("agent_loop_server.voice_pipeline.PipelineTask"), \
         patch("agent_loop_server.voice_pipeline.SileroVADAnalyzer") as mock_vad_class, \
         patch("agent_loop_server.voice_pipeline.ProtobufFrameSerializer") as mock_serializer_class, \
         patch("agent_loop_server.voice_pipeline.FastAPIWebsocketParams") as mock_params_class:

        # Setup mocks
        mock_transport = MagicMock()
        mock_transport.input.return_value = "transport_input"
        mock_transport.output.return_value = "transport_output"
        mock_transport_class.return_value = mock_transport

        mock_vad = MagicMock()
        mock_vad_class.return_value = mock_vad

        mock_serializer = MagicMock()
        mock_serializer_class.return_value = mock_serializer

        mock_params = MagicMock()
        mock_params_class.return_value = mock_params

        for mock_class in [mock_stt_class, mock_llm_class, mock_tts_class]:
            mock_instance = MagicMock()
            mock_instance.event_handler = lambda event_name: lambda func: func
            mock_class.return_value = mock_instance

        # Call function
        await VoicePipelineFactory.create_pipeline(
            websocket=mock_websocket,
            on_event=mock_event_callback
        )

        # Verify transport params
        mock_params_class.assert_called_once()
        params_kwargs = mock_params_class.call_args.kwargs
        assert params_kwargs["audio_in_enabled"] is True
        assert params_kwargs["audio_out_enabled"] is True
        assert params_kwargs["add_wav_header"] is False
        assert params_kwargs["vad_analyzer"] == mock_vad
        assert params_kwargs["serializer"] == mock_serializer
        assert params_kwargs["session_timeout"] is None

        # Verify transport created with websocket and params
        mock_transport_class.assert_called_once()
        assert mock_transport_class.call_args.kwargs["websocket"] == mock_websocket
        assert mock_transport_class.call_args.kwargs["params"] == mock_params
