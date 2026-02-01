#!/usr/bin/env python3
"""
Example usage of the Worker module.

This demonstrates how to:
1. Create a worker for a task
2. Start it with a command
3. Monitor its execution
4. Retrieve token usage and status
"""

import time
from program_nova.engine.worker import Worker, WorkerStatus


def example_simple_worker():
    """Example: Run a simple command and capture output"""
    print("=== Example 1: Simple Worker ===")

    worker = Worker(task_id="EXAMPLE-1", task_description="Echo hello world")

    print(f"Created worker: {worker}")
    print(f"Status: {worker.status.value}")
    print(f"Log path: {worker.log_path}")

    # Start the worker with a simple command
    worker.start(command=["echo", "Hello from worker!"])
    print(f"Started worker with PID: {worker.pid}")

    # Wait for completion
    exit_code = worker.wait()
    print(f"Worker completed with exit code: {exit_code}")
    print(f"Final status: {worker.status.value}")

    # Read the log
    with open(worker.log_path, "r") as f:
        print(f"Log contents:\n{f.read()}")

    print()


def example_monitoring_worker():
    """Example: Monitor a long-running worker"""
    print("=== Example 2: Monitoring Worker ===")

    worker = Worker(task_id="EXAMPLE-2", task_description="Long running task")

    # Start a worker that runs for 2 seconds
    worker.start(command=["sleep", "2"])
    print(f"Started worker with PID: {worker.pid}")

    # Poll while it's running
    while worker.is_alive():
        print(f"Worker is running... (status: {worker.status.value})")
        time.sleep(0.5)

    exit_code = worker.wait()
    print(f"Worker finished with exit code: {exit_code}")
    print()


def example_token_usage_parsing():
    """Example: Parse token usage from output"""
    print("=== Example 3: Token Usage Parsing ===")

    worker = Worker(task_id="EXAMPLE-3", task_description="Task with token usage")

    # Simulate output with token usage information
    # In real usage, this would come from Claude Code's output
    token_output = """
Starting task...
Token usage: input=1000, output=500, cache_read=200, cache_creation=50
Continuing work...
Token usage: input=1500, output=750, cache_read=300, cache_creation=75
Task completed!
"""

    # Use printf to preserve newlines
    worker.start(command=["printf", token_output])
    worker.wait()

    # Get accumulated token usage
    tokens = worker.get_token_usage()
    print(f"Token usage:")
    print(f"  Input tokens: {tokens['input_tokens']}")
    print(f"  Output tokens: {tokens['output_tokens']}")
    print(f"  Cache read tokens: {tokens['cache_read_tokens']}")
    print(f"  Cache creation tokens: {tokens['cache_creation_tokens']}")
    print()


def example_worker_failure():
    """Example: Handle worker failure"""
    print("=== Example 4: Worker Failure ===")

    worker = Worker(task_id="EXAMPLE-4", task_description="Failing task")

    # Start a command that will fail
    worker.start(command=["false"])
    exit_code = worker.wait()

    print(f"Worker exit code: {exit_code}")
    print(f"Worker status: {worker.status.value}")
    print(f"Is completed successfully: {worker.status == WorkerStatus.COMPLETED}")
    print(f"Is failed: {worker.status == WorkerStatus.FAILED}")
    print()


def example_worker_termination():
    """Example: Terminate a running worker"""
    print("=== Example 5: Worker Termination ===")

    worker = Worker(task_id="EXAMPLE-5", task_description="Task to be terminated")

    # Start a long-running task
    worker.start(command=["sleep", "30"])
    print(f"Started worker with PID: {worker.pid}")
    print(f"Worker is alive: {worker.is_alive()}")

    # Terminate it
    print("Terminating worker...")
    worker.terminate()

    print(f"Worker is alive: {worker.is_alive()}")
    print(f"Worker status: {worker.status.value}")
    print()


def example_status_dict():
    """Example: Get worker status as dictionary"""
    print("=== Example 6: Status Dictionary ===")

    worker = Worker(task_id="EXAMPLE-6", task_description="Status dict example")

    worker.start(command=["echo", "status check"])
    worker.wait()

    status_dict = worker.get_status_dict()
    print("Worker status dictionary:")
    for key, value in status_dict.items():
        print(f"  {key}: {value}")
    print()


if __name__ == "__main__":
    print("Worker Module Examples\n")

    example_simple_worker()
    example_monitoring_worker()
    example_token_usage_parsing()
    example_worker_failure()
    example_worker_termination()
    example_status_dict()

    print("All examples completed!")
    print("\nNote: Check the logs/ directory for worker output files.")
