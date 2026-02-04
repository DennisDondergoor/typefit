// ============================================
// Storage Manager
// ============================================
class StorageManager {
    constructor() {
        this.KEYS = {
            SESSIONS: 'typefit_sessions',
            PROBLEM_KEYS: 'typefit_problem_keys',
            FONT_SIZE: 'typefit_font_size'
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
        return parseInt(localStorage.getItem(this.KEYS.FONT_SIZE)) || 24;
    }

    setFontSize(size) {
        localStorage.setItem(this.KEYS.FONT_SIZE, size.toString());
    }

    clearAll() {
        localStorage.removeItem(this.KEYS.SESSIONS);
        localStorage.removeItem(this.KEYS.PROBLEM_KEYS);
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
        const isCorrect = key === expected;

        this.totalTyped++;

        if (isCorrect) {
            this.typedChars.push({ expected, typed: key, correct: true });
            this.correctChars++;
            this.position++;

            if (this.position >= this.text.length) {
                this.endTime = Date.now();
                return true; // Session complete
            }
        } else {
            // Don't advance position on incorrect key
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
                state = 'current';
            } else {
                state = 'pending';
            }

            states.push({ char, state });
        }
        return states;
    }

    getStats() {
        const endTime = this.endTime || Date.now();
        const elapsedMs = endTime - (this.startTime || endTime);
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
        const shuffled = [...WORDS].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count).join(' ');
    }

    static getSentence() {
        const index = Math.floor(Math.random() * SENTENCES.length);
        return SENTENCES[index];
    }

    static getSentences(count = 3) {
        const shuffled = [...SENTENCES].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count).join(' ');
    }

    static getPythonSnippet() {
        const index = Math.floor(Math.random() * PYTHON_SNIPPETS.length);
        return PYTHON_SNIPPETS[index];
    }

    static getText(mode) {
        switch (mode) {
            case 'words':
                return this.getWords(25);
            case 'sentences':
                return this.getSentences(2);
            case 'python':
                return this.getPythonSnippet();
            default:
                return this.getWords(25);
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
        this.updateInterval = null;

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

        // Menu elements
        this.fontSizeSlider = document.getElementById('font-size-slider');
        this.fontSizeValue = document.getElementById('font-size-value');
        this.modeBtns = document.querySelectorAll('.mode-btn');
        this.viewProgressBtn = document.getElementById('view-progress-btn');

        // Practice elements
        this.backToMenuBtn = document.getElementById('back-to-menu');
        this.textDisplay = document.getElementById('text-display');
        this.liveWpm = document.getElementById('live-wpm');
        this.liveAccuracy = document.getElementById('live-accuracy');
        this.liveProgress = document.getElementById('live-progress');

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
        // Font size slider
        this.fontSizeSlider.addEventListener('input', () => {
            const size = this.fontSizeSlider.value;
            this.setFontSize(size);
        });

        // Mode buttons
        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentMode = btn.dataset.mode;
                this.startPractice();
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
        const fontSize = this.storage.getFontSize();
        this.fontSizeSlider.value = fontSize;
        this.setFontSize(fontSize);
    }

    setFontSize(size) {
        document.documentElement.style.setProperty('--font-size', `${size}px`);
        this.fontSizeValue.textContent = `${size}px`;
        this.storage.setFontSize(size);
    }

    showScreen(screen) {
        [this.menuScreen, this.practiceScreen, this.summaryScreen, this.progressScreen]
            .forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    showMenu() {
        this.stopUpdateInterval();
        this.session = null;
        this.showScreen(this.menuScreen);
    }

    startPractice() {
        const text = TextGenerator.getText(this.currentMode);
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
        this.liveProgress.textContent = `Progress: ${stats.progress}%`;
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

        // Escape to return to menu
        if (e.key === 'Escape') {
            e.preventDefault();
            this.showMenu();
            return;
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

        // Handle Tab
        if (e.key === 'Tab') {
            e.preventDefault();
            const complete = this.session.handleKey('\t');
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
