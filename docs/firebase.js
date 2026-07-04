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

    // Cache the current user's ID token for synchronous use during page unload.
    _cacheToken() {
        if (!this.user) return;
        this.user.getIdToken()
            .then(t => { this._cachedToken = t; })
            .catch(e => { console.warn('Token cache failed:', e); });
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
                this._cacheToken();
            } else {
                this._cachedToken = null;
                this.cancelPendingSync();
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
        await this.auth.signInWithPopup(provider);
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

    // Drop any pending debounced save so stale data isn't re-saved.
    cancelPendingSync() {
        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
            this.syncTimeout = null;
        }
        this._pendingGetData = null;
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
            this._cacheToken();
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
            // Build the Firestore fields and the updateMask in one pass. Deriving
            // the mask from the data keys means it can never drift from whatever
            // App.getAllData() returns — a new key persists automatically.
            // Mask paths descend into nested maps so the PATCH deep-merges like
            // saveToCloud's set(..., { merge: true }) instead of replacing whole
            // top-level fields (which could drop another device's book progress).
            const fields = {};
            const paths = [];
            for (const [key, value] of Object.entries(data)) {
                fields[key] = this._toFirestoreValue(value);
                this._collectMaskPaths(value, this._escapeFieldPath(key), paths);
            }
            const maskParts = paths.map(p => `updateMask.fieldPaths=${encodeURIComponent(p)}`);
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?${maskParts.join('&')}`;
            // Use cached token synchronously — no async await during unload
            fetch(url, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${this._cachedToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields }),
                keepalive: true
            }).catch(() => {});
        }
    }

    // Recurse into plain maps and emit leaf field paths for the updateMask.
    // Arrays and scalars are leaves (merge:true replaces those wholesale too);
    // empty maps emit nothing, matching merge:true's no-op on {}.
    _collectMaskPaths(value, prefix, out) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            for (const [k, v] of Object.entries(value)) {
                this._collectMaskPaths(v, `${prefix}.${this._escapeFieldPath(k)}`, out);
            }
        } else {
            out.push(prefix);
        }
    }

    // Quote map keys that aren't simple identifiers (Firestore field path syntax).
    _escapeFieldPath(key) {
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return key;
        return '`' + key.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`';
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
