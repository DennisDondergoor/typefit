# Typefit

A web-based typing practice app with adjustable font size and book reading mode.

## Features

- **Multiple practice modes**: Words, sentences, Python code, and books
- **Book mode**: Type through classic novels with progress tracking
- **Real-time feedback**: WPM, accuracy, and character highlighting
- **Adjustable font size**: 32-40px range
- **Statistics tracking**: Session history and problem key analysis
- **Accent tolerance**: Type 'u' for 'ü', 'i' for 'î', etc.
- **Tab support**: Press Tab to skip indentation in Python code

## Usage

Open `docs/index.html` directly in your browser (no server required).

## Controls

- **Type normally**: During practice sessions
- **Backspace**: Fix errors
- **Tab**: Skip up to 4 spaces (for Python indentation)
- **Escape**: Return to menu

## Practice Modes

1. **Words**: Common English words (~8,000 words)
2. **Sentences**: Practice with complete sentences (~3,500 sentences)
3. **Python Code**: Code snippets with special characters (~200 snippets)
4. **Books**: Type through classic and contemporary literature with progress saved per book

### Available Books

8 books ranging from 1,000 to 57,000 words (sorted by length):

**Short Stories:**
- **Printcrime** by Cory Doctorow (1,037 words)
- **Men I'm Not Married To** by Dorothy Parker (3,118 words)
- **Big Blonde** by Dorothy Parker (8,467 words)

**Novellas:**
- **When Sysadmins Ruled the Earth** by Cory Doctorow (12,755 words)
- **I, Robot** by Cory Doctorow (15,642 words)

**Novels:**
- **The Time Machine** by H.G. Wells (32,297 words)
- **Notes from the Underground** by Fyodor Dostoyevsky (44,051 words)
- **Dracula's Guest** by Bram Stoker (56,861 words)

*Cory Doctorow stories licensed under CC BY-NC-SA 2.5*

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
