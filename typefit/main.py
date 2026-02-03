"""Main entry point for typefit."""

import curses
import sys
from pathlib import Path

from .display import Display
from .session import TypingSession, SessionState
from .storage import Storage
from .content import WordProvider, SentenceProvider, PythonCodeProvider, CustomTextManager


class TypefitApp:
    """Main application class."""

    def __init__(self, stdscr):
        self.stdscr = stdscr
        self.display = Display(stdscr)
        self.storage = Storage()

        # Content providers
        data_dir = Path(__file__).parent.parent / "data"
        self.word_provider = WordProvider(data_dir)
        self.sentence_provider = SentenceProvider(data_dir)
        self.python_provider = PythonCodeProvider(data_dir)
        self.custom_manager = CustomTextManager(data_dir)

    def run(self):
        """Main application loop."""
        while True:
            choice = self.display.draw_main_menu()

            if choice == "quit":
                break
            elif choice == "words":
                self.run_practice_mode("words")
            elif choice == "sentences":
                self.run_practice_mode("sentences")
            elif choice == "python":
                self.run_practice_mode("python")
            elif choice == "custom":
                self.run_custom_text_mode()
            elif choice == "progress":
                self.show_progress()
            elif choice == "manage_custom":
                self.manage_custom_texts()

    def run_practice_mode(self, mode: str):
        """Run a practice session in the specified mode."""
        # Get word/line count
        count = self.display.draw_word_count_menu(mode)
        if count is None:
            return

        while True:
            # Generate text
            text = self.get_practice_text(mode, count)

            # Run the session
            result = self.run_typing_session(text, mode)

            if result == "retry":
                continue
            elif result == "menu":
                return
            elif result == "quit":
                sys.exit(0)

    def run_custom_text_mode(self):
        """Run practice with custom text."""
        texts = self.custom_manager.list_texts()
        action, name = self.display.draw_custom_text_menu(texts)

        if action == "back":
            return
        elif action == "add":
            self.add_custom_text()
            return self.run_custom_text_mode()
        elif action == "select" and name:
            text = self.custom_manager.get_text(name)
            if text:
                result = self.run_typing_session(text, "custom")
                if result == "quit":
                    sys.exit(0)

    def get_practice_text(self, mode: str, count: int) -> str:
        """Get practice text for the specified mode."""
        if mode == "words":
            return self.word_provider.get_text(count)
        elif mode == "sentences":
            return self.sentence_provider.get_word_count_text(count)
        elif mode == "python":
            return self.python_provider.get_text(count)
        return ""

    def run_typing_session(self, text: str, mode: str) -> str:
        """Run a single typing session. Returns 'retry', 'menu', or 'quit'."""
        session = TypingSession(text, mode)
        session.start()

        # Enable nodelay for real-time updates
        self.stdscr.nodelay(True)
        self.stdscr.timeout(100)  # 100ms timeout for refresh

        try:
            while session.state == SessionState.IN_PROGRESS:
                self.display.draw_typing_session(session)

                try:
                    key = self.stdscr.getch()
                except Exception:
                    continue

                if key == -1:  # No input (timeout)
                    continue
                elif key == 27:  # Escape
                    session.cancel()
                    return "menu"
                elif key == curses.KEY_BACKSPACE or key == 127 or key == 8:
                    session.process_backspace()
                elif key == 10 or key == 13:  # Enter key
                    session.process_keystroke("\n")
                elif key == 9:  # Tab - convert to spaces for code
                    for _ in range(4):
                        session.process_keystroke(" ")
                elif 32 <= key < 127:  # Printable ASCII
                    session.process_keystroke(chr(key))

        finally:
            self.stdscr.nodelay(False)
            self.stdscr.timeout(-1)

        # Session completed - save stats
        if session.state == SessionState.COMPLETED:
            summary = session.stats.get_summary()
            self.storage.save_session(
                mode=mode,
                wpm=summary["wpm"],
                accuracy=summary["accuracy"],
                word_count=session.word_count,
                raw_wpm=summary["raw_wpm"],
                elapsed_seconds=summary["elapsed_seconds"],
            )
            self.storage.update_problem_keys(session.stats.error_counts)

            return self.display.draw_session_summary(session.stats, mode)

        return "menu"

    def show_progress(self):
        """Show the progress screen."""
        stats_summary = self.storage.get_stats_summary()
        recent_sessions = self.storage.get_progress(20)
        problem_keys = self.storage.get_problem_keys(10)

        self.display.draw_progress_screen(stats_summary, recent_sessions, problem_keys)

    def manage_custom_texts(self):
        """Manage custom texts."""
        while True:
            texts = self.custom_manager.list_texts()
            action, name = self.display.draw_manage_custom_texts(texts)

            if action == "back":
                return
            elif action == "add":
                self.add_custom_text()
            elif action == "delete" and name:
                if self.display.draw_confirm_delete(name):
                    self.custom_manager.delete_text(name)
                    self.display.show_message(f"Deleted '{name}'")

    def add_custom_text(self):
        """Add a new custom text."""
        name, content = self.display.draw_add_custom_text()
        if name and content:
            if self.custom_manager.save_text(name, content):
                self.display.show_message(f"Saved '{name}'")
            else:
                self.display.show_message("Failed to save text")


def main():
    """Entry point."""
    try:
        curses.wrapper(run_app)
    except KeyboardInterrupt:
        pass


def run_app(stdscr):
    """Run the application with curses wrapper."""
    app = TypefitApp(stdscr)
    app.run()


if __name__ == "__main__":
    main()
