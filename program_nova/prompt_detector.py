"""
Prompt Detector - Detects active system prompts from Claude Code session transcripts.

This module reads a JSONL transcript file, extracts the project directory, and identifies
which system prompts were active during the session by checking common prompt locations.
"""

import json
from pathlib import Path
from typing import Optional, List
from dataclasses import dataclass


@dataclass
class PromptInfo:
    """Information about a detected prompt file."""
    name: str           # Filename (e.g., "planning.md")
    location: str       # Relative location from project root (e.g., ".claude/prompts")
    full_path: str      # Absolute path to the file
    content: str        # Content of the prompt file


# Common locations where prompt files might be stored
PROMPT_LOCATIONS = [
    ".claude/prompts",
    ".claude/commands",
    ".claude/commands/solution-architect",
    ".claude/commands/problem",
    "prompts",
    ".prompts",
]

# File extensions to consider as prompts
PROMPT_EXTENSIONS = {".md", ".txt"}


def extract_project_dir_from_transcript(transcript_path: str) -> Optional[str]:
    """
    Extract the project directory (cwd) from a Claude Code transcript JSONL file.

    The project directory is typically found in the session metadata at the start
    of the transcript file, either in a 'data' field or at the root level.

    Args:
        transcript_path: Path to the .jsonl transcript file

    Returns:
        The project directory path (cwd), or None if not found or file doesn't exist

    Example transcript line formats:
        1. Hook format:
           {"timestamp": "...", "data": {"cwd": "/path/to/project", ...}}

        2. Session metadata format:
           {"sessionId": "...", "cwd": "/path/to/project", "gitBranch": "main", ...}
    """
    try:
        with open(transcript_path, 'r') as f:
            # Read through lines to find cwd
            for line in f:
                line = line.strip()
                if not line:
                    continue

                try:
                    data = json.loads(line)

                    # Check for cwd in 'data' field (hook format)
                    if 'data' in data and isinstance(data['data'], dict):
                        cwd = data['data'].get('cwd')
                        if cwd:
                            return cwd

                    # Check for cwd at root level (session metadata format)
                    if 'cwd' in data:
                        return data['cwd']

                except json.JSONDecodeError:
                    continue

    except (FileNotFoundError, IOError):
        return None

    return None


def find_active_prompts(project_dir: str) -> List[PromptInfo]:
    """
    Find all active prompt files in a project directory.

    Searches common prompt locations (.claude/prompts/, .claude/commands/, etc.)
    and returns information about all prompt files found.

    Args:
        project_dir: Path to the project directory

    Returns:
        List of PromptInfo objects for each prompt file found.
        Returns empty list if project directory doesn't exist or no prompts found.
    """
    project_path = Path(project_dir)

    if not project_path.exists() or not project_path.is_dir():
        return []

    prompts = []

    # Search each common prompt location
    for location in PROMPT_LOCATIONS:
        prompt_dir = project_path / location

        if not prompt_dir.exists() or not prompt_dir.is_dir():
            continue

        # Find all prompt files in this location
        for file_path in prompt_dir.iterdir():
            if not file_path.is_file():
                continue

            # Only include files with prompt extensions
            if file_path.suffix not in PROMPT_EXTENSIONS:
                continue

            # Read prompt content
            try:
                content = file_path.read_text(encoding='utf-8')

                prompts.append(PromptInfo(
                    name=file_path.name,
                    location=location,
                    full_path=str(file_path),
                    content=content
                ))
            except (IOError, UnicodeDecodeError):
                # Skip files that can't be read
                continue

    return prompts


def detect_prompts_from_transcript(transcript_path: str) -> dict:
    """
    Detect active prompts from a Claude Code session transcript.

    This is a convenience function that combines extracting the project directory
    and finding active prompts.

    Args:
        transcript_path: Path to the .jsonl transcript file

    Returns:
        Dictionary with:
        - 'project_dir': The detected project directory (or None)
        - 'prompts': List of PromptInfo objects for detected prompts
        - 'success': Boolean indicating if detection was successful

    Example:
        result = detect_prompts_from_transcript("session.jsonl")
        if result['success']:
            print(f"Found {len(result['prompts'])} prompts")
            for prompt in result['prompts']:
                print(f"  - {prompt.name} in {prompt.location}")
    """
    # Extract project directory
    project_dir = extract_project_dir_from_transcript(transcript_path)

    if not project_dir:
        return {
            'project_dir': None,
            'prompts': [],
            'success': False
        }

    # Find prompts
    prompts = find_active_prompts(project_dir)

    return {
        'project_dir': project_dir,
        'prompts': prompts,
        'success': True
    }


# Example usage and CLI interface
if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python prompt_detector.py <transcript.jsonl>")
        print()
        print("Detects which system prompts were active in a Claude Code session.")
        sys.exit(1)

    transcript_path = sys.argv[1]

    # Detect prompts
    result = detect_prompts_from_transcript(transcript_path)

    if not result['success']:
        print(f"Error: Could not extract project directory from {transcript_path}")
        sys.exit(1)

    print(f"Project Directory: {result['project_dir']}")
    print()

    prompts = result['prompts']
    if not prompts:
        print("No prompt files found in common locations.")
    else:
        print(f"Found {len(prompts)} active prompt(s):")
        print()
        for prompt in prompts:
            print(f"  📝 {prompt.name}")
            print(f"     Location: {prompt.location}")
            print(f"     Path: {prompt.full_path}")
            print(f"     Size: {len(prompt.content)} characters")
            print()
