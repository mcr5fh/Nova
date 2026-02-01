#!/usr/bin/env python3
"""Nova CLI - Manage orchestrator and dashboard services.

Usage:
    nova init
    nova start [orchestrator|dashboard|all]
    nova stop [orchestrator|dashboard|all]
    nova restart [orchestrator|dashboard|all]
    nova status [orchestrator|dashboard|all]
    nova logs [orchestrator|dashboard] [--follow]
"""

import argparse
import subprocess
import sys
from pathlib import Path


SERVICES = {
    "orchestrator": "nova-orchestrator",
    "dashboard": "nova-dashboard",
}

CASCADE_TEMPLATE = """# My Project

## L1: Application

### L2: Foundation
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| F1 | Setup Project | Initialize project structure | - |
| F2 | Add Dependencies | Install required packages | F1 |

### L2: Core Features
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| C1 | Implement Feature | Add main functionality | F2 |
| C2 | Add Tests | Write unit tests | C1 |

## L1: Documentation

### L2: User Guide
| Task ID | Task Name | What Changes | Depends On |
|---------|-----------|--------------|------------|
| D1 | Write README | Create documentation | C2 |
| D2 | Add Examples | Include usage examples | D1 |
"""


def check_cascade_exists() -> bool:
    """Check if CASCADE.md exists in the current directory.

    Returns:
        True if CASCADE.md exists, False otherwise.
        Prints helpful error message if missing.
    """
    cascade_file = Path.cwd() / "CASCADE.md"
    if not cascade_file.exists():
        print("Error: CASCADE.md not found in current directory", file=sys.stderr)
        print("", file=sys.stderr)
        print("Initialize a new project with:", file=sys.stderr)
        print("  nova init", file=sys.stderr)
        print("", file=sys.stderr)
        print("Or navigate to a directory with an existing CASCADE.md file.", file=sys.stderr)
        return False
    return True


def run_systemctl(command: str, service: str) -> int:
    """Run systemctl command for a service.

    Args:
        command: systemctl command (start, stop, restart, status)
        service: Service name

    Returns:
        Exit code from systemctl
    """
    try:
        result = subprocess.run(
            ["systemctl", "--user", command, service],
            capture_output=True,
            text=True,
        )

        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)

        return result.returncode
    except FileNotFoundError:
        print("Error: systemctl not found. Is systemd installed?", file=sys.stderr)
        return 1


def start(target: str) -> int:
    """Start service(s).

    Args:
        target: 'orchestrator', 'dashboard', or 'all'

    Returns:
        Exit code (0 = success)
    """
    # Check if CASCADE.md exists before starting services
    if not check_cascade_exists():
        return 1

    if target == "all":
        code = 0
        for service_name in SERVICES.values():
            ret = run_systemctl("start", service_name)
            if ret != 0:
                code = ret
        return code
    elif target in SERVICES:
        return run_systemctl("start", SERVICES[target])
    else:
        print(f"Error: Unknown target '{target}'", file=sys.stderr)
        return 1


def stop(target: str) -> int:
    """Stop service(s).

    Args:
        target: 'orchestrator', 'dashboard', or 'all'

    Returns:
        Exit code (0 = success)
    """
    if target == "all":
        code = 0
        for service_name in SERVICES.values():
            ret = run_systemctl("stop", service_name)
            if ret != 0:
                code = ret
        return code
    elif target in SERVICES:
        return run_systemctl("stop", SERVICES[target])
    else:
        print(f"Error: Unknown target '{target}'", file=sys.stderr)
        return 1


def restart(target: str) -> int:
    """Restart service(s).

    Args:
        target: 'orchestrator', 'dashboard', or 'all'

    Returns:
        Exit code (0 = success)
    """
    if target == "all":
        code = 0
        for service_name in SERVICES.values():
            ret = run_systemctl("restart", service_name)
            if ret != 0:
                code = ret
        return code
    elif target in SERVICES:
        return run_systemctl("restart", SERVICES[target])
    else:
        print(f"Error: Unknown target '{target}'", file=sys.stderr)
        return 1


