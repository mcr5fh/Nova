#!/usr/bin/env python3
"""
Tests for the GenerateMermaidDiagrams BAML function.
"""

import pytest
import os
from agent_loop_server.baml_client import b
from agent_loop_server.baml_client.types import Message, MessageRole, DiagramSet


def test_diagram_set_structure():
    """Test that DiagramSet has the correct structure."""
    # Create a sample DiagramSet
    diagrams = DiagramSet(
        flow="flowchart TD\nA-->B",
        erd="erDiagram\nUSER ||--o{ ORDER : places",
        system_arch="graph TD\nAPI-->DB"
    )

    assert hasattr(diagrams, 'flow')
    assert hasattr(diagrams, 'erd')
    assert hasattr(diagrams, 'system_arch')
    assert isinstance(diagrams.flow, str)
    assert isinstance(diagrams.erd, str)
    assert isinstance(diagrams.system_arch, str)


def test_message_types():
    """Test that Message types are correctly defined."""
    user_msg = Message(role=MessageRole.User, content="Test")
    assistant_msg = Message(role=MessageRole.Assistant, content="Response")

    assert user_msg.role == MessageRole.User
    assert assistant_msg.role == MessageRole.Assistant
    assert user_msg.content == "Test"
    assert assistant_msg.content == "Response"


@pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set - skipping integration test"
)
def test_generate_mermaid_diagrams_integration():
    """Integration test for GenerateMermaidDiagrams function."""

    messages = [
        Message(
            role=MessageRole.User,
            content="I need a simple user management system"
        )
    ]

    context = "User management with basic CRUD operations"

    # Call the function
    result = b.GenerateMermaidDiagrams(
        messages=messages,
        context=context
    )

    # Verify result structure
    assert isinstance(result, DiagramSet)
    assert isinstance(result.flow, str)
    assert isinstance(result.erd, str)
    assert isinstance(result.system_arch, str)

    # Verify diagrams are not empty
    assert len(result.flow) > 0
    assert len(result.erd) > 0
    assert len(result.system_arch) > 0

    # Basic validation - check for common Mermaid keywords
    diagrams_text = f"{result.flow} {result.erd} {result.system_arch}".lower()

    # At least one diagram should contain some mermaid syntax
    assert any(keyword in diagrams_text for keyword in [
        'flowchart', 'graph', 'erdiagram', '-->', '|', 'td', 'lr'
    ])


@pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set - skipping integration test"
)
def test_generate_complex_system():
    """Test diagram generation for a more complex system."""

    messages = [
        Message(
            role=MessageRole.User,
            content="Design a microservices e-commerce platform"
        ),
        Message(
            role=MessageRole.Assistant,
            content="I'll create an architecture with separate services for users, products, and orders"
        )
    ]

    context = """
    E-commerce microservices:
    - User Service (auth, profiles)
    - Product Service (catalog)
    - Order Service (orders, payments)
    - API Gateway
    - Message Queue
    """

    result = b.GenerateMermaidDiagrams(
        messages=messages,
        context=context
    )

    # Verify all diagrams are generated
    assert len(result.flow) > 50  # Should be substantial
    assert len(result.erd) > 50
    assert len(result.system_arch) > 50


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
