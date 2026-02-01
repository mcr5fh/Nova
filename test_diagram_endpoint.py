#!/usr/bin/env python3
"""
Test script for the /api/diagram/generate endpoint.

Run this with the server running:
    python -m agent_loop_server.server &
    python test_diagram_endpoint.py
"""

import requests
import json
import os


def test_diagram_endpoint():
    """Test the diagram generation endpoint."""

    # Endpoint URL
    url = "http://localhost:8001/api/diagram/generate"

    # Test request payload
    payload = {
        "messages": [
            {
                "role": "user",
                "content": "We're building an e-commerce platform with user accounts, products, and orders."
            },
            {
                "role": "assistant",
                "content": "I'll help design that. The system should have users who can browse products and place orders."
            },
            {
                "role": "user",
                "content": "Yes, and we need to handle payments and inventory tracking."
            }
        ],
        "context": """
        E-commerce Platform Requirements:
        - User authentication and profiles
        - Product catalog with categories
        - Shopping cart functionality
        - Order processing and payment
        - Inventory management
        - Order fulfillment workflow
        """
    }

    print("Testing POST /api/diagram/generate endpoint...")
    print("=" * 60)

    try:
        # Make the request
        response = requests.post(url, json=payload)

        # Check status code
        if response.status_code != 200:
            print(f"❌ Error: Status code {response.status_code}")
            print(f"Response: {response.text}")
            return False

        # Parse response
        result = response.json()

        # Validate response structure
        if not all(key in result for key in ["flow", "erd", "system_arch"]):
            print("❌ Error: Missing required keys in response")
            print(f"Response keys: {list(result.keys())}")
            return False

        # Display results
        print("\n✅ Success! Generated diagrams:\n")

        print("📊 FLOW DIAGRAM:")
        print("-" * 60)
        print(result["flow"])
        print()

        print("📊 ERD DIAGRAM:")
        print("-" * 60)
        print(result["erd"])
        print()

        print("📊 SYSTEM ARCHITECTURE DIAGRAM:")
        print("-" * 60)
        print(result["system_arch"])
        print()

        print("=" * 60)
        print("✨ All tests passed!")
        return True

    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to server")
        print("Make sure the server is running:")
        print("  python -m agent_loop_server.server")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_error_handling():
    """Test error handling with invalid input."""

    url = "http://localhost:8001/api/diagram/generate"

    print("\nTesting error handling...")
    print("=" * 60)

    # Test invalid role
    payload = {
        "messages": [
            {"role": "invalid_role", "content": "test"}
        ],
        "context": "test context"
    }

    try:
        response = requests.post(url, json=payload)

        if response.status_code == 400:
            print("✅ Invalid role correctly rejected (400 Bad Request)")
            print(f"   Error message: {response.json()['detail']}")
        else:
            print(f"⚠️  Unexpected status code: {response.status_code}")

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False


if __name__ == "__main__":
    # Check for API key
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("⚠️  Warning: ANTHROPIC_API_KEY environment variable not set")
        print("Please set it to run this test:")
        print("export ANTHROPIC_API_KEY='your-api-key'")
        exit(1)

    print("🧪 Testing Diagram Generation Endpoint")
    print("=" * 60)

    # Run tests
    success = test_diagram_endpoint()
    if success:
        test_error_handling()

    print("\n" + "=" * 60)
    print("🎉 Testing complete!")
