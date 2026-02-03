"""Word list provider for typing practice."""

import random
from pathlib import Path


class WordProvider:
    """Provides random words for typing practice."""

    def __init__(self, data_dir: Path = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent / "data"
        self.data_dir = data_dir
        self._words = None

    def _load_words(self) -> list[str]:
        """Load words from file, filtering out any with numbers."""
        if self._words is not None:
            return self._words

        words_file = self.data_dir / "words.txt"
        if not words_file.exists():
            # Fallback word list
            self._words = [
                "the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
                "for", "not", "on", "with", "he", "as", "you", "do", "at", "this",
                "but", "his", "by", "from", "they", "we", "say", "her", "she", "or",
            ]
            return self._words

        with open(words_file, "r") as f:
            words = [line.strip() for line in f if line.strip()]

        # Filter out words containing numbers
        self._words = [w for w in words if not any(c.isdigit() for c in w)]
        return self._words

    def get_words(self, count: int) -> list[str]:
        """Get a list of random words."""
        words = self._load_words()
        return random.choices(words, k=count)

    def get_text(self, word_count: int) -> str:
        """Get words as a single string."""
        return " ".join(self.get_words(word_count))
