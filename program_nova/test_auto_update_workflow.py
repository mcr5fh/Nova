"""
Tests for auto_update_workflow.py

Test the workflow orchestration including:
- Logging setup
- Step 1: Session ingestion
- Step 2: Prompt detection (with graceful handling when module missing)
- Step 3: Prompt updates
- Error handling
"""

import logging
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

# Need to add parent directory to path to import auto_update_workflow
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest


class TestLoggingSetup:
    """Test logging configuration."""

    def test_setup_logging_default_path(self):
        """Test that default logging path is ~/.nova/hook-logs/workflow.log"""
        from auto_update_workflow import setup_logging

        with tempfile.TemporaryDirectory() as tmpdir:
            with patch('pathlib.Path.home', return_value=Path(tmpdir)):
                logger = setup_logging()

                assert logger is not None
                assert logger.name == "auto_update_workflow"
                assert logger.level == logging.DEBUG

                # Check that log directory was created
                log_dir = Path(tmpdir) / ".nova" / "hook-logs"
                assert log_dir.exists()
                assert log_dir.is_dir()

                # Check that log file was created
                log_file = log_dir / "workflow.log"
                assert log_file.exists()

    def test_setup_logging_custom_path(self):
        """Test logging with custom file path"""
        from auto_update_workflow import setup_logging

        with tempfile.TemporaryDirectory() as tmpdir:
            log_file = Path(tmpdir) / "custom" / "test.log"
            logger = setup_logging(str(log_file))

            assert logger is not None
            assert log_file.exists()
            assert log_file.parent.exists()

    def test_logging_has_file_and_console_handlers(self):
        """Test that logger has both file and console handlers"""
        from auto_update_workflow import setup_logging

        with tempfile.TemporaryDirectory() as tmpdir:
            log_file = Path(tmpdir) / "test.log"
            logger = setup_logging(str(log_file))

            assert len(logger.handlers) == 2

            handler_types = [type(h).__name__ for h in logger.handlers]
            assert "FileHandler" in handler_types
            assert "StreamHandler" in handler_types


