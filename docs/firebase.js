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
        this._cachedToken = null;
    }

    init() {
        const firebaseConfig = {
            apiKey: "AIzaSyAasIsRPq0Ciuxf-yyTcgWsL5SFk2WR-ME",
            authDomain: "typefit-new.firebaseapp.com",
            projectId: "typefit-new",
            storageBucket: "typefit-new.firebasestorage.app",
            messagingSenderId: "999930591014",
            appId: "1:999930591014:web:e590dc9ec30bf1cbba33e7"
        };

        firebase.initializeApp(firebaseConfig);
        this.auth = firebase.auth();
        this.db = firebase.firestore();

        // Listen for auth state changes
        this.auth.onAuthStateChanged((user) => {
            this.user = user;
            // Pre-cache token for reliable page-unload sync
            if (user) {
                user.getIdToken().then(t => { this._cachedToken = t; }).catch(() => {});
            } else {
                this._cachedToken = null;
            }
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
            if (!this.user) return;
            const ok = await this.saveToCloud(getDataFn());
            // Refresh cached token for reliable page-unload sync
            if (this.user) {
                this.user.getIdToken().then(t => { this._cachedToken = t; }).catch(e => { console.warn('Token refresh failed:', e); });
            }
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
        if (this.user && this.db && this._cachedToken) {
            const projectId = this.db.app.options.projectId;
            const uid = this.user.uid;
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=sessions&updateMask.fieldPaths=bookProgress&updateMask.fieldPaths=totalTime&updateMask.fieldPaths=dailyTime&updateMask.fieldPaths=settings`;
            // Convert to Firestore REST format
            const fields = {};
            for (const [key, value] of Object.entries(data)) {
                fields[key] = this._toFirestoreValue(value);
            }
            // Use cached token synchronously — no async await during unload
            fetch(url, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${this._cachedToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields }),
                keepalive: true
            }).catch(() => {});
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
