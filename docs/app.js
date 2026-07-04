// ============================================
// Storage Manager
// ============================================
class StorageManager {
    constructor() {
        this.KEYS = {
            SESSIONS: 'typefit_sessions',
            BOOK_PROGRESS: 'typefit_book_progress',
            TOTAL_TIME: 'typefit_total_time',
            DAILY_TIME: 'typefit_daily_time'
        };
    }

    _safeParseJSON(str, fallback) {
        try {
            return JSON.parse(str);
        } catch {
            return fallback;
        }
    }

    getBookProgress(bookId) {
        const progress = this.getAllBookProgress()[bookId] || { chapter: 0, paragraph: 0 };
        if (!progress.completed) {
            progress.completed = {};
        }
        return progress;
    }

    setBookProgress(bookId, chapter, paragraph) {
        const allProgress = this.getAllBookProgress();
        const existing = allProgress[bookId] || { completed: {} };
        existing.chapter = chapter;
        existing.paragraph = paragraph;
        allProgress[bookId] = existing;
        this.setAllBookProgress(allProgress);
    }

    markParagraphCompleted(bookId, chapter, paragraph) {
        const allProgress = this.getAllBookProgress();
        const existing = allProgress[bookId] || { chapter: 0, paragraph: 0, completed: {} };
        if (!existing.completed[chapter]) {
            existing.completed[chapter] = [];
        }
        if (!existing.completed[chapter].includes(paragraph)) {
            existing.completed[chapter].push(paragraph);
        }
        allProgress[bookId] = existing;
        this.setAllBookProgress(allProgress);
    }

    isParagraphCompleted(bookId, chapter, paragraph) {
        const progress = this.getBookProgress(bookId);
        return !!(progress.completed[chapter] && progress.completed[chapter].includes(paragraph));
    }

    getBookStats(book) {
        const progress = this.getBookProgress(book.id);
        let totalChars = 0;
        let completedChars = 0;

        for (let i = 0; i < book.chapters.length; i++) {
            const chapter = book.chapters[i];
            const completedParagraphs = progress.completed[i] || [];
            for (let j = 0; j < chapter.paragraphs.length; j++) {
                const paragraphLength = chapter.paragraphs[j].length;
                totalChars += paragraphLength;
                if (completedParagraphs.includes(j)) {
                    completedChars += paragraphLength;
                }
            }
        }

        return {
            currentChapter: Math.min(progress.chapter + 1, book.chapters.length),
            totalChapters: book.chapters.length,
            completedChars,
            totalChars,
            percentComplete: totalChars > 0 ? Math.round((completedChars / totalChars) * 100) : 0
        };
    }

    getSessions() {
        const data = localStorage.getItem(this.KEYS.SESSIONS);
        return data ? this._safeParseJSON(data, []) : [];
    }

    saveSession(session) {
        const sessions = this.getSessions();
        sessions.unshift(session);
        // Keep last 100 sessions
        if (sessions.length > 100) {
            sessions.pop();
        }
        localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
        // Accumulate time (never reset by clearing stats)
        const secs = session.time || 0;
        const total = this.getTotalTime() + secs;
        localStorage.setItem(this.KEYS.TOTAL_TIME, String(total));
        const daily = this.getDailyTime();
        localStorage.setItem(this.KEYS.DAILY_TIME, JSON.stringify({
            date: daily.date,
            seconds: daily.seconds + secs
        }));
    }

    _todayStr(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    getDailyTime() {
        const today = this._todayStr();
        const stored = localStorage.getItem(this.KEYS.DAILY_TIME);
        if (stored) {
            const parsed = this._safeParseJSON(stored, null);
            if (parsed && parsed.date === today && Number.isFinite(parsed.seconds)) return parsed;
        }
        // Missing, corrupted, or new day: compute from existing sessions
        const sessions = this.getSessions();
        let seconds = 0;
        for (const s of sessions) {
            if (this._todayStr(new Date(s.date)) === today) seconds += s.time || 0;
        }
        const result = { date: today, seconds };
        localStorage.setItem(this.KEYS.DAILY_TIME, JSON.stringify(result));
        return result;
    }

    getTotalTime() {
        const stored = parseInt(localStorage.getItem(this.KEYS.TOTAL_TIME), 10);
        if (Number.isFinite(stored)) return stored;
        // Missing or corrupted: recompute from existing sessions
        const total = this.getSessions().reduce((sum, s) => sum + (s.time || 0), 0);
        localStorage.setItem(this.KEYS.TOTAL_TIME, String(total));
        return total;
    }

    setSessions(sessions) {
        localStorage.setItem(this.KEYS.SESSIONS, JSON.stringify(sessions));
    }

    getAllBookProgress() {
        return this._safeParseJSON(localStorage.getItem(this.KEYS.BOOK_PROGRESS) || '{}', {});
    }

    setAllBookProgress(allProgress) {
        localStorage.setItem(this.KEYS.BOOK_PROGRESS, JSON.stringify(allProgress));
    }

    setTotalTime(seconds) {
        localStorage.setItem(this.KEYS.TOTAL_TIME, String(seconds));
    }

    setDailyTime(dailyTime) {
        localStorage.setItem(this.KEYS.DAILY_TIME, JSON.stringify(dailyTime));
    }

    clearTypingStats() {
        localStorage.removeItem(this.KEYS.SESSIONS);
    }

    getStats(sessions = this.getSessions()) {
        if (sessions.length === 0) {
            return { totalSessions: 0, avgWpm: 0, avgAccuracy: 0, bestWpm: 0 };
        }

        const totalSessions = sessions.length;
        const avgWpm = Math.round(sessions.reduce((sum, s) => sum + s.wpm, 0) / totalSessions);
        const avgAccuracy = Math.round(sessions.reduce((sum, s) => sum + s.accuracy, 0) / totalSessions);
        const bestWpm = Math.max(...sessions.map(s => s.wpm));

        return { totalSessions, avgWpm, avgAccuracy, bestWpm };
    }

}

// ============================================
// Typing Session
// ============================================
class TypingSession {
    constructor(text) {
        this.text = text;
        this.position = 0;
        this.startTime = null;
        this.endTime = null;
        this.correctChars = 0;
        this.totalTyped = 0;
        this.maxPosition = 0;
        this.lastKeyIncorrect = false;
        this.isPaused = false;
        this.pauseStartTime = null;
        this.totalPausedTime = 0;
    }

