"""Unit tests for voice_pipeline.py structure and logic.

These tests verify the code structure without requiring pipecat dependencies.
They use import mocking to test the logic independently.
"""

import sys
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

# Mock pipecat modules before importing voice_pipeline
sys.modules['pipecat'] = MagicMock()
sys.modules['pipecat.transports'] = MagicMock()
sys.modules['pipecat.transports.network'] = MagicMock()
sys.modules['pipecat.transports.network.fastapi_websocket'] = MagicMock()
sys.modules['pipecat.services'] = MagicMock()
sys.modules['pipecat.services.deepgram'] = MagicMock()
sys.modules['pipecat.services.elevenlabs'] = MagicMock()
sys.modules['pipecat.services.anthropic'] = MagicMock()
sys.modules['pipecat.pipeline'] = MagicMock()
sys.modules['pipecat.pipeline.pipeline'] = MagicMock()
sys.modules['pipecat.pipeline.task'] = MagicMock()
sys.modules['pipecat.audio'] = MagicMock()
sys.modules['pipecat.audio.vad'] = MagicMock()
sys.modules['pipecat.audio.vad.silero'] = MagicMock()
sys.modules['pipecat.serializers'] = MagicMock()
sys.modules['pipecat.serializers.protobuf'] = MagicMock()


def test_voice_pipeline_module_imports():
    """Test that voice_pipeline module can be imported."""
    try:
        from agent_loop_server import voice_pipeline
        assert hasattr(voice_pipeline, 'VoicePipelineFactory')
        assert hasattr(voice_pipeline, 'run_voice_pipeline')
    except ImportError as e:
        pytest.fail(f"Failed to import voice_pipeline: {e}")


def test_voice_pipeline_factory_has_create_pipeline_method():
    """Test that VoicePipelineFactory has create_pipeline static method."""
    from agent_loop_server.voice_pipeline import VoicePipelineFactory

    assert hasattr(VoicePipelineFactory, 'create_pipeline')
    assert callable(VoicePipelineFactory.create_pipeline)


def test_run_voice_pipeline_is_async_function():
    """Test that run_voice_pipeline is an async function."""
    from agent_loop_server.voice_pipeline import run_voice_pipeline
    import inspect

    assert callable(run_voice_pipeline)
    assert inspect.iscoroutinefunction(run_voice_pipeline)


def test_voice_pipeline_factory_create_pipeline_is_async():
    """Test that VoicePipelineFactory.create_pipeline is an async method."""
    from agent_loop_server.voice_pipeline import VoicePipelineFactory
    import inspect

    assert inspect.iscoroutinefunction(VoicePipelineFactory.create_pipeline)


def test_voice_pipeline_has_correct_docstrings():
    """Test that functions have proper documentation."""
    from agent_loop_server.voice_pipeline import VoicePipelineFactory, run_voice_pipeline

    assert VoicePipelineFactory.__doc__ is not None
    assert "Creates Pipecat voice pipelines" in VoicePipelineFactory.__doc__

    assert VoicePipelineFactory.create_pipeline.__doc__ is not None
    assert "STT" in VoicePipelineFactory.create_pipeline.__doc__
    assert "LLM" in VoicePipelineFactory.create_pipeline.__doc__
    assert "TTS" in VoicePipelineFactory.create_pipeline.__doc__

    assert run_voice_pipeline.__doc__ is not None
    assert "WebSocket" in run_voice_pipeline.__doc__


def test_voice_pipeline_module_has_correct_structure():
    """Test that the module has the expected structure."""
    from agent_loop_server import voice_pipeline
    import inspect

    # Check that VoicePipelineFactory is a class
    assert inspect.isclass(voice_pipeline.VoicePipelineFactory)

    # Check that run_voice_pipeline is a function
    assert inspect.isfunction(voice_pipeline.run_voice_pipeline)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
