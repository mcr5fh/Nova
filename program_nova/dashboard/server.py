"""FastAPI server for Program Nova dashboard.

Provides API endpoints for:
- /api/status: Full project status with rollups
- /api/tasks/{task_id}: Individual task details
- /api/tasks/{task_id}/logs: Task log files
"""

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from program_nova.engine.parser import parse_cascade
from program_nova.engine.state import StateManager
from program_nova.dashboard.rollup import compute_hierarchy_rollups
from program_nova.dashboard.milestones import MilestoneEvaluator


# Default paths (can be overridden in create_app)
LOGS_DIR = Path("program_nova/logs")
STATIC_DIR = Path(__file__).parent / "static"


def create_app(
    state_file: str = "cascade_state.json",
    cascade_file: str = "CASCADE.md",
    milestones_file: str = "program_nova/milestones.yaml",
) -> FastAPI:
    """Create and configure the FastAPI application.

    Args:
        state_file: Path to cascade_state.json
        cascade_file: Path to CASCADE.md
        milestones_file: Path to milestones.yaml

    Returns:
        Configured FastAPI app instance
    """
    app = FastAPI(
        title="Program Nova Dashboard API",
        description="Real-time observability for hierarchical task execution",
        version="1.0.0",
    )

    # Enable CORS for frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Store config in app state
    app.state.state_file = state_file
    app.state.cascade_file = cascade_file
    app.state.milestones_file = milestones_file

    # Initialize milestone evaluator
    app.state.milestone_evaluator = MilestoneEvaluator(milestones_file)

    # Mount static files
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/")
    async def root():
        """Serve the dashboard HTML."""
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"status": "ok", "service": "Program Nova Dashboard"}

    @app.get("/api/status")
    async def get_status():
        """Get full project status with rollups.

        Returns:
            JSON with:
            - project: Project metadata (name, timestamps)
            - tasks: All task states
            - rollups: Aggregated metrics (L0, L1, L2)
        """
        try:
            # Read current state
            sm = StateManager(app.state.state_file)
            state = sm.read_state()

            # Parse cascade for hierarchy
            cascade_data = parse_cascade(app.state.cascade_file)

            # Compute rollups
            rollups = compute_hierarchy_rollups(
                tasks=state["tasks"],
                hierarchy=cascade_data["hierarchy"],
            )

            # Evaluate milestones
            triggered_milestones = app.state.milestone_evaluator.evaluate(state["tasks"])

            return JSONResponse(
                content={
                    "project": state["project"],
                    "tasks": state["tasks"],
                    "rollups": rollups,
                    "hierarchy": cascade_data["hierarchy"],
                    "milestones": triggered_milestones,
                }
            )
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

    @app.get("/api/tasks/{task_id}")
    async def get_task(task_id: str):
        """Get details for a specific task.

        Args:
            task_id: Task identifier (e.g., "F1", "P2")

        Returns:
            JSON with task details including status, duration, tokens, etc.
        """
        try:
            sm = StateManager(app.state.state_file)
            state = sm.read_state()

            if task_id not in state["tasks"]:
                raise HTTPException(
                    status_code=404,
                    detail=f"Task {task_id} not found"
                )

            task_data = state["tasks"][task_id]
            return JSONResponse(
                content={
                    "id": task_id,
                    **task_data,
                }
            )
        except HTTPException:
            raise
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

    @app.get("/api/tasks/{task_id}/logs")
    async def get_task_logs(task_id: str, lines: Optional[int] = None):
        """Get log file content for a specific task.

        Args:
            task_id: Task identifier
            lines: Optional number of last lines to return (default: all)

        Returns:
            JSON with:
            - task_id: Task identifier
            - logs: Log file content (string)
        """
        log_file = LOGS_DIR / f"{task_id}.log"

        if not log_file.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Log file not found for task {task_id}"
            )

        try:
            log_content = log_file.read_text()

            # If lines parameter is provided, return last N lines
            if lines is not None and lines > 0:
                log_lines = log_content.splitlines(keepends=True)
                log_content = "".join(log_lines[-lines:])

            return JSONResponse(
                content={
                    "task_id": task_id,
                    "logs": log_content,
                }
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading log file: {str(e)}")

    return app


def main():
    """Run the dashboard server (development mode)."""
    import uvicorn

    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")


if __name__ == "__main__":
    main()
