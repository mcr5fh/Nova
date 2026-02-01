"""
Session Analysis Workflow

This script orchestrates the complete workflow:
1. Load messages for a session from DB
2. Send to Claude via Anthropic wrapper (A1) with prompt (A2)
3. Parse response with JSON parser (A3)
4. Store analysis in analyses table

Usage:
    python analyze_session.py --session <session_id>
    python analyze_session.py --all [--limit N]

Environment Variables:
    ANTHROPIC_API_KEY: Required for Claude API access
"""

import sys
import os
import json
import argparse
from pathlib import Path
from typing import Optional, List, Dict, Any

# Import local modules
import db
from program_nova.anthropic_wrapper import AnthropicWrapper, AnthropicError
from program_nova.jsonl_parser import parse_jsonl_line, filter_human_messages
from prompts import get_planning_failure_analysis_prompt


def load_user_messages_from_db(session_id: str, db_path: str = None) -> List[str]:
    """
    Load all user messages for a session from the database.

    Args:
        session_id: The session identifier
        db_path: Optional database path

    Returns:
        List of user message content strings
    """
    messages = db.get_messages(session_id, db_path=db_path)

    # Filter to only user messages and extract content
    user_messages = [
        msg['content']
        for msg in messages
        if msg['role'] == 'user'
    ]

    return user_messages


def load_user_messages_from_jsonl(jsonl_path: str) -> List[str]:
    """
    Load user messages directly from a JSONL file (alternative method).

    Args:
        jsonl_path: Path to the session JSONL file

    Returns:
        List of user message content strings
    """
    user_messages = []

    with open(jsonl_path, 'r') as f:
        for line in f:
            parsed = parse_jsonl_line(line)
            if filter_human_messages(parsed):
                user_messages.append(parsed.content)

    return user_messages


def analyze_session_with_claude(
    user_messages: List[str],
    anthropic_wrapper: AnthropicWrapper,
    model: str = "claude-sonnet-4-5",
    max_tokens: int = 4096
) -> Optional[List[Dict[str, Any]]]:
    """
    Send user messages to Claude for planning failure analysis.

    Args:
        user_messages: List of user message strings
        anthropic_wrapper: Configured AnthropicWrapper instance
        model: Model to use for analysis
        max_tokens: Maximum tokens for response

    Returns:
        List of planning failure findings (parsed JSON), or None if analysis failed
    """
    # Generate the analysis prompt
    prompt = get_planning_failure_analysis_prompt(user_messages)

    try:
        # Send to Claude
        print(f"  Sending {len(user_messages)} user messages to Claude for analysis...")
        response = anthropic_wrapper.send_simple_message(
            user_message=prompt,
            model=model,
            max_tokens=max_tokens
        )

        # Parse JSON response
        # Claude may wrap the JSON in markdown code blocks, so we need to extract it
        response_text = response.strip()

        # Remove markdown code blocks if present
        if response_text.startswith("```"):
            lines = response_text.split('\n')
            # Remove first line (```json) and last line (```)
            response_text = '\n'.join(lines[1:-1])

        # Parse JSON
        findings = json.loads(response_text)

        print(f"  ✓ Analysis complete. Found {len(findings)} planning failures.")
        return findings

    except json.JSONDecodeError as e:
        print(f"  ✗ Failed to parse Claude's response as JSON: {e}")
        print(f"  Response was: {response[:200]}...")
        return None

    except AnthropicError as e:
        print(f"  ✗ Anthropic API error: {e}")
        return None


def store_analysis_in_db(
    session_id: str,
    findings: List[Dict[str, Any]],
    db_path: str = None
) -> int:
    """
    Store analysis findings in the analyses table.

    Args:
        session_id: The session identifier
        findings: List of planning failure findings
        db_path: Optional database path

    Returns:
        Database ID of the created analysis record
    """
    # Store as a single analysis record with type 'planning_failure'
    content_json = json.dumps(findings, indent=2)

    metadata = {
        "failure_count": len(findings),
        "categories": list(set(f.get("failure_category", "unknown") for f in findings))
    }

    analysis_id = db.create_analysis(
        session_id=session_id,
        analysis_type="planning_failure",
        content=content_json,
        metadata=metadata,
        db_path=db_path
    )

    print(f"  ✓ Stored analysis in database (ID: {analysis_id})")
    return analysis_id


