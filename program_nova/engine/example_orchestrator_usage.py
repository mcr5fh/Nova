#!/usr/bin/env python3
"""
Example usage of the orchestrator module.

This demonstrates how to:
1. Initialize an orchestrator with a CASCADE.md file
2. Run the main execution loop
3. Monitor progress
4. Get final status

For testing purposes, this uses a mock command (sleep) instead of actual Claude Code.
"""

import json
import time
from pathlib import Path
from program_nova.engine.orchestrator import Orchestrator


def main():
    """Run a simple orchestration example."""

    # Use the example CASCADE file from the project root
    cascade_file = "../../CASCADE.md.example"
    state_file = "example_state.json"

    # Clean up any previous state
    if Path(state_file).exists():
        Path(state_file).unlink()

    print("=" * 60)
    print("Program Nova Orchestrator - Example Usage")
    print("=" * 60)
    print()

    # Create orchestrator
    print(f"Initializing orchestrator...")
    print(f"  CASCADE file: {cascade_file}")
    print(f"  State file: {state_file}")
    print(f"  Max workers: 2")
    print()

    orchestrator = Orchestrator(
        cascade_file=cascade_file,
        state_file=state_file,
        max_workers=2,
    )

    print(f"Parsed cascade:")
    print(f"  Project: {orchestrator.cascade_data['project_name']}")
    print(f"  Total tasks: {len(orchestrator.tasks)}")
    print(f"  L1 branches: {len(orchestrator.hierarchy)}")
    print()

    # Show initial ready tasks
    ready_tasks = orchestrator.get_ready_tasks()
    print(f"Initially ready tasks: {', '.join(ready_tasks)}")
    print()

    print("Starting execution...")
    print("(Using mock commands for testing - real implementation would use Claude Code)")
    print()

    # Run the orchestrator with a short check interval for demo
    try:
        orchestrator.run(check_interval=0.5, max_iterations=100)
    except KeyboardInterrupt:
        print("\nInterrupted by user!")
        return

    print()
    print("=" * 60)
    print("Execution Complete!")
    print("=" * 60)
    print()

    # Get final status
    summary = orchestrator.get_status_summary()
    print(f"Final Status:")
    print(f"  Total tasks: {summary['total_tasks']}")
    print(f"  Completed: {summary['completed']}")
    print(f"  Failed: {summary['failed']}")
    print(f"  In Progress: {summary['in_progress']}")
    print(f"  Pending: {summary['pending']}")
    print()

    # Show the final state file
    print(f"State file written to: {state_file}")
    print()

    # Display a sample of the state
    with open(state_file) as f:
        state = json.load(f)

    print("Sample state (first 3 tasks):")
    for i, (task_id, task_data) in enumerate(state["tasks"].items()):
        if i >= 3:
            break
        print(f"  {task_id}:")
        print(f"    Status: {task_data['status']}")
        print(f"    Duration: {task_data['duration_seconds']}s")
        print(f"    Tokens: {task_data['token_usage']['input_tokens']} in, "
              f"{task_data['token_usage']['output_tokens']} out")

    if len(state["tasks"]) > 3:
        print(f"  ... and {len(state['tasks']) - 3} more tasks")

    print()
    print("Done! Check example_state.json for full details.")


if __name__ == "__main__":
    main()
