"""Sentence provider for typing practice."""

import random
from pathlib import Path


class SentenceProvider:
    """Provides sentences and paragraphs for typing practice."""

    def __init__(self, data_dir: Path = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent / "data"
        self.data_dir = data_dir
        self._sentences = None

    def _load_sentences(self) -> list[str]:
        """Load sentences from file."""
        if self._sentences is not None:
            return self._sentences

        sentences_file = self.data_dir / "sentences.txt"
        if not sentences_file.exists():
            # Fallback sentences
            self._sentences = [
                "The quick brown fox jumps over the lazy dog.",
                "Pack my box with five dozen liquor jugs.",
                "How vexingly quick daft zebras jump.",
            ]
            return self._sentences

        with open(sentences_file, "r") as f:
            self._sentences = [line.strip() for line in f if line.strip()]

        return self._sentences

    def get_sentences(self, count: int) -> list[str]:
        """Get a list of random sentences."""
        sentences = self._load_sentences()
        return random.choices(sentences, k=count)

    def get_text(self, sentence_count: int) -> str:
        """Get sentences as a single string."""
        return " ".join(self.get_sentences(sentence_count))

    def get_word_count_text(self, target_words: int) -> str:
        """Get enough sentences to reach approximately target word count."""
        sentences = self._load_sentences()
        result = []
        word_count = 0

        random.shuffle(sentences := sentences.copy())

        for sentence in sentences:
            result.append(sentence)
            word_count += len(sentence.split())
            if word_count >= target_words:
                break

        # If we need more, keep adding random sentences
        while word_count < target_words:
            sentence = random.choice(self._load_sentences())
            result.append(sentence)
            word_count += len(sentence.split())

        return " ".join(result)
