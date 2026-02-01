"""Thin wrapper around Anthropic SDK for sending messages and handling errors."""

from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass
import os

try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    Anthropic = None


@dataclass
class MessageResponse:
    """Response from Anthropic API."""
    content: str
    model: str
    role: str
    stop_reason: Optional[str] = None
    usage: Optional[Dict[str, int]] = None
    raw_response: Optional[Any] = None


class AnthropicError(Exception):
    """Base exception for Anthropic wrapper errors."""
    pass


class AuthenticationError(AnthropicError):
    """Raised when API key is invalid or missing."""
    pass


class RateLimitError(AnthropicError):
    """Raised when rate limit is exceeded."""
    pass


class InvalidRequestError(AnthropicError):
    """Raised when request is invalid."""
    pass


class APIError(AnthropicError):
    """Raised when API returns an error."""
    pass


class AnthropicWrapper:
    """Thin wrapper around Anthropic SDK for message handling."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize the wrapper.

        Args:
            api_key: Anthropic API key. If not provided, will look for ANTHROPIC_API_KEY env var.

        Raises:
            AuthenticationError: If no API key is provided or found in environment.
        """
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise AuthenticationError("No API key provided. Set ANTHROPIC_API_KEY environment variable or pass api_key parameter.")

        if not ANTHROPIC_AVAILABLE or Anthropic is None:
            raise ImportError("anthropic package not installed. Install with: pip install anthropic")

        self.client = Anthropic(api_key=self.api_key)

    def send_message(
        self,
        messages: List[Dict[str, str]],
        model: str = "claude-3-5-sonnet-20241022",
        max_tokens: int = 1024,
        temperature: float = 1.0,
        system: Optional[str] = None,
        **kwargs
    ) -> MessageResponse:
        """Send a message to Anthropic API and get response.

        Args:
            messages: List of message dicts with 'role' and 'content' keys.
            model: Model to use for generation.
            max_tokens: Maximum tokens to generate.
            temperature: Sampling temperature (0-1).
            system: Optional system prompt.
            **kwargs: Additional parameters to pass to the API.

        Returns:
            MessageResponse object with the API response.

        Raises:
            AuthenticationError: If API key is invalid.
            RateLimitError: If rate limit is exceeded.
            InvalidRequestError: If request format is invalid.
            APIError: For other API errors.
        """
        try:
            request_params = {
                "model": model,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": messages,
                **kwargs
            }

            if system:
                request_params["system"] = system

            response = self.client.messages.create(**request_params)

            # Extract text content from response
            content_text = ""
            if response.content:
                for block in response.content:
                    if hasattr(block, 'text'):
                        content_text += block.text

            return MessageResponse(
                content=content_text,
                model=response.model,
                role=response.role,
                stop_reason=response.stop_reason,
                usage={
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens
                } if response.usage else None,
                raw_response=response
            )

        except Exception as e:
            self._handle_error(e)

    def _handle_error(self, error: Exception) -> None:
        """Handle and translate Anthropic SDK errors.

        Args:
            error: The original exception from the SDK.

        Raises:
            Appropriate wrapper exception based on error type.
        """
        error_message = str(error)

        try:
            from anthropic import (
                AuthenticationError as AnthropicAuthError,
                RateLimitError as AnthropicRateLimitError,
                BadRequestError,
                APIError as AnthropicAPIError
            )

            if isinstance(error, AnthropicAuthError):
                raise AuthenticationError(f"Authentication failed: {error_message}") from error
            elif isinstance(error, AnthropicRateLimitError):
                raise RateLimitError(f"Rate limit exceeded: {error_message}") from error
            elif isinstance(error, BadRequestError):
                raise InvalidRequestError(f"Invalid request: {error_message}") from error
            elif isinstance(error, AnthropicAPIError):
                raise APIError(f"API error: {error_message}") from error
            else:
                raise APIError(f"Unexpected error: {error_message}") from error

        except ImportError:
            # If we can't import Anthropic error types, raise generic error
            raise APIError(f"Error communicating with Anthropic API: {error_message}") from error

    def send_simple_message(
        self,
        user_message: str,
        model: str = "claude-3-5-sonnet-20241022",
        max_tokens: int = 1024,
        system: Optional[str] = None
    ) -> str:
        """Send a simple user message and get text response.

        Convenience method for single-turn conversations.

        Args:
            user_message: The user's message text.
            model: Model to use for generation.
            max_tokens: Maximum tokens to generate.
            system: Optional system prompt.

        Returns:
            The response text as a string.
        """
        messages = [{"role": "user", "content": user_message}]
        response = self.send_message(
            messages=messages,
            model=model,
            max_tokens=max_tokens,
            system=system
        )
        return response.content