    pause() {
        if (!this.isPaused && this.startTime) {
            this.isPaused = true;
            this.pauseStartTime = Date.now();
        }
    }

    resume() {
        if (this.isPaused) {
            this.totalPausedTime += Date.now() - this.pauseStartTime;
            this.isPaused = false;
            this.pauseStartTime = null;
        }
    }

    start() {
        this.startTime = Date.now();
    }

    handleKey(key) {
        if (!this.startTime) {
            this.start();
        }

        if (this.position >= this.text.length) {
            return false;
        }

        const expected = this.text[this.position];
        // Normalize accented characters (ü→u, î→i, ô→o, etc.) and curly quotes
        const normalizedExpected = expected.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
        // Accept hyphen for em dash/en dash
        const dashMatch = (key === '-' && (expected === '\u2014' || expected === '\u2013'));
        const isCorrect = key === expected || key === normalizedExpected || dashMatch;

        // Only count toward totalTyped at new positions (not retyping after backspace)
        if (this.position >= this.maxPosition) {
            this.totalTyped++;
        }

        if (isCorrect) {
            this.correctChars++;
            this.position++;
            if (this.position > this.maxPosition) {
                this.maxPosition = this.position;
            }
            this.lastKeyIncorrect = false;

            if (this.position >= this.text.length) {
                this.endTime = Date.now();
                return true; // Session complete
            }
        } else {
            // Don't advance position on incorrect key
            this.lastKeyIncorrect = true;
        }

        return false;
    }

    handleBackspace() {
        if (this.position > 0) {
            this.position--;
            if (this.correctChars > 0) {
                this.correctChars--;
            }
            this.lastKeyIncorrect = false;
        }
    }

    handleTab() {
        if (!this.startTime) {
            this.start();
        }

        // Count consecutive spaces from current position (up to 4)
        let spacesToSkip = 0;
        for (let i = 0; i < 4 && this.position + i < this.text.length; i++) {
            if (this.text[this.position + i] === ' ') {
                spacesToSkip++;
            } else {
                break;
            }
        }

        // If no spaces to skip, treat as incorrect (don't advance)
        if (spacesToSkip === 0) {
            if (this.position >= this.maxPosition) {
                this.totalTyped++;
            }
            return false;
        }

        // Skip all the spaces — only count new positions toward totalTyped
        const newChars = Math.max(0, this.position + spacesToSkip - this.maxPosition);
        for (let i = 0; i < spacesToSkip; i++) {
            this.correctChars++;
            this.position++;
        }
        if (this.position > this.maxPosition) {
            this.maxPosition = this.position;
        }
        this.totalTyped += newChars;
        this.lastKeyIncorrect = false;

        if (this.position >= this.text.length) {
            this.endTime = Date.now();
            return true;
        }

        return false;
    }

    getStats() {
        const endTime = this.endTime || Date.now();
        const totalElapsedMs = endTime - (this.startTime || endTime);
        const elapsedMs = totalElapsedMs - this.totalPausedTime;
        const elapsedMinutes = elapsedMs / 60000;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);

        // WPM: (correct characters / 5) / minutes
        const wpm = elapsedMinutes > 0
            ? Math.round((this.correctChars / 5) / elapsedMinutes)
            : 0;

        // Accuracy: (correct / total) * 100
        const accuracy = this.totalTyped > 0
            ? Math.round((this.correctChars / this.totalTyped) * 100)
            : 100;

        return {
            wpm,
            accuracy,
            elapsedSeconds,
            totalChars: this.text.length
        };
    }

}

// ============================================
// Text Generator
// ============================================
class TextGenerator {
    static shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // Shuffle a pool and pick items until reaching approximately targetWords.
    static _selectByWordCount(pool, targetWords, joiner) {
        const shuffled = this.shuffle(pool);
        const selected = [];
        let wordCount = 0;
        for (const item of shuffled) {
            selected.push(item);
            wordCount += item.split(/\s+/).length;
            if (wordCount >= targetWords) break;
        }
        return selected.join(joiner);
    }

    static getSentences(targetWords = 25) {
        return this._selectByWordCount(SENTENCES, targetWords, ' ');
    }

    static getPythonSnippets(targetWords = 25) {
        // Filter out snippets that start with whitespace (they're continuations).
        // PYTHON_SNIPPETS is static, so compute the valid subset once.
        this._validSnippets ??= PYTHON_SNIPPETS.filter(s => s.length > 0 && !/^\s/.test(s));
        return this._selectByWordCount(this._validSnippets, targetWords, '\n\n');
    }

    static getText(mode, length) {
        return mode === 'python'
            ? this.getPythonSnippets(length)
            : this.getSentences(length);
    }
}

// ============================================
// App Controller
// ============================================
class App {
    constructor() {
        this.storage = new StorageManager();
        this.firebase = new FirebaseSync();
        this.session = null;
        this.currentMode = 'sentences';
        this.currentBook = null;
        this.bookChapter = 0;
        this.bookParagraph = 0;
        this._suppressSync = false;

        this.initElements();
        this.initEventListeners();
        this.showMenu();
        this.initFirebase();
    }

