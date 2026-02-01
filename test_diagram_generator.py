"""Test DiagramGenerator integration."""

import asyncio
from agent_loop_server.agent import DiagramGenerator
from agent_loop_server.events import AgentMessageEvent, DiagramUpdateEvent, DiagramErrorEvent


async def test_diagram_generator_basic():
    """Test basic diagram generator functionality."""
    events_received = []

    async def mock_broadcast(event):
        """Mock broadcast callback to capture events."""
        events_received.append(event)
        print(f"Event received: {type(event).__name__}")

    # Create diagram generator with shorter debounce for testing
    generator = DiagramGenerator(
        api_base_url="http://localhost:8001",
        debounce_seconds=0.5,
        broadcast_callback=mock_broadcast,
    )

    # Add some messages
    generator.add_user_message("Hello, I want to create a user authentication system")
    await generator.handle_agent_message(
        AgentMessageEvent(message="I can help you with that. Let me design a system...")
    )

    # Wait for debounce
    await asyncio.sleep(1.0)

    print(f"\n✓ Test completed")
    print(f"  Conversation history: {len(generator.conversation_history)} messages")
    print(f"  Events received: {len(events_received)}")

    return generator, events_received


async def test_debouncing():
    """Test that debouncing works correctly."""
    events_received = []

    async def mock_broadcast(event):
        """Mock broadcast callback."""
        events_received.append(event)
        print(f"Event at {asyncio.get_event_loop().time():.2f}: {type(event).__name__}")

    generator = DiagramGenerator(
        api_base_url="http://localhost:8001",
        debounce_seconds=2.0,
        broadcast_callback=mock_broadcast,
    )

    # Add messages rapidly
    start_time = asyncio.get_event_loop().time()
    print(f"\nStarting rapid messages at {start_time:.2f}")

    for i in range(5):
        await generator.handle_agent_message(
            AgentMessageEvent(message=f"Message {i}")
        )
        await asyncio.sleep(0.1)

    print(f"Finished sending messages at {asyncio.get_event_loop().time():.2f}")

    # Wait for debounce to complete
    await asyncio.sleep(3.0)

    end_time = asyncio.get_event_loop().time()
    elapsed = end_time - start_time

    print(f"\n✓ Debouncing test completed")
    print(f"  Total elapsed time: {elapsed:.2f}s")
    print(f"  Messages sent: 5")
    print(f"  Events received: {len(events_received)}")
    print(f"  Expected: 1 diagram generation (due to debouncing)")

    return generator, events_received


if __name__ == "__main__":
    print("=" * 60)
    print("Testing DiagramGenerator")
    print("=" * 60)

    print("\n1. Basic functionality test:")
    print("-" * 60)
    asyncio.run(test_diagram_generator_basic())

    print("\n2. Debouncing test:")
    print("-" * 60)
    asyncio.run(test_debouncing())

    print("\n" + "=" * 60)
    print("All tests completed!")
    print("=" * 60)
