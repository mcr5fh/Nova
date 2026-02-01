"""
Test script for the session analysis workflow.

This tests the workflow without making actual API calls.
"""

import json
import sys
from pathlib import Path

# Import local modules
import db
from program_nova.jsonl_parser import parse_jsonl_line, filter_human_messages
from prompts import get_planning_failure_analysis_prompt


def test_load_messages():
    """Test loading messages from database."""
    print("Test 1: Loading messages from database")
    print("=" * 60)

    # Get a session
    sessions = db.get_all_sessions(limit=1)
    if not sessions:
        print("  ✗ No sessions found in database")
        print("  Run session_importer.py first to import sessions")
        return False

    session_id = sessions[0]['session_id']
    print(f"  Testing with session: {session_id}")

    # Load messages
    messages = db.get_messages(session_id)
    print(f"  Total messages: {len(messages)}")

    # Count by role
    role_counts = {}
    for msg in messages:
        role = msg['role']
        role_counts[role] = role_counts.get(role, 0) + 1

    print(f"  Message breakdown:")
    for role, count in role_counts.items():
        print(f"    {role}: {count}")

    # Extract user messages
    user_messages = [msg['content'] for msg in messages if msg['role'] == 'user']
    print(f"  User messages: {len(user_messages)}")

    if user_messages:
        print(f"  First user message preview: {user_messages[0][:100]}...")
        print("  ✓ Test passed\n")
        return True
    else:
        print("  ✗ No user messages found\n")
        return False


def test_prompt_generation():
    """Test generating the analysis prompt."""
    print("Test 2: Generating analysis prompt")
    print("=" * 60)

    # Sample user messages
    user_messages = [
        "Add authentication to the app",
        "Make it use JWT tokens",
        "Also add a login page"
    ]

    prompt = get_planning_failure_analysis_prompt(user_messages)

    print(f"  Generated prompt length: {len(prompt)} characters")
    print(f"  Prompt includes user messages: {'<user_messages>' in prompt}")
    print(f"  Prompt includes output format: {'json' in prompt.lower()}")
    print(f"  Prompt includes failure categories: {'missing_plan_mode' in prompt}")

    # Show a snippet
    print(f"\n  Prompt preview (first 200 chars):")
    print(f"  {prompt[:200]}...")

    if all([
        len(prompt) > 100,
        '<user_messages>' in prompt,
        'json' in prompt.lower(),
        'missing_plan_mode' in prompt
    ]):
        print("\n  ✓ Test passed\n")
        return True
    else:
        print("\n  ✗ Test failed\n")
        return False


def test_json_parsing():
    """Test parsing a mock Claude response."""
    print("Test 3: Parsing Claude response")
    print("=" * 60)

    # Mock response from Claude
    mock_response = """```json
[
  {
    "failure_category": "missing_plan_mode",
    "triggering_message_number": 1,
    "description": "User requested adding authentication, which is a multi-file change.",
    "suggested_improvement": "Emphasize plan mode for auth features."
  }
]
```"""

    # Simulate the parsing logic from analyze_session.py
    response_text = mock_response.strip()

    # Remove markdown code blocks
    if response_text.startswith("```"):
        lines = response_text.split('\n')
        response_text = '\n'.join(lines[1:-1])

    try:
        findings = json.loads(response_text)
        print(f"  ✓ Successfully parsed JSON")
        print(f"  Found {len(findings)} findings")

        if findings:
            print(f"  First finding category: {findings[0]['failure_category']}")
            print(f"  First finding message #: {findings[0]['triggering_message_number']}")
            print("\n  ✓ Test passed\n")
            return True
    except json.JSONDecodeError as e:
        print(f"  ✗ Failed to parse JSON: {e}\n")
        return False


def test_store_analysis():
    """Test storing analysis in database."""
    print("Test 4: Storing analysis in database")
    print("=" * 60)

    # Get a session
    sessions = db.get_all_sessions(limit=1)
    if not sessions:
        print("  ✗ No sessions found\n")
        return False

    session_id = sessions[0]['session_id']

    # Mock findings
    findings = [
        {
            "failure_category": "missing_plan_mode",
            "triggering_message_number": 1,
            "description": "Test finding",
            "suggested_improvement": "Test improvement"
        }
    ]

    # Store
    content_json = json.dumps(findings, indent=2)
    metadata = {
        "failure_count": len(findings),
        "categories": ["missing_plan_mode"],
        "test": True  # Mark as test data
    }

    try:
        analysis_id = db.create_analysis(
            session_id=session_id,
            analysis_type="planning_failure_test",
            content=content_json,
            metadata=metadata
        )

        print(f"  ✓ Created analysis record (ID: {analysis_id})")

        # Retrieve it
        analyses = db.get_analyses(session_id, analysis_type="planning_failure_test")
        print(f"  ✓ Retrieved {len(analyses)} analysis records")

        if analyses:
            latest = analyses[0]
            print(f"  Content length: {len(latest['content'])} chars")
            print(f"  Metadata: {latest['metadata']}")
            print("\n  ✓ Test passed\n")
            return True
        else:
            print("\n  ✗ Could not retrieve analysis\n")
            return False

    except Exception as e:
        print(f"  ✗ Error: {e}\n")
        return False


def test_jsonl_parser():
    """Test the JSONL parser with sample data."""
    print("Test 5: JSONL Parser")
    print("=" * 60)

    test_lines = [
        '{"type": "user", "message": {"content": "Hello Claude", "uuid": "msg-123"}}',
        '{"type": "tool", "message": {"content": [{"type": "text"}], "uuid": "msg-456"}}',
        '{"type": "assistant", "message": {"content": "Hi there!"}}',
    ]

    results = []
    for line in test_lines:
        parsed = parse_jsonl_line(line)
        is_human = filter_human_messages(parsed)
        results.append(is_human)

    # Should be: True, False, False
    expected = [True, False, False]

    if results == expected:
        print(f"  ✓ Correctly classified messages: {results}")
        print("  ✓ Test passed\n")
        return True
    else:
        print(f"  ✗ Expected {expected}, got {results}\n")
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("TESTING SESSION ANALYSIS WORKFLOW")
    print("=" * 60 + "\n")

    tests = [
        ("Load messages from DB", test_load_messages),
        ("Generate analysis prompt", test_prompt_generation),
        ("Parse JSON response", test_json_parsing),
        ("Store analysis in DB", test_store_analysis),
        ("JSONL parser", test_jsonl_parser),
    ]

    results = {}
    for name, test_func in tests:
        try:
            results[name] = test_func()
        except Exception as e:
            print(f"  ✗ Test raised exception: {e}\n")
            results[name] = False

    # Summary
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for name, result in results.items():
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status}: {name}")

    print(f"\n  Total: {passed}/{total} tests passed")
    print("=" * 60 + "\n")

    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
