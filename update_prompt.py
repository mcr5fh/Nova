#!/usr/bin/env python3
"""
Send current prompt + aggregated findings to Claude API for prompt update.

This script orchestrates U1 through P2:
U1: Load current planning system prompt from file
U2: Query and aggregate unaddressed planning failure analyses
U3: Send both to Claude API to generate an updated prompt
P1: Write the updated prompt to a file
P2: (Optional) Create a PR via Claude Code CLI

Usage:
    python3 update_prompt.py --prompt-file <path>
    python3 update_prompt.py --prompt-file <path> --output <path>
    python3 update_prompt.py --prompt-file <path> --create-pr
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, List

# Import our modules
from program_nova.anthropic_wrapper import AnthropicWrapper, AnthropicError
import prompts
import query_analyses


def load_current_prompt(prompt_file: str) -> str:
    """
    U1: Load the current planning system prompt from file.

    Args:
        prompt_file: Path to the prompt file to load

    Returns:
        Content of the prompt file

    Raises:
        FileNotFoundError: If prompt file doesn't exist
        IOError: If file cannot be read
    """
    prompt_path = Path(prompt_file)

    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_file}")

    if not prompt_path.is_file():
        raise IOError(f"Path is not a file: {prompt_file}")

    with open(prompt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    if not content.strip():
        raise IOError(f"Prompt file is empty: {prompt_file}")

    return content


def get_aggregated_findings() -> List[Dict[str, Any]]:
    """
    U2: Get aggregated and deduplicated findings from the database.

    Returns:
        List of aggregated findings with failure categories and suggestions
    """
    # Get unaddressed analyses
    unaddressed = query_analyses.get_unaddressed_analyses()

    if not unaddressed:
        print("No unaddressed analyses found.")
        return []

    # Group by failure category
    grouped = query_analyses.group_by_failure_category(unaddressed)

    # Deduplicate within categories
    deduplicated = query_analyses.deduplicate_by_category(grouped)

    # Convert to list format for prompt generation
    findings = []
    for category, data in deduplicated.items():
        findings.append({
            "failure_category": category,
            "count": data["count"],
            "unique_suggestions": data["unique_suggestions"],
            "example_descriptions": data["example_descriptions"]
        })

    return findings


def send_prompt_update_request(
    current_prompt: str,
    findings: List[Dict[str, Any]]
) -> str:
    """
    U3: Send the current prompt and findings to Claude API for an updated prompt.

    Args:
        current_prompt: The current planning system prompt
        findings: Aggregated planning failure findings

    Returns:
        Updated prompt from Claude

    Raises:
        AnthropicError: If API call fails
    """
    # Initialize wrapper
    wrapper = AnthropicWrapper()

    # Generate the prompt using our template
    prompt_text = prompts.get_prompt_update_generation_prompt(
        current_prompt=current_prompt,
        aggregated_findings=findings
    )

    print("Sending request to Claude API...")
    print(f"Input: {len(current_prompt)} chars of current prompt")
    print(f"Input: {len(findings)} failure categories")

    # Send to Claude API with higher token limit for full prompt generation
    response = wrapper.send_message(
        messages=[{"role": "user", "content": prompt_text}],
        model="claude-3-5-sonnet-20241022",
        max_tokens=4000,
        temperature=0.3  # Lower temperature for more consistent output
    )

    print(f"\nAPI Response received:")
    print(f"  Tokens used - Input: {response.usage['input_tokens']}, Output: {response.usage['output_tokens']}")
    print(f"  Stop reason: {response.stop_reason}")

    return response.content


def write_updated_prompt(updated_prompt: str, output_file: str) -> None:
    """
    P1: Write the updated prompt to a file.

    Args:
        updated_prompt: The updated prompt content
        output_file: Path to write the updated prompt to

    Raises:
        IOError: If file cannot be written
    """
    output_path = Path(output_file)

    # Create parent directories if they don't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(updated_prompt)

    print(f"✓ Updated prompt saved to: {output_file}")


def create_pr_with_claude_code(
    prompt_file: str,
    findings: List[Dict[str, Any]],
    branch_name: str = "auto-update-system-prompt"
) -> None:
    """
    P2: Create a PR via Claude Code CLI.

    Args:
        prompt_file: Path to the prompt file that was updated
        findings: Aggregated findings for PR description
        branch_name: Name of the branch to create

    Raises:
        subprocess.CalledProcessError: If git or Claude Code commands fail
    """
    print("\nStep P2: Creating PR via Claude Code...")

    # Check if we're in a git repo
    try:
        subprocess.run(['git', 'rev-parse', '--git-dir'],
                       check=True, capture_output=True)
    except subprocess.CalledProcessError:
        print("  Error: Not in a git repository")
        sys.exit(1)

    # Create branch
    print(f"  Creating branch: {branch_name}")
    try:
        # Check if branch already exists
        result = subprocess.run(['git', 'branch', '--list', branch_name],
                                capture_output=True, text=True)
        if result.stdout.strip():
            print(f"  Branch '{branch_name}' already exists, switching to it")
            subprocess.run(['git', 'checkout', branch_name], check=True)
        else:
            subprocess.run(['git', 'checkout', '-b', branch_name], check=True)
    except subprocess.CalledProcessError as e:
        print(f"  Error creating branch: {e}")
        sys.exit(1)

    # Stage the changed prompt file
    print(f"  Staging: {prompt_file}")
    try:
        subprocess.run(['git', 'add', prompt_file], check=True)
    except subprocess.CalledProcessError as e:
        print(f"  Error staging file: {e}")
        sys.exit(1)

    # Create commit
    commit_message = generate_commit_message(findings)
    print("  Creating commit...")
    try:
        subprocess.run(['git', 'commit', '-m', commit_message], check=True)
    except subprocess.CalledProcessError as e:
        print(f"  Error creating commit: {e}")
        sys.exit(1)

    # Push branch
    print(f"  Pushing branch to remote...")
    try:
        subprocess.run(['git', 'push', '-u', 'origin', branch_name], check=True)
    except subprocess.CalledProcessError as e:
        print(f"  Error pushing branch: {e}")
        sys.exit(1)

    print("✓ Branch created and pushed successfully")
    print(f"\n  To create a PR, run:")
    print(f"    gh pr create --title \"Auto-update planning system prompt\" --body \"<description>\"")


def generate_commit_message(findings: List[Dict[str, Any]]) -> str:
    """
    Generate a commit message summarizing the prompt update.

    Args:
        findings: Aggregated findings that were addressed

    Returns:
        Commit message string
    """
    categories = [f['failure_category'] for f in findings]
    summary = f"Auto-update planning system prompt\n\nAddresses {len(findings)} failure categories:\n"

    for finding in findings:
        summary += f"- {finding['failure_category']} ({finding['count']} occurrences)\n"

    return summary


def parse_args() -> argparse.Namespace:
    """
    Parse command-line arguments.

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="Auto-update planning system prompt based on analysis findings",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Update prompt from file, save to default output
  %(prog)s --prompt-file prompts/planning.txt

  # Specify custom output location
  %(prog)s --prompt-file prompts/planning.txt --output updated_planning.txt

  # Update and create a PR
  %(prog)s --prompt-file prompts/planning.txt --create-pr

