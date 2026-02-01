"""
Script to find and analyze all unanalyzed sessions.

This script:
1. Queries all sessions from the database
2. Identifies which ones don't have S1 (planning_failure) analyses
3. Runs S1 analysis on each unanalyzed session
"""

import sys
from typing import List, Dict, Any

import db
from program_nova.anthropic_wrapper import AnthropicWrapper
from analyze_session import analyze_single_session


def get_unanalyzed_sessions(db_path: str = None) -> List[Dict[str, Any]]:
    """
    Find all sessions that don't have a planning_failure analysis.

    Args:
        db_path: Optional database path

    Returns:
        List of session dictionaries that need analysis
    """
    all_sessions = db.get_all_sessions(db_path=db_path)
    unanalyzed = []

    for session in all_sessions:
        session_id = session['session_id']
        analyses = db.get_analyses(session_id, analysis_type='planning_failure', db_path=db_path)

        if not analyses:
            unanalyzed.append(session)

    return unanalyzed


def main():
    """Main entry point."""
    print("Finding unanalyzed sessions...")

    # Find unanalyzed sessions
    unanalyzed = get_unanalyzed_sessions()

    if not unanalyzed:
        print("✓ All sessions have been analyzed!")
        return 0

    print(f"\nFound {len(unanalyzed)} unanalyzed sessions:")
    for session in unanalyzed:
        title = session.get('title', 'Untitled')
        print(f"  - {session['session_id']} ({title})")

    # Initialize Anthropic wrapper
    try:
        wrapper = AnthropicWrapper()
    except Exception as e:
        print(f"\n✗ Error initializing Anthropic API: {e}")
        print("\nMake sure ANTHROPIC_API_KEY environment variable is set:")
        print("  export ANTHROPIC_API_KEY='your-api-key'")
        return 1

    # Analyze each session
    print(f"\nRunning S1 analysis on {len(unanalyzed)} sessions...")
    print("=" * 80)

    results = {"success": 0, "failed": 0}

    for session in unanalyzed:
        session_id = session['session_id']
        success = analyze_single_session(session_id, wrapper)

        if success:
            results["success"] += 1
        else:
            results["failed"] += 1

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Successfully analyzed: {results['success']}")
    print(f"Failed: {results['failed']}")
    print("=" * 80)

    return 0 if results["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
