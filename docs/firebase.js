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
        if (!this.user) return;

        try {
            await this.db.collection('users').doc(this.user.uid).set(data, { merge: true });
        } catch (error) {
            console.error('Cloud save failed:', error);
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
    scheduleSave(data) {
        if (!this.user) return;

        if (this.syncTimeout) {
            clearTimeout(this.syncTimeout);
        }
        this.syncTimeout = setTimeout(() => {
            this.syncTimeout = null;
            this.saveToCloud(data);
        }, 2000);
    }
}
