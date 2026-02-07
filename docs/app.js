// ============================================
// Storage Manager
// ============================================
class StorageManager {
    constructor() {
        this.KEYS = {
            SESSIONS: 'typefit_sessions',
            FONT_SIZE: 'typefit_font_size',
            FONT_FAMILY: 'typefit_font_family',
            BOOK_PROGRESS: 'typefit_book_progress',
            TOTAL_TIME: 'typefit_total_time',
            DAILY_TIME: 'typefit_daily_time'
        };
    }

    getBookProgress(bookId) {
        const data = localStorage.getItem(this.KEYS.BOOK_PROGRESS);
        const allProgress = data ? JSON.parse(data) : {};
        const progress = allProgress[bookId] || { chapter: 0, paragraph: 0 };
        if (!progress.completed) {
            progress.completed = {};
        }
        return progress;
    }

    setBookProgress(bookId, chapter, paragraph) {
        const data = localStorage.getItem(this.KEYS.BOOK_PROGRESS);
        const allProgress = data ? JSON.parse(data) : {};
        const existing = allProgress[bookId] || { completed: {} };
        existing.chapter = chapter;
        existing.paragraph = paragraph;
        allProgress[bookId] = existing;
        localStorage.setItem(this.KEYS.BOOK_PROGRESS, JSON.stringify(allProgress));
    }

    markParagraphCompleted(bookId, chapter, paragraph) {
        const data = localStorage.getItem(this.KEYS.BOOK_PROGRESS);
        const allProgress = data ? JSON.parse(data) : {};
        const existing = allProgress[bookId] || { chapter: 0, paragraph: 0, completed: {} };
        if (!existing.completed[chapter]) {
            existing.completed[chapter] = [];
        }
        if (!existing.completed[chapter].includes(paragraph)) {
            existing.completed[chapter].push(paragraph);
        }
        allProgress[bookId] = existing;
        localStorage.setItem(this.KEYS.BOOK_PROGRESS, JSON.stringify(allProgress));
    }

    isParagraphCompleted(bookId, chapter, paragraph) {
        const progress = this.getBookProgress(bookId);
        return !!(progress.completed[chapter] && progress.completed[chapter].includes(paragraph));
    }

    getChapterCompletedCount(bookId, chapterIndex) {
        const progress = this.getBookProgress(bookId);
        const completed = progress.completed[chapterIndex];
        return completed ? completed.length : 0;
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
        return data ? JSON.parse(data) : [];
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

    _todayStr() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    getDailyTime() {
        const today = this._todayStr();
        const stored = localStorage.getItem(this.KEYS.DAILY_TIME);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.date === today) return parsed;
        }
        // Migration or new day: compute from existing sessions
        const sessions = this.getSessions();
        let seconds = 0;
        for (const s of sessions) {
            const d = new Date(s.date);
            const sLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (sLocal === today) seconds += s.time || 0;
        }
        const result = { date: today, seconds };
        localStorage.setItem(this.KEYS.DAILY_TIME, JSON.stringify(result));
        return result;
    }

    getTotalTime() {
        const stored = localStorage.getItem(this.KEYS.TOTAL_TIME);
        if (stored !== null) return parseInt(stored, 10);
        // Migration: compute from existing sessions
        const total = this.getSessions().reduce((sum, s) => sum + (s.time || 0), 0);
        localStorage.setItem(this.KEYS.TOTAL_TIME, String(total));
        return total;
    }

    getFontSize() {
        return parseInt(localStorage.getItem(this.KEYS.FONT_SIZE)) || 36;
    }

    setFontSize(size) {
        localStorage.setItem(this.KEYS.FONT_SIZE, size.toString());
    }

    getFontFamily() {
        return localStorage.getItem(this.KEYS.FONT_FAMILY) || 'Source Code Pro';
    }

    setFontFamily(font) {
        localStorage.setItem(this.KEYS.FONT_FAMILY, font);
    }

    clearTypingStats() {
        localStorage.removeItem(this.KEYS.SESSIONS);
    }

    getStats() {
        const sessions = this.getSessions();
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
        this.mistakes = {};
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
            const displayKey = this.getDisplayKey(expected);
            this.mistakes[displayKey] = (this.mistakes[displayKey] || 0) + 1;
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
            this.mistakes['Tab'] = (this.mistakes['Tab'] || 0) + 1;
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

    getDisplayKey(char) {
        if (char === ' ') return 'Space';
        if (char === '\n') return 'Enter';
        if (char === '\t') return 'Tab';
        return char;
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

        const progress = this.text.length > 0
            ? Math.round((this.position / this.text.length) * 100)
            : 100;

        return {
            wpm,
            accuracy,
            progress,
            elapsedSeconds,
            totalChars: this.text.length,
            correctChars: this.correctChars,
            mistakes: { ...this.mistakes }
        };
    }

}

