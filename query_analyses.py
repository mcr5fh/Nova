#!/usr/bin/env python3
"""
Query and analyze unaddressed planning failure analyses from the database.

This script:
1. Queries all analyses from the database
2. Filters for unaddressed analyses (where metadata.addressed is not True)
3. Groups by failure_category
4. Deduplicates similar suggestions using text similarity
5. Outputs the results in a structured format
"""

import json
import sqlite3
from collections import defaultdict
from pathlib import Path
from typing import List, Dict, Any
from difflib import SequenceMatcher

# Import database module
import db


def similarity(a: str, b: str) -> float:
    """
    Calculate similarity ratio between two strings.

    Args:
        a: First string
        b: Second string

    Returns:
        float: Similarity ratio between 0 and 1
    """
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def deduplicate_suggestions(suggestions: List[str], threshold: float = 0.65) -> List[str]:
    """
    Deduplicate similar suggestions based on text similarity.

    Uses a lower default threshold (0.65) to catch semantically similar suggestions
    that may be phrased differently.

    Args:
        suggestions: List of suggestion strings
        threshold: Similarity threshold (0-1) above which suggestions are considered duplicates
                  Default is 0.65 to balance deduplication vs preserving unique ideas

    Returns:
        List of deduplicated suggestions
    """
    if not suggestions:
        return []

    deduplicated = []

    for suggestion in suggestions:
        # Check if this suggestion is similar to any existing one
        is_duplicate = False
        for existing in deduplicated:
            if similarity(suggestion, existing) >= threshold:
                is_duplicate = True
                break

        if not is_duplicate:
            deduplicated.append(suggestion)

    return deduplicated


def get_unaddressed_analyses(db_path: str = None) -> List[Dict[str, Any]]:
    """
    Query all unaddressed analyses from the database.

    An analysis is considered unaddressed if:
    - metadata.addressed is not set to True
    - OR metadata field is None/empty

    Args:
        db_path: Optional path to database file

    Returns:
        List of unaddressed analysis dictionaries
    """
    analyses = []

    with db.get_connection(db_path) as conn:
        cursor = db.get_cursor(conn)
        cursor.execute("SELECT * FROM analyses ORDER BY created_at DESC")

        for row in cursor.fetchall():
            analysis = dict(row)

            # Parse metadata if it exists
            metadata = {}
            if analysis.get("metadata"):
                try:
                    # Handle both string and dict metadata
                    if isinstance(analysis["metadata"], str):
                        metadata = json.loads(analysis["metadata"])
                    else:
                        metadata = analysis["metadata"]
                except (json.JSONDecodeError, TypeError):
                    pass

            # Check if addressed
            if not metadata.get("addressed", False):
                analysis["parsed_metadata"] = metadata
                analyses.append(analysis)

    return analyses


def group_by_failure_category(analyses: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Group analyses by failure_category.

    Args:
        analyses: List of analysis dictionaries

    Returns:
        Dictionary mapping failure_category to list of analyses
    """
    grouped = defaultdict(list)

    for analysis in analyses:
        # Parse the content as JSON to get failure_category
        try:
            content = json.loads(analysis["content"])

            # Handle both single finding and array of findings
            if isinstance(content, list):
                findings = content
            else:
                findings = [content]

            for finding in findings:
                category = finding.get("failure_category", "unknown")
                grouped[category].append({
                    "analysis_id": analysis["id"],
                    "session_id": analysis["session_id"],
                    "created_at": analysis["created_at"],
                    "finding": finding
                })
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            print(f"Warning: Could not parse analysis {analysis['id']}: {e}")
            continue

    return dict(grouped)


def deduplicate_by_category(grouped: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Dict[str, Any]]:
    """
    Deduplicate suggestions within each category.

    Args:
        grouped: Dictionary mapping category to list of analyses

    Returns:
        Dictionary with deduplicated suggestions and metadata per category
    """
    result = {}

    for category, analyses in grouped.items():
        # Extract all suggestions
        suggestions = [a["finding"].get("suggested_improvement", "") for a in analyses]

        # Deduplicate
        unique_suggestions = deduplicate_suggestions(suggestions)

        # Get example descriptions
        descriptions = [a["finding"].get("description", "") for a in analyses][:3]  # First 3 examples

        result[category] = {
            "count": len(analyses),
            "unique_suggestions": unique_suggestions,
            "example_descriptions": descriptions,
            "analysis_ids": [a["analysis_id"] for a in analyses]
        }

    return result


def main():
    """Main function to query and display unaddressed analyses."""

    # Initialize database if needed
    db_path = str(db.DB_PATH)
    if not Path(db_path).exists() or Path(db_path).stat().st_size == 0:
        print(f"Database at {db_path} is empty or doesn't exist. Initializing...")
        db.init_db()
        print("Database initialized. No analyses found.")
        return

    print(f"Querying database at {db_path}...\n")

    # Get unaddressed analyses
    unaddressed = get_unaddressed_analyses()
    print(f"Found {len(unaddressed)} unaddressed analyses\n")

    if not unaddressed:
        print("No unaddressed analyses to process.")
        return

    # Group by failure category
    grouped = group_by_failure_category(unaddressed)
    print(f"Grouped into {len(grouped)} failure categories\n")

    # Deduplicate within categories
    deduplicated = deduplicate_by_category(grouped)

    # Display results
    print("=" * 80)
    print("UNADDRESSED ANALYSES BY FAILURE CATEGORY")
    print("=" * 80)
    print()

    for category, data in sorted(deduplicated.items()):
        print(f"\n{'─' * 80}")
        print(f"Category: {category.upper().replace('_', ' ')}")
        print(f"{'─' * 80}")
        print(f"Total occurrences: {data['count']}")
        print(f"Unique suggestions: {len(data['unique_suggestions'])}")
        print(f"Analysis IDs: {', '.join(map(str, data['analysis_ids']))}")

        print(f"\nExample Descriptions:")
        for i, desc in enumerate(data['example_descriptions'], 1):
            print(f"  {i}. {desc}")

        print(f"\nDeduplicated Suggestions:")
        for i, suggestion in enumerate(data['unique_suggestions'], 1):
            print(f"  {i}. {suggestion}")
        print()

    # Output as JSON for programmatic use
    print("\n" + "=" * 80)
    print("JSON OUTPUT")
    print("=" * 80)
    print(json.dumps(deduplicated, indent=2))


if __name__ == "__main__":
    main()
