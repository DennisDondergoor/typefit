"""Content providers for typing practice."""

from .words import WordProvider
from .sentences import SentenceProvider
from .python_code import PythonCodeProvider
from .custom import CustomTextManager

__all__ = ["WordProvider", "SentenceProvider", "PythonCodeProvider", "CustomTextManager"]
