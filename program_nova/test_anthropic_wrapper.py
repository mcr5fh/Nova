"""Tests for Anthropic SDK wrapper."""

import pytest
import os
from unittest.mock import Mock, patch
from program_nova.anthropic_wrapper import (
    AnthropicWrapper,
    MessageResponse,
    AuthenticationError,
    RateLimitError,
    InvalidRequestError,
    APIError
)


@pytest.fixture
def mock_anthropic():
    """Fixture to mock Anthropic client."""
    with patch('program_nova.anthropic_wrapper.Anthropic') as mock_class:
        with patch('program_nova.anthropic_wrapper.ANTHROPIC_AVAILABLE', True):
            yield mock_class


class TestAnthropicWrapper:
    """Test cases for AnthropicWrapper."""

    def test_init_with_api_key(self, mock_anthropic):
        """Test initialization with explicit API key."""
        wrapper = AnthropicWrapper(api_key="test-key")
        assert wrapper.api_key == "test-key"
        mock_anthropic.assert_called_once_with(api_key="test-key")

    def test_init_with_env_var(self, mock_anthropic):
        """Test initialization with environment variable."""
        with patch.dict(os.environ, {'ANTHROPIC_API_KEY': 'env-key'}):
            wrapper = AnthropicWrapper()
            assert wrapper.api_key == "env-key"
            mock_anthropic.assert_called_once_with(api_key="env-key")

    def test_init_without_api_key(self):
        """Test initialization fails without API key."""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(AuthenticationError) as exc_info:
                AnthropicWrapper()
            assert "No API key provided" in str(exc_info.value)

    def test_send_message_success(self, mock_anthropic):
        """Test successful message sending."""
        # Mock response
        mock_content = Mock()
        mock_content.text = "Hello! How can I help you?"

        mock_usage = Mock()
        mock_usage.input_tokens = 10
        mock_usage.output_tokens = 20

        mock_response = Mock()
        mock_response.content = [mock_content]
        mock_response.model = "claude-3-5-sonnet-20241022"
        mock_response.role = "assistant"
        mock_response.stop_reason = "end_turn"
        mock_response.usage = mock_usage

        mock_client = Mock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client

        wrapper = AnthropicWrapper(api_key="test-key")

        messages = [{"role": "user", "content": "Hello"}]
        response = wrapper.send_message(messages)

        assert isinstance(response, MessageResponse)
        assert response.content == "Hello! How can I help you?"
        assert response.model == "claude-3-5-sonnet-20241022"
        assert response.role == "assistant"
        assert response.stop_reason == "end_turn"
        assert response.usage["input_tokens"] == 10
        assert response.usage["output_tokens"] == 20

        mock_client.messages.create.assert_called_once()

    def test_send_message_with_system_prompt(self, mock_anthropic):
        """Test sending message with system prompt."""
        mock_content = Mock()
        mock_content.text = "Response"

        mock_response = Mock()
        mock_response.content = [mock_content]
        mock_response.model = "claude-3-5-sonnet-20241022"
        mock_response.role = "assistant"
        mock_response.stop_reason = "end_turn"
        mock_response.usage = None

        mock_client = Mock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client

        wrapper = AnthropicWrapper(api_key="test-key")

        messages = [{"role": "user", "content": "Hello"}]
        response = wrapper.send_message(
            messages,
            system="You are a helpful assistant."
        )

        assert response.content == "Response"

        call_args = mock_client.messages.create.call_args
        assert call_args.kwargs["system"] == "You are a helpful assistant."

    def test_send_simple_message(self, mock_anthropic):
        """Test simple message convenience method."""
        mock_content = Mock()
        mock_content.text = "Simple response"

        mock_response = Mock()
        mock_response.content = [mock_content]
        mock_response.model = "claude-3-5-sonnet-20241022"
        mock_response.role = "assistant"
        mock_response.stop_reason = "end_turn"
        mock_response.usage = None

        mock_client = Mock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client

        wrapper = AnthropicWrapper(api_key="test-key")

        response = wrapper.send_simple_message("Hello")

        assert response == "Simple response"
        assert isinstance(response, str)

    def test_error_handling(self, mock_anthropic):
        """Test that errors are properly wrapped and raised."""
        mock_client = Mock()
        mock_client.messages.create.side_effect = Exception("API Error occurred")
        mock_anthropic.return_value = mock_client

        wrapper = AnthropicWrapper(api_key="test-key")

        with pytest.raises(APIError) as exc_info:
            wrapper.send_message([{"role": "user", "content": "Hello"}])
        assert "API Error occurred" in str(exc_info.value)




    def test_multiple_content_blocks(self, mock_anthropic):
        """Test handling response with multiple content blocks."""
        mock_content1 = Mock()
        mock_content1.text = "First part. "

        mock_content2 = Mock()
        mock_content2.text = "Second part."

        mock_response = Mock()
        mock_response.content = [mock_content1, mock_content2]
        mock_response.model = "claude-3-5-sonnet-20241022"
        mock_response.role = "assistant"
        mock_response.stop_reason = "end_turn"
        mock_response.usage = None

        mock_client = Mock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client

        wrapper = AnthropicWrapper(api_key="test-key")

        response = wrapper.send_message([{"role": "user", "content": "Hello"}])

        assert response.content == "First part. Second part."

    def test_custom_parameters(self, mock_anthropic):
        """Test passing custom parameters to API."""
        mock_content = Mock()
        mock_content.text = "Response"

        mock_response = Mock()
        mock_response.content = [mock_content]
        mock_response.model = "claude-3-opus-20240229"
        mock_response.role = "assistant"
        mock_response.stop_reason = "end_turn"
        mock_response.usage = None

        mock_client = Mock()
        mock_client.messages.create.return_value = mock_response
        mock_anthropic.return_value = mock_client

        wrapper = AnthropicWrapper(api_key="test-key")

        messages = [{"role": "user", "content": "Hello"}]
        wrapper.send_message(
            messages,
            model="claude-3-opus-20240229",
            max_tokens=2048,
            temperature=0.7,
            top_p=0.9
        )

        call_args = mock_client.messages.create.call_args
        assert call_args.kwargs["model"] == "claude-3-opus-20240229"
        assert call_args.kwargs["max_tokens"] == 2048
        assert call_args.kwargs["temperature"] == 0.7
        assert call_args.kwargs["top_p"] == 0.9
