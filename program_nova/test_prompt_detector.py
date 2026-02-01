"""
Tests for prompt_detector module.

This module tests the detection of active system prompts from Claude Code session transcripts.
"""

import json
from program_nova.prompt_detector import (
    extract_project_dir_from_transcript,
    find_active_prompts,
)


class TestExtractProjectDir:
    """Tests for extracting project directory from transcript."""

    def test_extract_cwd_from_valid_transcript(self, tmp_path):
        """Test extracting cwd from a valid JSONL transcript."""
        # Create a test transcript file
        transcript_file = tmp_path / "test_session.jsonl"

        # Write sample JSONL lines with session metadata
        test_data = [
            {
                "timestamp": "2026-02-01T02:04:30Z",
                "data": {
                    "session_id": "test-session-123",
                    "transcript_path": "/path/to/transcript.jsonl",
                    "cwd": "/home/user/project",
                    "hook_event_name": "SessionStart",
                    "source": "startup"
                }
            },
            {
                "type": "user",
                "message": {
                    "content": "Hello Claude",
                    "uuid": "msg-123"
                }
            }
        ]

        with open(transcript_file, 'w') as f:
            for line in test_data:
                f.write(json.dumps(line) + '\n')

        # Extract project directory
        result = extract_project_dir_from_transcript(str(transcript_file))

        assert result == "/home/user/project"

    def test_extract_cwd_from_session_metadata(self, tmp_path):
        """Test extracting cwd from session metadata line (alternative format)."""
        transcript_file = tmp_path / "test_session.jsonl"

        # Alternative format with cwd at root level
        test_data = [
            {
                "sessionId": "test-session-456",
                "cwd": "/var/www/myapp",
                "gitBranch": "main",
                "version": "1.0"
            }
        ]

        with open(transcript_file, 'w') as f:
            for line in test_data:
                f.write(json.dumps(line) + '\n')

        result = extract_project_dir_from_transcript(str(transcript_file))

        assert result == "/var/www/myapp"

    def test_no_cwd_returns_none(self, tmp_path):
        """Test that missing cwd returns None."""
        transcript_file = tmp_path / "test_session.jsonl"

        test_data = [
            {"type": "user", "message": {"content": "test"}}
        ]

        with open(transcript_file, 'w') as f:
            for line in test_data:
                f.write(json.dumps(line) + '\n')

        result = extract_project_dir_from_transcript(str(transcript_file))

        assert result is None

    def test_empty_file_returns_none(self, tmp_path):
        """Test that empty file returns None."""
        transcript_file = tmp_path / "empty.jsonl"
        transcript_file.touch()

        result = extract_project_dir_from_transcript(str(transcript_file))

        assert result is None

    def test_missing_file_returns_none(self):
        """Test that missing file returns None."""
        result = extract_project_dir_from_transcript("/nonexistent/file.jsonl")

        assert result is None


class TestFindActivePrompts:
    """Tests for finding active system prompts."""

    def test_find_prompts_in_claude_prompts_dir(self, tmp_path):
        """Test finding prompts in .claude/prompts/ directory."""
        # Create mock project structure
        project_dir = tmp_path / "test_project"
        project_dir.mkdir()

        prompts_dir = project_dir / ".claude" / "prompts"
        prompts_dir.mkdir(parents=True)

        # Create test prompt files
        (prompts_dir / "planning.md").write_text("# Planning prompt")
        (prompts_dir / "coding.txt").write_text("Coding prompt content")

        # Find prompts
        result = find_active_prompts(str(project_dir))

        assert len(result) == 2
        assert any(p.name == "planning.md" for p in result)
        assert any(p.name == "coding.txt" for p in result)
        assert all(p.location == ".claude/prompts" for p in result)

    def test_find_prompts_in_multiple_locations(self, tmp_path):
        """Test finding prompts in multiple common locations."""
        project_dir = tmp_path / "test_project"
        project_dir.mkdir()

        # Create prompts in different locations
        locations = [
            ".claude/prompts",
            ".claude/commands",
            "prompts",
        ]

        for loc in locations:
            loc_path = project_dir / loc
            loc_path.mkdir(parents=True)
            (loc_path / "test.md").write_text(f"Prompt in {loc}")

        result = find_active_prompts(str(project_dir))

        # Should find prompts in all locations
        assert len(result) >= 3
        found_locations = {p.location for p in result}
        assert ".claude/prompts" in found_locations
        assert ".claude/commands" in found_locations
        assert "prompts" in found_locations

    def test_no_prompts_returns_empty_list(self, tmp_path):
        """Test that project with no prompts returns empty list."""
        project_dir = tmp_path / "empty_project"
        project_dir.mkdir()

        result = find_active_prompts(str(project_dir))

        assert result == []

    def test_missing_project_dir_returns_empty_list(self):
        """Test that missing project directory returns empty list."""
        result = find_active_prompts("/nonexistent/project")

        assert result == []

    def test_prompt_info_contains_correct_data(self, tmp_path):
        """Test that PromptInfo objects contain correct metadata."""
        project_dir = tmp_path / "test_project"
        project_dir.mkdir()

        prompts_dir = project_dir / ".claude" / "prompts"
        prompts_dir.mkdir(parents=True)

        test_content = "# Test Prompt\nThis is a test prompt."
        prompt_file = prompts_dir / "test_prompt.md"
        prompt_file.write_text(test_content)

        result = find_active_prompts(str(project_dir))

        assert len(result) == 1
        prompt = result[0]
        assert prompt.name == "test_prompt.md"
        assert prompt.location == ".claude/prompts"
        assert prompt.content == test_content
        assert str(project_dir / ".claude" / "prompts" / "test_prompt.md") in prompt.full_path

    def test_filters_non_prompt_files(self, tmp_path):
        """Test that non-prompt files are filtered out."""
        project_dir = tmp_path / "test_project"
        prompts_dir = project_dir / ".claude" / "prompts"
        prompts_dir.mkdir(parents=True)

        # Create various files
        (prompts_dir / "prompt.md").write_text("Prompt")
        (prompts_dir / "data.json").write_text("{}")  # Should be ignored
        (prompts_dir / "script.py").write_text("# Python")  # Should be ignored
        (prompts_dir / "notes.txt").write_text("Notes")  # Should be included

        result = find_active_prompts(str(project_dir))

        # Should only include .md and .txt files
        assert len(result) == 2
        assert all(p.name.endswith(('.md', '.txt')) for p in result)
