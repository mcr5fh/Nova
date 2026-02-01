#!/usr/bin/env python3
"""
Test script for query_analyses.py functionality.

Demonstrates the deduplication logic with sample data.
"""

import json
from query_analyses import deduplicate_suggestions, similarity


def test_similarity():
    """Test the similarity function."""
    print("Testing similarity function:")
    print("=" * 80)

    test_pairs = [
        ("System prompt should emphasize entering plan mode for auth features",
         "Emphasize plan mode in system prompt for authentication"),
        ("Always ask clarifying questions before implementation",
         "Request clarification from user prior to coding"),
        ("Break down complex tasks into subtasks",
         "Use subtask breakdown for complicated requests"),
        ("This is completely different",
         "Something entirely unrelated"),
    ]

    for a, b in test_pairs:
        sim = similarity(a, b)
        print(f"\nString 1: {a}")
        print(f"String 2: {b}")
        print(f"Similarity: {sim:.2%}")
        print(f"Would deduplicate at 0.8 threshold: {sim >= 0.8}")

    print()


def test_deduplication():
    """Test the deduplication function."""
    print("\nTesting deduplication with sample suggestions:")
    print("=" * 80)

    # Test case 1: Moderately similar suggestions
    suggestions = [
        "System prompt should emphasize entering plan mode for authentication features",
        "Emphasize plan mode in system prompt for authentication and authorization",
        "Always ask clarifying questions before starting implementation",
        "Request clarification from users before beginning to code",
        "Break down complex tasks into smaller subtasks",
        "Use task breakdown for complicated multi-step requests",
        "Add more examples of when to enter plan mode",
        "Include additional plan mode examples in the prompt",
    ]

    print("\n--- Test Case 1: Moderately Similar ---")

    print(f"\nOriginal suggestions ({len(suggestions)}):")
    for i, s in enumerate(suggestions, 1):
        print(f"  {i}. {s}")

    # Test with different thresholds
    for threshold in [0.5, 0.65, 0.8]:
        deduplicated = deduplicate_suggestions(suggestions, threshold=threshold)
        print(f"\nThreshold {threshold}: {len(suggestions)} → {len(deduplicated)} "
              f"({(1 - len(deduplicated)/len(suggestions))*100:.1f}% reduction)")
        for i, s in enumerate(deduplicated, 1):
            print(f"  {i}. {s}")

    # Test case 2: Very similar/duplicate suggestions
    print("\n\n--- Test Case 2: Very Similar/Duplicates ---")
    duplicate_suggestions = [
        "System prompt should emphasize entering plan mode for authentication",
        "System prompt should emphasize entering plan mode for authentication features",
        "The system prompt should emphasize entering plan mode for authentication",
        "Add clarifying questions to the prompt",
        "Include clarifying questions in the system prompt",
        "Make sure to ask clarifying questions",
        "Different suggestion about task breakdown",
    ]

    print(f"\nOriginal suggestions ({len(duplicate_suggestions)}):")
    for i, s in enumerate(duplicate_suggestions, 1):
        print(f"  {i}. {s}")

    for threshold in [0.5, 0.65, 0.8]:
        deduplicated = deduplicate_suggestions(duplicate_suggestions, threshold=threshold)
        print(f"\nThreshold {threshold}: {len(duplicate_suggestions)} → {len(deduplicated)} "
              f"({(1 - len(deduplicated)/len(duplicate_suggestions))*100:.1f}% reduction)")
        for i, s in enumerate(deduplicated, 1):
            print(f"  {i}. {s}")

    print()


def test_with_mock_data():
    """Test with mock database data structure."""
    print("\nTesting with mock analysis data structure:")
    print("=" * 80)

    mock_analyses = [
        {
            "id": 1,
            "session_id": "session-001",
            "analysis_type": "planning_failure",
            "content": json.dumps([{
                "failure_category": "missing_plan_mode",
                "triggering_message_number": 3,
                "description": "User requested adding authentication without plan mode",
                "suggested_improvement": "System prompt should emphasize plan mode for auth"
            }]),
            "created_at": "2026-01-31T10:00:00",
            "metadata": json.dumps({"addressed": False})
        },
        {
            "id": 2,
            "session_id": "session-002",
            "analysis_type": "planning_failure",
            "content": json.dumps([{
                "failure_category": "missing_plan_mode",
                "triggering_message_number": 5,
                "description": "User wanted to add OAuth without discussing approach",
                "suggested_improvement": "Emphasize entering plan mode for authentication features"
            }]),
            "created_at": "2026-01-31T11:00:00",
            "metadata": json.dumps({"addressed": False})
        },
        {
            "id": 3,
            "session_id": "session-003",
            "analysis_type": "planning_failure",
            "content": json.dumps([{
                "failure_category": "insufficient_clarification",
                "triggering_message_number": 2,
                "description": "User asked to optimize API without specifying metrics",
                "suggested_improvement": "Always ask what metrics to optimize before proceeding"
            }]),
            "created_at": "2026-01-31T12:00:00",
            "metadata": json.dumps({"addressed": False})
        },
    ]

    # Group by category
    from collections import defaultdict
    grouped = defaultdict(list)

    for analysis in mock_analyses:
        content = json.loads(analysis["content"])
        for finding in content:
            category = finding.get("failure_category", "unknown")
            grouped[category].append({
                "analysis_id": analysis["id"],
                "session_id": analysis["session_id"],
                "finding": finding
            })

    # Process each category
    for category, analyses in grouped.items():
        suggestions = [a["finding"]["suggested_improvement"] for a in analyses]
        deduplicated = deduplicate_suggestions(suggestions)  # Use default threshold (0.65)

        print(f"\nCategory: {category.upper().replace('_', ' ')}")
        print(f"  Total: {len(analyses)}")
        print(f"  Unique suggestions: {len(deduplicated)}")
        print(f"  Suggestions:")
        for i, s in enumerate(deduplicated, 1):
            print(f"    {i}. {s}")

    print()


if __name__ == "__main__":
    test_similarity()
    test_deduplication()
    test_with_mock_data()