// ============================================
// Text Generator
// ============================================
class TextGenerator {
    static getWords(count = 25) {
        // Categorize words by length for better variety
        const realWords = WORDS.filter(w => w.length >= 2);
        const short = realWords.filter(w => w.length <= 4);
        const medium = realWords.filter(w => w.length >= 5 && w.length <= 7);
        const long = realWords.filter(w => w.length >= 8);

        // Target distribution: 40% short, 40% medium, 20% long
        const shortCount = Math.round(count * 0.4);
        const mediumCount = Math.round(count * 0.4);
        const longCount = count - shortCount - mediumCount;

        const pick = (arr, n) => {
            const shuffled = [...arr].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, n);
        };

        const selected = [
            ...pick(short, shortCount),
            ...pick(medium, mediumCount),
            ...pick(long, longCount)
        ];

        // Shuffle the final selection
        return selected.sort(() => Math.random() - 0.5).join(' ');
    }

    static getSentences(targetWords = 25) {
        // Pick sentences until we reach approximately targetWords
        const shuffled = [...SENTENCES].sort(() => Math.random() - 0.5);
        const selected = [];
        let wordCount = 0;

        for (const sentence of shuffled) {
            selected.push(sentence);
            wordCount += sentence.split(/\s+/).length;
            if (wordCount >= targetWords) break;
        }

        return selected.join(' ');
    }

    static getPythonSnippets(targetWords = 25) {
        // Pick snippets until we reach approximately targetWords
        // Filter out snippets that start with whitespace (they're continuations)
        const validSnippets = PYTHON_SNIPPETS.filter(s => s.length > 0 && !/^\s/.test(s));
        const shuffled = [...validSnippets].sort(() => Math.random() - 0.5);
        const selected = [];
        let wordCount = 0;

        for (const snippet of shuffled) {
            selected.push(snippet);
            // Count words (split on whitespace)
            wordCount += snippet.split(/\s+/).length;
            if (wordCount >= targetWords) break;
        }

        return selected.join('\n\n');
    }

    static getText(mode, length = 25) {
        switch (mode) {
            case 'sentences':
                return this.getSentences(length);
            case 'python':
                return this.getPythonSnippets(length);
            default:
                return this.getWords(length);
        }
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
        this.exerciseLength = 10;
        this.updateInterval = null;
        this.currentBook = null;
        this.bookChapter = 0;
        this.bookParagraph = 0;
        this._suppressSync = false;

        this.initElements();
        this.initEventListeners();
        this._suppressSync = true;
        this.loadSettings();
        this._suppressSync = false;
        this.updateTimerDisplay();
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

        // Book selection elements
        this.bookList = document.getElementById('book-list');
        this.backFromBooksBtn = document.getElementById('back-from-books');

        // Chapter selection elements
        this.chapterList = document.getElementById('chapter-list');
        this.chapterScreenTitle = document.getElementById('chapter-screen-title');
        this.backFromChaptersBtn = document.getElementById('back-from-chapters');

        // Chapter title in practice
        this.chapterTitle = document.getElementById('chapter-title');
        this.bookHint = document.querySelector('.book-hint');

        // Menu elements
        this.modeBtns = document.querySelectorAll('.mode-btn');
        this.viewProgressBtn = document.getElementById('view-progress-btn');
        this.openSettingsBtn = document.getElementById('open-settings-btn');
        this.authBtn = document.getElementById('auth-btn');
        this.syncStatus = document.getElementById('sync-status');
        this.timerDisplay = document.getElementById('timer-display');

        // Length modal elements
        this.lengthModal = document.getElementById('length-modal');
        this.lengthBtns = document.querySelectorAll('.length-btn');
        this.startPracticeBtn = document.getElementById('start-practice-btn');
        this.cancelLengthBtn = document.getElementById('cancel-length-btn');

        // Settings modal elements
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = document.getElementById('close-settings-btn');
        this.fontBtns = document.querySelectorAll('.font-btn');
        this.fontSizeSlider = document.getElementById('font-size-slider');
        this.fontSizeValue = document.getElementById('font-size-value');

        // Practice elements
        this.backToMenuBtn = document.getElementById('back-to-menu');
        this.textDisplay = document.getElementById('text-display');
        this.liveWpm = document.getElementById('live-wpm');
        this.liveAccuracy = document.getElementById('live-accuracy');
        this.liveProgress = document.getElementById('live-progress');

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
        this.backToMenuSummaryBtn = document.getElementById('back-to-menu-summary');

        // Progress elements
        this.backFromProgressBtn = document.getElementById('back-from-progress');
        this.totalSessions = document.getElementById('total-sessions');
        this.avgWpm = document.getElementById('avg-wpm');
        this.avgAccuracy = document.getElementById('avg-accuracy');
        this.bestWpm = document.getElementById('best-wpm');
        this.sessionHistory = document.getElementById('session-history');
        this.clearDataBtn = document.getElementById('clear-data');
    }

    initEventListeners() {
        // Font buttons
        this.fontBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.fontBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setFontFamily(btn.dataset.font);
            });
        });

        // Font size slider
        this.fontSizeSlider.addEventListener('input', () => {
            const size = this.fontSizeSlider.value;
            this.setFontSize(size);
        });

        // Mode buttons
        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentMode = btn.dataset.mode;
                if (this.currentMode === 'books') {
                    this.showBookSelection();
                } else {
                    this.showLengthModal();
                }
            });
        });

        // Back from book selection
        this.backFromBooksBtn.addEventListener('click', () => {
            this.showMenu();
        });

        // Back from chapter selection
        this.backFromChaptersBtn.addEventListener('click', () => {
            this.showBookSelection();
        });

        // Length modal
        this.lengthBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.lengthBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.exerciseLength = parseInt(btn.dataset.length);
            });
        });
        this.startPracticeBtn.addEventListener('click', () => {
            this.hideLengthModal();
            this.startPractice();
        });
        this.cancelLengthBtn.addEventListener('click', () => {
            this.hideLengthModal();
        });

        // Settings modal
        this.openSettingsBtn.addEventListener('click', () => {
            this.showSettingsModal();
        });
        this.closeSettingsBtn.addEventListener('click', () => {
            this.hideSettingsModal();
        });

        // View progress
        this.viewProgressBtn.addEventListener('click', () => {
            this.showProgress();
        });

        // Back to menu buttons
        this.backToMenuBtn.addEventListener('click', () => {
            if (this.currentMode === 'books') {
                this.showChapterSelection();
            } else {
                this.showMenu();
            }
        });
        this.backToMenuSummaryBtn.addEventListener('click', () => {
            this.showMenu();
        });
        this.backFromProgressBtn.addEventListener('click', () => {
            this.showMenu();
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
            this.showConfirm('Clear all typing stats? Book progress will be kept.', () => {
                this.storage.clearTypingStats();
                if (this.firebase.syncTimeout) {
                    clearTimeout(this.firebase.syncTimeout);
                    this.firebase.syncTimeout = null;
                }
                this.firebase.deleteField('sessions');
                this.showProgress();
            });
        });
        // Auth button
        this.authBtn.addEventListener('click', () => {
            if (this.firebase.isSignedIn()) {
                this.firebase.signOut();
            } else {
                this.firebase.signIn().catch(() => {});
            }
        });

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
                this.loadSettings();
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
            bookProgress: JSON.parse(localStorage.getItem(this.storage.KEYS.BOOK_PROGRESS) || '{}'),
            totalTime: this.storage.getTotalTime(),
            dailyTime: this.storage.getDailyTime(),
            settings: {
                fontSize: this.storage.getFontSize(),
                fontFamily: this.storage.getFontFamily(),
            }
        };
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
            localStorage.setItem(this.storage.KEYS.SESSIONS, JSON.stringify(local.slice(0, 100)));
        }

        // Merge book progress: union of completed paragraphs
        if (data.bookProgress) {
            const localData = JSON.parse(localStorage.getItem(this.storage.KEYS.BOOK_PROGRESS) || '{}');
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
            localStorage.setItem(this.storage.KEYS.BOOK_PROGRESS, JSON.stringify(localData));
        }

        // Merge total time: take max (never decrease)
        if (data.totalTime) {
            const local = this.storage.getTotalTime();
            const merged = Math.max(local, data.totalTime);
            localStorage.setItem(this.storage.KEYS.TOTAL_TIME, String(merged));
        }

        // Merge daily time: take max for same day
        if (data.dailyTime) {
            const local = this.storage.getDailyTime();
            if (data.dailyTime.date === local.date) {
                const merged = Math.max(local.seconds, data.dailyTime.seconds);
                localStorage.setItem(this.storage.KEYS.DAILY_TIME, JSON.stringify({
                    date: local.date, seconds: merged
                }));
            }
        }

        // Settings: cloud wins
        if (data.settings) {
            if (data.settings.fontSize) {
                localStorage.setItem(this.storage.KEYS.FONT_SIZE, data.settings.fontSize.toString());
            }
            if (data.settings.fontFamily) {
                localStorage.setItem(this.storage.KEYS.FONT_FAMILY, data.settings.fontFamily);
            }
        }

        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        const todaySeconds = this.storage.getDailyTime().seconds;
        const totalSeconds = this.storage.getTotalTime();
        const parts = [];
        if (todaySeconds > 0) {
            const todayClass = todaySeconds > 600 ? ' class="timer-accent"' : '';
            parts.push(`<span class="timer-label">Today:</span> <span${todayClass}>${this.formatTime(todaySeconds)}</span>`);
        }
        if (totalSeconds > 0) {
            parts.push(`<span class="timer-label">Total:</span> ${this.formatTime(totalSeconds)}`);
        }
        this.timerDisplay.innerHTML = parts.join('<br>');
    }

    loadSettings() {
        // Load font family
        const fontFamily = this.storage.getFontFamily();
        this.setFontFamily(fontFamily);
        this.fontBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.font === fontFamily);
        });

        // Load font size
        const fontSize = this.storage.getFontSize();
        this.fontSizeSlider.value = fontSize;
        this.setFontSize(fontSize);

    }

    setFontSize(size) {
        document.documentElement.style.setProperty('--font-size', `${size}px`);
        this.fontSizeValue.textContent = `${size}px`;
        this.storage.setFontSize(size);
        this.syncToCloud();
    }

    setFontFamily(font) {
        document.documentElement.style.setProperty('--font-family', `'${font}', monospace`);
        this.storage.setFontFamily(font);
        this.syncToCloud();
    }

    showScreen(screen) {
        [this.menuScreen, this.practiceScreen, this.summaryScreen, this.progressScreen, this.bookSelectionScreen, this.chapterSelectionScreen]
            .forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    showMenu() {
        this.stopUpdateInterval();
        this.session = null;
        this.updateTimerDisplay();
        this.showScreen(this.menuScreen);
    }

    showLengthModal() {
        this.lengthModal.classList.remove('hidden');
    }

    hideLengthModal() {
        this.lengthModal.classList.add('hidden');
    }

    showSettingsModal() {
        this.settingsModal.classList.remove('hidden');
    }

    hideSettingsModal() {
        this.settingsModal.classList.add('hidden');
    }

    updateChapterTitle(chapter, chapterIndex, paragraphIndex) {
        const total = chapter.paragraphs.length;
        const isCompleted = this.storage.isParagraphCompleted(this.currentBook.id, chapterIndex, paragraphIndex);
        const completedHtml = isCompleted ? ' <span class="completed-mark">(COMPLETED)</span>' : '';
        this.chapterTitle.innerHTML = `${this.escapeHtml(this.currentBook.title)} — Chapter ${chapter.number}: ${this.escapeHtml(chapter.title)} — ${paragraphIndex + 1}/${total}${completedHtml}`;
        this.textDisplay.classList.toggle('already-completed', isCompleted);
    }

    pausePractice() {
        if (this.session) {
            this.session.pause();
            this.stopUpdateInterval();
            this.pauseOverlay.classList.remove('hidden');
        }
    }

    resumePractice() {
        if (this.session) {
            this.session.resume();
            this.startUpdateInterval();
            this.pauseOverlay.classList.add('hidden');
        }
    }

    hidePause() {
        this.pauseOverlay.classList.add('hidden');
    }

    startPractice() {
        let text;

        if (this.currentMode === 'books' && this.currentBook) {
            // Load book progress
            const progress = this.storage.getBookProgress(this.currentBook.id);
            this.bookChapter = progress.chapter;
            this.bookParagraph = progress.paragraph;

            // Check if book is complete
            if (this.bookChapter >= this.currentBook.chapters.length) {
                const next = this.findNextUncompleted(0, -1);
                if (next.chapter >= this.currentBook.chapters.length) {
                    this.showToast('Congratulations! You have completed the entire book!', 5000);
                    this.showBookSelection();
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
            while (!text || text.trim() === '') {
                this.storage.markParagraphCompleted(this.currentBook.id, this.bookChapter, this.bookParagraph);
                const next = this.findNextUncompleted(this.bookChapter, this.bookParagraph);
                if (next.chapter >= this.currentBook.chapters.length) {
                    this.showToast('Congratulations! You have completed the entire book!', 5000);
                    this.showBookSelection();
                    return;
                }
                this.bookChapter = next.chapter;
                this.bookParagraph = next.paragraph;
                this.storage.setBookProgress(this.currentBook.id, next.chapter, next.paragraph);
                chapter = this.currentBook.chapters[this.bookChapter];
                text = chapter.paragraphs[this.bookParagraph];
            }

            // Cache book stats for live display (avoids repeated localStorage reads)
            this._cachedBookStats = this.storage.getBookStats(this.currentBook);

            // Show chapter title with paragraph info
            this.updateChapterTitle(chapter, this.bookChapter, this.bookParagraph);
            this.chapterTitle.classList.remove('hidden');
            this.bookHint.classList.remove('hidden');
        } else {
            text = TextGenerator.getText(this.currentMode, this.exerciseLength);
            this.chapterTitle.classList.add('hidden');
            this.bookHint.classList.add('hidden');
            this.textDisplay.classList.remove('already-completed');
            this._cachedBookStats = null;
        }

        // Strip Gutenberg _italic_ markers from book text
        if (this.currentMode === 'books') {
            text = text.replace(/(?<![_])_([^_]+)_(?![_])/g, '$1');
        }

        this.session = new TypingSession(text);
        this.renderText();
        this.updateLiveStats();
        this.startUpdateInterval();
        this.showScreen(this.practiceScreen);
    }

    renderText() {
        if (!this.session) return;

        // Build all spans once
        const text = this.session.text;
        this.textDisplay.innerHTML = text.split('').map((char, i) => {
            let displayChar = char;
            if (char === '\n') {
                displayChar = '\u21b5\n';
            } else if (char === '\t') {
                displayChar = '    ';
            }
            const state = i === 0 ? 'current' : 'pending';
            return `<span class="char ${state}">${this.escapeHtml(displayChar)}</span>`;
        }).join('');

        // Store span references for fast updates
        this.charSpans = this.textDisplay.querySelectorAll('.char');
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

        // Scroll current character into view within the text-display container only
        const span = this.charSpans[pos];
        if (span) {
            const container = this.textDisplay;
            const spanTop = span.offsetTop - container.offsetTop;
            const spanBottom = spanTop + span.offsetHeight;
            if (spanTop < container.scrollTop) {
                container.scrollTop = spanTop;
            } else if (spanBottom > container.scrollTop + container.clientHeight) {
                container.scrollTop = spanBottom - container.clientHeight;
            }
        }
    }

    escapeHtml(text) {
        this._escapeDiv ??= document.createElement('div');
        this._escapeDiv.textContent = text;
        return this._escapeDiv.innerHTML;
    }

    showConfirm(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        const title = document.getElementById('confirm-modal-title');
        const yesBtn = document.getElementById('confirm-yes-btn');
        const noBtn = document.getElementById('confirm-no-btn');
        title.textContent = message;
        modal.classList.remove('hidden');

        const cleanup = () => {
            modal.classList.add('hidden');
            yesBtn.replaceWith(yesBtn.cloneNode(true));
            noBtn.replaceWith(noBtn.cloneNode(true));
        };

        yesBtn.addEventListener('click', () => { cleanup(); onConfirm(); }, { once: true });
        noBtn.addEventListener('click', () => { cleanup(); }, { once: true });
    }

    showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden', 'fade-out');
        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, duration);
    }

    updateLiveStats() {
        if (!this.session) return;

        const stats = this.session.getStats();
        this.liveWpm.textContent = `WPM: ${stats.wpm}`;
        this.liveAccuracy.textContent = `Accuracy: ${stats.accuracy}%`;

        if (this.currentMode === 'books' && this.currentBook && this._cachedBookStats) {
            const bs = this._cachedBookStats;
            this.liveProgress.textContent = `Chapter ${bs.currentChapter}/${bs.totalChapters} (${bs.percentComplete}% complete)`;
        } else {
            this.liveProgress.textContent = `Progress: ${stats.progress}%`;
        }
    }

    startUpdateInterval() {
        this.stopUpdateInterval();
        this.updateInterval = setInterval(() => {
            this.updateLiveStats();
        }, 500);
    }

    stopUpdateInterval() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    handleKeyDown(e) {
        // Handle Escape for modals
        if (e.key === 'Escape') {
            if (!this.lengthModal.classList.contains('hidden')) {
                this.hideLengthModal();
                return;
            }
            if (!this.settingsModal.classList.contains('hidden')) {
                this.hideSettingsModal();
                return;
            }
        }

        // Only handle keys during practice
        if (!this.session || !this.practiceScreen.classList.contains('active')) {
            return;
        }

        // If paused, any key resumes (except Escape which quits)
        if (this.session.isPaused) {
            e.preventDefault();
            if (e.key === 'Escape') {
                this.hidePause();
                this.showMenu();
            } else {
                this.resumePractice();
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
        if (this.currentMode === 'books' && this.currentBook) {
            if (e.key === 'PageDown') {
                e.preventDefault();
                this.skipParagraph(1);
                return;
            }
            if (e.key === 'PageUp') {
                e.preventDefault();
                this.skipParagraph(-1);
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

        const chapter = this.currentBook.chapters[this.bookChapter];
        let newParagraph = this.bookParagraph + direction;
        let newChapter = this.bookChapter;

        // Handle chapter boundaries
        if (newParagraph < 0) {
            // Go to previous chapter
            if (newChapter > 0) {
                newChapter--;
                newParagraph = this.currentBook.chapters[newChapter].paragraphs.length - 1;
            } else {
                // Already at first paragraph of first chapter
                return;
            }
        } else if (newParagraph >= chapter.paragraphs.length) {
            // Go to next chapter
            if (newChapter < this.currentBook.chapters.length - 1) {
                newChapter++;
                newParagraph = 0;
            } else {
                // Already at last paragraph of last chapter
                return;
            }
        }

        // Update progress and restart practice
        this.bookChapter = newChapter;
        this.bookParagraph = newParagraph;
        this.storage.setBookProgress(this.currentBook.id, newChapter, newParagraph);
        this.syncToCloud();

        // Restart with new paragraph
        const newChapterData = this.currentBook.chapters[newChapter];
        let text = newChapterData.paragraphs[newParagraph];

        // Skip empty paragraphs
        if (!text || text.trim() === '') {
            this.storage.markParagraphCompleted(this.currentBook.id, newChapter, newParagraph);
            this.storage.setBookProgress(this.currentBook.id, newChapter, newParagraph);
            this.skipParagraph(direction > 0 ? 1 : -1);
            return;
        }

        // Strip Gutenberg _italic_ markers
        text = text.replace(/(?<![_])_([^_]+)_(?![_])/g, '$1');

        this.session = new TypingSession(text);
        this._cachedBookStats = this.storage.getBookStats(this.currentBook);
        this.updateChapterTitle(newChapterData, newChapter, newParagraph);
        this.renderText();
        this.updateLiveStats();
    }

    endSession() {
        this.stopUpdateInterval();
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
        if (this.currentMode === 'books' && this.currentBook) {
            // Mark current paragraph as completed
            this.storage.markParagraphCompleted(this.currentBook.id, this.bookChapter, this.bookParagraph);
            this._cachedBookStats = this.storage.getBookStats(this.currentBook);

            // Find next uncompleted paragraph
            const next = this.findNextUncompleted(this.bookChapter, this.bookParagraph);
            this.bookChapter = next.chapter;
            this.bookParagraph = next.paragraph;
            this.storage.setBookProgress(this.currentBook.id, this.bookChapter, this.bookParagraph);

            // Auto-advance to next paragraph, or show summary if book is done
            if (this.bookChapter < this.currentBook.chapters.length) {
                this.syncToCloud();
                this.startPractice();
                return;
            }
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
    }

    showProgress() {
        const stats = this.storage.getStats();
        const sessions = this.storage.getSessions();

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
                        <span class="session-mode">${this.escapeHtml(session.mode)}</span>
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
    }

    async loadBooks() {
        if (typeof BOOKS !== 'undefined') return;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'books.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async showBookSelection() {
        try {
            await this.loadBooks();
        } catch {
            this.bookList.innerHTML = '<p>Failed to load books.</p>';
            this.showScreen(this.bookSelectionScreen);
            return;
        }
        // Render book cards
        this.bookList.innerHTML = BOOKS.map(book => {
            const stats = this.storage.getBookStats(book);
            return `
                <div class="book-card" data-book-id="${book.id}">
                    <div class="book-info">
                        <h3>${this.escapeHtml(book.title)}</h3>
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
    }

    selectBook(bookId) {
        this.currentBook = BOOKS.find(b => b.id === bookId);
        if (this.currentBook) {
            this.showChapterSelection();
        }
    }

    showChapterSelection() {
        if (!this.currentBook) return;

        this.chapterScreenTitle.textContent = this.currentBook.title;
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

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
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