Environment Variables:
  ANTHROPIC_API_KEY: Required for Claude API access
        """
    )

    parser.add_argument(
        '--prompt-file',
        required=True,
        help='Path to the current planning system prompt file'
    )

    parser.add_argument(
        '--output',
        default='updated_planning_prompt.txt',
        help='Path to save the updated prompt (default: updated_planning_prompt.txt)'
    )

    parser.add_argument(
        '--create-pr',
        action='store_true',
        help='Create a PR with the updated prompt via git commands'
    )

    parser.add_argument(
        '--branch',
        default='auto-update-system-prompt',
        help='Branch name for PR (default: auto-update-system-prompt)'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )

    return parser.parse_args()


def main():
    """Main function to orchestrate U1 through P2."""
    args = parse_args()

    print("=" * 80)
    print("PLANNING PROMPT AUTO-UPDATER")
    print("=" * 80)
    print()

    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes will be made\n")

    # Check API key
    if not os.getenv('ANTHROPIC_API_KEY'):
        print("Error: ANTHROPIC_API_KEY environment variable not set")
        print("Set it with: export ANTHROPIC_API_KEY='your-api-key-here'")
        sys.exit(1)

    # U1: Load current prompt
    print("Step U1: Loading current planning prompt...")
    try:
        current_prompt = load_current_prompt(args.prompt_file)
        print(f"  ✓ Loaded {len(current_prompt)} characters from {args.prompt_file}")
    except (FileNotFoundError, IOError) as e:
        print(f"  Error: {e}")
        sys.exit(1)
    print()

    # U2: Get aggregated findings
    print("Step U2: Querying and aggregating unaddressed analyses...")
    findings = get_aggregated_findings()

    if not findings:
        print("  No findings to address. Exiting.")
        return

    print(f"  ✓ Found {len(findings)} failure categories:")
    for finding in findings:
        print(f"    - {finding['failure_category']}: {finding['count']} occurrences")
    print()

    # U3: Send to Claude API
    print("Step U3: Generating updated prompt via Claude API...")
    if args.dry_run:
        print("  [DRY RUN] Would send to Claude API")
        updated_prompt = current_prompt + "\n\n[DRY RUN - No actual update]"
    else:
        try:
            updated_prompt = send_prompt_update_request(current_prompt, findings)
            print(f"  ✓ Generated updated prompt ({len(updated_prompt)} characters)")
        except AnthropicError as e:
            print(f"  Error calling Claude API: {e}")
            sys.exit(1)
    print()

    # P1: Write updated prompt
    print(f"Step P1: Writing updated prompt to {args.output}...")
    if args.dry_run:
        print(f"  [DRY RUN] Would write to: {args.output}")
    else:
        try:
            write_updated_prompt(updated_prompt, args.output)
        except IOError as e:
            print(f"  Error writing file: {e}")
            sys.exit(1)
    print()

    # P2: Create PR (optional)
    if args.create_pr:
        if args.dry_run:
            print("Step P2: [DRY RUN] Would create PR")
            print(f"  Branch: {args.branch}")
            print(f"  Files: {args.output}")
        else:
            create_pr_with_claude_code(args.output, findings, args.branch)
    else:
        print("Skipping PR creation (use --create-pr to enable)")

    print()
    print("=" * 80)
    print("COMPLETE")
    print("=" * 80)
    print()
    print(f"Updated prompt saved to: {args.output}")
    if args.create_pr and not args.dry_run:
        print(f"Branch '{args.branch}' created and pushed")


if __name__ == "__main__":
    main()
