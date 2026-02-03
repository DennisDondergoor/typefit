"""Custom text manager for user-imported content."""

from pathlib import Path
from typing import Optional


class CustomTextManager:
    """Manages custom texts imported by the user."""

    def __init__(self, data_dir: Path = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent / "data"
        self.custom_dir = data_dir / "custom"
        self.custom_dir.mkdir(parents=True, exist_ok=True)

    def list_texts(self) -> list[str]:
        """List all available custom texts."""
        texts = []
        for f in self.custom_dir.iterdir():
            if f.is_file() and f.suffix == ".txt":
                texts.append(f.stem)
        return sorted(texts)

    def get_text(self, name: str) -> Optional[str]:
        """Get a custom text by name."""
        file_path = self.custom_dir / f"{name}.txt"
        if not file_path.exists():
            return None
        with open(file_path, "r") as f:
            return f.read().strip()

    def save_text(self, name: str, content: str) -> bool:
        """Save a custom text."""
        # Sanitize name
        safe_name = "".join(c for c in name if c.isalnum() or c in "._- ")
        safe_name = safe_name.strip()
        if not safe_name:
            return False

        file_path = self.custom_dir / f"{safe_name}.txt"
        with open(file_path, "w") as f:
            f.write(content)
        return True

    def delete_text(self, name: str) -> bool:
        """Delete a custom text."""
        file_path = self.custom_dir / f"{name}.txt"
        if file_path.exists():
            file_path.unlink()
            return True
        return False

    def import_from_file(self, file_path: str, name: str = None) -> bool:
        """Import text from an external file."""
        source = Path(file_path)
        if not source.exists():
            return False

        with open(source, "r") as f:
            content = f.read()

        if name is None:
            name = source.stem

        return self.save_text(name, content)
