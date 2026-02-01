"""Example usage of the Anthropic wrapper."""

from program_nova.anthropic_wrapper import AnthropicWrapper, AuthenticationError, RateLimitError


def example_simple_usage():
    """Example of simple single-message usage."""
    try:
        # Initialize wrapper (uses ANTHROPIC_API_KEY env var)
        wrapper = AnthropicWrapper()

        # Send a simple message
        response = wrapper.send_simple_message(
            "What is the capital of France?",
            max_tokens=100
        )

        print(f"Response: {response}")

    except AuthenticationError as e:
        print(f"Authentication failed: {e}")
    except Exception as e:
        print(f"Error: {e}")


def example_conversation():
    """Example of multi-turn conversation."""
    try:
        wrapper = AnthropicWrapper()

        # Multi-turn conversation
        messages = [
            {"role": "user", "content": "Hello! Can you help me with Python?"},
            {"role": "assistant", "content": "Of course! I'd be happy to help with Python. What would you like to know?"},
            {"role": "user", "content": "How do I read a file?"}
        ]

        response = wrapper.send_message(
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )

        print(f"Assistant: {response.content}")
        print(f"Tokens used - Input: {response.usage['input_tokens']}, Output: {response.usage['output_tokens']}")

    except Exception as e:
        print(f"Error: {e}")


def example_with_system_prompt():
    """Example using system prompt."""
    try:
        wrapper = AnthropicWrapper()

        response = wrapper.send_message(
            messages=[{"role": "user", "content": "Tell me about recursion"}],
            system="You are a computer science teacher. Explain concepts clearly and concisely.",
            max_tokens=300
        )

        print(f"Response: {response.content}")

    except Exception as e:
        print(f"Error: {e}")


def example_error_handling():
    """Example demonstrating error handling."""
    try:
        # This will fail if API key is invalid
        wrapper = AnthropicWrapper(api_key="invalid-key")

        wrapper.send_simple_message("Hello")

    except AuthenticationError as e:
        print(f"Authentication error: {e}")
    except RateLimitError as e:
        print(f"Rate limit error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")


def example_custom_model():
    """Example using different Claude models."""
    try:
        wrapper = AnthropicWrapper()

        # Use Claude 3 Opus for more complex tasks
        response = wrapper.send_message(
            messages=[{"role": "user", "content": "Explain quantum computing"}],
            model="claude-3-opus-20240229",
            max_tokens=1000,
            temperature=0.5
        )

        print(f"Model: {response.model}")
        print(f"Response: {response.content}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    print("=== Simple Usage ===")
    example_simple_usage()

    print("\n=== Conversation ===")
    example_conversation()

    print("\n=== System Prompt ===")
    example_with_system_prompt()

    print("\n=== Error Handling ===")
    example_error_handling()

    print("\n=== Custom Model ===")
    example_custom_model()
