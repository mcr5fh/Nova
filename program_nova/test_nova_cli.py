"""Tests for nova CLI script.

These tests verify the nova CLI functionality for managing services.
We test the CLI by running it as a subprocess since it's a standalone script.
"""

import subprocess
import sys
from pathlib import Path
from unittest.mock import Mock, patch, call
import pytest


# Path to nova CLI script
NOVA_CLI = Path(__file__).parent.parent / "bin" / "nova"


class TestNovaCLI:
    """Tests for nova CLI script."""

    def test_cli_help(self):
        """Test nova CLI help command."""
        result = subprocess.run(
            [sys.executable, str(NOVA_CLI), "--help"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "start" in result.stdout
        assert "stop" in result.stdout
        assert "restart" in result.stdout
        assert "status" in result.stdout
        assert "logs" in result.stdout

    def test_start_help(self):
        """Test nova start help command."""
        result = subprocess.run(
            [sys.executable, str(NOVA_CLI), "start", "--help"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "orchestrator" in result.stdout
        assert "dashboard" in result.stdout
        assert "all" in result.stdout

    def test_stop_help(self):
        """Test nova stop help command."""
        result = subprocess.run(
            [sys.executable, str(NOVA_CLI), "stop", "--help"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "orchestrator" in result.stdout
        assert "dashboard" in result.stdout
        assert "all" in result.stdout

    def test_restart_help(self):
        """Test nova restart help command."""
        result = subprocess.run(
            [sys.executable, str(NOVA_CLI), "restart", "--help"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "orchestrator" in result.stdout
        assert "dashboard" in result.stdout
        assert "all" in result.stdout

    def test_status_help(self):
        """Test nova status help command."""
        result = subprocess.run(
            [sys.executable, str(NOVA_CLI), "status", "--help"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "orchestrator" in result.stdout
        assert "dashboard" in result.stdout
        assert "all" in result.stdout

    def test_logs_help(self):
        """Test nova logs help command."""
        result = subprocess.run(
            [sys.executable, str(NOVA_CLI), "logs", "--help"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "orchestrator" in result.stdout
        assert "dashboard" in result.stdout
        assert "--follow" in result.stdout



if __name__ == "__main__":
    pytest.main([__file__, "-v"])
