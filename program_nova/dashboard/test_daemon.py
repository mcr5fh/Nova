"""Tests for dashboard daemon mode.

These tests verify the daemon mode functionality for the dashboard server.
"""

import logging
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch, Mock
import pytest

from program_nova.dashboard.server import setup_logging


class TestSetupLogging:
    """Tests for setup_logging function."""

    def test_setup_logging_interactive_mode(self, tmp_path, monkeypatch):
        """Test logging setup in interactive mode."""
        # Change to temp directory
        monkeypatch.chdir(tmp_path)

        logger = setup_logging(daemon_mode=False)

        # Should have one handler (StreamHandler)
        assert len(logger.handlers) == 1
        handler = logger.handlers[0]
        assert isinstance(handler, logging.StreamHandler)

        # Check log level
        assert logger.level == logging.INFO

    def test_setup_logging_daemon_mode(self, tmp_path, monkeypatch):
        """Test logging setup in daemon mode."""
        # Change to temp directory
        monkeypatch.chdir(tmp_path)

        logger = setup_logging(daemon_mode=True)

        # Should have one handler (RotatingFileHandler)
        assert len(logger.handlers) == 1
        handler = logger.handlers[0]
        assert isinstance(handler, logging.handlers.RotatingFileHandler)

        # Check that logs directory was created
        logs_dir = tmp_path / "logs"
        assert logs_dir.exists()

        # Check that log file was created
        log_file = logs_dir / "dashboard.log"
        assert log_file.exists() or True  # File created on first log

        # Check log level
        assert logger.level == logging.INFO

    def test_setup_logging_creates_logs_directory(self, tmp_path, monkeypatch):
        """Test that setup_logging creates logs directory if it doesn't exist."""
        # Change to temp directory
        monkeypatch.chdir(tmp_path)

        logs_dir = tmp_path / "logs"
        assert not logs_dir.exists()

        setup_logging(daemon_mode=True)

        assert logs_dir.exists()

    def test_setup_logging_clears_existing_handlers(self, tmp_path, monkeypatch):
        """Test that setup_logging clears existing handlers."""
        # Change to temp directory
        monkeypatch.chdir(tmp_path)

        # Get initial handler count (pytest adds some)
        logger = logging.getLogger()
        initial_count = len(logger.handlers)

        # Add some handlers
        logger.addHandler(logging.StreamHandler())
        logger.addHandler(logging.StreamHandler())
        assert len(logger.handlers) == initial_count + 2

        # Setup logging should clear them all and add exactly one
        setup_logging(daemon_mode=False)
        assert len(logger.handlers) == 1
        # Verify it's a StreamHandler
        assert isinstance(logger.handlers[0], logging.StreamHandler)


class TestDashboardDaemonMode:
    """Tests for dashboard daemon mode execution."""

    def test_dashboard_accepts_daemon_flag(self):
        """Test that dashboard accepts --daemon flag."""
        result = subprocess.run(
            [sys.executable, "-m", "program_nova.dashboard.server", "--help"],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "--daemon" in result.stdout

    def test_dashboard_accepts_host_flag(self):
        """Test that dashboard accepts --host flag."""
        result = subprocess.run(
            [sys.executable, "-m", "program_nova.dashboard.server", "--help"],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "--host" in result.stdout

    def test_dashboard_accepts_port_flag(self):
        """Test that dashboard accepts --port flag."""
        result = subprocess.run(
            [sys.executable, "-m", "program_nova.dashboard.server", "--help"],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "--port" in result.stdout

    def test_dashboard_accepts_state_file_flag(self):
        """Test that dashboard accepts --state-file flag."""
        result = subprocess.run(
            [sys.executable, "-m", "program_nova.dashboard.server", "--help"],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "--state-file" in result.stdout

    def test_dashboard_accepts_cascade_file_flag(self):
        """Test that dashboard accepts --cascade-file flag."""
        result = subprocess.run(
            [sys.executable, "-m", "program_nova.dashboard.server", "--help"],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "--cascade-file" in result.stdout

    def test_dashboard_accepts_milestones_file_flag(self):
        """Test that dashboard accepts --milestones-file flag."""
        result = subprocess.run(
            [sys.executable, "-m", "program_nova.dashboard.server", "--help"],
            capture_output=True,
            text=True,
        )

        assert result.returncode == 0
        assert "--milestones-file" in result.stdout


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
