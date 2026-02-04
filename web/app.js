// ============================================
// Storage Manager
// ============================================
class StorageManager {
    constructor() {
        this.KEYS = {
            SESSIONS: 'typefit_sessions',
            PROBLEM_KEYS: 'typefit_problem_keys',
            FONT_SIZE: 'typefit_font_size',
            FONT_FAMILY: 'typefit_font_family',
            BOOK_PROGRESS: 'typefit_book_progress',
            COLORS: 'typefit_colors'
        };
        this.DEFAULT_COLORS = {
            correct: '#4ade80',
            incorrect: '#dc2626',
            cursor: '#ffffff'
        };
    }

    getBookProgress(bookId) {
        const data = localStorage.getItem(this.KEYS.BOOK_PROGRESS);
        const allProgress = data ? JSON.parse(data) : {};
        return allProgress[bookId] || { chapter: 0, paragraph: 0 };
    }

    setBookProgress(bookId, chapter, paragraph) {
        const data = localStorage.getItem(this.KEYS.BOOK_PROGRESS);
        const allProgress = data ? JSON.parse(data) : {};
        allProgress[bookId] = { chapter, paragraph };
        localStorage.setItem(this.KEYS.BOOK_PROGRESS, JSON.stringify(allProgress));
    }

    getBookStats(book) {
        const progress = this.getBookProgress(book.id);
        let totalChars = 0;
        let completedChars = 0;

        for (let i = 0; i < book.chapters.length; i++) {
            const chapter = book.chapters[i];
            for (let j = 0; j < chapter.paragraphs.length; j++) {
                const paragraphLength = chapter.paragraphs[j].length;
                totalChars += paragraphLength;
                if (i < progress.chapter || (i === progress.chapter && j < progress.paragraph)) {
                    completedChars += paragraphLength;
                }
            }
        }

        return {
            currentChapter: progress.chapter + 1,
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
    }

    getProblemKeys() {
        const data = localStorage.getItem(this.KEYS.PROBLEM_KEYS);
        return data ? JSON.parse(data) : {};
    }

    updateProblemKeys(mistakes) {
        const problemKeys = this.getProblemKeys();
        for (const [key, count] of Object.entries(mistakes)) {
            problemKeys[key] = (problemKeys[key] || 0) + count;
        }
        localStorage.setItem(this.KEYS.PROBLEM_KEYS, JSON.stringify(problemKeys));
    }

    getFontSize() {
        return parseInt(localStorage.getItem(this.KEYS.FONT_SIZE)) || 36;
    }

    setFontSize(size) {
        localStorage.setItem(this.KEYS.FONT_SIZE, size.toString());
    }

    getFontFamily() {
        return localStorage.getItem(this.KEYS.FONT_FAMILY) || 'JetBrains Mono';
    }

    setFontFamily(font) {
        localStorage.setItem(this.KEYS.FONT_FAMILY, font);
    }

    getColors() {
        const data = localStorage.getItem(this.KEYS.COLORS);
        return data ? JSON.parse(data) : { ...this.DEFAULT_COLORS };
    }

    setColor(key, value) {
        const colors = this.getColors();
        colors[key] = value;
        localStorage.setItem(this.KEYS.COLORS, JSON.stringify(colors));
    }

    clearAll() {
        localStorage.removeItem(this.KEYS.SESSIONS);
        localStorage.removeItem(this.KEYS.PROBLEM_KEYS);
        localStorage.removeItem(this.KEYS.BOOK_PROGRESS);
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

    getTopProblemKeys(limit = 10) {
        const problemKeys = this.getProblemKeys();
        return Object.entries(problemKeys)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);
    }
}

// ============================================
// Typing Session
// ============================================
class TypingSession {
    constructor(text) {
        this.text = text;
        this.position = 0;
        this.typedChars = [];
        this.mistakes = {};
        this.startTime = null;
        this.endTime = null;
        this.correctChars = 0;
        this.totalTyped = 0;
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
        // Normalize accented characters (ü→u, î→i, ô→o, etc.)
        const normalizedExpected = expected.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const isCorrect = key === expected || key === normalizedExpected;

        this.totalTyped++;

        if (isCorrect) {
            this.typedChars.push({ expected, typed: key, correct: true });
            this.correctChars++;
            this.position++;
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
            this.typedChars.pop();
            this.correctChars--;
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
            this.totalTyped++;
            const expected = this.text[this.position];
            const displayKey = this.getDisplayKey(expected);
            this.mistakes[displayKey] = (this.mistakes[displayKey] || 0) + 1;
            return false;
        }

        // Skip all the spaces
        for (let i = 0; i < spacesToSkip; i++) {
            this.typedChars.push({ expected: ' ', typed: ' ', correct: true });
            this.correctChars++;
            this.position++;
        }
        this.totalTyped++;

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

    getCharStates() {
        const states = [];
        for (let i = 0; i < this.text.length; i++) {
            const char = this.text[i];
            let state;

            if (i < this.position) {
                state = 'correct';
            } else if (i === this.position) {
                state = this.lastKeyIncorrect ? 'incorrect' : 'current';
            } else {
                state = 'pending';
            }

            states.push({ char, state });
        }
        return states;
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

        const progress = Math.round((this.position / this.text.length) * 100);

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

    isComplete() {
        return this.position >= this.text.length;
    }
}

// ============================================
// Text Generator
// ============================================
class TextGenerator {
    static getWords(count = 25) {
        // Categorize words by length for better variety
        const short = WORDS.filter(w => w.length <= 4);
        const medium = WORDS.filter(w => w.length >= 5 && w.length <= 7);
        const long = WORDS.filter(w => w.length >= 8);

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
            case 'words':
                return this.getWords(length);
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
        this.session = null;
        this.currentMode = 'words';
        this.exerciseLength = 25;
        this.updateInterval = null;
        this.currentBook = null;
        this.bookChapter = 0;
        this.bookParagraph = 0;

        this.initElements();
        this.initEventListeners();
        this.loadSettings();
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
        this.fontBtns = document.querySelectorAll('.font-btn');
        this.fontSizeSlider = document.getElementById('font-size-slider');
        this.fontSizeValue = document.getElementById('font-size-value');
        this.modeBtns = document.querySelectorAll('.mode-btn');
        this.lengthBtns = document.querySelectorAll('.length-btn');
        this.viewProgressBtn = document.getElementById('view-progress-btn');

        // Color inputs
        this.colorCorrect = document.getElementById('color-correct');
        this.colorIncorrect = document.getElementById('color-incorrect');
        this.colorCursor = document.getElementById('color-cursor');

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
        this.problemKeysDisplay = document.getElementById('problem-keys-display');
        this.practiceAgainBtn = document.getElementById('practice-again');
        this.backToMenuSummaryBtn = document.getElementById('back-to-menu-summary');

        // Progress elements
        this.backFromProgressBtn = document.getElementById('back-from-progress');
        this.totalSessions = document.getElementById('total-sessions');
        this.avgWpm = document.getElementById('avg-wpm');
        this.avgAccuracy = document.getElementById('avg-accuracy');
        this.bestWpm = document.getElementById('best-wpm');
        this.topProblemKeys = document.getElementById('top-problem-keys');
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

        // Color inputs
        this.colorCorrect.addEventListener('input', () => {
            this.setColor('correct', this.colorCorrect.value);
        });
        this.colorIncorrect.addEventListener('input', () => {
            this.setColor('incorrect', this.colorIncorrect.value);
        });
        this.colorCursor.addEventListener('input', () => {
            this.setColor('cursor', this.colorCursor.value);
        });

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

        // Back from book selection
        this.backFromBooksBtn.addEventListener('click', () => {
            this.showMenu();
        });

        // Back from chapter selection
        this.backFromChaptersBtn.addEventListener('click', () => {
            this.showBookSelection();
        });

        // Length buttons
        this.lengthBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.lengthBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.exerciseLength = parseInt(btn.dataset.length);
            });
        });

