"""Terminal UI using curses."""

import curses
from typing import Optional, Callable

from .session import TypingSession, SessionState
from .stats import SessionStats, StatsCalculator


class Colors:
    """Color pair constants."""

    NORMAL = 1
    CORRECT = 2
    INCORRECT = 3
    CURRENT = 4
    PENDING = 5
    HIGHLIGHT = 6
    DIM = 7


class Display:
    """Handles all terminal display using curses."""

    def __init__(self, stdscr):
        self.stdscr = stdscr
        self._setup_colors()
        self._setup_screen()

    def _setup_colors(self):
        """Initialize color pairs."""
        curses.start_color()
        curses.use_default_colors()

        # White on black (normal)
        curses.init_pair(Colors.NORMAL, curses.COLOR_WHITE, -1)
        # Green for correct
        curses.init_pair(Colors.CORRECT, curses.COLOR_GREEN, -1)
        # Red background for incorrect
        curses.init_pair(Colors.INCORRECT, curses.COLOR_WHITE, curses.COLOR_RED)
        # Reverse video for current character
        curses.init_pair(Colors.CURRENT, curses.COLOR_BLACK, curses.COLOR_WHITE)
        # Dim for pending text
        curses.init_pair(Colors.PENDING, curses.COLOR_WHITE, -1)
        # Cyan for highlights
        curses.init_pair(Colors.HIGHLIGHT, curses.COLOR_CYAN, -1)
        # Dim gray
        curses.init_pair(Colors.DIM, curses.COLOR_WHITE, -1)

    def _setup_screen(self):
        """Configure screen settings."""
        curses.curs_set(0)  # Hide cursor
        self.stdscr.keypad(True)
        self.stdscr.nodelay(False)
        self.stdscr.timeout(-1)

    def get_dimensions(self) -> tuple[int, int]:
        """Get screen dimensions (height, width)."""
        return self.stdscr.getmaxyx()

    def clear(self):
        """Clear the screen."""
        self.stdscr.clear()

    def refresh(self):
        """Refresh the screen."""
        self.stdscr.refresh()

    def get_key(self) -> int:
        """Get a single keypress."""
        return self.stdscr.getch()

    def draw_centered_text(self, y: int, text: str, color_pair: int = Colors.NORMAL, attr: int = 0):
        """Draw text centered on the screen."""
        height, width = self.get_dimensions()
        x = max(0, (width - len(text)) // 2)
        try:
            self.stdscr.addstr(y, x, text[:width], curses.color_pair(color_pair) | attr)
        except curses.error:
            pass

    def draw_text(self, y: int, x: int, text: str, color_pair: int = Colors.NORMAL, attr: int = 0):
        """Draw text at a specific position."""
        height, width = self.get_dimensions()
        try:
            self.stdscr.addstr(y, x, text[: width - x], curses.color_pair(color_pair) | attr)
        except curses.error:
            pass

    def draw_main_menu(self) -> str:
        """Draw the main menu and return the selected option."""
        while True:
            self.clear()
            height, width = self.get_dimensions()

            # Title
            self.draw_centered_text(2, "=== typefit ===", Colors.HIGHLIGHT, curses.A_BOLD)

            # Practice section
            self.draw_centered_text(5, "Practice:", Colors.NORMAL, curses.A_BOLD)
            self.draw_centered_text(7, "[1] Words", Colors.NORMAL)
            self.draw_centered_text(8, "[2] Sentences", Colors.NORMAL)
            self.draw_centered_text(9, "[3] Python Code", Colors.NORMAL)
            self.draw_centered_text(10, "[4] Custom Text", Colors.NORMAL)

            # Other section
            self.draw_centered_text(13, "Other:", Colors.NORMAL, curses.A_BOLD)
            self.draw_centered_text(15, "[5] View Progress", Colors.NORMAL)
            self.draw_centered_text(16, "[6] Manage Custom Texts", Colors.NORMAL)
            self.draw_centered_text(17, "[q] Quit", Colors.NORMAL)

            self.refresh()

            key = self.get_key()
            if key == ord("q") or key == ord("Q"):
                return "quit"
            elif key == ord("1"):
                return "words"
            elif key == ord("2"):
                return "sentences"
            elif key == ord("3"):
                return "python"
            elif key == ord("4"):
                return "custom"
            elif key == ord("5"):
                return "progress"
            elif key == ord("6"):
                return "manage_custom"

    def draw_word_count_menu(self, mode: str) -> Optional[int]:
        """Draw the word count selection menu."""
        if mode == "python":
            options = [(5, "5 lines"), (10, "10 lines"), (20, "20 lines")]
            title = "How many lines of code?"
        else:
            options = [(10, "10 words"), (25, "25 words"), (50, "50 words")]
            title = "How many words?"

        while True:
            self.clear()
            height, width = self.get_dimensions()

            self.draw_centered_text(5, title, Colors.HIGHLIGHT, curses.A_BOLD)

            for i, (count, label) in enumerate(options):
                self.draw_centered_text(8 + i, f"[{i + 1}] {label}", Colors.NORMAL)

            self.draw_centered_text(13, "[Esc] Back to menu", Colors.DIM)

            self.refresh()

            key = self.get_key()
            if key == 27:  # Escape
                return None
            elif key == ord("1"):
                return options[0][0]
            elif key == ord("2"):
                return options[1][0]
            elif key == ord("3"):
                return options[2][0]

    def draw_typing_session(self, session: TypingSession):
        """Draw the typing session screen."""
        self.clear()
        height, width = self.get_dimensions()

        # Header: mode and progress
        progress_current, progress_total = session.progress
        mode_display = session.mode.replace("_", " ").title()
        header = f"{mode_display} - {progress_current}/{progress_total}"
        self.draw_text(1, 2, header, Colors.HIGHLIGHT)

        # Calculate text display area
        text_start_y = 4
        text_width = width - 4
        text_x = 2

        # Get character states and wrap text
        char_states = session.get_char_states()

        # Draw text with colors
        current_x = text_x
        current_y = text_start_y
        max_y = height - 6  # Leave room for stats

        for char, state in char_states:
            # Handle line wrapping
            if char == "\n" or current_x >= width - 2:
                current_y += 1
                current_x = text_x
                if char == "\n":
                    continue
                if current_y >= max_y:
                    break

            # Determine color
            if state == "correct":
                color = Colors.CORRECT
            elif state == "incorrect":
                color = Colors.INCORRECT
            elif state == "current":
                color = Colors.CURRENT
            else:  # pending
                color = Colors.DIM

            # Draw character
            display_char = char if char != "\n" else " "
            try:
                attr = curses.A_DIM if state == "pending" else 0
                self.stdscr.addch(current_y, current_x, display_char, curses.color_pair(color) | attr)
            except curses.error:
                pass

            current_x += 1

        # Stats bar at bottom
        stats_y = height - 2
        wpm_str = f"WPM: {session.stats.wpm:.0f}"
        acc_str = f"Accuracy: {session.stats.accuracy:.1f}%"
        time_str = f"Time: {StatsCalculator.format_time(session.stats.elapsed_time)}"

        self.draw_text(stats_y, 2, wpm_str, Colors.HIGHLIGHT)
        self.draw_text(stats_y, 20, acc_str, Colors.HIGHLIGHT)
        self.draw_text(stats_y, 42, time_str, Colors.DIM)

        # Escape hint
        self.draw_text(stats_y, width - 15, "[Esc] Cancel", Colors.DIM)

        self.refresh()

    def draw_session_summary(self, stats: SessionStats, mode: str) -> str:
        """Draw the session summary screen. Returns 'retry', 'menu', or 'quit'."""
        while True:
            self.clear()
            height, width = self.get_dimensions()

            self.draw_centered_text(3, "Session Complete!", Colors.HIGHLIGHT, curses.A_BOLD)

            summary = stats.get_summary()

            self.draw_centered_text(6, f"WPM: {summary['wpm']}", Colors.NORMAL, curses.A_BOLD)
            self.draw_centered_text(7, f"Accuracy: {summary['accuracy']}%", Colors.NORMAL)
            self.draw_centered_text(8, f"Time: {StatsCalculator.format_time(summary['elapsed_seconds'])}", Colors.DIM)

            # Problem keys
            if summary["problem_keys"]:
                self.draw_centered_text(11, "Problem Keys:", Colors.HIGHLIGHT)
                problem_str = ", ".join(
                    [f"'{k}' ({v})" for k, v in summary["problem_keys"][:5]]
                )
                self.draw_centered_text(12, problem_str, Colors.INCORRECT)

            self.draw_centered_text(15, "[r] Retry", Colors.NORMAL)
            self.draw_centered_text(16, "[m] Main Menu", Colors.NORMAL)
            self.draw_centered_text(17, "[q] Quit", Colors.NORMAL)

            self.refresh()

            key = self.get_key()
            if key == ord("r") or key == ord("R"):
                return "retry"
            elif key == ord("m") or key == ord("M") or key == 27:
                return "menu"
            elif key == ord("q") or key == ord("Q"):
                return "quit"

    def draw_progress_screen(self, stats_summary: dict, recent_sessions: list, problem_keys: list):
        """Draw the progress viewing screen."""
        while True:
            self.clear()
            height, width = self.get_dimensions()

            self.draw_centered_text(2, "=== Progress ===", Colors.HIGHLIGHT, curses.A_BOLD)

            # Overall stats
            self.draw_text(4, 2, "Overall Statistics:", Colors.NORMAL, curses.A_BOLD)
            self.draw_text(5, 4, f"Total Sessions: {stats_summary['total_sessions']}", Colors.NORMAL)
            self.draw_text(6, 4, f"Average WPM: {stats_summary['avg_wpm']}", Colors.NORMAL)
            self.draw_text(7, 4, f"Best WPM: {stats_summary['best_wpm']}", Colors.HIGHLIGHT)
            self.draw_text(8, 4, f"Average Accuracy: {stats_summary['avg_accuracy']}%", Colors.NORMAL)

            # Problem keys
            if problem_keys:
                self.draw_text(10, 2, "Problem Keys:", Colors.NORMAL, curses.A_BOLD)
                for i, pk in enumerate(problem_keys[:5]):
                    char_display = repr(pk["character"]) if pk["character"] in " \t\n" else f"'{pk['character']}'"
                    self.draw_text(11 + i, 4, f"{char_display}: {pk['error_count']} errors", Colors.INCORRECT)

            # Recent sessions
            self.draw_text(17, 2, "Recent Sessions:", Colors.NORMAL, curses.A_BOLD)
            for i, session in enumerate(recent_sessions[:5]):
                line = f"{session['mode']}: {session['wpm']:.0f} WPM, {session['accuracy']:.0f}%"
                self.draw_text(18 + i, 4, line, Colors.DIM)

            self.draw_centered_text(height - 2, "[Any key] Back to menu", Colors.DIM)

            self.refresh()

            self.get_key()
            return

    def draw_custom_text_menu(self, texts: list) -> tuple[str, Optional[str]]:
        """Draw custom text selection or management menu."""
        while True:
            self.clear()
            height, width = self.get_dimensions()

            self.draw_centered_text(2, "=== Custom Texts ===", Colors.HIGHLIGHT, curses.A_BOLD)

            if not texts:
                self.draw_centered_text(6, "No custom texts available.", Colors.DIM)
                self.draw_centered_text(8, "[a] Add new text", Colors.NORMAL)
            else:
                self.draw_text(4, 2, "Available texts:", Colors.NORMAL, curses.A_BOLD)
                for i, name in enumerate(texts[:9]):
                    self.draw_text(5 + i, 4, f"[{i + 1}] {name}", Colors.NORMAL)

                self.draw_centered_text(16, "[a] Add new text", Colors.NORMAL)

            self.draw_centered_text(17, "[Esc] Back to menu", Colors.DIM)

            self.refresh()

            key = self.get_key()
            if key == 27:  # Escape
                return ("back", None)
            elif key == ord("a") or key == ord("A"):
                return ("add", None)
            elif ord("1") <= key <= ord("9"):
                idx = key - ord("1")
                if idx < len(texts):
                    return ("select", texts[idx])

    def draw_add_custom_text(self) -> tuple[Optional[str], Optional[str]]:
        """Draw screen to add custom text. Returns (name, content) or (None, None)."""
        curses.echo()
        curses.curs_set(1)

        self.clear()
        height, width = self.get_dimensions()

        self.draw_centered_text(2, "=== Add Custom Text ===", Colors.HIGHLIGHT, curses.A_BOLD)
        self.draw_text(5, 2, "Enter a name for this text:", Colors.NORMAL)
        self.draw_text(6, 2, "> ", Colors.HIGHLIGHT)

        self.refresh()

        # Get name
        try:
            name_bytes = self.stdscr.getstr(6, 4, 50)
            name = name_bytes.decode("utf-8").strip()
        except Exception:
            curses.noecho()
            curses.curs_set(0)
            return (None, None)

        if not name:
            curses.noecho()
            curses.curs_set(0)
            return (None, None)

        self.clear()
        self.draw_centered_text(2, "=== Add Custom Text ===", Colors.HIGHLIGHT, curses.A_BOLD)
        self.draw_text(4, 2, f"Name: {name}", Colors.HIGHLIGHT)
        self.draw_text(6, 2, "Paste or type your text below.", Colors.NORMAL)
        self.draw_text(7, 2, "Press Ctrl+D or Ctrl+G when done, Esc to cancel.", Colors.DIM)
        self.draw_text(9, 2, "", Colors.NORMAL)

        self.refresh()

        # Get content - simple multi-line input
        lines = []
        current_line = ""
        y = 9

        curses.noecho()

        while True:
            key = self.get_key()

            if key == 27:  # Escape
                curses.curs_set(0)
                return (None, None)
            elif key == 4 or key == 7:  # Ctrl+D or Ctrl+G
                if current_line:
                    lines.append(current_line)
                break
            elif key == 10 or key == 13:  # Enter
                lines.append(current_line)
                current_line = ""
                y += 1
                self.draw_text(y, 2, "", Colors.NORMAL)
            elif key == 127 or key == curses.KEY_BACKSPACE:  # Backspace
                if current_line:
                    current_line = current_line[:-1]
                    self.draw_text(y, 2, current_line + " ", Colors.NORMAL)
            elif 32 <= key < 127:  # Printable characters
                current_line += chr(key)
                self.draw_text(y, 2, current_line, Colors.NORMAL)

            self.refresh()

        curses.curs_set(0)
        content = "\n".join(lines)

        if not content.strip():
            return (None, None)

        return (name, content)

    def draw_manage_custom_texts(self, texts: list) -> tuple[str, Optional[str]]:
        """Draw custom text management screen."""
        while True:
            self.clear()
            height, width = self.get_dimensions()

            self.draw_centered_text(2, "=== Manage Custom Texts ===", Colors.HIGHLIGHT, curses.A_BOLD)

            if not texts:
                self.draw_centered_text(6, "No custom texts to manage.", Colors.DIM)
            else:
                self.draw_text(4, 2, "Select a text to delete:", Colors.NORMAL, curses.A_BOLD)
                for i, name in enumerate(texts[:9]):
                    self.draw_text(5 + i, 4, f"[{i + 1}] {name}", Colors.NORMAL)

            self.draw_centered_text(16, "[a] Add new text", Colors.NORMAL)
            self.draw_centered_text(17, "[Esc] Back to menu", Colors.DIM)

            self.refresh()

            key = self.get_key()
            if key == 27:  # Escape
                return ("back", None)
            elif key == ord("a") or key == ord("A"):
                return ("add", None)
            elif ord("1") <= key <= ord("9"):
                idx = key - ord("1")
                if idx < len(texts):
                    return ("delete", texts[idx])

    def draw_confirm_delete(self, name: str) -> bool:
        """Confirm deletion of a custom text."""
        self.clear()
        height, width = self.get_dimensions()

        self.draw_centered_text(6, f"Delete '{name}'?", Colors.INCORRECT, curses.A_BOLD)
        self.draw_centered_text(9, "[y] Yes, delete", Colors.NORMAL)
        self.draw_centered_text(10, "[n] No, cancel", Colors.NORMAL)

        self.refresh()

        while True:
            key = self.get_key()
            if key == ord("y") or key == ord("Y"):
                return True
            elif key == ord("n") or key == ord("N") or key == 27:
                return False

    def show_message(self, message: str, wait: bool = True):
        """Show a temporary message."""
        self.clear()
        height, width = self.get_dimensions()
        self.draw_centered_text(height // 2, message, Colors.HIGHLIGHT)
        if wait:
            self.draw_centered_text(height // 2 + 2, "[Any key to continue]", Colors.DIM)
        self.refresh()
        if wait:
            self.get_key()
