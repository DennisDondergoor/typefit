// ============================================
// Firebase Sync
// ============================================
class FirebaseSync {
    constructor() {
        this.db = null;
        this.auth = null;
        this.user = null;
        this.onAuthChangeCallback = null;
        this.syncTimeout = null;
    }

    init() {
        const firebaseConfig = {
            apiKey: "AIzaSyBtXOgsuhUCv3uEDPZFCeFspcrl5z0_KHY",
            authDomain: "typefit-abf48.firebaseapp.com",
            projectId: "typefit-abf48",
            storageBucket: "typefit-abf48.firebasestorage.app",
            messagingSenderId: "817856774728",
            appId: "1:817856774728:web:67b4996f69db55f4b08e7d"
        };

        firebase.initializeApp(firebaseConfig);
        this.auth = firebase.auth();
        this.db = firebase.firestore();

        // Listen for auth state changes
        this.auth.onAuthStateChanged((user) => {
            this.user = user;
            if (this.onAuthChangeCallback) {
                this.onAuthChangeCallback(user);
            }
        });
    }

    onAuthChange(callback) {
        this.onAuthChangeCallback = callback;
    }

    async signIn() {
        const provider = new firebase.auth.GithubAuthProvider();
        try {
            await this.auth.signInWithPopup(provider);
        } catch (error) {
            console.error('Sign in failed:', error);
            throw error;
        }
    }

    async signOut() {
        try {
            await this.auth.signOut();
        } catch (error) {
            console.error('Sign out failed:', error);
        }
    }

    isSignedIn() {
        return this.user !== null;
    }

    getUserName() {
        return this.user ? this.user.displayName || this.user.email || 'User' : null;
    }

    async saveToCloud(data) {
        if (!this.user) return false;

        try {
            await this.db.collection('users').doc(this.user.uid).set(data, { merge: true });
            return true;
        } catch (error) {
            console.error('Cloud save failed:', error);
            return false;
        }
    }

    async loadFromCloud() {
        if (!this.user) return null;

        try {
            const doc = await this.db.collection('users').doc(this.user.uid).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Cloud load failed:', error);
            return null;
        }
    }

    async deleteField(fieldName) {
        if (!this.user) return;

        try {
            await this.db.collection('users').doc(this.user.uid).update({
                [fieldName]: firebase.firestore.FieldValue.delete()
            });
        } catch (error) {
            console.error('Cloud field delete failed:', error);
        }
    }

    // Debounced sync - waits 2 seconds after last change before syncing
    scheduleSave(getDataFn) {
        if (!this.user) return;

        this._pendingGetData = getDataFn;
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }
        this.syncTimeout = setTimeout(async () => {
            this.syncTimeout = null;
            this._pendingGetData = null;
            const ok = await this.saveToCloud(getDataFn());
            if (this.onSyncResult) this.onSyncResult(ok);
        }, 2000);
    }

    // Flush pending save immediately (for page unload)
    flushPendingSync() {
        if (!this.syncTimeout || !this._pendingGetData) return;
        clearTimeout(this.syncTimeout);
        this.syncTimeout = null;
        const data = this._pendingGetData();
        this._pendingGetData = null;
        // Use fetch with keepalive for reliability during page unload
        if (this.user && this.db) {
            const projectId = this.db.app.options.projectId;
            const uid = this.user.uid;
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=sessions&updateMask.fieldPaths=bookProgress&updateMask.fieldPaths=totalTime&updateMask.fieldPaths=dailyTime&updateMask.fieldPaths=settings`;
            // Convert to Firestore REST format
            const fields = {};
            for (const [key, value] of Object.entries(data)) {
                fields[key] = this._toFirestoreValue(value);
            }
            this.user.getIdToken().then(token => {
                fetch(url, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fields }),
                    keepalive: true
                }).catch(() => {});
            }).catch(() => {
                // Token fetch failed, fall back to regular save
                this.saveToCloud(data);
            });
        }
    }

    _toFirestoreValue(value) {
        if (value === null || value === undefined) return { nullValue: null };
        if (typeof value === 'string') return { stringValue: value };
        if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
        if (typeof value === 'boolean') return { booleanValue: value };
        if (Array.isArray(value)) return { arrayValue: { values: value.map(v => this._toFirestoreValue(v)) } };
        if (typeof value === 'object') {
            const fields = {};
            for (const [k, v] of Object.entries(value)) {
                fields[k] = this._toFirestoreValue(v);
            }
            return { mapValue: { fields } };
        }
        return { stringValue: String(value) };
    }
}
