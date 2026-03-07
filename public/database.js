const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCd1ngYCXhsROkzOES0VkgR05DZLblWYiM",
    authDomain: "libnav-dc2c8.firebaseapp.com",
    databaseURL: "https://libnav-dc2c8-default-rtdb.firebaseio.com/",
    projectId: "libnav-dc2c8",
    storageBucket: "libnav-dc2c8.firebasestorage.app",
    messagingSenderId: "301317373664",
    appId: "1:301317373664:web:e734e2de0058e4175c1a85"
};

const RANKS = [
    { min: 0,   title: "Guest Reader",     icon: "📖" },
    { min: 1,   title: "Novice Explorer",  icon: "🔍" },
    { min: 5,   title: "Bookworm",         icon: "🐛" },
    { min: 10,  title: "Shelf Seeker",     icon: "📚" },
    { min: 25,  title: "Page Turner",      icon: "⚡" },
    { min: 50,  title: "Knowledge Seeker", icon: "🎯" },
    { min: 100, title: "Library Legend",   icon: "🏆" }
];

function getRank(count) {
    let rank = RANKS[0];
    for (const r of RANKS) { if (count >= r.min) rank = r; }
    return rank;
}

const LibraryDB = {
    dbUrl: "https://libnav-dc2c8-default-rtdb.firebaseio.com/",
    books: [],
    helpedCount: 0,
    currentUser: null,
    currentUserData: null,
    _authStateListeners: [],
    _sdkLoaded: false,
    _sdkLoading: null,

    // ─── LOAD SCRIPTS ONE AT A TIME (order matters for Firebase compat) ───────
    _loadScript: function(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('Failed to load: ' + src));
            document.head.appendChild(s);
        });
    },

    _loadSDK: function() {
        if (this._sdkLoaded) return Promise.resolve();
        if (this._sdkLoading) return this._sdkLoading;
        this._sdkLoading = (async () => {
            await this._loadScript("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
            await this._loadScript("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js");
            await this._loadScript("https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js");
            if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
            this._sdkLoaded = true;
        })();
        return this._sdkLoading;
    },

    // Shorthand to get db ref
    _ref: function(path) {
        return firebase.database().ref(path);
    },

    // ─── AUTH ─────────────────────────────────────────────────────────────────
    _initAuth: async function() {
        try {
            await this._loadSDK();
            await Promise.race([
                new Promise(resolve => {
                    let resolved = false;
                    firebase.auth().onAuthStateChanged(async (user) => {
                        if (user) {
                            this.currentUser = user;
                            await this._loadUserData(user.uid).catch(() => {});
                        } else {
                            this.currentUser = null;
                            this.currentUserData = null;
                        }
                        this._authStateListeners.forEach(fn => fn(user));
                        if (!resolved) { resolved = true; resolve(); }
                    });
                }),
                new Promise(resolve => setTimeout(resolve, 8000))
            ]);
        } catch(e) {
            this.currentUser = null;
            this.currentUserData = null;
            this._authStateListeners.forEach(fn => fn(null));
        }
    },

    onAuthStateChanged: function(cb) {
        this._authStateListeners.push(cb);
    },

    _getAuthToken: async function() {
        try {
            if (this.currentUser) return await this.currentUser.getIdToken(true);
        } catch(e) {}
        return null;
    },

    // ─── USER DATA ────────────────────────────────────────────────────────────
    _loadUserData: async function(uid) {
        try {
            const snap = await this._ref(`users/${uid}`).once('value');
            const data = snap.val();
            if (data) {
                if (data.helpedCount === undefined) data.helpedCount = 0;
                if (data.backpack === undefined) data.backpack = [];
                if (data.bookmarkCount === undefined) data.bookmarkCount = 0;
                this.currentUserData = data;
            } else {
                const fresh = {
                    displayName: this.currentUser?.displayName || 'Student',
                    email: this.currentUser?.email || '',
                    bookmarkCount: 0, helpedCount: 0, backpack: [],
                    createdAt: Date.now()
                };
                await this._ref(`users/${uid}`).set(fresh).catch(() => {});
                this.currentUserData = fresh;
            }
        } catch(e) {
            this.currentUserData = null;
        }
    },

    signUp: async function(email, password, displayName) {
        await this._loadSDK();
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName });
        await cred.user.sendEmailVerification();
        const fresh = { displayName, email, bookmarkCount: 0, helpedCount: 0, backpack: [], createdAt: Date.now() };
        try { await this._ref(`users/${cred.user.uid}`).set(fresh); } catch(e) {}
        this.currentUserData = fresh;
        return cred.user;
    },

    signIn: async function(email, password) {
        await this._loadSDK();
        const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
        if (!cred.user.emailVerified) {
            await firebase.auth().signOut();
            const err = new Error('Email not verified.');
            err.code = 'auth/email-not-verified';
            throw err;
        }
        this.currentUser = cred.user;
        await this._loadUserData(cred.user.uid);
        return cred.user;
    },

    signInWithGoogle: async function() {
        await this._loadSDK();
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const cred = await firebase.auth().signInWithPopup(provider);
        this.currentUser = cred.user;
        await this._loadUserData(cred.user.uid);
        return cred.user;
    },

    signOut: async function() {
        await this._loadSDK();
        await firebase.auth().signOut();
        this.currentUser = null;
        this.currentUserData = null;
    },

    sendVerificationEmail: async function() {
        if (this.currentUser && !this.currentUser.emailVerified)
            await this.currentUser.sendEmailVerification();
    },

    sendPasswordReset: async function(email) {
        await this._loadSDK();
        await firebase.auth().sendPasswordResetEmail(email);
    },

    isAdmin: async function() {
        if (!this.currentUser) return false;
        try {
            const snap = await this._ref(`admins/${this.currentUser.uid}`).once('value');
            return snap.val() === true;
        } catch(e) { return false; }
    },

    // ─── BACKPACK ─────────────────────────────────────────────────────────────
    getBackpack: function() {
        return (this.currentUserData?.backpack) || [];
    },

    addToBackpack: async function(bookId) {
        if (!this.currentUser || !this.currentUserData) return false;
        const bp = this.getBackpack();
        if (bp.includes(String(bookId))) return true;
        bp.push(String(bookId));
        this.currentUserData.backpack = bp;
        const newCount = (this.currentUserData.bookmarkCount || 0) + 1;
        this.currentUserData.bookmarkCount = newCount;
        try {
            await this._ref(`users/${this.currentUser.uid}`).update({ backpack: bp, bookmarkCount: newCount });
            return true;
        } catch(e) { return false; }
    },

    removeFromBackpack: async function(bookId) {
        if (!this.currentUser || !this.currentUserData) return false;
        const bp = this.getBackpack().filter(id => id !== String(bookId));
        this.currentUserData.backpack = bp;
        const newCount = Math.max(0, (this.currentUserData.bookmarkCount || 0) - 1);
        this.currentUserData.bookmarkCount = newCount;
        try {
            await this._ref(`users/${this.currentUser.uid}`).update({ backpack: bp, bookmarkCount: newCount });
            return true;
        } catch(e) { return false; }
    },

    incrementUserHelped: async function() {
        if (!this.currentUser || !this.currentUserData) return false;
        const newCount = (this.currentUserData.helpedCount || 0) + 1;
        this.currentUserData.helpedCount = newCount;
        try {
            await this._ref(`users/${this.currentUser.uid}`).update({ helpedCount: newCount });
            return newCount;
        } catch(e) { return false; }
    },

    _patchUser: async function(updates) {
        if (!this.currentUser) return false;
        try {
            await this._ref(`users/${this.currentUser.uid}`).update(updates);
            return true;
        } catch(e) { return false; }
    },

    updateUserProfile: async function(displayName, avatarStyle) {
        if (!this.currentUser || !this.currentUserData) return false;
        const updates = {};
        if (displayName && displayName.trim()) {
            updates.displayName = displayName.trim();
            this.currentUserData.displayName = displayName.trim();
            try { await this.currentUser.updateProfile({ displayName: displayName.trim() }); } catch(e) {}
        }
        if (avatarStyle !== undefined) {
            updates.avatarStyle = avatarStyle;
            this.currentUserData.avatarStyle = avatarStyle;
            updates.avatarUrl = null;
            this.currentUserData.avatarUrl = null;
        }
        try {
            await this._ref(`users/${this.currentUser.uid}`).update(updates);
            return true;
        } catch(e) { return false; }
    },

    // ─── LEADERBOARD ──────────────────────────────────────────────────────────
    getLeaderboard: async function() {
        try {
            if (!this.currentUser) return null;
            const snap = await this._ref('users').orderByChild('helpedCount').limitToLast(10).once('value');
            const data = snap.val();
            if (!data) return [];
            return Object.entries(data)
                .filter(([, u]) => u && u.displayName && !u.isPrivate)
                .map(([uid, u]) => ({
                    uid,
                    displayName: u.displayName,
                    helpedCount: u.helpedCount || 0,
                    bookmarkCount: u.bookmarkCount || 0,
                    avatarStyle: u.avatarStyle || null,
                    rank: getRank(u.helpedCount || 0)
                }))
                .sort((a, b) => b.helpedCount - a.helpedCount);
        } catch(e) { return []; }
    },

    getBookSocialProof: async function() { return {}; },

    // ─── INIT & GLOBAL STATS ──────────────────────────────────────────────────
    init: async function() {
        await this._initAuth();
        await this.fetchGlobalStats();
        return true;
    },

    fetchGlobalStats: async function() {
        try {
            const [booksRes, helpedRes] = await Promise.all([
                fetch(`${this.dbUrl}books.json`),
                fetch(`${this.dbUrl}globalStats/helpedCount.json?t=${Date.now()}`)
            ]);
            if (!booksRes.ok) throw new Error("Failed");
            const booksData = await booksRes.json();
            let helpedData = 0;
            if (helpedRes.ok) { try { helpedData = await helpedRes.json(); } catch(e) {} }
            if (Array.isArray(booksData)) {
                this.books = booksData.filter(b => b !== null && b !== undefined);
            } else if (booksData && typeof booksData === 'object') {
                this.books = Object.values(booksData).filter(b => b !== null && b !== undefined);
            } else {
                this.books = [];
            }
            this.helpedCount = (typeof helpedData === 'number') ? helpedData : 0;
            return true;
        } catch(e) { return false; }
    },

    // ─── BOOKS ────────────────────────────────────────────────────────────────
    saveToCloud: async function() {
        try {
            await this._ref('books').set(this.books);
            return true;
        } catch(e) { return false; }
    },

    getBooks: function() { return this.books; },
    getHelpedCount: function() { return this.helpedCount || 0; },

    addBook: async function(book) {
        this.books.push(book);
        return await this.saveToCloud();
    },

    deleteBook: async function(id) {
        this.books = this.books.filter(b => String(b.id) !== String(id));
        return await this.saveToCloud();
    },

    incrementView: async function(id) {
        const book = this.books.find(b => String(b.id) === String(id));
        if (book) {
            book.views = (book.views || 0) + 1;
            this._ref('books').set(this.books).catch(() => {});
        }
    },

    // ─── REVIEWS ──────────────────────────────────────────────────────────────
    fetchReviews: async function() {
        try {
            const res = await fetch(`${this.dbUrl}reviews.json`);
            if (!res.ok) return {};
            const data = await res.json();
            return (data && typeof data === 'object') ? data : {};
        } catch(e) { return {}; }
    },

    submitReview: async function(stars, message) {
        if (!this.currentUser) throw new Error('Not logged in');
        const uid = this.currentUser.uid;
        const review = {
            uid,
            displayName: this.currentUserData?.displayName || this.currentUser.displayName || 'Student',
            email: this.currentUser.email || '',
            avatarStyle: this.currentUserData?.avatarStyle || null,
            stars: parseInt(stars),
            message: message.trim(),
            updatedAt: Date.now()
        };
        await this._ref(`reviews/${uid}`).set(review);
        return review;
    },

    deleteReview: async function() {
        if (!this.currentUser) return false;
        await this._ref(`reviews/${this.currentUser.uid}`).remove();
        return true;
    },

    // ─── GLOBAL HELPED COUNT ──────────────────────────────────────────────────
    incrementHelped: async function() {
        try {
            const ref = this._ref('globalStats/helpedCount');
            const snap = await ref.once('value');
            const current = typeof snap.val() === 'number' ? snap.val() : 0;
            const newCount = current + 1;
            await ref.set(newCount);
            this.helpedCount = newCount;
            return true;
        } catch(e) { return false; }
    },

    factoryReset: async function() {
        this.books.forEach(b => b.views = 0);
        await this.saveToCloud();
        await this._ref('reviews').remove();
        await this._ref('globalStats/helpedCount').set(0);
        this.helpedCount = 0;
        return true;
    },

    getBroadcast: async function() {
        try {
            await this._loadSDK();
            const snap = await firebase.database().ref('broadcast').once('value');
            return snap.val();
        } catch(e) { return null; }
    },

    setBroadcast: async function(obj) {
        try {
            await this._loadSDK();
            await firebase.database().ref('broadcast').set(obj);
            return true;
        } catch(e) {
            console.error('setBroadcast error:', e.message);
            return false;
        }
    },

    getMaintenance: async function() {
        try {
            await this._loadSDK();
            const snap = await firebase.database().ref('maintenance').once('value');
            return snap.val();
        } catch(e) { return false; }
    },

    setMaintenance: async function(status) {
    try {
        await this._loadSDK();

        if (!this.currentUser) {
            throw new Error("User not logged in");
        }

        const isAdmin = await this.isAdmin();
        if (!isAdmin) {
            throw new Error("User is not admin");
        }

        const ref = firebase.database().ref('maintenance');

        await ref.set(!!status);

        const verify = await ref.once('value');
        console.log("Maintenance saved:", verify.val());

        return true;

    } catch(e) {
        console.error("Maintenance write failed:", e);
        return false;
    }
}
};
