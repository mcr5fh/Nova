# Anthropic SDK Wrapper

A thin wrapper around the Anthropic SDK for sending messages, getting responses, and handling errors.

## Installation

First, install the Anthropic SDK:

```bash
pip install anthropic
```

## Usage

### Basic Setup

```python
from program_nova.anthropic_wrapper import AnthropicWrapper

# Initialize with API key from environment variable ANTHROPIC_API_KEY
wrapper = AnthropicWrapper()

# Or pass API key explicitly
wrapper = AnthropicWrapper(api_key="your-api-key")
```

### Simple Message

```python
# Send a single message and get text response
response = wrapper.send_simple_message("What is the capital of France?")
print(response)  # "The capital of France is Paris."
```

### Multi-turn Conversation

```python
messages = [
    {"role": "user", "content": "Hello! Can you help me with Python?"},
    {"role": "assistant", "content": "Of course! I'd be happy to help with Python."},
    {"role": "user", "content": "How do I read a file?"}
]

response = wrapper.send_message(messages=messages, max_tokens=500)

print(response.content)
print(f"Tokens used - Input: {response.usage['input_tokens']}, Output: {response.usage['output_tokens']}")
```

### With System Prompt

```python
response = wrapper.send_message(
    messages=[{"role": "user", "content": "Tell me about recursion"}],
    system="You are a computer science teacher. Explain concepts clearly and concisely.",
    max_tokens=300
)

print(response.content)
```

### Custom Model and Parameters

```python
response = wrapper.send_message(
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    model="claude-3-opus-20240229",
    max_tokens=1000,
    temperature=0.5
)

print(f"Model: {response.model}")
print(f"Response: {response.content}")
```

## Error Handling

The wrapper provides custom exception classes for different error types:

```python
from program_nova.anthropic_wrapper import (
    AnthropicWrapper,
    AuthenticationError,
    RateLimitError,
    InvalidRequestError,
    APIError
)

try:
    wrapper = AnthropicWrapper(api_key="invalid-key")
    wrapper.send_simple_message("Hello")

except AuthenticationError as e:
    print(f"Authentication error: {e}")
except RateLimitError as e:
    print(f"Rate limit error: {e}")
except InvalidRequestError as e:
    print(f"Invalid request: {e}")
except APIError as e:
    print(f"API error: {e}")
```

## API Reference

### AnthropicWrapper

#### `__init__(api_key: Optional[str] = None)`

Initialize the wrapper.

- `api_key`: Anthropic API key. If not provided, will look for `ANTHROPIC_API_KEY` env var.

**Raises**: `AuthenticationError` if no API key is provided or found.

#### `send_message(messages, model, max_tokens, temperature, system, **kwargs)`

Send a message to Anthropic API and get response.

**Parameters:**
- `messages`: List of message dicts with 'role' and 'content' keys
- `model`: Model to use (default: "claude-3-5-sonnet-20241022")
- `max_tokens`: Maximum tokens to generate (default: 1024)
- `temperature`: Sampling temperature 0-1 (default: 1.0)
- `system`: Optional system prompt
- `**kwargs`: Additional parameters to pass to the API

**Returns**: `MessageResponse` object with:
- `content`: The response text
- `model`: Model used
- `role`: Response role (usually "assistant")
- `stop_reason`: Why the response stopped
- `usage`: Token usage dict with `input_tokens` and `output_tokens`
- `raw_response`: Original API response object

#### `send_simple_message(user_message, model, max_tokens, system)`

Convenience method for single-turn conversations.

**Parameters:**
- `user_message`: The user's message text
- `model`: Model to use (default: "claude-3-5-sonnet-20241022")
- `max_tokens`: Maximum tokens to generate (default: 1024)
- `system`: Optional system prompt

**Returns**: The response text as a string

### Exception Classes

- `AnthropicError`: Base exception for all wrapper errors
- `AuthenticationError`: API key is invalid or missing
- `RateLimitError`: Rate limit is exceeded
- `InvalidRequestError`: Request format is invalid
- `APIError`: Generic API error

## Examples

See `example_anthropic_usage.py` for complete working examples.

## Running Tests

```bash
pytest program_nova/test_anthropic_wrapper.py -v
```
