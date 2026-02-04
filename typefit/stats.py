"""Statistics calculation and tracking for typing sessions."""

import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SessionStats:
    """Statistics for a single typing session."""

    start_time: float = 0.0
    end_time: float = 0.0
    total_keystrokes: int = 0
    correct_keystrokes: int = 0
    total_characters: int = 0
    characters_typed: int = 0
    error_counts: dict = field(default_factory=dict)

    def start(self):
        """Start timing the session."""
        self.start_time = time.time()

    def stop(self):
        """Stop timing the session."""
        self.end_time = time.time()

    def record_keystroke(self, char: str, correct: bool):
        """Record a keystroke."""
        self.total_keystrokes += 1
        if correct:
            self.correct_keystrokes += 1
            self.characters_typed += 1
        else:
            # Track error frequency per character
            self.error_counts[char] = self.error_counts.get(char, 0) + 1

    def record_backspace(self):
        """Record a backspace keystroke (does not affect accuracy)."""
        if self.characters_typed > 0:
            self.characters_typed -= 1

    @property
    def elapsed_time(self) -> float:
        """Get elapsed time in seconds."""
        if self.start_time == 0:
            return 0.0
        end = self.end_time if self.end_time > 0 else time.time()
        return end - self.start_time

    @property
    def elapsed_minutes(self) -> float:
        """Get elapsed time in minutes."""
        return self.elapsed_time / 60.0

    @property
    def wpm(self) -> float:
        """Calculate words per minute (standard: 5 characters = 1 word)."""
        if self.elapsed_minutes <= 0:
            return 0.0
        return (self.characters_typed / 5.0) / self.elapsed_minutes

    @property
    def raw_wpm(self) -> float:
        """Calculate raw WPM including errors."""
        if self.elapsed_minutes <= 0:
            return 0.0
        return (self.total_keystrokes / 5.0) / self.elapsed_minutes

    @property
    def accuracy(self) -> float:
        """Calculate accuracy as percentage."""
        if self.total_keystrokes == 0:
            return 100.0
        return (self.correct_keystrokes / self.total_keystrokes) * 100.0

    @property
    def problem_keys(self) -> list[tuple[str, int]]:
        """Get list of problem keys sorted by error count."""
        return sorted(self.error_counts.items(), key=lambda x: x[1], reverse=True)

    def get_summary(self) -> dict:
        """Get a summary of the session statistics."""
        return {
            "wpm": round(self.wpm, 1),
            "raw_wpm": round(self.raw_wpm, 1),
            "accuracy": round(self.accuracy, 1),
            "total_keystrokes": self.total_keystrokes,
            "correct_keystrokes": self.correct_keystrokes,
            "characters_typed": self.characters_typed,
            "elapsed_seconds": round(self.elapsed_time, 1),
            "problem_keys": self.problem_keys[:5],  # Top 5 problem keys
        }


class StatsCalculator:
    """Utility class for calculating typing statistics."""

    @staticmethod
    def calculate_wpm(characters: int, seconds: float) -> float:
        """Calculate WPM from characters typed and time elapsed."""
        if seconds <= 0:
            return 0.0
        minutes = seconds / 60.0
        words = characters / 5.0
        return words / minutes

    @staticmethod
    def calculate_accuracy(correct: int, total: int) -> float:
        """Calculate accuracy percentage."""
        if total == 0:
            return 100.0
        return (correct / total) * 100.0

    @staticmethod
    def format_time(seconds: float) -> str:
        """Format seconds as mm:ss."""
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}:{secs:02d}"
