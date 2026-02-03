# typefit

A terminal-based touch typing practice app with accessibility-first design.

## Features

- **Multiple practice modes**: Words, sentences, Python code, and custom text
- **Real-time feedback**: See errors highlighted as you type
- **Statistics tracking**: WPM, accuracy, and problem key analysis
- **Progress history**: Track your improvement over time
- **Custom text import**: Practice with your own content

## Installation

```bash
cd /Users/dennis/projects/typefit
pip install -e .
```

## Usage

```bash
typefit
```

Or run directly:

```bash
python -m typefit
```

## Controls

- **Number keys**: Navigate menus
- **Type normally**: During practice sessions
- **Backspace**: Fix errors
- **Escape**: Return to menu
- **q**: Quit (from main menu)

## Practice Modes

1. **Words**: Random common English words
2. **Sentences**: Practice with complete sentences
3. **Python Code**: Code snippets with special characters
4. **Custom Text**: Your own imported content

## Requirements

- Python 3.8+
- Terminal with curses support (most Unix terminals, Windows Terminal)
