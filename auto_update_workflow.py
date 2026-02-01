#!/usr/bin/env python3
"""
Auto-Update Workflow - Orchestrates Nova session ingestion and prompt updates

This workflow:
1. Ingests a Claude Code session transcript via ingest.py
2. Detects active system prompts via prompt_detector (when available)
3. Analyzes the session for planning failures
4. Updates system prompts based on findings

All operations are logged to ~/.nova/hook-logs/workflow.log

Usage:
    python3 auto_update_workflow.py <path-to-jsonl>
    python3 auto_update_workflow.py <path-to-jsonl> --log-file <custom-log>
"""

import argparse
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

# Import our modules
from ingest import ingest_file, ingest_directory


def setup_logging(log_file: Optional[str] = None) -> logging.Logger:
    """
    Set up comprehensive logging to file and console.

    Args:
        log_file: Optional custom log file path. Defaults to ~/.nova/hook-logs/workflow.log

    Returns:
        Configured logger instance
    """
    if log_file is None:
        # Default to ~/.nova/hook-logs/workflow.log
        log_dir = Path.home() / ".nova" / "hook-logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = str(log_dir / "workflow.log")
    else:
        # Ensure parent directory exists
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

    # Create logger
    logger = logging.getLogger("auto_update_workflow")
    logger.setLevel(logging.DEBUG)

    # Clear any existing handlers
    logger.handlers.clear()

    # File handler with detailed format
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)

    # Console handler with simpler format
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter('%(levelname)s - %(message)s')
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    return logger


def log_workflow_start(logger: logging.Logger, path: str, db_path: Optional[str] = None) -> None:
    """
    Log the start of the workflow with configuration details.

    Args:
        logger: Logger instance
        path: Path to JSONL file or directory
        db_path: Optional database path
    """
    logger.info("=" * 80)
    logger.info("AUTO-UPDATE WORKFLOW STARTED")
    logger.info("=" * 80)
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info(f"Input path: {path}")
    logger.info(f"Database: {db_path or 'default (nova.db)'}")
    logger.info(f"Python version: {sys.version}")
    logger.info(f"Working directory: {os.getcwd()}")
    logger.info("=" * 80)


def log_workflow_end(logger: logging.Logger, success: bool, error: Optional[str] = None) -> None:
    """
    Log the end of the workflow with status.

    Args:
        logger: Logger instance
        success: Whether workflow completed successfully
        error: Optional error message
    """
    logger.info("=" * 80)
    logger.info("AUTO-UPDATE WORKFLOW COMPLETED")
    logger.info("=" * 80)
    logger.info(f"Status: {'SUCCESS' if success else 'FAILED'}")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    if error:
        logger.error(f"Error: {error}")
    logger.info("=" * 80)


