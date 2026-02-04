"""SQLite database operations for persisting typing data."""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional


class Storage:
    """Handles all database operations for typefit."""

    def __init__(self, db_path: Path = None):
        if db_path is None:
            db_path = Path(__file__).parent.parent / "typefit.db"
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """Get a database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Initialize database schema."""
        conn = self._get_connection()
        cursor = conn.cursor()

        # Sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mode TEXT NOT NULL,
                word_count INTEGER,
                wpm REAL NOT NULL,
                raw_wpm REAL,
                accuracy REAL NOT NULL,
                elapsed_seconds REAL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Problem keys table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS problem_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character TEXT NOT NULL,
                error_count INTEGER DEFAULT 0,
                total_count INTEGER DEFAULT 0,
                UNIQUE(character)
            )
        """)

        # Custom texts table (for database-backed storage, optional)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS custom_texts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                content TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.commit()
        conn.close()

    def save_session(
        self,
        mode: str,
        wpm: float,
        accuracy: float,
        word_count: int = None,
        raw_wpm: float = None,
        elapsed_seconds: float = None,
    ) -> int:
        """Save a completed typing session."""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO sessions (mode, word_count, wpm, raw_wpm, accuracy, elapsed_seconds)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (mode, word_count, wpm, raw_wpm, accuracy, elapsed_seconds),
        )

        session_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return session_id

    def update_problem_keys(self, error_counts: dict):
        """Update problem key statistics."""
        conn = self._get_connection()
        cursor = conn.cursor()

        for char, count in error_counts.items():
            cursor.execute(
                """
                INSERT INTO problem_keys (character, error_count, total_count)
                VALUES (?, ?, ?)
                ON CONFLICT(character) DO UPDATE SET
                    error_count = error_count + excluded.error_count,
                    total_count = total_count + excluded.total_count
            """,
                (char, count, count),
            )

        conn.commit()
        conn.close()

    def get_progress(self, limit: int = 20) -> list[dict]:
        """Get recent session history."""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT mode, word_count, wpm, accuracy, elapsed_seconds, timestamp
            FROM sessions
            ORDER BY timestamp DESC
            LIMIT ?
        """,
            (limit,),
        )

        rows = cursor.fetchall()
        conn.close()

        return [dict(row) for row in rows]

    def get_stats_summary(self) -> dict:
        """Get overall statistics summary."""
        conn = self._get_connection()
        cursor = conn.cursor()

        # Total sessions
        cursor.execute("SELECT COUNT(*) as count FROM sessions")
        total_sessions = cursor.fetchone()["count"]

        # Average WPM
        cursor.execute("SELECT AVG(wpm) as avg_wpm FROM sessions")
        avg_wpm = cursor.fetchone()["avg_wpm"] or 0

        # Average accuracy
        cursor.execute("SELECT AVG(accuracy) as avg_accuracy FROM sessions")
        avg_accuracy = cursor.fetchone()["avg_accuracy"] or 0

        # Best WPM
        cursor.execute("SELECT MAX(wpm) as best_wpm FROM sessions")
        best_wpm = cursor.fetchone()["best_wpm"] or 0

        # Sessions by mode
        cursor.execute("""
            SELECT mode, COUNT(*) as count, AVG(wpm) as avg_wpm
            FROM sessions
            GROUP BY mode
        """)
        by_mode = {row["mode"]: {"count": row["count"], "avg_wpm": row["avg_wpm"]} for row in cursor.fetchall()}

        conn.close()

        return {
            "total_sessions": total_sessions,
            "avg_wpm": round(avg_wpm, 1),
            "avg_accuracy": round(avg_accuracy, 1),
            "best_wpm": round(best_wpm, 1),
            "by_mode": by_mode,
        }

    def get_problem_keys(self, limit: int = 10) -> list[dict]:
        """Get the most problematic keys."""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT character, error_count, total_count
            FROM problem_keys
            WHERE error_count > 0
            ORDER BY error_count DESC
            LIMIT ?
        """,
            (limit,),
        )

        rows = cursor.fetchall()
        conn.close()

        return [dict(row) for row in rows]

    def get_recent_wpm_trend(self, limit: int = 10) -> list[float]:
        """Get recent WPM values for trend analysis."""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT wpm FROM sessions
            ORDER BY timestamp DESC
            LIMIT ?
        """,
            (limit,),
        )

        rows = cursor.fetchall()
        conn.close()

        # Return in chronological order
        return [row["wpm"] for row in reversed(rows)]

    def reset_statistics(self):
        """Reset all statistics by clearing sessions and problem keys tables."""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("DELETE FROM sessions")
        cursor.execute("DELETE FROM problem_keys")

        conn.commit()
        conn.close()