    initElements() {
        // Screens
        this.menuScreen = document.getElementById('menu-screen');
        this.practiceScreen = document.getElementById('practice-screen');
        this.summaryScreen = document.getElementById('summary-screen');
        this.progressScreen = document.getElementById('progress-screen');
        this.bookSelectionScreen = document.getElementById('book-selection-screen');
        this.chapterSelectionScreen = document.getElementById('chapter-selection-screen');
        // All screens, for showScreen() — derived from markup so it can't drift
        this.screens = document.querySelectorAll('.screen');

        // Confirm modal + toast (cached like every other element)
        this.confirmModal = document.getElementById('confirm-modal');
        this.confirmModalTitle = document.getElementById('confirm-modal-title');
        this.confirmModalSubtitle = document.getElementById('confirm-modal-subtitle');
        this.confirmYesBtn = document.getElementById('confirm-yes-btn');
        this.confirmNoBtn = document.getElementById('confirm-no-btn');
        this.toast = document.getElementById('toast');

        // Book selection elements
        this.bookList = document.getElementById('book-list');

        // Chapter selection elements
        this.chapterList = document.getElementById('chapter-list');
        this.chapterScreenTitle = document.getElementById('chapter-screen-title');

        // Chapter title in practice
        this.chapterTitle = document.getElementById('chapter-title');

        // Menu elements
        this.modeBtns = document.querySelectorAll('.mode-btn');
        this.viewProgressBtn = document.getElementById('view-progress-btn');
        this.authBtn = document.getElementById('auth-btn');
        this.syncStatus = document.getElementById('sync-status');
        this.timerDisplay = document.getElementById('timer-display');

        // Practice elements
        this.textDisplay = document.getElementById('text-display');

        // Pause elements
        this.pauseOverlay = document.getElementById('pause-overlay');
        this.resumeBtn = document.getElementById('resume-btn');
        this.quitBtn = document.getElementById('quit-btn');

        // Summary elements
        this.summaryWpm = document.getElementById('summary-wpm');
        this.summaryAccuracy = document.getElementById('summary-accuracy');
        this.summaryTime = document.getElementById('summary-time');
        this.summaryChars = document.getElementById('summary-chars');
        this.practiceAgainBtn = document.getElementById('practice-again');

        // Progress elements
        this.totalSessions = document.getElementById('total-sessions');
        this.avgWpm = document.getElementById('avg-wpm');
        this.avgAccuracy = document.getElementById('avg-accuracy');
        this.bestWpm = document.getElementById('best-wpm');
        this.sessionHistory = document.getElementById('session-history');
        this.clearDataBtn = document.getElementById('clear-data');
    }

