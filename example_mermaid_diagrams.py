#!/usr/bin/env python3
"""
Example usage of the GenerateMermaidDiagrams BAML function.

This demonstrates how to generate three types of Mermaid diagrams:
- Flow diagrams (process flows)
- ERD diagrams (data models)
- System architecture diagrams (component relationships)
"""

import os
from agent_loop_server.baml_client import b
from agent_loop_server.baml_client.types import Message, MessageRole


def example_ecommerce_system():
    """Generate diagrams for an e-commerce system."""

    messages = [
        Message(
            role=MessageRole.User,
            content="We're building an e-commerce platform with user accounts, products, and orders."
        ),
        Message(
            role=MessageRole.Assistant,
            content="I'll help design that. The system should have users who can browse products and place orders."
        ),
        Message(
            role=MessageRole.User,
            content="Yes, and we need to handle payments and inventory tracking."
        )
    ]

    context = """
    E-commerce Platform Requirements:
    - User authentication and profiles
    - Product catalog with categories
    - Shopping cart functionality
    - Order processing and payment
    - Inventory management
    - Order fulfillment workflow
    """

    print("Generating Mermaid diagrams for e-commerce platform...")
    print("=" * 60)

    try:
        # Call the BAML function
        result = b.GenerateMermaidDiagrams(
            messages=messages,
            context=context
        )

        print("\n📊 FLOW DIAGRAM (Process Flow)")
        print("-" * 60)
        print(result.flow)

        print("\n📊 ERD DIAGRAM (Data Model)")
        print("-" * 60)
        print(result.erd)

        print("\n📊 SYSTEM ARCHITECTURE DIAGRAM")
        print("-" * 60)
        print(result.system_arch)

        print("\n✅ Diagrams generated successfully!")
        print("\nTo visualize these diagrams:")
        print("1. Copy each diagram to https://mermaid.live")
        print("2. Or use a Mermaid-compatible markdown renderer")

    except Exception as e:
        print(f"❌ Error generating diagrams: {e}")
        raise


def example_microservices_system():
    """Generate diagrams for a microservices architecture."""

    messages = [
        Message(
            role=MessageRole.User,
            content="We're migrating from a monolith to microservices architecture."
        ),
        Message(
            role=MessageRole.Assistant,
            content="Let's design a microservices architecture with API Gateway, service mesh, and individual services."
        )
    ]

    context = """
    Microservices Architecture:
    - API Gateway for routing
    - User Service (authentication, profiles)
    - Product Service (catalog, search)
    - Order Service (order processing)
    - Payment Service (payment processing)
    - Message Queue for async communication
    - Service Discovery
    - Centralized logging and monitoring
    """

    print("\n\nGenerating Mermaid diagrams for microservices architecture...")
    print("=" * 60)

    try:
        result = b.GenerateMermaidDiagrams(
            messages=messages,
            context=context
        )

        print("\n📊 FLOW DIAGRAM (Request Flow)")
        print("-" * 60)
        print(result.flow)

        print("\n📊 ERD DIAGRAM (Service Data Models)")
        print("-" * 60)
        print(result.erd)

        print("\n📊 SYSTEM ARCHITECTURE DIAGRAM")
        print("-" * 60)
        print(result.system_arch)

        print("\n✅ Diagrams generated successfully!")

    except Exception as e:
        print(f"❌ Error generating diagrams: {e}")
        raise


if __name__ == "__main__":
    # Check for API key
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("⚠️  Warning: ANTHROPIC_API_KEY environment variable not set")
        print("Please set it to use this example:")
        print("export ANTHROPIC_API_KEY='your-api-key'")
        exit(1)

    print("🎨 Mermaid Diagram Generator Examples")
    print("=" * 60)

    # Run examples
    example_ecommerce_system()
    example_microservices_system()

    print("\n" + "=" * 60)
    print("✨ All examples completed!")
