#!/usr/bin/env python3
"""
Example usage of Task U2 functionality.

This demonstrates how to populate the database with sample analyses
and then query/deduplicate them using query_analyses.py.
"""

import json
import db
from query_analyses import get_unaddressed_analyses, group_by_failure_category, deduplicate_by_category


def create_sample_data():
    """Create sample sessions and analyses for testing."""
    print("Creating sample data...")

    # Initialize database
    db.init_db()

    # Create sample sessions
    sessions = [
        {"session_id": "session-001", "title": "Add authentication feature"},
        {"session_id": "session-002", "title": "Optimize API performance"},
        {"session_id": "session-003", "title": "Refactor user module"},
        {"session_id": "session-004", "title": "Add payment integration"},
        {"session_id": "session-005", "title": "Implement caching"},
    ]

    for session in sessions:
        try:
            db.create_session(**session)
        except Exception as e:
            print(f"Session {session['session_id']} may already exist: {e}")

    # Create sample analyses with various failure categories
    analyses = [
        # Missing plan mode failures
        {
            "session_id": "session-001",
            "analysis_type": "planning_failure",
            "content": json.dumps([{
                "failure_category": "missing_plan_mode",
                "triggering_message_number": 1,
                "description": "User requested adding authentication to the app. This is a multi-file architectural change requiring decisions about auth method, storage, middleware. Claude started implementing without entering plan mode.",
                "suggested_improvement": "System prompt should emphasize entering plan mode for authentication/authorization features as they always involve architectural decisions."
            }]),
            "metadata": {"addressed": False}
        },
        {
            "session_id": "session-004",
            "analysis_type": "planning_failure",
            "content": json.dumps([{
                "failure_category": "missing_plan_mode",
                "triggering_message_number": 2,
                "description": "User asked to add payment integration. This requires choosing payment provider, handling webhooks, managing PCI compliance. Should have entered plan mode.",
                "suggested_improvement": "Emphasize plan mode for payment and financial feature implementations due to security and architectural implications."
            }]),
            "metadata": {"addressed": False}
        },
        {
            "session_id": "session-005",
            "analysis_type": "planning_failure",
            "content": json.dumps([{
                "failure_category": "missing_plan_mode",
                "triggering_message_number": 1,
                "description": "User wanted to implement caching without specifying which layer. Could be Redis, in-memory, CDN, etc. Required architectural discussion first.",
                "suggested_improvement": "System prompt should require plan mode for infrastructure changes like caching, as they involve multiple valid approaches."
            }]),
            "metadata": {"addressed": False}
        },

        # Insufficient clarification failures
        {
            "session_id": "session-002",
            "analysis_type": "planning_failure",
            "content": json.dumps([{
                "failure_category": "insufficient_clarification",
                "triggering_message_number": 1,
                "description": "User asked to 'optimize the API' without specifying what metrics matter (latency, throughput, memory). Claude started making changes without clarifying optimization goals.",
                "suggested_improvement": "When users request optimization, the prompt should require asking what specific metrics to optimize for before proceeding."
            }]),
            "metadata": {"addressed": False}
        },
        {
            "session_id": "session-002",
            "analysis_type": "planning_failure",
            "content": json.dumps([{
                "failure_category": "insufficient_clarification",
                "triggering_message_number": 5,
                "description": "User mentioned 'making it faster' without context about acceptable latency, which operations to prioritize, or current bottlenecks.",
                "suggested_improvement": "Require clarification on performance targets and constraints before starting optimization work."
            }]),
            "metadata": {"addressed": False}
        },

        # Premature implementation failures
        {
            "session_id": "session-003",
            "analysis_type": "planning_failure",
            "content": json.dumps([{
                "failure_category": "premature_implementation",
                "triggering_message_number": 2,
                "description": "User said 'refactor the user module' and Claude immediately started moving code around without understanding the current architecture or desired end state.",
                "suggested_improvement": "Before refactoring, always first explore the current implementation and ask about the desired architecture."
            }]),
            "metadata": {"addressed": False}
        },

        # Poor task breakdown
        {
            "session_id": "session-004",
            "analysis_type": "planning_failure",
            "content": json.dumps([{
                "failure_category": "poor_task_breakdown",
                "triggering_message_number": 5,
                "description": "Payment integration was attempted as a single monolithic task instead of breaking it into: provider selection, API setup, webhook handling, error handling, testing.",
                "suggested_improvement": "For complex multi-step features, use TodoWrite to break down into clear subtasks before starting implementation."
            }]),
            "metadata": {"addressed": False}
        },

        # Already addressed analysis (should be filtered out)
        {
            "session_id": "session-001",
            "analysis_type": "planning_failure",
            "content": json.dumps([{
                "failure_category": "missing_plan_mode",
                "triggering_message_number": 10,
                "description": "This analysis was already addressed in a previous prompt update.",
                "suggested_improvement": "This should not appear in results."
            }]),
            "metadata": {"addressed": True, "updated_at": "2026-01-30T12:00:00"}
        },
    ]

    for analysis in analyses:
        db.create_analysis(**analysis)

    print(f"Created {len(analyses)} analyses (including 1 already addressed)")
    print()


def demonstrate_query_and_deduplication():
    """Demonstrate the full U2 workflow."""

    print("=" * 80)
    print("TASK U2: QUERY AND DEDUPLICATE ANALYSES")
    print("=" * 80)
    print()

    # Step 1: Get unaddressed analyses
    print("Step 1: Querying unaddressed analyses...")
    unaddressed = get_unaddressed_analyses()
    print(f"Found {len(unaddressed)} unaddressed analyses")
    print()

    # Step 2: Group by failure category
    print("Step 2: Grouping by failure category...")
    grouped = group_by_failure_category(unaddressed)
    print(f"Grouped into {len(grouped)} categories:")
    for category, analyses in grouped.items():
        print(f"  - {category}: {len(analyses)} analyses")
    print()

    # Step 3: Deduplicate within categories
    print("Step 3: Deduplicating suggestions...")
    deduplicated = deduplicate_by_category(grouped)
    print()

    # Display results
    print("=" * 80)
    print("RESULTS")
    print("=" * 80)
    print()

    for category, data in sorted(deduplicated.items()):
        print(f"\n{'─' * 80}")
        print(f"Category: {category.upper().replace('_', ' ')}")
        print(f"{'─' * 80}")
        print(f"Total occurrences: {data['count']}")
        print(f"Unique suggestions: {len(data['unique_suggestions'])}")

        print(f"\nExample Descriptions:")
        for i, desc in enumerate(data['example_descriptions'], 1):
            # Truncate long descriptions
            desc_short = desc if len(desc) <= 120 else desc[:117] + "..."
            print(f"  {i}. {desc_short}")

        print(f"\nDeduplicated Suggestions:")
        for i, suggestion in enumerate(data['unique_suggestions'], 1):
            print(f"  {i}. {suggestion}")
        print()

    print("=" * 80)
    print(f"\nSummary:")
    print(f"  Total unaddressed analyses: {len(unaddressed)}")
    print(f"  Failure categories: {len(deduplicated)}")
    total_suggestions = sum(len(d['unique_suggestions']) for d in deduplicated.values())
    print(f"  Total unique suggestions: {total_suggestions}")
    print()


if __name__ == "__main__":
    import sys

    # Check if we should create sample data
    if len(sys.argv) > 1 and sys.argv[1] == "--create-samples":
        create_sample_data()

    # Run demonstration
    demonstrate_query_and_deduplication()