class TestStep1Ingest:
    """Test step 1: session ingestion."""

    def test_ingest_nonexistent_path(self):
        """Test ingestion with nonexistent path"""
        from auto_update_workflow import step_1_ingest_session

        with tempfile.TemporaryDirectory() as tmpdir:
            logger = logging.getLogger("test")
            result = step_1_ingest_session(
                logger,
                str(Path(tmpdir) / "nonexistent.jsonl")
            )

            assert result["success"] is False
            assert "does not exist" in result["error"]

    @patch('auto_update_workflow.ingest_file')
    def test_ingest_single_file_success(self, mock_ingest_file):
        """Test successful ingestion of single file"""
        from auto_update_workflow import step_1_ingest_session

        # Mock successful ingestion
        mock_ingest_file.return_value = {
            "success": True,
            "type": "file",
            "session_id": "test-session-123",
            "messages_imported": 42
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a dummy file
            test_file = Path(tmpdir) / "test.jsonl"
            test_file.write_text("{}")

            logger = logging.getLogger("test")
            result = step_1_ingest_session(logger, str(test_file))

            assert result["success"] is True
            assert result["session_id"] == "test-session-123"
            assert result["messages_imported"] == 42
            mock_ingest_file.assert_called_once()

    @patch('auto_update_workflow.ingest_directory')
    def test_ingest_directory_success(self, mock_ingest_directory):
        """Test successful ingestion of directory"""
        from auto_update_workflow import step_1_ingest_session

        # Mock successful directory ingestion
        mock_ingest_directory.return_value = {
            "success": True,
            "type": "directory",
            "total_files": 3,
            "files_ingested": 3,
            "total_messages": 100
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            logger = logging.getLogger("test")
            result = step_1_ingest_session(logger, tmpdir)

            assert result["success"] is True
            assert result["total_files"] == 3
            assert result["files_ingested"] == 3
            assert result["total_messages"] == 100
            mock_ingest_directory.assert_called_once()


class TestStep2DetectPrompts:
    """Test step 2: prompt detection."""

    def test_prompt_detector_not_available(self):
        """Test graceful handling when prompt_detector module is not available"""
        from auto_update_workflow import step_2_detect_prompts

        logger = logging.getLogger("test")

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "test.jsonl"
            test_file.write_text("{}")

            result = step_2_detect_prompts(
                logger,
                "test-session-123",
                str(test_file)
            )

            # Should succeed but be skipped
            assert result["success"] is True
            assert result["skipped"] is True
            assert "Phase 2 incomplete" in result["reason"]

    def test_prompt_detection_success(self):
        """Test successful prompt detection when module is available"""
        from auto_update_workflow import step_2_detect_prompts

        # Create a mock module for prompt_detector
        mock_prompt_detector = MagicMock()
        mock_detect_prompts = MagicMock()
        mock_detect_prompts.return_value = {
            "success": True,
            "prompts": [
                "/path/to/prompt1.txt",
                "/path/to/prompt2.txt"
            ]
        }
        mock_prompt_detector.detect_prompts = mock_detect_prompts

        with tempfile.TemporaryDirectory() as tmpdir:
            test_file = Path(tmpdir) / "test.jsonl"
            test_file.write_text("{}")

            logger = logging.getLogger("test")

            # Patch sys.modules to make the import succeed
            with patch.dict('sys.modules', {'program_nova.prompt_detector': mock_prompt_detector}):
                result = step_2_detect_prompts(
                    logger,
                    "test-session-123",
                    str(test_file)
                )

            assert result["success"] is True
            assert len(result["prompts"]) == 2


class TestStep3UpdatePrompts:
    """Test step 3: prompt updates."""

    def test_update_prompts_none_detected(self):
        """Test update step with no prompts detected"""
        from auto_update_workflow import step_3_update_prompts

        logger = logging.getLogger("test")
        result = step_3_update_prompts(logger, [])

        assert result["success"] is True
        assert result["skipped"] is True
        assert "No prompts detected" in result["reason"]

    def test_update_prompts_dry_run(self):
        """Test update step in dry run mode"""
        from auto_update_workflow import step_3_update_prompts

        logger = logging.getLogger("test")
        prompts = ["/path/to/prompt1.txt", "/path/to/prompt2.txt"]

        result = step_3_update_prompts(logger, prompts, dry_run=True)

        assert result["success"] is True
        assert result["planned_updates"] == 2


class TestWorkflowIntegration:
    """Test complete workflow integration."""

    @patch('auto_update_workflow.ingest_file')
    def test_workflow_single_file_with_missing_prompt_detector(self, mock_ingest_file):
        """Test complete workflow with single file when prompt_detector is missing"""
        from auto_update_workflow import run_workflow

        # Mock successful ingestion
        mock_ingest_file.return_value = {
            "success": True,
            "type": "file",
            "session_id": "test-session-123",
            "messages_imported": 42
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            # Create test file and log file
            test_file = Path(tmpdir) / "test.jsonl"
            test_file.write_text("{}")
            log_file = Path(tmpdir) / "test.log"

            success = run_workflow(
                str(test_file),
                log_file=str(log_file)
            )

            # Workflow should succeed even without prompt_detector
            assert success is True
            assert log_file.exists()

            # Check log contents
            log_content = log_file.read_text()
            assert "AUTO-UPDATE WORKFLOW STARTED" in log_content
            assert "STEP 1: INGEST SESSION" in log_content
            assert "STEP 2: DETECT PROMPTS" in log_content
            assert "AUTO-UPDATE WORKFLOW COMPLETED" in log_content
            assert "SUCCESS" in log_content

    def test_workflow_nonexistent_file_fails(self):
        """Test that workflow fails gracefully with nonexistent file"""
        from auto_update_workflow import run_workflow

        with tempfile.TemporaryDirectory() as tmpdir:
            log_file = Path(tmpdir) / "test.log"

            success = run_workflow(
                "/nonexistent/file.jsonl",
                log_file=str(log_file)
            )

            assert success is False
            assert log_file.exists()

            # Check log contents
            log_content = log_file.read_text()
            assert "FAILED" in log_content


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
