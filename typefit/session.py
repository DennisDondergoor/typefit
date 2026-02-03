"""Typing session manager."""

from dataclasses import dataclass
from enum import Enum
from typing import Callable, Optional

from .stats import SessionStats


class SessionState(Enum):
    """States of a typing session."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class CharacterResult:
    """Result of typing a single character."""

    expected: str
    typed: str
    correct: bool
    position: int


class TypingSession:
    """Manages a single typing practice session."""

    def __init__(self, text: str, mode: str = "words"):
        self.text = text
        self.mode = mode
        self.position = 0
        self.typed_chars: list[str] = []
        self.state = SessionState.NOT_STARTED
        self.stats = SessionStats()
        self.stats.total_characters = len(text)

        # Callbacks
        self.on_keystroke: Optional[Callable[[CharacterResult], None]] = None
        self.on_complete: Optional[Callable[[SessionStats], None]] = None
        self.on_progress: Optional[Callable[[int, int], None]] = None

    @property
    def current_char(self) -> Optional[str]:
        """Get the current character to type."""
        if self.position >= len(self.text):
            return None
        return self.text[self.position]

    @property
    def progress(self) -> tuple[int, int]:
        """Get current progress as (current, total)."""
        return (self.position, len(self.text))

    @property
    def progress_percent(self) -> float:
        """Get progress as percentage."""
        if len(self.text) == 0:
            return 100.0
        return (self.position / len(self.text)) * 100.0

    @property
    def remaining_text(self) -> str:
        """Get the remaining text to type."""
        return self.text[self.position :]

    @property
    def typed_text(self) -> str:
        """Get the text typed so far."""
        return "".join(self.typed_chars)

    @property
    def is_complete(self) -> bool:
        """Check if the session is complete."""
        return self.position >= len(self.text)

    @property
    def word_count(self) -> int:
        """Get approximate word count of the text."""
        return len(self.text.split())

    def start(self):
        """Start the typing session."""
        if self.state == SessionState.NOT_STARTED:
            self.state = SessionState.IN_PROGRESS
            self.stats.start()

    def process_keystroke(self, char: str) -> Optional[CharacterResult]:
        """Process a single keystroke. Returns result or None if session not active."""
        if self.state != SessionState.IN_PROGRESS:
            return None

        if self.is_complete:
            self._complete()
            return None

        expected = self.current_char
        correct = char == expected

        result = CharacterResult(
            expected=expected,
            typed=char,
            correct=correct,
            position=self.position,
        )

        self.stats.record_keystroke(expected, correct)
        self.typed_chars.append(char)
        self.position += 1

        if self.on_keystroke:
            self.on_keystroke(result)

        if self.on_progress:
            self.on_progress(*self.progress)

        if self.is_complete:
            self._complete()

        return result

    def process_backspace(self) -> bool:
        """Process a backspace keystroke. Returns True if position changed."""
        if self.state != SessionState.IN_PROGRESS:
            return False

        if self.position > 0:
            self.position -= 1
            if self.typed_chars:
                self.typed_chars.pop()
            self.stats.record_backspace()

            if self.on_progress:
                self.on_progress(*self.progress)

            return True

        return False

    def _complete(self):
        """Mark session as complete."""
        self.state = SessionState.COMPLETED
        self.stats.stop()

        if self.on_complete:
            self.on_complete(self.stats)

    def cancel(self):
        """Cancel the session."""
        self.state = SessionState.CANCELLED
        self.stats.stop()

    def pause(self):
        """Pause the session."""
        if self.state == SessionState.IN_PROGRESS:
            self.state = SessionState.PAUSED

    def resume(self):
        """Resume the session."""
        if self.state == SessionState.PAUSED:
            self.state = SessionState.IN_PROGRESS

    def get_display_state(self) -> dict:
        """Get the current state for display purposes."""
        return {
            "text": self.text,
            "position": self.position,
            "typed_chars": self.typed_chars,
            "remaining": self.remaining_text,
            "typed": self.typed_text,
            "progress": self.progress,
            "progress_percent": self.progress_percent,
            "is_complete": self.is_complete,
            "wpm": self.stats.wpm,
            "accuracy": self.stats.accuracy,
            "elapsed": self.stats.elapsed_time,
        }

    def get_char_states(self) -> list[tuple[str, str]]:
        """
        Get the state of each character for display.
        Returns list of (char, state) where state is 'correct', 'incorrect', 'current', or 'pending'.
        """
        states = []

        for i, char in enumerate(self.text):
            if i < len(self.typed_chars):
                if self.typed_chars[i] == char:
                    states.append((char, "correct"))
                else:
                    states.append((char, "incorrect"))
            elif i == self.position:
                states.append((char, "current"))
            else:
                states.append((char, "pending"))

        return states
