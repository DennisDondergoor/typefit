# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

- **Firebase project**: `typefit-new`
- **Local dev**: `python3 -m http.server 8000 -d docs` → http://localhost:8000
- **Production**: https://dennisdondergoor.github.io/typefit/
- **Firestore path**: `users/{uid}` (flat structure)
- **GitHub repo**: https://github.com/DennisDondergoor/typefit

## Development

```bash
# Serve locally
python3 -m http.server 8000 -d docs
# Open http://localhost:8000
```

No build step, no package manager, no tests. The app is a static site served from the `docs/` directory (GitHub Pages).

## Architecture

Single-page app with screen toggling (add/remove `active` class). All source is in `docs/`:

- **index.html** — All screens: menu, practice, summary, progress, book/chapter selection. Font (Source Code Pro) and size (38px) are hardcoded in CSS — no settings UI.
- **app.js** — Main application (~1,450 lines). Contains: `StorageManager` (localStorage wrapper with `_safeParseJSON` for corrupted data), `TypingSession` (single session state/logic), `TextGenerator` (practice text generation with Fisher-Yates shuffle), `App` (controller that wires everything together)
- **style.css** — All styles. Uses CSS variables in `:root` for theming — changing a variable updates everywhere
- **data.js** — `SENTENCES` and `PYTHON_SNIPPETS` arrays (large static dataset, ~315KB). Lazy-loaded via `App.loadData()` on first sentences/python practice.
- **books.js** — `BOOKS` array. Spans short stories to novels; some CC-licensed (Cory Doctorow). Large file (~1MB). Lazy-loaded via `App.loadBooks()` on first books practice.

Only `firebase.js` and `app.js` are loaded eagerly from index.html. The two large content files are pulled in on demand by injecting a `<script>` tag, so the initial page load never pays for content the user may not reach. `startPractice()` is `async` and awaits the relevant loader (toast + early return on fetch failure).
- **firebase.js** — `FirebaseSync` class (Firestore compat SDK v10, GitHub OAuth)

### Typing Engine

`TypingSession` tracks position, correctness, and timing. Position only advances on correct input. Special handling:
- Accent normalization (`u` accepted for `ü`, etc.)
- Dash matching (`-` accepted for em/en dash)
- Tab skips up to 4 consecutive spaces (Python indentation)
- WPM = `(correctChars / 5) / minutes`, paused time excluded
- `maxPosition` high-water mark ensures retyping after backspace doesn't inflate `totalTyped` or penalize accuracy

`renderText()` creates all character spans once; `updateCharDisplay(fromPos)` incrementally updates only 2-3 spans around the cursor for performance.

### Books Mode

Auto-advances to next uncompleted paragraph after each completion (no summary shown). PageUp/PageDown skip between paragraphs across chapters. Progress stored per book as `{chapter, paragraph, completed: {chapterIdx: [paragraphIdx...]}}`.

### Cloud Sync (Firebase)

- Single Firestore document per user at `users/{uid}`, saved with `{ merge: true }`
- `scheduleSave()` debounces 2 seconds; pending save flushed on page unload
- Cloud data loads only on auth state change, not on navigation
- Auth token pre-cached and refreshed after each save for reliable `flushPendingSync()` during page unload
- Merge strategy: sessions unioned by date, book progress unions completed sets, total/daily time take max

## Key Gotchas

**Firestore merge:true cannot clear nested fields.** `set(data, { merge: true })` with empty objects does NOT remove keys. Use `deleteField()` (which calls `FieldValue.delete()`). Cancel any pending debounced sync before deleting, or stale data gets re-saved.

**Three practice modes: `books`, `sentences`, `python`** (see `data-mode` buttons in index.html). `TextGenerator.getText()` routes `python`→`getPythonSnippets()` and everything else (`sentences` + `default`)→`getSentences()`. There is no word-list mode — the old `WORDS` array and `getWords()` were removed. To add one, reintroduce a data source and a `getText()` case.

**`_suppressSync` flag.** Set during cloud load to prevent the loaded data from immediately triggering a cloud save cycle.

**Large data files.** `data.js` and `books.js` are committed to the repo and served directly (no CDN needed for GitHub Pages), but loaded lazily — `loadData()` and `loadBooks()` are `typeof`-guarded mirrors that inject a `<script>` tag on first use. Don't reference `SENTENCES`/`PYTHON_SNIPPETS`/`BOOKS` before their loader has run.

**Books sorted by word count, completed last.** Books are ordered from shortest to longest to help users choose based on available time. Fully completed books (100%) sink to the bottom, within their own word-count order. Word counts are calculated and displayed in the UI.

## Deployment

Deployed via GitHub Pages from the `docs/` folder. To deploy:

```bash
git add docs/
git commit -m "Update deployment"
git push origin main
```

Changes go live automatically within ~1 minute.

## Commit Style

Short imperative subject, blank line, explanation of why. End with:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

(Adjust model name as appropriate: Claude Sonnet 4.6, Claude Opus 4.6, etc.)
