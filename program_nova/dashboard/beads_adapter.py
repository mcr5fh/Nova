"""Beads adapter for transforming bead graph data to dashboard format.

This module provides functions to transform bead graph data (from bd CLI)
into the format expected by the Program Nova dashboard.
"""

import json
import subprocess
from typing import Dict, Any, List

from program_nova.dashboard.rollup import compute_hierarchy_rollups


def map_bead_status(status: str) -> str:
    """Map bead status to dashboard status.

    Args:
        status: Bead status (open, in_progress, closed, deferred, completed)

    Returns:
        Dashboard status (pending, in_progress, completed)
    """
    status_map = {
        "open": "pending",
        "in_progress": "in_progress",
        "closed": "completed",
        "completed": "completed",  # Support both "closed" and "completed"
        "deferred": "pending",
    }
    return status_map.get(status, "pending")


def parse_metrics_from_comments(bead_id: str) -> dict:
    """Extract metrics JSON from bead comments.

    Queries comments on the bead and finds the one with type='metrics',
    then returns the metrics data.

    Args:
        bead_id: Bead ID to query comments for

    Returns:
        Dictionary with metrics (token_usage, cost_usd, duration_seconds)
        or empty dict if no metrics comment found
    """
    # Get comments for this bead
    result = subprocess.run(
        ["bd", "comments", bead_id, "--json"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        return {}

    try:
        comments = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {}

    # Find comment with type='metrics'
    for comment in comments:
        text = comment.get("text", "")
        if not text:
            continue

        try:
            data = json.loads(text)
            if data.get("type") == "metrics":
                # Return metrics data (excluding 'type' field for backward compat)
                return {
                    "token_usage": data.get("token_usage", {}),
                    "cost_usd": data.get("cost_usd", 0),
                    "duration_seconds": data.get("duration_seconds", 0)
                }
        except json.JSONDecodeError:
            continue

    return {}


def get_epic_status(epic_id: str) -> dict:
    """Get status in dashboard format from bead data.

    Queries the bead graph for an epic and transforms it into the
    format expected by the dashboard (matching cascade_state.json structure).

    Args:
        epic_id: Bead ID of the epic to query

    Returns:
        Dictionary with:
        - project: {name: str}
        - tasks: Dict[task_id -> task_data]
        - hierarchy: Dict[branch -> group -> [task_ids]]
        - task_definitions: Dict[task_id -> task_definition]
        - rollups: Computed rollups for L0, L1, L2
    """
    # Get graph with layout
    result = subprocess.run(
        ["bd", "graph", epic_id, "--json"],
        capture_output=True,
        text=True,
        check=True,
    )
    graph = json.loads(result.stdout)

    # Build hierarchy from layers
    hierarchy: Dict[str, Dict[str, List[str]]] = {}
    tasks: Dict[str, Dict[str, Any]] = {}
    task_definitions: Dict[str, Dict[str, Any]] = {}

    for layer_idx, layer_beads in enumerate(graph["layout"]["Layers"]):
        # Skip layer 0 (the epic itself)
        if layer_idx == 0:
            continue

        layer_name = f"Layer {layer_idx}"
        hierarchy[layer_name] = {"All": []}

        for bead_id in layer_beads:
            if bead_id == epic_id:
                continue  # Skip epic itself

            hierarchy[layer_name]["All"].append(bead_id)

            # Find bead in issues
            bead = next((i for i in graph["issues"] if i["id"] == bead_id), None)
            if not bead:
                continue

            # Parse metrics from comments if present
            metrics = parse_metrics_from_comments(bead_id)

            tasks[bead_id] = {
                "name": bead["title"],
                "status": map_bead_status(bead["status"]),
                "started_at": bead.get("updated_at"),
                "completed_at": bead.get("closed_at"),
                "duration_seconds": metrics.get("duration_seconds", 0),
                "token_usage": metrics.get("token_usage", {}),
            }

            node = graph["layout"]["Nodes"][bead_id]
            task_definitions[bead_id] = {
                "name": bead["title"],
                "branch": layer_name,
                "group": "All",
                "depends_on": node.get("DependsOn") or [],
            }

    # Compute rollups
    rollups = compute_hierarchy_rollups(tasks, hierarchy)

    return {
        "project": {"name": graph["root"]["title"]},
        "tasks": tasks,
        "hierarchy": hierarchy,
        "task_definitions": task_definitions,
        "rollups": rollups,
    }
