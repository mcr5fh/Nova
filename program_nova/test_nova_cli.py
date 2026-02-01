"""Tests for nova CLI module.

These tests verify the nova CLI functionality for managing services.
We test the CLI by importing and calling functions directly from the module.
"""

import subprocess
import sys
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, call
import pytest

from program_nova import cli


class TestNovaCLI:
    """Tests for nova CLI module."""

    def test_cli_help(self, capsys):
        """Test nova CLI help command."""
        with patch('sys.argv', ['nova', '--help']):
            with pytest.raises(SystemExit) as exc_info:
                cli.main()
            assert exc_info.value.code == 0
            captured = capsys.readouterr()
            assert "start" in captured.out
            assert "stop" in captured.out
            assert "restart" in captured.out
            assert "status" in captured.out
            assert "logs" in captured.out

    def test_start_help(self, capsys):
        """Test nova start help command."""
        with patch('sys.argv', ['nova', 'start', '--help']):
            with pytest.raises(SystemExit) as exc_info:
                cli.main()
            assert exc_info.value.code == 0
            captured = capsys.readouterr()
            assert "orchestrator" in captured.out
            assert "dashboard" in captured.out
            assert "all" in captured.out

    def test_stop_help(self, capsys):
        """Test nova stop help command."""
        with patch('sys.argv', ['nova', 'stop', '--help']):
            with pytest.raises(SystemExit) as exc_info:
                cli.main()
            assert exc_info.value.code == 0
            captured = capsys.readouterr()
            assert "orchestrator" in captured.out
            assert "dashboard" in captured.out
            assert "all" in captured.out

    def test_restart_help(self, capsys):
        """Test nova restart help command."""
        with patch('sys.argv', ['nova', 'restart', '--help']):
            with pytest.raises(SystemExit) as exc_info:
                cli.main()
            assert exc_info.value.code == 0
            captured = capsys.readouterr()
            assert "orchestrator" in captured.out
            assert "dashboard" in captured.out
            assert "all" in captured.out

    def test_status_help(self, capsys):
        """Test nova status help command."""
        with patch('sys.argv', ['nova', 'status', '--help']):
            with pytest.raises(SystemExit) as exc_info:
                cli.main()
            assert exc_info.value.code == 0
            captured = capsys.readouterr()
            assert "orchestrator" in captured.out
            assert "dashboard" in captured.out
            assert "all" in captured.out

    def test_logs_help(self, capsys):
        """Test nova logs help command."""
        with patch('sys.argv', ['nova', 'logs', '--help']):
            with pytest.raises(SystemExit) as exc_info:
                cli.main()
            assert exc_info.value.code == 0
            captured = capsys.readouterr()
            assert "orchestrator" in captured.out
            assert "dashboard" in captured.out
            assert "--follow" in captured.out

    def test_init_help(self, capsys):
        """Test nova init help command."""
        with patch('sys.argv', ['nova', 'init', '--help']):
            with pytest.raises(SystemExit) as exc_info:
                cli.main()
            assert exc_info.value.code == 0
            captured = capsys.readouterr()
            assert "init" in captured.out

    def test_init_creates_cascade_md(self, tmp_path, capsys):
        """Test nova init creates CASCADE.md template in current directory."""
        # Change to temp directory
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)

            # Run nova init
            with patch('sys.argv', ['nova', 'init']):
                result = cli.main()

            # Should return 0 on success
            assert result == 0

            # CASCADE.md should exist
            cascade_file = tmp_path / "CASCADE.md"
            assert cascade_file.exists()

            # Verify content contains required sections
            content = cascade_file.read_text()
            assert "# My Project" in content
            assert "## L1:" in content
            assert "### L2:" in content
            assert "| Task ID | Task Name | What Changes | Depends On |" in content

            # Check that success message was printed
            captured = capsys.readouterr()
            assert "Created CASCADE.md" in captured.out
        finally:
            os.chdir(original_cwd)

    def test_init_fails_if_cascade_exists(self, tmp_path, capsys):
        """Test nova init fails if CASCADE.md already exists."""
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)

            # Create existing CASCADE.md
            cascade_file = tmp_path / "CASCADE.md"
            cascade_file.write_text("existing content")

            # Run nova init
            with patch('sys.argv', ['nova', 'init']):
                result = cli.main()

            # Should return 1 on error
            assert result == 1

            # Original content should be preserved
            assert cascade_file.read_text() == "existing content"

            # Check error message
            captured = capsys.readouterr()
            assert "already exists" in captured.err
        finally:
            os.chdir(original_cwd)

    def test_start_checks_cascade_exists(self, tmp_path, capsys):
        """Test that start command checks for CASCADE.md and gives helpful error."""
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)

            # Run nova start without CASCADE.md
            with patch('sys.argv', ['nova', 'start']):
                result = cli.main()

            # Should return 1 on error
            assert result == 1

            # Check for helpful error message
            captured = capsys.readouterr()
            assert "CASCADE.md not found" in captured.err
            assert "nova init" in captured.err
        finally:
            os.chdir(original_cwd)

    def test_run_help(self, capsys):
        """Test nova run help command."""
        with patch('sys.argv', ['nova', 'run', '--help']):
            with pytest.raises(SystemExit) as exc_info:
                cli.main()
            assert exc_info.value.code == 0
            captured = capsys.readouterr()
            assert "run" in captured.out.lower()

    def test_run_checks_cascade_exists(self, tmp_path, capsys):
        """Test that run command checks for CASCADE.md and gives helpful error."""
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)

            # Run nova run without CASCADE.md
            with patch('sys.argv', ['nova', 'run']):
                result = cli.main()

            # Should return 1 on error
            assert result == 1

            # Check for helpful error message
            captured = capsys.readouterr()
            assert "CASCADE.md not found" in captured.err
            assert "nova init" in captured.err
        finally:
            os.chdir(original_cwd)

    @patch('program_nova.cli.subprocess.Popen')
    def test_run_starts_both_services_foreground(self, mock_popen, tmp_path, capsys):
        """Test nova run starts orchestrator and dashboard in foreground."""
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)

            # Create CASCADE.md
            cascade_file = tmp_path / "CASCADE.md"
            cascade_file.write_text(cli.CASCADE_TEMPLATE)

            # Mock the Popen processes
            mock_orch = Mock()
            mock_orch.poll.return_value = None  # Still running
            mock_orch.returncode = None
            mock_dash = Mock()
            mock_dash.poll.return_value = None
            mock_dash.returncode = None

            mock_popen.side_effect = [mock_orch, mock_dash]

            # Simulate KeyboardInterrupt to exit the monitoring loop
            with patch('program_nova.cli.time.sleep', side_effect=KeyboardInterrupt):
                with patch('sys.argv', ['nova', 'run']):
                    result = cli.main()

            # Should return 1 on KeyboardInterrupt (normal behavior)
            assert result == 1

            # Verify both processes were started
            assert mock_popen.call_count == 2

            # Verify orchestrator was started with direct script path (not -m flag)
            orch_call = mock_popen.call_args_list[0]
            orch_args = orch_call[0][0]
            assert orch_args[0] == sys.executable
            # Should NOT contain '-m' flag
            assert '-m' not in orch_args
            # Should end with orchestrator.py
            assert orch_args[1].endswith('orchestrator.py')
            assert 'program_nova/engine/orchestrator.py' in orch_args[1] or 'program_nova\\engine\\orchestrator.py' in orch_args[1]

            # Verify dashboard was started with direct script path (not -m flag)
            dash_call = mock_popen.call_args_list[1]
            dash_args = dash_call[0][0]
            assert dash_args[0] == sys.executable
            # Should NOT contain '-m' flag
            assert '-m' not in dash_args
            # Should end with server.py
            assert dash_args[1].endswith('server.py')
            assert 'program_nova/dashboard/server.py' in dash_args[1] or 'program_nova\\dashboard\\server.py' in dash_args[1]

            # Verify processes were terminated
            mock_orch.terminate.assert_called_once()
            mock_dash.terminate.assert_called_once()
        finally:
            os.chdir(original_cwd)

    @patch('program_nova.cli.subprocess.Popen')
    def test_run_passes_correct_arguments_to_scripts(self, mock_popen, tmp_path):
        """Test that nova run passes correct argument format to orchestrator and dashboard.

        orchestrator.py expects: CASCADE_FILE --state-file STATE
        server.py expects: --host HOST --port PORT --state-file STATE --cascade-file CASCADE
        """
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)

            # Create CASCADE.md
            cascade_file = tmp_path / "CASCADE.md"
            cascade_file.write_text(cli.CASCADE_TEMPLATE)

            # Mock the Popen processes
            mock_orch = Mock()
            mock_orch.poll.return_value = None
            mock_dash = Mock()
            mock_dash.poll.return_value = None

            mock_popen.side_effect = [mock_orch, mock_dash]

            # Simulate KeyboardInterrupt to exit the monitoring loop
            with patch('program_nova.cli.time.sleep', side_effect=KeyboardInterrupt):
                with patch('sys.argv', ['nova', 'run']):
                    cli.main()

            # Verify orchestrator command arguments
            orch_call = mock_popen.call_args_list[0]
            orch_args = orch_call[0][0]
            # Expected: [python, orchestrator.py, ./CASCADE.md, --state-file, ./cascade_state.json]
            assert orch_args[2] == "./CASCADE.md", \
                "orchestrator.py should receive CASCADE.md as positional argument"
            assert "--state-file" in orch_args
            state_file_idx = orch_args.index("--state-file")
            assert orch_args[state_file_idx + 1] == "./cascade_state.json"
            # Make sure --cascade-file is NOT in orchestrator args
            assert "--cascade-file" not in orch_args, \
                "orchestrator.py should NOT receive --cascade-file flag"

            # Verify dashboard command arguments
            dash_call = mock_popen.call_args_list[1]
            dash_args = dash_call[0][0]
            # Expected: [python, server.py, --host, 0.0.0.0, --port, 8000, --state-file, ./cascade_state.json, --cascade-file, ./CASCADE.md]
            assert "--host" in dash_args
            assert "--port" in dash_args
            assert "--state-file" in dash_args
            assert "--cascade-file" in dash_args, \
                "server.py should receive --cascade-file flag"
            cascade_idx = dash_args.index("--cascade-file")
            assert dash_args[cascade_idx + 1] == "./CASCADE.md"

        finally:
            os.chdir(original_cwd)

    @patch('program_nova.cli.shutil.which')
    def test_start_detects_systemd_unavailable(self, mock_which, tmp_path, capsys):
        """Test nova start detects when systemd is not available and suggests nova run."""
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)

            # Create CASCADE.md
            cascade_file = tmp_path / "CASCADE.md"
            cascade_file.write_text(cli.CASCADE_TEMPLATE)

            # Mock systemctl not found
            mock_which.return_value = None

            with patch('sys.argv', ['nova', 'start']):
                result = cli.main()

            # Should return 1 when systemd not available
            assert result == 1

            # Check for helpful error message suggesting nova run
            captured = capsys.readouterr()
            assert "systemd not available" in captured.err or "systemctl not found" in captured.err
            assert "nova run" in captured.err
        finally:
            os.chdir(original_cwd)

    @patch('program_nova.cli.subprocess.Popen')
    def test_run_does_not_capture_subprocess_output(self, mock_popen, tmp_path):
        """Test that nova run does NOT capture stdout/stderr (allows real-time output)."""
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)

            # Create CASCADE.md
            cascade_file = tmp_path / "CASCADE.md"
            cascade_file.write_text(cli.CASCADE_TEMPLATE)

            # Mock the Popen processes
            mock_orch = Mock()
            mock_orch.poll.return_value = None
            mock_dash = Mock()
            mock_dash.poll.return_value = None

            mock_popen.side_effect = [mock_orch, mock_dash]

            # Simulate KeyboardInterrupt to exit the monitoring loop
            with patch('program_nova.cli.time.sleep', side_effect=KeyboardInterrupt):
                with patch('sys.argv', ['nova', 'run']):
                    cli.main()

            # Verify both Popen calls
            assert mock_popen.call_count == 2

            # Check orchestrator Popen call - stdout/stderr should NOT be PIPE
            orch_call = mock_popen.call_args_list[0]
            orch_kwargs = orch_call[1]
            assert orch_kwargs.get('stdout') != subprocess.PIPE, \
                "Orchestrator stdout should not be captured (should be None or not set)"
            assert orch_kwargs.get('stderr') != subprocess.PIPE and \
                   orch_kwargs.get('stderr') != subprocess.STDOUT, \
                "Orchestrator stderr should not be captured or redirected"

            # Check dashboard Popen call - stdout/stderr should NOT be PIPE
            dash_call = mock_popen.call_args_list[1]
            dash_kwargs = dash_call[1]
            assert dash_kwargs.get('stdout') != subprocess.PIPE, \
                "Dashboard stdout should not be captured (should be None or not set)"
            assert dash_kwargs.get('stderr') != subprocess.PIPE and \
                   dash_kwargs.get('stderr') != subprocess.STDOUT, \
                "Dashboard stderr should not be captured or redirected"

        finally:
            os.chdir(original_cwd)

    @patch('program_nova.cli.subprocess.Popen')
    def test_run_keeps_dashboard_running_after_orchestrator_success(self, mock_popen, tmp_path, capsys):
        """Test that dashboard keeps running when orchestrator exits with code 0."""
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)

            # Create CASCADE.md
            cascade_file = tmp_path / "CASCADE.md"
            cascade_file.write_text(cli.CASCADE_TEMPLATE)

            # Mock the Popen processes
            mock_orch = Mock()
            mock_dash = Mock()

            # Orchestrator exits successfully (code 0)
            poll_count = [0]
            def orch_poll():
                poll_count[0] += 1
                if poll_count[0] > 2:
                    return 0  # Exit with code 0 after a few polls
                return None

            mock_orch.poll = Mock(side_effect=orch_poll)
            mock_dash.poll.return_value = None  # Dashboard keeps running

            mock_popen.side_effect = [mock_orch, mock_dash]

            # Simulate KeyboardInterrupt after orchestrator exits to stop the dashboard
            sleep_count = [0]
            def sleep_side_effect(duration):
                sleep_count[0] += 1
                if sleep_count[0] > 5:  # After orchestrator exits and message is printed
                    raise KeyboardInterrupt

            with patch('program_nova.cli.time.sleep', side_effect=sleep_side_effect):
                with patch('sys.argv', ['nova', 'run']):
                    result = cli.main()

            # Should return 1 due to KeyboardInterrupt
            assert result == 1

            # Verify message was printed about orchestrator completing
            captured = capsys.readouterr()
            assert "Orchestrator complete" in captured.out
            assert "Dashboard still running at http://localhost:8000" in captured.out
            assert "Press Ctrl+C to stop" in captured.out

            # Verify dashboard was NOT terminated when orchestrator exited
            # It should only be terminated by KeyboardInterrupt
            mock_orch.terminate.assert_called_once()  # Terminated by KeyboardInterrupt
            mock_dash.terminate.assert_called_once()  # Terminated by KeyboardInterrupt

        finally:
            os.chdir(original_cwd)

    @patch('program_nova.cli.subprocess.Popen')
    def test_run_stops_dashboard_when_orchestrator_fails(self, mock_popen, tmp_path, capsys):
        """Test that dashboard is stopped when orchestrator exits with non-zero code."""
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)

            # Create CASCADE.md
            cascade_file = tmp_path / "CASCADE.md"
            cascade_file.write_text(cli.CASCADE_TEMPLATE)

            # Mock the Popen processes
            mock_orch = Mock()
            mock_dash = Mock()

            # Orchestrator exits with error (code 1)
            poll_count = [0]
            def orch_poll():
                poll_count[0] += 1
                if poll_count[0] > 2:
                    return 1  # Exit with code 1 after a few polls
                return None

            mock_orch.poll = Mock(side_effect=orch_poll)
            mock_dash.poll.return_value = None  # Dashboard keeps running

            mock_popen.side_effect = [mock_orch, mock_dash]

            with patch('program_nova.cli.time.sleep'):
                with patch('sys.argv', ['nova', 'run']):
                    result = cli.main()

            # Should return the orchestrator's exit code
            assert result == 1

            # Verify error message was printed
            captured = capsys.readouterr()
            assert "Orchestrator exited with code 1" in captured.err

            # Verify dashboard WAS terminated when orchestrator failed
            mock_dash.terminate.assert_called_once()

        finally:
            os.chdir(original_cwd)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