def analyze_single_session(
    session_id: str,
    anthropic_wrapper: AnthropicWrapper,
    db_path: str = None
) -> bool:
    """
    Complete workflow: analyze a single session and store results.

    Args:
        session_id: The session identifier
        anthropic_wrapper: Configured AnthropicWrapper instance
        db_path: Optional database path

    Returns:
        True if analysis succeeded, False otherwise
    """
    print(f"\nAnalyzing session: {session_id}")

    # Step 1: Load messages from DB
    print("  Loading messages from database...")
    user_messages = load_user_messages_from_db(session_id, db_path)

    if not user_messages:
        print(f"  ✗ No user messages found for session {session_id}")
        return False

    print(f"  ✓ Loaded {len(user_messages)} user messages")

    # Step 2: Analyze with Claude
    findings = analyze_session_with_claude(user_messages, anthropic_wrapper)

    if findings is None:
        return False

    # Step 3: Store results
    if findings:  # Only store if there are findings
        store_analysis_in_db(session_id, findings, db_path)
    else:
        print("  ✓ No planning failures detected - skipping database storage")

    return True


def analyze_all_sessions(
    anthropic_wrapper: AnthropicWrapper,
    db_path: str = None,
    limit: int = None,
    reanalyze: bool = False
) -> Dict[str, int]:
    """
    Analyze all sessions in the database.

    Args:
        anthropic_wrapper: Configured AnthropicWrapper instance
        db_path: Optional database path
        limit: Optional limit on number of sessions to analyze
        reanalyze: If False (default), skip sessions that already have an analysis

    Returns:
        Dictionary with 'success', 'failed', and 'skipped' counts
    """
    print("Analyzing all sessions...")

    sessions = db.get_all_sessions(limit=limit, db_path=db_path)

    if not sessions:
        print("No sessions found in database")
        return {"success": 0, "failed": 0, "skipped": 0}

    results = {"success": 0, "failed": 0, "skipped": 0}

    # Filter out already-analyzed sessions unless reanalyze is set
    if not reanalyze:
        unanalyzed = []
        for session in sessions:
            existing = db.get_analyses(session['session_id'], analysis_type='planning_failure', db_path=db_path)
            if existing:
                results["skipped"] += 1
            else:
                unanalyzed.append(session)
        sessions = unanalyzed

    if not sessions:
        print(f"No new sessions to analyze ({results['skipped']} already analyzed)")
        return results

    print(f"Found {len(sessions)} sessions to analyze ({results['skipped']} already analyzed, skipped)")

    for session in sessions:
        session_id = session['session_id']
        success = analyze_single_session(session_id, anthropic_wrapper, db_path)

        if success:
            results["success"] += 1
        else:
            results["failed"] += 1

    print(f"\n{'='*60}")
    print(f"Analysis complete:")
    print(f"  Successful: {results['success']}")
    print(f"  Failed: {results['failed']}")
    print(f"  Skipped (already analyzed): {results['skipped']}")
    print(f"{'='*60}")

    return results


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description="Analyze Claude Code sessions for planning failures",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  Analyze a specific session:
    python analyze_session.py --session abc123

  Analyze all sessions:
    python analyze_session.py --all

  Analyze all sessions with a limit:
    python analyze_session.py --all --limit 10

Environment Variables:
  ANTHROPIC_API_KEY    Required for Claude API access
        """
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--session",
        type=str,
        metavar="ID",
        help="Analyze a specific session by ID"
    )
    group.add_argument(
        "--all",
        action="store_true",
        help="Analyze all sessions in the database"
    )

    parser.add_argument(
        "--limit",
        type=int,
        metavar="N",
        help="Limit the number of sessions to analyze (use with --all)"
    )

    parser.add_argument(
        "--reanalyze",
        action="store_true",
        help="Re-analyze sessions even if they already have an analysis (use with --all)"
    )

    args = parser.parse_args()

    # Validate that --limit is only used with --all
    if args.limit and not args.all:
        parser.error("--limit can only be used with --all")

    if args.reanalyze and not args.all:
        parser.error("--reanalyze can only be used with --all")

    # Check for ANTHROPIC_API_KEY environment variable
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("Error: ANTHROPIC_API_KEY environment variable is not set")
        print("\nPlease set your API key:")
        print("  export ANTHROPIC_API_KEY='your-api-key'")
        sys.exit(1)

    # Initialize Anthropic wrapper
    try:
        wrapper = AnthropicWrapper()
    except Exception as e:
        print(f"Error initializing Anthropic API: {e}")
        print("\nMake sure ANTHROPIC_API_KEY environment variable is set:")
        print("  export ANTHROPIC_API_KEY='your-api-key'")
        sys.exit(1)

    # Execute the requested analysis
    if args.all:
        analyze_all_sessions(wrapper, limit=args.limit, reanalyze=args.reanalyze)
    else:
        success = analyze_single_session(args.session, wrapper)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