def status(target: str) -> int:
    """Show status of service(s).

    Args:
        target: 'orchestrator', 'dashboard', or 'all'

    Returns:
        Exit code (0 = success)
    """
    if target == "all":
        code = 0
        for service_name in SERVICES.values():
            ret = run_systemctl("status", service_name)
            print()  # Blank line between services
            if ret != 0:
                code = ret
        return code
    elif target in SERVICES:
        return run_systemctl("status", SERVICES[target])
    else:
        print(f"Error: Unknown target '{target}'", file=sys.stderr)
        return 1


def init() -> int:
    """Initialize a new CASCADE.md file in the current directory.

    Returns:
        Exit code (0 = success, 1 = error)
    """
    cascade_file = Path.cwd() / "CASCADE.md"

    if cascade_file.exists():
        print(f"Error: CASCADE.md already exists in {Path.cwd()}", file=sys.stderr)
        return 1

    try:
        cascade_file.write_text(CASCADE_TEMPLATE)
        print(f"Created CASCADE.md in {Path.cwd()}")
        print("\nEdit CASCADE.md to define your project tasks, then run:")
        print("  nova start    # Start the orchestrator and dashboard")
        return 0
    except Exception as e:
        print(f"Error creating CASCADE.md: {e}", file=sys.stderr)
        return 1


def logs(target: str, follow: bool = False) -> int:
    """Show logs for a service.

    Args:
        target: 'orchestrator' or 'dashboard'
        follow: If True, follow logs in real-time

    Returns:
        Exit code (0 = success)
    """
    if target not in SERVICES:
        print(f"Error: Unknown target '{target}'", file=sys.stderr)
        return 1

    cmd = ["journalctl", "--user", "-u", SERVICES[target]]
    if follow:
        cmd.append("-f")

    try:
        subprocess.run(cmd)
        return 0
    except FileNotFoundError:
        print("Error: journalctl not found. Is systemd installed?", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        return 0


def main():
    """Main entry point for nova CLI."""
    parser = argparse.ArgumentParser(
        description="Nova CLI - Manage orchestrator and dashboard services",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Init command
    subparsers.add_parser("init", help="Initialize CASCADE.md template")

    # Start command
    start_parser = subparsers.add_parser("start", help="Start service(s)")
    start_parser.add_argument(
        "target",
        nargs="?",
        default="all",
        choices=["orchestrator", "dashboard", "all"],
        help="Service to start (default: all)",
    )

    # Stop command
    stop_parser = subparsers.add_parser("stop", help="Stop service(s)")
    stop_parser.add_argument(
        "target",
        nargs="?",
        default="all",
        choices=["orchestrator", "dashboard", "all"],
        help="Service to stop (default: all)",
    )

    # Restart command
    restart_parser = subparsers.add_parser("restart", help="Restart service(s)")
    restart_parser.add_argument(
        "target",
        nargs="?",
        default="all",
        choices=["orchestrator", "dashboard", "all"],
        help="Service to restart (default: all)",
    )

    # Status command
    status_parser = subparsers.add_parser("status", help="Show service status")
    status_parser.add_argument(
        "target",
        nargs="?",
        default="all",
        choices=["orchestrator", "dashboard", "all"],
        help="Service to check (default: all)",
    )

    # Logs command
    logs_parser = subparsers.add_parser("logs", help="Show service logs")
    logs_parser.add_argument(
        "target",
        choices=["orchestrator", "dashboard"],
        help="Service to show logs for",
    )
    logs_parser.add_argument(
        "-f", "--follow",
        action="store_true",
        help="Follow logs in real-time",
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    # Execute command
    if args.command == "init":
        return init()
    elif args.command == "start":
        return start(args.target)
    elif args.command == "stop":
        return stop(args.target)
    elif args.command == "restart":
        return restart(args.target)
    elif args.command == "status":
        return status(args.target)
    elif args.command == "logs":
        return logs(args.target, args.follow)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
