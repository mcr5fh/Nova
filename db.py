"""
Database module for Nova - handles SQLite database operations for sessions, messages, and analyses.
"""

import sqlite3
from contextlib import contextmanager
from datetime import datetime
from typing import Optional, List, Dict, Any
import json
from pathlib import Path


# Default database path
DB_PATH = Path(__file__).parent / "nova.db"


@contextmanager
def get_connection(db_path: str = None):
    """
    Context manager for database connections.

    Args:
        db_path: Optional path to the database file. Uses default if not provided.

    Yields:
        sqlite3.Connection: Database connection object
    """
    path = db_path or str(DB_PATH)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_cursor(conn: sqlite3.Connection) -> sqlite3.Cursor:
    """
    Get a cursor from a connection.

    Args:
        conn: Database connection

    Returns:
        sqlite3.Cursor: Database cursor
    """
    return conn.cursor()


def init_db(db_path: str = None):
    """
    Initialize the database with required tables.

    Args:
        db_path: Optional path to the database file. Uses default if not provided.
    """
    with get_connection(db_path) as conn:
        cursor = get_cursor(conn)

        # Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                title TEXT,
                metadata TEXT
            )
        """)

        # Messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                message_index INTEGER,
                tokens_input INTEGER,
                tokens_output INTEGER,
                model TEXT,
                metadata TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )
        """)

        # Analyses table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                analysis_type TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )
        """)

        # Create indexes for better query performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_session_id
            ON messages(session_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_session_message_index
            ON messages(session_id, message_index)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_analyses_session_id
            ON analyses(session_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_created_at
            ON sessions(created_at)
        """)


# Session operations
def create_session(session_id: str, title: str = None, metadata: Dict[str, Any] = None, db_path: str = None) -> int:
    """
    Create a new session.

    Args:
        session_id: Unique session identifier
        title: Optional session title
        metadata: Optional metadata dictionary
        db_path: Optional database path

    Returns:
        int: Session database ID
    """
    with get_connection(db_path) as conn:
        cursor = get_cursor(conn)
        metadata_json = json.dumps(metadata) if metadata else None
        cursor.execute(
            "INSERT INTO sessions (session_id, title, metadata) VALUES (?, ?, ?)",
            (session_id, title, metadata_json)
        )
        return cursor.lastrowid


def get_session(session_id: str, db_path: str = None) -> Optional[Dict[str, Any]]:
    """
    Get a session by ID.

    Args:
        session_id: Session identifier
        db_path: Optional database path

    Returns:
        Optional[Dict]: Session data or None if not found
    """
    with get_connection(db_path) as conn:
        cursor = get_cursor(conn)
        cursor.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id,))
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None


def update_session(session_id: str, title: str = None, metadata: Dict[str, Any] = None, db_path: str = None):
    """
    Update a session.

    Args:
        session_id: Session identifier
        title: Optional new title
        metadata: Optional new metadata
        db_path: Optional database path
    """
    with get_connection(db_path) as conn:
        cursor = get_cursor(conn)
        updates = []
        params = []

        if title is not None:
            updates.append("title = ?")
            params.append(title)

        if metadata is not None:
            updates.append("metadata = ?")
            params.append(json.dumps(metadata))

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(session_id)
            query = f"UPDATE sessions SET {', '.join(updates)} WHERE session_id = ?"
            cursor.execute(query, params)


# Message operations
def create_message(
    session_id: str,
    role: str,
    content: str,
    message_index: int = None,
    tokens_input: int = None,
    tokens_output: int = None,
    model: str = None,
    metadata: Dict[str, Any] = None,
    db_path: str = None
) -> int:
    """
    Create a new message.

    Args:
        session_id: Session identifier
        role: Message role (user, assistant, system)
        content: Message content
        message_index: Optional index of message in conversation (0-based)
        tokens_input: Optional input token count
        tokens_output: Optional output token count
        model: Optional model identifier
        metadata: Optional metadata dictionary
        db_path: Optional database path

    Returns:
        int: Message database ID
    """
    with get_connection(db_path) as conn:
        cursor = get_cursor(conn)
        metadata_json = json.dumps(metadata) if metadata else None
        cursor.execute(
            """INSERT INTO messages
               (session_id, role, content, message_index, tokens_input, tokens_output, model, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (session_id, role, content, message_index, tokens_input, tokens_output, model, metadata_json)
        )
        return cursor.lastrowid


def get_messages(session_id: str, limit: int = None, db_path: str = None) -> List[Dict[str, Any]]:
    """
    Get messages for a session.

    Args:
        session_id: Session identifier
        limit: Optional limit on number of messages
        db_path: Optional database path

    Returns:
        List[Dict]: List of message dictionaries
    """
    with get_connection(db_path) as conn:
        cursor = get_cursor(conn)
        query = "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC"
        if limit:
            query += f" LIMIT {limit}"
        cursor.execute(query, (session_id,))
        return [dict(row) for row in cursor.fetchall()]


# Analysis operations
def create_analysis(
    session_id: str,
    analysis_type: str,
    content: str,
    metadata: Dict[str, Any] = None,
    db_path: str = None
) -> int:
    """
    Create a new analysis.

    Args:
        session_id: Session identifier
        analysis_type: Type of analysis (e.g., 'dependency', 'complexity', 'summary')
        content: Analysis content
        metadata: Optional metadata dictionary
        db_path: Optional database path

    Returns:
        int: Analysis database ID
    """
    with get_connection(db_path) as conn:
        cursor = get_cursor(conn)
        metadata_json = json.dumps(metadata) if metadata else None
        cursor.execute(
            "INSERT INTO analyses (session_id, analysis_type, content, metadata) VALUES (?, ?, ?, ?)",
            (session_id, analysis_type, content, metadata_json)
        )
        return cursor.lastrowid


def get_analyses(
    session_id: str,
    analysis_type: str = None,
    limit: int = None,
    db_path: str = None
) -> List[Dict[str, Any]]:
    """
    Get analyses for a session.

    Args:
        session_id: Session identifier
        analysis_type: Optional filter by analysis type
        limit: Optional limit on number of analyses
        db_path: Optional database path

    Returns:
        List[Dict]: List of analysis dictionaries
    """
    with get_connection(db_path) as conn:
        cursor = get_cursor(conn)
        query = "SELECT * FROM analyses WHERE session_id = ?"
        params = [session_id]

        if analysis_type:
            query += " AND analysis_type = ?"
            params.append(analysis_type)

        query += " ORDER BY created_at DESC"

        if limit:
            query += f" LIMIT {limit}"

        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]


def get_all_sessions(limit: int = None, db_path: str = None) -> List[Dict[str, Any]]:
    """
    Get all sessions.

    Args:
        limit: Optional limit on number of sessions
        db_path: Optional database path

    Returns:
        List[Dict]: List of session dictionaries
    """
    with get_connection(db_path) as conn:
        cursor = get_cursor(conn)
        query = "SELECT * FROM sessions ORDER BY updated_at DESC"
        if limit:
            query += f" LIMIT {limit}"
        cursor.execute(query)
        return [dict(row) for row in cursor.fetchall()]


if __name__ == "__main__":
    # Initialize database when run directly
    print(f"Initializing database at {DB_PATH}")
    init_db()
    print("Database initialized successfully!")