def step_1_ingest_session(
    logger: logging.Logger,
    path: str,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Step 1: Ingest session transcript via ingest.py

    Args:
        logger: Logger instance
        path: Path to JSONL file or directory
        db_path: Optional database path

    Returns:
        Dictionary with ingestion results
    """
    logger.info("\n" + "=" * 80)
    logger.info("STEP 1: INGEST SESSION")
    logger.info("=" * 80)

    try:
        logger.info(f"Processing: {path}")

        # Determine if path is file or directory
        path_obj = Path(path)

        if not path_obj.exists():
            error_msg = f"Path does not exist: {path}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}

        if path_obj.is_file():
            logger.info("Type: Single file")
            result = ingest_file(str(path), db_path=db_path)
        elif path_obj.is_dir():
            logger.info("Type: Directory")
            result = ingest_directory(str(path), db_path=db_path)
        else:
            error_msg = f"Path is neither a file nor directory: {path}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}

        # Log results
        if result.get("success"):
            logger.info("✓ Ingestion successful")
            if result.get("type") == "file":
                logger.info(f"  Session ID: {result.get('session_id', 'unknown')}")
                logger.info(f"  Messages: {result.get('messages_imported', 0)}")
            elif result.get("type") == "directory":
                logger.info(f"  Files processed: {result.get('files_ingested', 0)}/{result.get('total_files', 0)}")
                logger.info(f"  Total messages: {result.get('total_messages', 0)}")
        else:
            logger.error(f"✗ Ingestion failed: {result.get('error', 'unknown error')}")

        logger.info("=" * 80)
        return result

    except Exception as e:
        error_msg = f"Exception during ingestion: {str(e)}"
        logger.exception(error_msg)
        return {"success": False, "error": error_msg}


def step_2_detect_prompts(
    logger: logging.Logger,
    session_id: str,
    jsonl_path: str
) -> Dict[str, Any]:
    """
    Step 2: Detect active system prompts via prompt_detector

    Args:
        logger: Logger instance
        session_id: Session ID from ingestion
        jsonl_path: Path to JSONL file

    Returns:
        Dictionary with detected prompts
    """
    logger.info("\n" + "=" * 80)
    logger.info("STEP 2: DETECT PROMPTS")
    logger.info("=" * 80)

    try:
        # Try to import prompt_detector
        try:
            from program_nova.prompt_detector import detect_prompts
            logger.info("✓ prompt_detector module loaded")
        except ImportError as e:
            logger.warning("⚠ prompt_detector module not found (Phase 2 incomplete)")
            logger.warning(f"  Import error: {str(e)}")
            logger.warning("  Skipping prompt detection step")
            return {
                "success": True,
                "skipped": True,
                "reason": "prompt_detector not implemented yet (Phase 2 incomplete)"
            }

        logger.info(f"Detecting prompts for session: {session_id}")
        logger.info(f"JSONL path: {jsonl_path}")

        # Call the prompt detector
        result = detect_prompts(jsonl_path)

        if result.get("success"):
            logger.info("✓ Prompt detection successful")
            prompts = result.get("prompts", [])
            logger.info(f"  Detected {len(prompts)} prompt(s)")
            for prompt in prompts:
                logger.info(f"    - {prompt}")
        else:
            logger.error(f"✗ Prompt detection failed: {result.get('error', 'unknown error')}")

        logger.info("=" * 80)
        return result

    except Exception as e:
        error_msg = f"Exception during prompt detection: {str(e)}"
        logger.exception(error_msg)
        return {"success": False, "error": error_msg}


def step_3_update_prompts(
    logger: logging.Logger,
    detected_prompts: list,
    dry_run: bool = True
) -> Dict[str, Any]:
    """
    Step 3: Update system prompts based on analysis

    Args:
        logger: Logger instance
        detected_prompts: List of detected prompt files
        dry_run: Whether to do a dry run (default True for safety)

    Returns:
        Dictionary with update results
    """
    logger.info("\n" + "=" * 80)
    logger.info("STEP 3: UPDATE PROMPTS")
    logger.info("=" * 80)

    if not detected_prompts:
        logger.warning("⚠ No prompts detected, skipping update step")
        return {
            "success": True,
            "skipped": True,
            "reason": "No prompts detected"
        }

    if dry_run:
        logger.info("🔍 DRY RUN MODE - No actual updates will be made")

    try:
        logger.info(f"Processing {len(detected_prompts)} prompt(s)")

        # For now, we log what would be done
        # Actual implementation will call update_prompt.py for each detected prompt
        for prompt_file in detected_prompts:
            logger.info(f"  Would update: {prompt_file}")

        logger.info("✓ Prompt update planning complete")
        logger.info("  Note: Actual update implementation pending")
        logger.info("=" * 80)

        return {
            "success": True,
            "planned_updates": len(detected_prompts),
            "note": "Actual update implementation pending"
        }

    except Exception as e:
        error_msg = f"Exception during prompt update: {str(e)}"
        logger.exception(error_msg)
        return {"success": False, "error": error_msg}


def run_workflow(
    path: str,
    db_path: Optional[str] = None,
    log_file: Optional[str] = None,
    dry_run: bool = True
) -> bool:
    """
    Run the complete auto-update workflow.

    Args:
        path: Path to JSONL file or directory
        db_path: Optional database path
        log_file: Optional custom log file
        dry_run: Whether to do a dry run (default True)

    Returns:
        True if workflow completed successfully, False otherwise
    """
    # Set up logging
    logger = setup_logging(log_file)

    try:
        # Log workflow start
        log_workflow_start(logger, path, db_path)

        # Step 1: Ingest session
        ingest_result = step_1_ingest_session(logger, path, db_path)

        if not ingest_result.get("success"):
            log_workflow_end(logger, False, ingest_result.get("error"))
            return False

        # Extract session info for next steps
        session_id = ingest_result.get("session_id")
        if not session_id and ingest_result.get("type") == "file":
            logger.error("No session_id returned from ingestion")
            log_workflow_end(logger, False, "No session_id from ingestion")
            return False

        # Step 2: Detect prompts (skip if directory or if module not available)
        detected_prompts = []
        if ingest_result.get("type") == "file" and session_id:
            prompt_result = step_2_detect_prompts(logger, session_id, path)

            if not prompt_result.get("success") and not prompt_result.get("skipped"):
                logger.warning("Prompt detection failed, continuing workflow")

            detected_prompts = prompt_result.get("prompts", [])

        # Step 3: Update prompts
        update_result = step_3_update_prompts(logger, detected_prompts, dry_run)

        if not update_result.get("success") and not update_result.get("skipped"):
            log_workflow_end(logger, False, update_result.get("error"))
            return False

        # Success!
        log_workflow_end(logger, True)
        return True

    except Exception as e:
        logger.exception("Unhandled exception in workflow")
        log_workflow_end(logger, False, str(e))
        return False


def parse_args() -> argparse.Namespace:
    """
    Parse command-line arguments.

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="Auto-update workflow for Nova session analysis and prompt updates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Ingest and process a single session
  %(prog)s /path/to/session.jsonl

  # Process all sessions in a directory
  %(prog)s /path/to/sessions/

  # Use custom log file
  %(prog)s /path/to/session.jsonl --log-file /tmp/workflow.log

  # Use custom database
  %(prog)s /path/to/session.jsonl --db custom.db

Environment Variables:
  ANTHROPIC_API_KEY: Required for Claude API access (for analysis/update steps)
        """
    )

    parser.add_argument(
        'path',
        help='Path to JSONL file or directory containing JSONL files'
    )

    parser.add_argument(
        '--db',
        default=None,
        help='Path to SQLite database (default: nova.db)'
    )

    parser.add_argument(
        '--log-file',
        default=None,
        help='Path to log file (default: ~/.nova/hook-logs/workflow.log)'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        default=True,
        help='Dry run mode - do not make actual updates (default: True)'
    )

    parser.add_argument(
        '--no-dry-run',
        action='store_true',
        help='Disable dry run mode - make actual updates'
    )

    return parser.parse_args()


def main():
    """CLI entry point."""
    args = parse_args()

    # Determine dry run mode
    dry_run = args.dry_run and not args.no_dry_run

    # Run workflow
    success = run_workflow(
        path=args.path,
        db_path=args.db,
        log_file=args.log_file,
        dry_run=dry_run
    )

    # Exit with appropriate code
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
