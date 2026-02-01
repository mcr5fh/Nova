"""FastAPI server for Program Nova dashboard.

Provides API endpoints for:
- /api/status: Full project status with rollups
- /api/tasks/{task_id}: Individual task details
- /api/tasks/{task_id}/logs: Task log files
- /api/beads/epics: List available bead epics
- /api/beads/start: Start epic execution
- /api/beads/status/{epic_id}: Get epic status in dashboard format
"""

import json
import logging
import subprocess
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from program_nova.engine.parser import parse_cascade
from program_nova.engine.state import StateManager
from program_nova.engine.bead_orchestrator import BeadOrchestrator
from program_nova.dashboard.rollup import compute_hierarchy_rollups
from program_nova.dashboard.milestones import MilestoneEvaluator
from program_nova.dashboard.beads_adapter import get_epic_status

# Get logger for this module
logger = logging.getLogger(__name__)

# Default paths (can be overridden in create_app)
# LOGS_DIR is now set relative to cwd where the app is run
LOGS_DIR = Path.cwd() / "logs"
STATIC_DIR = Path(__file__).parent / "static"


class StartEpicRequest(BaseModel):
    """Request model for starting epic execution."""
    epic_id: str


def create_app(
    state_file: str = "./cascade_state.json",
    cascade_file: str = "./CASCADE.md",
    milestones_file: str = "./program_nova/milestones.yaml",
) -> FastAPI:
    """Create and configure the FastAPI application.

    Args:
        state_file: Path to cascade_state.json
        cascade_file: Path to CASCADE.md
        milestones_file: Path to milestones.yaml

    Returns:
        Configured FastAPI app instance
    """
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Manage application lifecycle - handles shutdown only."""
        yield

        # Shutdown: Stop all orchestrators gracefully
        logger.info(f"Shutting down {len(app.state.orchestrators)} orchestrators")
        for epic_id, orchestrator in app.state.orchestrators.items():
            logger.info(f"Stopping orchestrator for {epic_id}")
            orchestrator.stop()
        logger.info("All orchestrators stopped")

    app = FastAPI(
        title="Program Nova Dashboard API",
        description="Real-time observability for hierarchical task execution",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Enable CORS for frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Initialize app state
    app.state.state_file = state_file
    app.state.cascade_file = cascade_file
    app.state.milestones_file = milestones_file
    app.state.milestone_evaluator = MilestoneEvaluator(milestones_file)
    app.state.orchestrators = {}

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

            # Check if all tasks are completed
            all_tasks_completed = all(
                task.get("status") == "completed"
                for task in state["tasks"].values()
            )

            return JSONResponse(
                content={
                    "project": state["project"],
                    "tasks": state["tasks"],
                    "rollups": rollups,
                    "hierarchy": cascade_data["hierarchy"],
                    "milestones": triggered_milestones,
                    "all_tasks_completed": all_tasks_completed,
                    "task_definitions": cascade_data["tasks"],  # Include task definitions with dependencies
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

    @app.get("/api/beads/epics")
    async def list_epics():
        """List all bead epics available for execution.

        Returns:
            JSON array of epic beads with id, title, type, status, priority
        """
        logger.info("Epic list requested")
        try:
            result = subprocess.run(
                ["bd", "list", "--type=epic", "--json"],
                capture_output=True,
                text=True,
                check=True
            )
            epics = json.loads(result.stdout)
            logger.info(f"Epic list returned {len(epics)} epics")
            return epics
        except subprocess.CalledProcessError as e:
            logger.error(f"Error listing epics: {e.stderr}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Error listing epics: {e.stderr}"
            )
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing epic list: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Error parsing epic list: {str(e)}"
            )

    @app.post("/api/beads/start")
    async def start_epic(request: StartEpicRequest):
        """Start execution of an epic's children.

        Starts the orchestrator in a background thread so it doesn't block
        the HTTP response. The orchestrator will run indefinitely, spawning
        workers for ready tasks until all tasks are complete.

        The orchestrator is tracked in app.state for graceful shutdown,
        and the thread is non-daemon so the server waits for completion.

        Args:
            request: Request containing epic_id

        Returns:
            JSON with status and epic_id
        """
        logger.info(f"Epic start requested for epic_id={request.epic_id}")
        try:
            # Instantiate the BeadOrchestrator
            logger.info(f"Starting BeadOrchestrator for epic_id={request.epic_id}")
            orchestrator = BeadOrchestrator(request.epic_id)

            # Track orchestrator for graceful shutdown
            app.state.orchestrators[request.epic_id] = orchestrator

            # Start orchestrator in background thread
            # This allows the HTTP response to return immediately
            def run_orchestrator():
                """Run orchestrator in background thread."""
                try:
                    logger.info(f"BeadOrchestrator thread started for epic_id={request.epic_id}")
                    orchestrator.start()
                    logger.info(f"BeadOrchestrator completed for epic_id={request.epic_id}")
                except Exception as e:
                    logger.error(f"BeadOrchestrator error for epic_id={request.epic_id}: {str(e)}", exc_info=True)
                finally:
                    # Remove from tracked orchestrators when done
                    app.state.orchestrators.pop(request.epic_id, None)

            thread = threading.Thread(
                target=run_orchestrator,
                name=f"BeadOrchestrator-{request.epic_id}",
                daemon=False  # Non-daemon thread allows graceful shutdown
            )
            thread.start()

            logger.info(f"BeadOrchestrator thread started successfully for epic_id={request.epic_id}")

            return JSONResponse(
                content={
                    "status": "started",
                    "epic_id": request.epic_id
                }
            )
        except Exception as e:
            logger.error(f"Error starting epic {request.epic_id}: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Error starting epic: {str(e)}"
            )

    @app.get("/api/beads/status/{epic_id}")
    async def get_epic_status_endpoint(epic_id: str):
        """Get status for bead mode in dashboard format.

        Args:
            epic_id: Epic bead identifier

        Returns:
            JSON with dashboard-compatible status structure
        """
        logger.info(f"Epic status queried for epic_id={epic_id}")
        try:
            status = get_epic_status(epic_id)
            logger.info(f"Epic status retrieved successfully for epic_id={epic_id}")
            return JSONResponse(content=status)
        except subprocess.CalledProcessError as e:
            logger.error(f"Error getting epic status for {epic_id}: {e.stderr}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Error getting epic status: {e.stderr}"
            )
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing epic graph for {epic_id}: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Error parsing epic graph: {str(e)}"
            )

    return app


def setup_logging(daemon_mode: bool = False):
    """
    Setup logging configuration.

    Args:
        daemon_mode: If True, configure logging for daemon mode (log to file)
                    If False, log to console
    """
    import logging
    import logging.handlers
    from pathlib import Path

    # Create logs directory if it doesn't exist (relative to cwd)
    logs_dir = Path.cwd() / "logs"
    logs_dir.mkdir(exist_ok=True)

    # Configure root logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    # Clear any existing handlers
    logger.handlers.clear()

    if daemon_mode:
        # Daemon mode: log to file with rotation
        log_file = logs_dir / "dashboard.log"
        handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
        )
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
    else:
        # Interactive mode: log to console
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            "%(levelname)s: %(message)s"
        )

    handler.setFormatter(formatter)
    logger.addHandler(handler)

    return logger


def main():
    """Run the dashboard server.

    Usage:
        python -m program_nova.dashboard.server [--daemon] [--host HOST] [--port PORT]

    Args:
        --daemon: Run in daemon mode (log to file instead of console)
        --host: Host to bind to (default: 0.0.0.0)
        --port: Port to bind to (default: 8000)
        --state-file: Path to state file (default: cascade_state.json)
        --cascade-file: Path to cascade file (default: CASCADE.md)
        --milestones-file: Path to milestones file (default: program_nova/milestones.yaml)
    """
    import argparse
    import uvicorn

    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Program Nova Dashboard - Real-time Task Observability Web UI"
    )
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run in daemon mode (log to file)",
    )
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to (default: 8000)",
    )
    parser.add_argument(
        "--state-file",
        default="./cascade_state.json",
        help="Path to state file (default: ./cascade_state.json)",
    )
    parser.add_argument(
        "--cascade-file",
        default="./CASCADE.md",
        help="Path to cascade file (default: ./CASCADE.md)",
    )
    parser.add_argument(
        "--milestones-file",
        default="./program_nova/milestones.yaml",
        help="Path to milestones file (default: ./program_nova/milestones.yaml)",
    )

    args = parser.parse_args()

    # Setup logging
    logger = setup_logging(daemon_mode=args.daemon)

    logger.info("Starting Program Nova Dashboard")
    logger.info(f"Host: {args.host}:{args.port}")
    logger.info(f"State file: {args.state_file}")
    logger.info(f"Cascade file: {args.cascade_file}")
    logger.info(f"Milestones file: {args.milestones_file}")
    logger.info(f"Daemon mode: {args.daemon}")

    # Create app with configured paths
    app = create_app(
        state_file=args.state_file,
        cascade_file=args.cascade_file,
        milestones_file=args.milestones_file,
    )

    # Configure uvicorn log level
    log_level = "info" if not args.daemon else "warning"

    # Run server
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level=log_level,
        access_log=not args.daemon,  # Disable access log in daemon mode
    )


if __name__ == "__main__":
    main()
