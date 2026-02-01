"""Rollup computation for aggregating task metrics across hierarchy.

This module computes aggregate status, duration, token usage, and cost
for task groups (L2), branches (L1), and the overall project (L0).
"""

from typing import Dict, List, Any


# Pricing for Sonnet 4.5 (per million tokens)
PRICE_INPUT_TOKENS = 3.00
PRICE_OUTPUT_TOKENS = 15.00
PRICE_CACHE_READ_TOKENS = 0.30
PRICE_CACHE_CREATION_TOKENS = 3.75


def compute_rollup_status(tasks: Dict[str, Dict], task_ids: List[str]) -> str:
    """Compute aggregate status for a group of tasks.

    Status priority:
    1. If any task is failed -> "failed"
    2. If any task is in_progress -> "in_progress"
    3. If all tasks are completed -> "completed"
    4. Otherwise -> "pending"

    Args:
        tasks: Dictionary of task_id -> task_data
        task_ids: List of task IDs to aggregate

    Returns:
        Aggregate status: "failed", "in_progress", "completed", or "pending"
    """
    if not task_ids:
        return "pending"

    statuses = []
    for task_id in task_ids:
        task = tasks.get(task_id, {})
        status = task.get("status", "pending")
        statuses.append(status)

    # Priority: failed > in_progress > completed > pending
    if "failed" in statuses:
        return "failed"
    if "in_progress" in statuses:
        return "in_progress"
    if all(s == "completed" for s in statuses):
        return "completed"
    return "pending"


def compute_rollup_metrics(tasks: Dict[str, Dict], task_ids: List[str]) -> Dict[str, Any]:
    """Compute aggregate metrics for a group of tasks.

    Aggregates:
    - duration_seconds: Sum of all task durations
    - token_usage: Sum of all token types
    - cost_usd: Computed from token usage using Sonnet 4.5 pricing

    Args:
        tasks: Dictionary of task_id -> task_data
        task_ids: List of task IDs to aggregate

    Returns:
        Dictionary with:
        - duration_seconds: int
        - token_usage: dict with input_tokens, output_tokens, etc.
        - cost_usd: float
    """
    total_duration = 0
    total_tokens = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_creation_tokens": 0,
    }

    for task_id in task_ids:
        task = tasks.get(task_id, {})

        # Sum duration
        total_duration += task.get("duration_seconds", 0)

        # Sum token usage
        token_usage = task.get("token_usage", {})
        total_tokens["input_tokens"] += token_usage.get("input_tokens", 0)
        total_tokens["output_tokens"] += token_usage.get("output_tokens", 0)
        total_tokens["cache_read_tokens"] += token_usage.get("cache_read_tokens", 0)
        total_tokens["cache_creation_tokens"] += token_usage.get("cache_creation_tokens", 0)

    # Compute cost (convert tokens to millions)
    cost_usd = (
        total_tokens["input_tokens"] / 1_000_000 * PRICE_INPUT_TOKENS
        + total_tokens["output_tokens"] / 1_000_000 * PRICE_OUTPUT_TOKENS
        + total_tokens["cache_read_tokens"] / 1_000_000 * PRICE_CACHE_READ_TOKENS
        + total_tokens["cache_creation_tokens"] / 1_000_000 * PRICE_CACHE_CREATION_TOKENS
    )

    return {
        "duration_seconds": total_duration,
        "token_usage": total_tokens,
        "cost_usd": round(cost_usd, 4),
    }


def compute_hierarchy_rollups(
    tasks: Dict[str, Dict], hierarchy: Dict[str, Dict[str, List[str]]]
) -> Dict[str, Any]:
    """Compute rollups for entire hierarchy (L2, L1, L0).

    Args:
        tasks: Dictionary of task_id -> task_data from cascade_state.json
        hierarchy: Dictionary of L1 -> L2 -> [task_ids] from parser

    Returns:
        Dictionary containing:
        - l2_rollups: Dict[L1][L2] -> {status, duration, tokens, cost}
        - l1_rollups: Dict[L1] -> {status, duration, tokens, cost}
        - l0_rollup: {status, duration, tokens, cost} (project-level)
    """
    l2_rollups = {}
    l1_rollups = {}

    # Compute L2 (group) rollups
    for l1, l2_groups in hierarchy.items():
        l2_rollups[l1] = {}
        for l2, task_ids in l2_groups.items():
            status = compute_rollup_status(tasks, task_ids)
            metrics = compute_rollup_metrics(tasks, task_ids)
            l2_rollups[l1][l2] = {
                "status": status,
                **metrics,
            }

    # Compute L1 (branch) rollups
    for l1, l2_groups in hierarchy.items():
        # Flatten all task IDs in this branch
        all_task_ids = []
        for task_ids in l2_groups.values():
            all_task_ids.extend(task_ids)

        status = compute_rollup_status(tasks, all_task_ids)
        metrics = compute_rollup_metrics(tasks, all_task_ids)
        l1_rollups[l1] = {
            "status": status,
            **metrics,
        }

    # Compute L0 (project) rollup
    all_task_ids = []
    for l2_groups in hierarchy.values():
        for task_ids in l2_groups.values():
            all_task_ids.extend(task_ids)

    l0_status = compute_rollup_status(tasks, all_task_ids)
    l0_metrics = compute_rollup_metrics(tasks, all_task_ids)
    l0_rollup = {
        "status": l0_status,
        **l0_metrics,
    }

    return {
        "l2_rollups": l2_rollups,
        "l1_rollups": l1_rollups,
        "l0_rollup": l0_rollup,
    }