        // View progress
        this.viewProgressBtn.addEventListener('click', () => {
            this.showProgress();
        });

        // Back to menu buttons
        this.backToMenuBtn.addEventListener('click', () => {
            this.showMenu();
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
            if (confirm('Are you sure you want to clear all your progress data?')) {
                this.storage.clearAll();
                this.showProgress();
            }
        });

        // Keyboard handling
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
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

        // Load colors
        const colors = this.storage.getColors();
        this.colorCorrect.value = colors.correct;
        this.colorIncorrect.value = colors.incorrect;
        this.colorCursor.value = colors.cursor;
        this.applyColors(colors);
    }

    setFontSize(size) {
        document.documentElement.style.setProperty('--font-size', `${size}px`);
        this.fontSizeValue.textContent = `${size}px`;
        this.storage.setFontSize(size);
    }

    setFontFamily(font) {
        document.documentElement.style.setProperty('--font-family', `'${font}', monospace`);
        this.storage.setFontFamily(font);
    }

    setColor(key, value) {
        this.storage.setColor(key, value);
        const colors = this.storage.getColors();
        this.applyColors(colors);
    }

    applyColors(colors) {
        document.documentElement.style.setProperty('--success-color', colors.correct);
        document.documentElement.style.setProperty('--error-bg', colors.incorrect);
        document.documentElement.style.setProperty('--highlight-bg', colors.cursor);
    }

    showScreen(screen) {
        [this.menuScreen, this.practiceScreen, this.summaryScreen, this.progressScreen, this.bookSelectionScreen, this.chapterSelectionScreen]
            .forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    showMenu() {
        this.stopUpdateInterval();
        this.session = null;
        this.showScreen(this.menuScreen);
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
                alert('Congratulations! You have completed the entire book!');
                this.bookChapter = 0;
                this.bookParagraph = 0;
                this.storage.setBookProgress(this.currentBook.id, 0, 0);
            }

            // Get current paragraph
            const chapter = this.currentBook.chapters[this.bookChapter];
            text = chapter.paragraphs[this.bookParagraph];

            // Show chapter title
            this.chapterTitle.textContent = `Chapter ${chapter.number}: ${chapter.title}`;
            this.chapterTitle.classList.remove('hidden');
            this.bookHint.classList.remove('hidden');
        } else {
            text = TextGenerator.getText(this.currentMode, this.exerciseLength);
            this.chapterTitle.classList.add('hidden');
            this.bookHint.classList.add('hidden');
        }

        this.session = new TypingSession(text);
        this.renderText();
        this.updateLiveStats();
        this.startUpdateInterval();
        this.showScreen(this.practiceScreen);
    }

    renderText() {
        if (!this.session) return;

        const states = this.session.getCharStates();
        this.textDisplay.innerHTML = states.map(({ char, state }) => {
            // Handle special characters for display
            let displayChar = char;
            if (char === '\n') {
                displayChar = '\u21b5\n'; // Show return symbol before newline
            } else if (char === '\t') {
                displayChar = '    '; // Show spaces for tab
            }
            return `<span class="char ${state}">${this.escapeHtml(displayChar)}</span>`;
        }).join('');

        // Scroll current character into view
        const currentChar = this.textDisplay.querySelector('.char.current');
        if (currentChar) {
            currentChar.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateLiveStats() {
        if (!this.session) return;

        const stats = this.session.getStats();
        this.liveWpm.textContent = `WPM: ${stats.wpm}`;
        this.liveAccuracy.textContent = `Accuracy: ${stats.accuracy}%`;

        if (this.currentMode === 'books' && this.currentBook) {
            const bookStats = this.storage.getBookStats(this.currentBook);
            this.liveProgress.textContent = `Chapter ${bookStats.currentChapter}/${bookStats.totalChapters} (${bookStats.percentComplete}% complete)`;
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
            this.renderText();
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
            const complete = this.session.handleTab();
            this.renderText();
            if (complete) {
                this.endSession();
            }
            return;
        }

        // Handle Enter
        if (e.key === 'Enter') {
            e.preventDefault();
            const complete = this.session.handleKey('\n');
            this.renderText();
            if (complete) {
                this.endSession();
            }
            return;
        }

        // Handle regular characters
        if (e.key.length === 1) {
            e.preventDefault();
            const complete = this.session.handleKey(e.key);
            this.renderText();
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

        // Restart with new paragraph
        const newChapterData = this.currentBook.chapters[newChapter];
        const text = newChapterData.paragraphs[newParagraph];

        this.session = new TypingSession(text);
        this.chapterTitle.textContent = `Chapter ${newChapterData.number}: ${newChapterData.title}`;
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
        this.storage.updateProblemKeys(stats.mistakes);

        // Advance book progress if in books mode
        if (this.currentMode === 'books' && this.currentBook) {
            this.bookParagraph++;
            const chapter = this.currentBook.chapters[this.bookChapter];

            if (this.bookParagraph >= chapter.paragraphs.length) {
                // Move to next chapter
                this.bookChapter++;
                this.bookParagraph = 0;
            }

            this.storage.setBookProgress(this.currentBook.id, this.bookChapter, this.bookParagraph);
        }

        // Show summary
        this.showSummary(stats);
    }

    showSummary(stats) {
        this.summaryWpm.textContent = stats.wpm;
        this.summaryAccuracy.textContent = `${stats.accuracy}%`;
        this.summaryTime.textContent = this.formatTime(stats.elapsedSeconds);
        this.summaryChars.textContent = stats.totalChars;

        // Show problem keys from this session
        const mistakeEntries = Object.entries(stats.mistakes)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (mistakeEntries.length > 0) {
            this.problemKeysDisplay.innerHTML = mistakeEntries
                .map(([key, count]) => `<span class="problem-key">${this.escapeHtml(key)} (${count})</span>`)
                .join('');
            document.getElementById('problem-keys-section').style.display = 'block';
        } else {
            document.getElementById('problem-keys-section').style.display = 'none';
        }

        this.showScreen(this.summaryScreen);
    }

    showProgress() {
        const stats = this.storage.getStats();
        const sessions = this.storage.getSessions();
        const topKeys = this.storage.getTopProblemKeys(10);

        // Overview stats
        this.totalSessions.textContent = stats.totalSessions;
        this.avgWpm.textContent = stats.avgWpm || '--';
        this.avgAccuracy.textContent = stats.avgAccuracy ? `${stats.avgAccuracy}%` : '--';
        this.bestWpm.textContent = stats.bestWpm || '--';

        // Top problem keys
        if (topKeys.length > 0) {
            this.topProblemKeys.innerHTML = topKeys
                .map(([key, count]) => `<span class="problem-key">${this.escapeHtml(key)} (${count})</span>`)
                .join('');
        } else {
            this.topProblemKeys.innerHTML = '<p class="empty-state">No problem keys yet</p>';
        }

        // Session history
        if (sessions.length > 0) {
            this.sessionHistory.innerHTML = sessions.slice(0, 20).map(session => `
                <div class="session-item">
                    <div>
                        <span class="session-mode">${session.mode}</span>
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

    showBookSelection() {
        // Render book cards
        this.bookList.innerHTML = BOOKS.map(book => {
            const stats = this.storage.getBookStats(book);
            return `
                <div class="book-card" data-book-id="${book.id}">
                    <div class="book-info">
                        <h3>${book.title}</h3>
                        <p class="book-author">${book.author}</p>
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
            const isCurrent = index === progress.chapter;
            const isCompleted = index < progress.chapter;
            const paragraphCount = chapter.paragraphs.length;
            const currentParagraph = isCurrent ? progress.paragraph : (isCompleted ? paragraphCount : 0);

            let statusText;
            let statusClass = '';
            if (isCompleted) {
                statusText = 'Completed';
            } else if (isCurrent) {
                statusText = `${currentParagraph}/${paragraphCount} paragraphs`;
                statusClass = 'in-progress';
            } else {
                statusText = `${paragraphCount} paragraphs`;
            }

            const cardClass = isCurrent ? 'current' : (isCompleted ? 'completed' : '');

            return `
                <div class="chapter-card ${cardClass}" data-chapter-index="${index}">
                    <div class="chapter-info">
                        <span class="chapter-number">Ch. ${chapter.number}</span>
                        <h4>${chapter.title}</h4>
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

        // Update progress to start of selected chapter
        this.storage.setBookProgress(this.currentBook.id, chapterIndex, 0);
        this.startPractice();
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) {
            return `${mins}m ${secs}s`;
        }
        return `${secs}s`;
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
