"""Python code snippet provider for typing practice."""

import random
from pathlib import Path


class PythonCodeProvider:
    """Provides Python code snippets for typing practice."""

    def __init__(self, data_dir: Path = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent / "data"
        self.data_dir = data_dir
        self._snippets = None

    def _load_snippets(self) -> list[str]:
        """Load code snippets from file."""
        if self._snippets is not None:
            return self._snippets

        snippets_file = self.data_dir / "python_snippets.txt"
        if not snippets_file.exists():
            # Fallback snippets
            self._snippets = [
                'def hello():\n    print("Hello, World!")',
                "for i in range(10):\n    print(i)",
                "if x > 0:\n    return True",
            ]
            return self._snippets

        with open(snippets_file, "r") as f:
            content = f.read()

        # Split on blank lines to get individual snippets
        raw_snippets = content.split("\n\n")
        self._snippets = [s.strip() for s in raw_snippets if s.strip()]

        return self._snippets

    def get_snippets(self, count: int) -> list[str]:
        """Get a list of random code snippets."""
        snippets = self._load_snippets()
        return random.choices(snippets, k=count)

    def get_text(self, line_count: int) -> str:
        """Get enough snippets to reach approximately target line count."""
        snippets = self._load_snippets()
        result = []
        current_lines = 0

        random.shuffle(snippets := snippets.copy())

        for snippet in snippets:
            result.append(snippet)
            current_lines += snippet.count("\n") + 1
            if current_lines >= line_count:
                break

        # If we need more, keep adding random snippets
        while current_lines < line_count:
            snippet = random.choice(self._load_snippets())
            result.append(snippet)
            current_lines += snippet.count("\n") + 1

        return "\n\n".join(result)

    def get_single_snippet(self) -> str:
        """Get a single random snippet."""
        snippets = self._load_snippets()
        return random.choice(snippets)