    initEventListeners() {
        // Mode buttons
        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentMode = btn.dataset.mode;
                if (this.currentMode === 'books') {
                    this.showBookSelection();
                } else {
                    this.startPractice();
                }
            });
        });


        // View progress
        this.viewProgressBtn.addEventListener('click', () => {
            this.showProgress();
        });

        // Practice again
        this.practiceAgainBtn.addEventListener('click', () => {
            this.startPractice();
        });

        // Pause overlay buttons
        this.resumeBtn.addEventListener('click', () => {
            this.resumePractice();
        });
        this.quitBtn.addEventListener('click', () => {
            this.hidePause();
            this.showMenu();
        });

        // Clear data
        this.clearDataBtn.addEventListener('click', () => {
            this.showConfirm('Clear all typing stats?', 'Book progress will be kept.', async () => {
                this.storage.clearTypingStats();
                // Cancel any pending debounced sync so stale sessions aren't re-saved
                this.firebase.cancelPendingSync();
                await this.firebase.deleteField('sessions');
                this.showProgress();
            });
        });
        // Auth button
        this.authBtn.addEventListener('click', () => {
            if (this.firebase.isSignedIn()) {
                this.firebase.signOut();
            } else {
                this.firebase.signIn().catch((err) => {
                    this.showToast('Sign in failed. Please try again.', 4000);
                    console.error('Sign in error:', err);
                });
            }
        });

        // Keyboard-only app: block real mouse clicks everywhere. Keyboard
        // navigation activates elements via synthetic .click() calls, which
        // are untrusted events and pass through. Click listeners on elements
        // remain as the shared activation plumbing.
        document.addEventListener('click', (e) => {
            if (e.isTrusted) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);

        // Keyboard handling
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Flush pending cloud sync when page is hidden or unloading
        const flushSync = () => this.firebase.flushPendingSync();
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flushSync();
        });
        window.addEventListener('beforeunload', flushSync);
    }

    initFirebase() {
        try {
            this.firebase.init();
        } catch (e) {
            console.error('Firebase init failed:', e);
            return;
        }
        this.firebase.onSyncResult = (ok) => {
            if (!this.firebase.isSignedIn()) return;
            this.syncStatus.textContent = ok
                ? `Signed in as ${this.firebase.getUserName()}`
                : 'Sync failed — will retry';
        };
        this.firebase.onAuthChange(async (user) => {
            if (user) {
                this.authBtn.textContent = 'Sign out';
                this.syncStatus.textContent = 'Loading from cloud...';
                this._suppressSync = true;
                await this.loadFromCloud();
                this._suppressSync = false;
                this.syncToCloud();
                this.syncStatus.textContent = `Signed in as ${this.firebase.getUserName()}`;
            } else {
                this.authBtn.textContent = 'Sign in';
                this.syncStatus.textContent = '';
            }
        });
    }

    getAllData() {
        return {
            sessions: this.storage.getSessions(),
            bookProgress: this.storage.getAllBookProgress(),
            totalTime: this.storage.getTotalTime(),
            dailyTime: this.storage.getDailyTime(),
        };
    }

    // True when actively practicing a book (mode selected AND a book is loaded).
    get inBookMode() {
        return this.currentMode === 'books' && !!this.currentBook;
    }

    syncToCloud() {
        if (this._suppressSync) return;
        this.firebase.scheduleSave(() => this.getAllData());
    }

    async loadFromCloud() {
        const data = await this.firebase.loadFromCloud();
        if (!data) return;

        // Merge sessions: combine and deduplicate by date, keep newest 100
        if (data.sessions) {
            const local = this.storage.getSessions();
            const dates = new Set(local.map(s => s.date));
            for (const s of data.sessions) {
                if (!dates.has(s.date)) {
                    local.push(s);
                    dates.add(s.date);
                }
            }
            local.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.storage.setSessions(local.slice(0, 100));
        }

        // Merge book progress: union of completed paragraphs
        if (data.bookProgress) {
            const localData = this.storage.getAllBookProgress();
            for (const [bookId, cloudProgress] of Object.entries(data.bookProgress)) {
                const local = localData[bookId] || { chapter: 0, paragraph: 0, completed: {} };
                const cloud = cloudProgress || { chapter: 0, paragraph: 0, completed: {} };
                // Merge completed maps (union)
                const mergedCompleted = { ...local.completed };
                for (const [ch, paragraphs] of Object.entries(cloud.completed || {})) {
                    const existing = new Set(mergedCompleted[ch] || []);
                    for (const p of paragraphs) existing.add(p);
                    mergedCompleted[ch] = [...existing];
                }
                // Take whichever position is further in the book
                const localCh = local.chapter || 0;
                const localP = local.paragraph || 0;
                const cloudCh = cloud.chapter || 0;
                const cloudP = cloud.paragraph || 0;
                let mergedCh, mergedP;
                if (cloudCh > localCh || (cloudCh === localCh && cloudP > localP)) {
                    mergedCh = cloudCh;
                    mergedP = cloudP;
                } else {
                    mergedCh = localCh;
                    mergedP = localP;
                }
                localData[bookId] = {
                    chapter: mergedCh,
                    paragraph: mergedP,
                    completed: mergedCompleted
                };
            }
            this.storage.setAllBookProgress(localData);
        }

        // Merge total time: take max (never decrease)
        if (data.totalTime) {
            const local = this.storage.getTotalTime();
            const merged = Math.max(local, data.totalTime);
            this.storage.setTotalTime(merged);
        }

        // Merge daily time: take max for same day, keep most recent if dates differ
        if (data.dailyTime) {
            const local = this.storage.getDailyTime();
            if (data.dailyTime.date === local.date) {
                const merged = Math.max(local.seconds, data.dailyTime.seconds);
                this.storage.setDailyTime({ date: local.date, seconds: merged });
            } else if (data.dailyTime.date > local.date) {
                this.storage.setDailyTime(data.dailyTime);
            }
        }

        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        const todaySeconds = this.storage.getDailyTime().seconds;
        const totalSeconds = this.storage.getTotalTime();

        const units = (seconds) => {
            const { h, m, s } = this._hms(seconds);
            return [h > 0 ? h + 'h' : '', (h > 0 || m > 0) ? m + 'm' : '', s + 's'];
        };

        const rows = [];
        if (todaySeconds > 0) {
            const accent = todaySeconds > 600 ? ' class="timer-accent"' : '';
            const [h, m, s] = units(todaySeconds);
            rows.push(`<span class="timer-label">Today:</span><span class="timer-unit"${accent}>${h}</span><span class="timer-unit"${accent}>${m}</span><span class="timer-unit"${accent}>${s}</span>`);
        }
        if (totalSeconds > 0) {
            const [h, m, s] = units(totalSeconds);
            rows.push(`<span class="timer-label">Total:</span><span class="timer-unit">${h}</span><span class="timer-unit">${m}</span><span class="timer-unit">${s}</span>`);
        }
        this.timerDisplay.innerHTML = rows.join('');
    }

    showScreen(screen) {
        this.screens.forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    showMenu() {
        this.session = null;
        this.updateTimerDisplay();
        this.showScreen(this.menuScreen);
        // Two nav rows: the mode buttons, then the footer (progress + sign in).
        // Start the highlight on the current mode's button.
        const modeBtns = [...this.modeBtns];
        const modeIndex = modeBtns.findIndex(btn => btn.dataset.mode === this.currentMode);
        this._initKeyNav([modeBtns, [this.viewProgressBtn, this.authBtn]], { startCol: Math.max(0, modeIndex) });
    }

    updateChapterTitle(chapter, chapterIndex, paragraphIndex) {
        const total = chapter.paragraphs.length;
        const isCompleted = this.storage.isParagraphCompleted(this.currentBook.id, chapterIndex, paragraphIndex);
        const completedHtml = isCompleted ? ' <span class="completed-mark">(Completed)</span>' : '';
        this.chapterTitle.innerHTML = `Chapter ${chapter.number}: ${this.escapeHtml(chapter.title)} • Paragraph ${paragraphIndex + 1} of ${total}${completedHtml}`;
        this.textDisplay.classList.toggle('already-completed', isCompleted);
    }

    pausePractice() {
        if (this.session) {
            this.session.pause();
            this.pauseOverlay.classList.remove('hidden');
            // Arrow keys + Enter drive the overlay buttons; start on Resume
            this._initKeyNav([[this.resumeBtn, this.quitBtn]]);
        }
    }

    resumePractice() {
        if (this.session) {
            this.session.resume();
            this.pauseOverlay.classList.add('hidden');
        }
    }

    hidePause() {
        this.pauseOverlay.classList.add('hidden');
    }

    isParagraphEmpty(text) {
        return !text || text.trim() === '';
    }

    showBookComplete() {
        this.showToast('Congratulations! You have completed the entire book!', 5000);
        this.showBookSelection();
    }

    async startPractice() {
        let text;

        if (this.inBookMode) {
            // Load book progress (clamp to valid bounds in case of corrupted data)
            const progress = this.storage.getBookProgress(this.currentBook.id);
            this.bookChapter = Math.max(0, Math.min(progress.chapter || 0, this.currentBook.chapters.length));
            this.bookParagraph = Math.max(0, progress.paragraph || 0);
            const currentChapter = this.currentBook.chapters[this.bookChapter];
            if (currentChapter) {
                this.bookParagraph = Math.min(this.bookParagraph, currentChapter.paragraphs.length - 1);
            }

            // Check if book is complete
            if (this.bookChapter >= this.currentBook.chapters.length) {
                const next = this.findNextUncompleted(0, -1);
                if (next.chapter >= this.currentBook.chapters.length) {
                    this.showBookComplete();
                    return;
                }
                this.bookChapter = next.chapter;
                this.bookParagraph = next.paragraph;
                this.storage.setBookProgress(this.currentBook.id, next.chapter, next.paragraph);
                this.syncToCloud();
            }

            // Get current paragraph (skip empty ones)
            let chapter = this.currentBook.chapters[this.bookChapter];
            text = chapter.paragraphs[this.bookParagraph];
            let skippedEmpty = false;
            while (this.isParagraphEmpty(text)) {
                skippedEmpty = true;
                this.storage.markParagraphCompleted(this.currentBook.id, this.bookChapter, this.bookParagraph);
                const next = this.findNextUncompleted(this.bookChapter, this.bookParagraph);
                if (next.chapter >= this.currentBook.chapters.length) {
                    this.syncToCloud();
                    this.showBookComplete();
                    return;
                }
                this.bookChapter = next.chapter;
                this.bookParagraph = next.paragraph;
                this.storage.setBookProgress(this.currentBook.id, next.chapter, next.paragraph);
                chapter = this.currentBook.chapters[this.bookChapter];
                text = chapter.paragraphs[this.bookParagraph];
            }
            // Persist progress advanced by skipping, like skipParagraph/endSession do
            if (skippedEmpty) {
                this.syncToCloud();
            }

            // Show chapter title with paragraph info
            this.updateChapterTitle(chapter, this.bookChapter, this.bookParagraph);
            this.chapterTitle.classList.remove('hidden');
        } else {
            this.chapterTitle.classList.add('hidden');
            this.textDisplay.classList.remove('already-completed');
            try {
                await this.loadData();
            } catch (err) {
                console.error('Failed to load practice data:', err);
                this.showToast('Failed to load practice content.', 4000);
                return;
            }
            text = TextGenerator.getText(this.currentMode, 10);
        }

        // Strip Gutenberg _italic_ markers from book text
        if (this.inBookMode) {
            text = this.stripGutenbergItalics(text);
        }

        this.session = new TypingSession(text);
        this.renderText();
        this.showScreen(this.practiceScreen);
        // Position cursor and scroll indicator after screen is visible (getBoundingClientRect needs layout)
        this.updateCursorPosition();
        this.updateScrollIndicator();
    }

    renderText() {
        if (!this.session) return;

        // Build all spans once
        const text = this.session.text;
        this.textDisplay.innerHTML = text.split('').map((char, i) => {
            let displayChar = char;
            let extraClass = '';
            if (char === '\n') {
                displayChar = '\u21b5\n';
                extraClass = ' newline';
            } else if (char === '\t') {
                displayChar = '    ';
            }
            const state = i === 0 ? 'current' : 'pending';
            return `<span class="char ${state}${extraClass}">${this.escapeHtml(displayChar)}</span>`;
        }).join('');

        // Store span references for fast updates
        this.charSpans = this.textDisplay.querySelectorAll('.char');

        // Create cursor element
        if (!this.cursorEl) {
            this.cursorEl = document.createElement('div');
            this.cursorEl.className = 'typing-cursor';
        }
        // Disable transition so cursor snaps to initial position
        this.cursorEl.style.transition = 'none';
        this.textDisplay.appendChild(this.cursorEl);

        // Set up scroll indicator (lives outside text-display in the wrapper)
        if (!this.scrollIndicator) {
            this.scrollIndicator = document.getElementById('scroll-indicator');
            this.scrollThumb = this.scrollIndicator.querySelector('.scroll-indicator-thumb');
            this.textDisplay.addEventListener('scroll', () => this.updateScrollIndicator());
        }

        // Reset scroll to top for new text
        this.textDisplay.scrollTop = 0;

        // Position cursor on first character, then restore transition
        this.updateCursorPosition();
        // Force reflow before restoring transition
        this.cursorEl.offsetHeight;
        this.cursorEl.style.transition = '';
    }

    updateCharDisplay(fromPos = null) {
        if (!this.session || !this.charSpans) return;

        const pos = this.session.position;
        const lastIncorrect = this.session.lastKeyIncorrect;

        // Update from specified position (or pos-1) to current position +1
        const start = fromPos !== null ? fromPos : Math.max(0, pos - 1);
        const end = Math.min(pos + 1, this.charSpans.length - 1);

        for (let i = start; i <= end; i++) {
            const span = this.charSpans[i];
            span.classList.remove('correct', 'incorrect', 'current', 'pending');

            if (i < pos) {
                span.classList.add('correct');
            } else if (i === pos) {
                span.classList.add(lastIncorrect ? 'incorrect' : 'current');
            } else {
                span.classList.add('pending');
            }
        }

        // Measure the cursor span + container once and reuse for both cursor
        // positioning and the scroll-into-view check (avoids a double reflow).
        const container = this.textDisplay;
        const cursorSpan = this.charSpans[Math.min(pos, this.charSpans.length - 1)];
        if (!cursorSpan) {
            this.updateCursorPosition();
            return;
        }
        const containerRect = container.getBoundingClientRect();
        const spanRect = cursorSpan.getBoundingClientRect();

        // Cursor's content-coordinate top is invariant to the scrollTop write below,
        // so positioning it with the pre-scroll rects is safe.
        this.updateCursorPosition(spanRect, containerRect);

        // Scroll current character + cursor underline into view (only when pos is a
        // real character; at end-of-text charSpans[pos] is undefined → nothing to do).
        if (pos < this.charSpans.length) {
            const cursorBottom = spanRect.bottom + 3; // 3px cursor underline
            if (spanRect.top < containerRect.top) {
                container.scrollTop += spanRect.top - containerRect.top;
            } else if (cursorBottom > containerRect.bottom) {
                container.scrollTop += cursorBottom - containerRect.bottom;
            }
        }
    }

    updateCursorPosition(spanRect = null, containerRect = null) {
        if (!this.cursorEl || !this.charSpans) return;
        const pos = this.session ? this.session.position : 0;
        const span = this.charSpans[Math.min(pos, this.charSpans.length - 1)];
        if (!span) return;
        const container = this.textDisplay;
        spanRect ??= span.getBoundingClientRect();
        containerRect ??= container.getBoundingClientRect();
        this.cursorEl.style.left = (spanRect.left - containerRect.left + container.scrollLeft) + 'px';
        this.cursorEl.style.top = (spanRect.top - containerRect.top + container.scrollTop + spanRect.height) + 'px';
        this.cursorEl.style.width = spanRect.width + 'px';
    }

    updateScrollIndicator() {
        if (!this.scrollIndicator) return;
        const el = this.textDisplay;
        const hasOverflow = el.scrollHeight > el.clientHeight + 1;
        this.scrollIndicator.classList.toggle('hidden', !hasOverflow);
        if (!hasOverflow) return;
        const trackHeight = this.scrollIndicator.clientHeight;
        const thumbRatio = el.clientHeight / el.scrollHeight;
        const thumbHeight = Math.max(12, trackHeight * thumbRatio);
        const scrollableHeight = el.scrollHeight - el.clientHeight;
        const scrollRatio = scrollableHeight > 0 ? el.scrollTop / scrollableHeight : 0;
        const thumbTop = scrollRatio * (trackHeight - thumbHeight);
        this.scrollThumb.style.height = thumbHeight + 'px';
        this.scrollThumb.style.top = thumbTop + 'px';
    }

    escapeHtml(text) {
        // Pure-string escape (no DOM round-trip) — renderText calls this once per
        // character, so a textContent/innerHTML bounce per char is wasteful.
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    stripGutenbergItalics(text) {
        // Remove Gutenberg Project _italic_ markers (but not __bold__ with double underscores)
        return text.replace(/(?<![_])_([^_]+)_(?![_])/g, '$1');
    }

    showConfirm(message, subtitle, onConfirm) {
        const modal = this.confirmModal;
        const title = this.confirmModalTitle;
        const sub = this.confirmModalSubtitle;
        const yesBtn = this.confirmYesBtn;
        const noBtn = this.confirmNoBtn;
        title.textContent = message;
        sub.textContent = subtitle || '';
        sub.style.display = (subtitle && subtitle.trim()) ? '' : 'none';
        modal.classList.remove('hidden');
        // Left/Right + Enter drive the modal buttons; start on Cancel for
        // safety. Snapshot the underlying screen's nav state for restore.
        const savedNav = {
            rows: this._navRows,
            row: this._navRow,
            col: this._navCol,
            container: this._navContainer
        };
        this._initKeyNav([[yesBtn, noBtn]], { startCol: 1 });

        // Abort removes BOTH listeners on close — { once: true } would leave the
        // other button's listener attached, firing a stale callback next time.
        const controller = new AbortController();
        const close = () => {
            modal.classList.add('hidden');
            controller.abort();
            // Put keyboard nav back on the screen under the modal
            if (savedNav.rows) {
                this._initKeyNav(savedNav.rows, {
                    startRow: savedNav.row,
                    startCol: savedNav.col,
                    scrollContainer: savedNav.container
                });
            }
        };
        yesBtn.addEventListener('click', () => {
            close();
            onConfirm();
        }, { signal: controller.signal });
        noBtn.addEventListener('click', close, { signal: controller.signal });
    }

    showToast(message, duration = 3000) {
        const toast = this.toast;
        toast.textContent = message;
        toast.classList.remove('hidden', 'fade-out');
        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, duration);
    }


    handleKeyDown(e) {
        // Confirm modal captures all keys while open
        if (!this.confirmModal.classList.contains('hidden')) {
            if (e.key === 'Escape') {
                this.confirmNoBtn.click();
            } else {
                this.handleNavKey(e);
            }
            return;
        }

        // Handle Escape for navigation screens
        if (e.key === 'Escape') {
            if (this.progressScreen.classList.contains('active')) {
                this.showMenu();
                return;
            }
            if (this.chapterSelectionScreen.classList.contains('active')) {
                this.showBookSelection();
                return;
            }
            if (this.bookSelectionScreen.classList.contains('active')) {
                this.showMenu();
                return;
            }
            if (this.summaryScreen.classList.contains('active')) {
                if (this.inBookMode) {
                    this.showChapterSelection();
                } else {
                    this.showMenu();
                }
                return;
            }
        }

        // Arrow-key navigation on menu, summary, progress, and book/chapter
        // selection screens
        if (this.menuScreen.classList.contains('active') ||
            this.summaryScreen.classList.contains('active') ||
            this.progressScreen.classList.contains('active') ||
            this.bookSelectionScreen.classList.contains('active') ||
            this.chapterSelectionScreen.classList.contains('active')) {
            this.handleNavKey(e);
            return;
        }

        // Only handle keys during practice
        if (!this.session || !this.practiceScreen.classList.contains('active')) {
            return;
        }

        // If the pause overlay is up: Space always resumes, Escape quits,
        // arrows + Enter drive the Resume/Quit buttons. Check the overlay, not
        // session.isPaused — pausing before the first keystroke shows the
        // overlay without the session clock having started.
        if (!this.pauseOverlay.classList.contains('hidden')) {
            e.preventDefault();
            if (e.key === 'Escape') {
                this.hidePause();
                this.showMenu();
            } else if (e.key === ' ') {
                this.resumePractice();
            } else {
                this.handleNavKey(e);
            }
            return;
        }

        // Escape to pause
        if (e.key === 'Escape') {
            e.preventDefault();
            this.pausePractice();
            return;
        }

        // Paragraph navigation for books mode
        if (this.inBookMode) {
            const dir = e.key === 'PageDown' ? 1 : e.key === 'PageUp' ? -1 : 0;
            if (dir) {
                e.preventDefault();
                this.skipParagraph(dir);
                return;
            }
        }

        // Backspace
        if (e.key === 'Backspace') {
            e.preventDefault();
            this.session.handleBackspace();
            this.updateCharDisplay();
            return;
        }

        // Ignore modifier keys alone
        if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
            return;
        }

        // Ignore key combinations (except Shift)
        if (e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }

        // Handle Tab - skip up to 4 spaces
        if (e.key === 'Tab') {
            e.preventDefault();
            const oldPos = this.session.position;
            const complete = this.session.handleTab();
            this.updateCharDisplay(oldPos);
            if (complete) {
                this.endSession();
            }
            return;
        }

        // Handle Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            const complete = this.session.handleKey('\n');
            this.updateCharDisplay();
            if (complete) {
                this.endSession();
            }
            return;
        }

        // Handle regular characters
        if (e.key.length === 1) {
            e.preventDefault();
            const complete = this.session.handleKey(e.key);
            this.updateCharDisplay();
            if (complete) {
                this.endSession();
            }
        }
    }

    skipParagraph(direction) {
        if (!this.currentBook) return;

        let newParagraph = this.bookParagraph;
        let newChapter = this.bookChapter;
        const step = direction > 0 ? 1 : -1;
        const maxSteps = 1000;

        for (let i = 0; i < maxSteps; i++) {
            newParagraph += step;
            const currentChapterData = this.currentBook.chapters[newChapter];

            // Handle chapter boundaries
            if (newParagraph < 0) {
                if (newChapter > 0) {
                    newChapter--;
                    newParagraph = this.currentBook.chapters[newChapter].paragraphs.length - 1;
                } else {
                    return; // Already at first paragraph of first chapter
                }
            } else if (newParagraph >= currentChapterData.paragraphs.length) {
                if (newChapter < this.currentBook.chapters.length - 1) {
                    newChapter++;
                    newParagraph = 0;
                } else {
                    return; // Already at last paragraph of last chapter
                }
            }

            const text = this.currentBook.chapters[newChapter].paragraphs[newParagraph];

            // Skip empty paragraphs silently
            if (this.isParagraphEmpty(text)) {
                this.storage.markParagraphCompleted(this.currentBook.id, newChapter, newParagraph);
                this.storage.setBookProgress(this.currentBook.id, newChapter, newParagraph);
                continue;
            }

            // Found a valid paragraph
            this.bookChapter = newChapter;
            this.bookParagraph = newParagraph;
            this.storage.setBookProgress(this.currentBook.id, newChapter, newParagraph);
            this.syncToCloud();

            const newChapterData = this.currentBook.chapters[newChapter];
            this.session = new TypingSession(this.stripGutenbergItalics(text));
            this.updateChapterTitle(newChapterData, newChapter, newParagraph);
            this.renderText();
            this.updateScrollIndicator();
            return;
        }
    }

    endSession() {
        if (!this.session) return;
        const stats = this.session.getStats();

        // Save session
        const sessionData = {
            mode: this.currentMode,
            wpm: stats.wpm,
            accuracy: stats.accuracy,
            time: stats.elapsedSeconds,
            chars: stats.totalChars,
            date: new Date().toISOString()
        };
        this.storage.saveSession(sessionData);

        // Advance book progress if in books mode
        if (this.inBookMode) {
            // Mark current paragraph as completed
            this.storage.markParagraphCompleted(this.currentBook.id, this.bookChapter, this.bookParagraph);

            // Find next uncompleted paragraph
            const next = this.findNextUncompleted(this.bookChapter, this.bookParagraph);
            this.bookChapter = next.chapter;
            this.bookParagraph = next.paragraph;
            this.storage.setBookProgress(this.currentBook.id, this.bookChapter, this.bookParagraph);

            // Auto-advance to next paragraph, or celebrate book completion
            this.syncToCloud();
            if (this.bookChapter < this.currentBook.chapters.length) {
                this.startPractice();
                return;
            }
            this.showBookComplete();
            return;
        }

        this.syncToCloud();

        // Show summary
        this.showSummary(stats);
    }

    showSummary(stats) {
        this.summaryWpm.textContent = stats.wpm;
        this.summaryAccuracy.textContent = `${stats.accuracy}%`;
        this.summaryTime.textContent = this.formatTime(stats.elapsedSeconds);
        this.summaryChars.textContent = stats.totalChars;

        this.showScreen(this.summaryScreen);
        this._initKeyNav([[this.practiceAgainBtn]]);
    }

    // Stored mode values → display labels ('python' is stored in existing
    // session data, but the menu calls it "Code").
    _modeLabel(mode) {
        const labels = { books: 'Books', sentences: 'Sentences', python: 'Code' };
        return labels[mode] || mode;
    }

    showProgress() {
        const sessions = this.storage.getSessions();
        const stats = this.storage.getStats(sessions);

        // Overview stats
        this.totalSessions.textContent = stats.totalSessions;
        this.avgWpm.textContent = stats.avgWpm || '--';
        this.avgAccuracy.textContent = stats.avgAccuracy ? `${stats.avgAccuracy}%` : '--';
        this.bestWpm.textContent = stats.bestWpm || '--';

        // Session history
        if (sessions.length > 0) {
            this.sessionHistory.innerHTML = sessions.slice(0, 20).map(session => `
                <div class="session-item">
                    <div>
                        <span class="session-mode">${this.escapeHtml(this._modeLabel(session.mode))}</span>
                        <span class="session-date">${this.formatDate(session.date)}</span>
                    </div>
                    <div class="session-stats">
                        <span>${session.wpm} WPM</span>
                        <span>${session.accuracy}%</span>
                    </div>
                </div>
            `).join('');
        } else {
            this.sessionHistory.innerHTML = '<p class="empty-state">No sessions yet. Start practicing!</p>';
        }

        this.showScreen(this.progressScreen);
        // Clear button reachable by keyboard, but its danger highlight only
        // appears after the first arrow press
        this._initKeyNav([[this.clearDataBtn]], { startRow: -1 });
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async loadBooks() {
        if (typeof BOOKS === 'undefined') await this._loadScript('books.js');
    }

    async loadData() {
        if (typeof SENTENCES === 'undefined') await this._loadScript('data.js');
    }

    // Total word count for a book. BOOKS is static, so compute once and cache by id.
    _bookWordCount(book) {
        this._wordCounts ??= new Map();
        let count = this._wordCounts.get(book.id);
        if (count === undefined) {
            count = book.chapters.reduce((sum, ch) =>
                sum + ch.paragraphs.reduce((pSum, p) => pSum + p.split(/\s+/).length, 0), 0);
            this._wordCounts.set(book.id, count);
        }
        return count;
    }

    // Set up arrow-key navigation over a grid of elements (rows of columns):
    // Up/Down move between rows, Left/Right within a row, Enter activates.
    // Must run after showScreen() — scrolling the highlight into view needs layout.
    _initKeyNav(rows, { startRow = 0, startCol = 0, scrollContainer = null } = {}) {
        // Clear the previous group's highlight — menu/pause/modal elements
        // persist in the DOM across screen switches, so it would go stale
        if (this._navRows && this._navRow >= 0) {
            this._navRows[this._navRow][this._navCol].classList.remove('selected');
        }
        this._navRows = rows.filter(row => row.length > 0);
        this._navContainer = scrollContainer;
        this._navRow = -1;
        this._navCol = 0;
        // startRow -1 = nothing highlighted until the first arrow press
        if (startRow >= 0) {
            this._selectNav(startRow, startCol);
        }
    }

    // Single-column card list (book/chapter selection)
    _initListNav(container, startIndex = 0) {
        const cards = [...container.querySelectorAll('.book-card, .chapter-card')];
        this._initKeyNav(cards.map(card => [card]), { startRow: startIndex, scrollContainer: container });
    }

    _selectNav(row, col) {
        if (this._navRows.length === 0) return;
        const r = Math.max(0, Math.min(row, this._navRows.length - 1));
        const c = Math.max(0, Math.min(col, this._navRows[r].length - 1));
        if (this._navRow >= 0) {
            this._navRows[this._navRow][this._navCol].classList.remove('selected');
        }
        this._navRow = r;
        this._navCol = c;
        const el = this._navRows[r][c];
        el.classList.add('selected');
        this._scrollNavIntoView(el);
    }

    _scrollNavIntoView(el) {
        const rect = el.getBoundingClientRect();
        const margin = 8;
        const container = this._navContainer;
        if (container && container.scrollHeight > container.clientHeight + 1) {
            // Scrollable list (chapters): adjust the container's own scrollTop —
            // scrollIntoView() would scroll the whole page.
            const cRect = container.getBoundingClientRect();
            if (rect.top < cRect.top) {
                container.scrollTop += rect.top - cRect.top - margin;
            } else if (rect.bottom > cRect.bottom) {
                container.scrollTop += rect.bottom - cRect.bottom + margin;
            }
        } else {
            // Everything else scrolls at page level (no-op when already visible)
            if (rect.top < 0) {
                window.scrollBy(0, rect.top - margin);
            } else if (rect.bottom > window.innerHeight) {
                window.scrollBy(0, rect.bottom - window.innerHeight + margin);
            }
        }
    }

    handleNavKey(e) {
        const dRow = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
        const dCol = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (dRow || dCol) {
            e.preventDefault();
            this._selectNav(this._navRow + dRow, this._navCol + dCol);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (this._navRow >= 0) {
                // Reuse the element's click handler so keyboard and mouse
                // selection go through the same path
                this._navRows[this._navRow][this._navCol].click();
            }
        }
    }

    async showBookSelection() {
        try {
            await this.loadBooks();
        } catch (err) {
            console.error('Failed to load books:', err);
            this.bookList.innerHTML = '<p class="empty-state">Failed to load books.</p>';
            this.showScreen(this.bookSelectionScreen);
            this._initListNav(this.bookList);
            return;
        }
        // Render book cards — completed books sink to the bottom, preserving word-count order within each group
        const statsByBook = new Map(BOOKS.map(book => [book.id, this.storage.getBookStats(book)]));
        const sortedBooks = [...BOOKS].sort((a, b) => {
            const aComplete = statsByBook.get(a.id).percentComplete === 100;
            const bComplete = statsByBook.get(b.id).percentComplete === 100;
            return aComplete - bComplete;
        });
        this.bookList.innerHTML = sortedBooks.map(book => {
            const stats = statsByBook.get(book.id);
            const totalWords = this._bookWordCount(book);

            return `
                <div class="book-card" data-book-id="${book.id}">
                    <div class="book-info">
                        <h3>${this.escapeHtml(book.title)} (${book.year})</h3>
                        <p class="book-author">${this.escapeHtml(book.author)}</p>
                        <div class="book-progress">
                            <div class="book-progress-bar">
                                <div class="book-progress-fill" style="width: ${stats.percentComplete}%"></div>
                            </div>
                            <span>${stats.percentComplete}%</span>
                        </div>
                    </div>
                    <div class="book-stats">
                        <span class="chapters">${stats.totalChapters} chapters</span>
                        <span class="words">${totalWords.toLocaleString()} words</span>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        this.bookList.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('click', () => {
                const bookId = card.dataset.bookId;
                this.selectBook(bookId);
            });
        });

        this.showScreen(this.bookSelectionScreen);
        // Start on the first card — incomplete books sort before completed ones
        this._initListNav(this.bookList);
    }

    selectBook(bookId) {
        this.currentBook = BOOKS.find(b => b.id === bookId);
        if (this.currentBook) {
            this.showChapterSelection();
        }
    }

    showChapterSelection() {
        if (!this.currentBook) return;

        this.chapterScreenTitle.textContent = `${this.currentBook.title} (${this.currentBook.year})`;
        const progress = this.storage.getBookProgress(this.currentBook.id);

        this.chapterList.innerHTML = this.currentBook.chapters.map((chapter, index) => {
            const paragraphCount = chapter.paragraphs.length;
            const completedInChapter = progress.completed[index] || [];
            const completedCount = completedInChapter.length;
            const isCurrent = index === progress.chapter;
            const isCompleted = completedCount === paragraphCount;

            let statusText;
            let statusClass = '';
            if (isCompleted) {
                statusText = 'Completed';
            } else if (completedCount > 0 || isCurrent) {
                statusText = `${completedCount}/${paragraphCount} paragraphs`;
                statusClass = 'in-progress';
            } else {
                statusText = `${paragraphCount} paragraphs`;
            }

            const cardClass = isCompleted ? 'completed' : ((completedCount > 0 || isCurrent) ? 'current' : '');

            return `
                <div class="chapter-card ${cardClass}" data-chapter-index="${index}">
                    <div class="chapter-info">
                        <span class="chapter-number">Ch. ${chapter.number}</span>
                        <h4>${this.escapeHtml(chapter.title)}</h4>
                    </div>
                    <span class="chapter-status ${statusClass}">${statusText}</span>
                </div>
            `;
        }).join('');

        // Add click handlers
        this.chapterList.querySelectorAll('.chapter-card').forEach(card => {
            card.addEventListener('click', () => {
                const chapterIndex = parseInt(card.dataset.chapterIndex);
                this.selectChapter(chapterIndex);
            });
        });

        this.showScreen(this.chapterSelectionScreen);
        // Start on the current chapter (clamped: progress.chapter can be one
        // past the end when the book is complete)
        const startIndex = Math.min(progress.chapter || 0, this.currentBook.chapters.length - 1);
        this._initListNav(this.chapterList, Math.max(0, startIndex));
    }

    selectChapter(chapterIndex) {
        if (!this.currentBook) return;

        // Find first uncompleted paragraph in this chapter
        const next = this.findNextUncompleted(chapterIndex, -1);
        // If all paragraphs in this chapter are done, start at paragraph 0 anyway
        if (next.chapter !== chapterIndex) {
            this.storage.setBookProgress(this.currentBook.id, chapterIndex, 0);
        } else {
            this.storage.setBookProgress(this.currentBook.id, next.chapter, next.paragraph);
        }
        this.syncToCloud();
        this.startPractice();
    }

    findNextUncompleted(fromChapter, fromParagraph) {
        if (!this.currentBook) return { chapter: 0, paragraph: 0 };
        // Read progress once to avoid repeated localStorage reads
        const progress = this.storage.getBookProgress(this.currentBook.id);
        // Search from the given position forward
        for (let c = fromChapter; c < this.currentBook.chapters.length; c++) {
            const startP = (c === fromChapter) ? fromParagraph + 1 : 0;
            const chapter = this.currentBook.chapters[c];
            const completedInChapter = progress.completed[c] || [];
            for (let p = startP; p < chapter.paragraphs.length; p++) {
                if (!completedInChapter.includes(p)) {
                    return { chapter: c, paragraph: p };
                }
            }
        }
        // All done — return end position
        return { chapter: this.currentBook.chapters.length, paragraph: 0 };
    }

    // Split seconds into whole hours/minutes/seconds.
    _hms(seconds) {
        return {
            h: Math.floor(seconds / 3600),
            m: Math.floor((seconds % 3600) / 60),
            s: seconds % 60
        };
    }

    formatTime(seconds) {
        const { h, m, s } = this._hms(seconds);
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Initialize the app
const app = new App();
