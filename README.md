# Typefit

A web-based, keyboard-only typing practice app with sentence, Python code, and book reading modes.

## Features

- **Multiple practice modes**: Sentences, Python code, and books
- **Book mode**: Type through classic novels with progress tracking, sorted shortest to longest
- **Real-time feedback**: WPM, accuracy, and character highlighting
- **Statistics tracking**: Session history
- **Accent tolerance**: Type 'u' for 'ü', 'i' for 'î', etc.
- **Tab support**: Press Tab to skip indentation in Python code
- **Keyboard-only**: no mouse required — the whole app is navigable and playable from the keyboard

## Usage

Run a local server (see Local Development below) and open http://localhost:8000.

## Controls

- **Type normally**: During practice sessions
- **Backspace**: Fix errors
- **Tab**: Skip up to 4 spaces (for Python indentation)
- **Escape**: Return to menu / go back
- **Arrow keys**: Navigate menus and lists

## Practice Modes

1. **Sentences**: Large collection of practice sentences
2. **Python Code**: Snippets with Python-specific characters and indentation
3. **Books**: Type through classic and contemporary literature (short stories to novels), sorted by length with progress saved per book

*Some books licensed under CC BY-NC-SA 2.5 (Cory Doctorow)*

## Local Development

```bash
python3 -m http.server 8000 -d docs
# Open http://localhost:8000
```

No build step required. Static site served from `docs/` directory.

## Cloud Sync & Security

### Firebase Configuration

The Firebase config in `docs/firebase.js` contains:
- `apiKey`, `projectId`, `authDomain`, etc.

**These are PUBLIC and safe to commit.** They are designed to be in client-side code.

### Security Model

✅ **Safe in code:**
- Firebase API keys (public identifiers)
- Project IDs and app IDs

❌ **Never in code:**
- Firebase service_role key (admin access)
- GitHub OAuth Client Secret (in Firebase Console only)

🔒 **Protection:**
- Firestore Security Rules enforce user data isolation
- Users can only read/write their own data at `users/{uid}`
- Authentication required for all database access

### Authentication

Sign in with GitHub to:
- Sync progress across devices
- Back up typing sessions to the cloud
- Access your statistics from anywhere

Progress is saved locally even without signing in.

## Tech Stack

- Vanilla JavaScript (no dependencies)
- Firebase (Firestore + Auth)
- GitHub OAuth
- Static HTML/CSS/JS

## License

Built with Claude Code
