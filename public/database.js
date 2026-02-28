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
    ratings: [],
    helpedCount: 0,
    currentUser: null,
    currentUserData: null,
    _authStateListeners: [],
    _sdkLoaded: false,

    _loadSDK: function() {
        if (this._sdkLoaded) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const urls = [
                "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
                "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"
            ];
            let done = 0;
            urls.forEach(src => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = () => { done++; if (done === urls.length) { this._sdkLoaded = true; resolve(); } };
                s.onerror = reject;
                document.head.appendChild(s);
            });
        });
    },

    _initAuth: async function() {
        await this._loadSDK();
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        return new Promise(resolve => {
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    await this._loadUserData(user.uid);
                } else {
                    this.currentUser = null;
                    this.currentUserData = null;
                }
                this._authStateListeners.forEach(fn => fn(user));
                resolve();
            });
        });
    },

    onAuthStateChanged: function(cb) {
        this._authStateListeners.push(cb);
    },

    _loadUserData: async function(uid) {
        try {
            const res = await fetch(`${this.dbUrl}users/${uid}.json`);
            const data = await res.json();
            if (data) {
                this.currentUserData = data;
            } else {
                const fresh = {
                    displayName: this.currentUser?.displayName || 'Student',
                    email: this.currentUser?.email || '',
                    bookmarkCount: 0,
                    backpack: [],
                    createdAt: Date.now()
                };
                await fetch(`${this.dbUrl}users/${uid}.json`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fresh)
                });
                this.currentUserData = fresh;
            }
        } catch(e) { this.currentUserData = null; }
    },

    signUp: async function(email, password, displayName) {
        await this._loadSDK();
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName });
        await cred.user.sendEmailVerification();
        const fresh = { displayName, email, bookmarkCount: 0, backpack: [], createdAt: Date.now() };
        await fetch(`${this.dbUrl}users/${cred.user.uid}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fresh)
        });
        this.currentUserData = fresh;
        return cred.user;
    },

    signIn: async function(email, password) {
        await this._loadSDK();
        const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
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
        if (this.currentUser && !this.currentUser.emailVerified) {
            await this.currentUser.sendEmailVerification();
        }
    },

    sendPasswordReset: async function(email) {
        await this._loadSDK();
        await firebase.auth().sendPasswordResetEmail(email);
    },

    isAdmin: async function() {
        if (!this.currentUser) return false;
        try {
            const res = await fetch(`${this.dbUrl}admins/${this.currentUser.uid}.json`);
            const val = await res.json();
            return val === true;
        } catch(e) { return false; }
    },

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
            await fetch(`${this.dbUrl}users/${this.currentUser.uid}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backpack: bp, bookmarkCount: newCount })
            });
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
            await fetch(`${this.dbUrl}users/${this.currentUser.uid}.json`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backpack: bp, bookmarkCount: newCount })
            });
            return true;
        } catch(e) { return false; }
    },

    getLeaderboard: async function() {
        try {
            const res = await fetch(`${this.dbUrl}users.json`);
            const data = await res.json();
            if (!data) return [];
            return Object.entries(data)
                .filter(([, u]) => u && u.displayName && !u.isPrivate)
                .map(([uid, u]) => ({
                    uid,
                    displayName: u.displayName,
                    bookmarkCount: u.bookmarkCount || 0,
                    rank: getRank(u.bookmarkCount || 0)
                }))
                .sort((a, b) => b.bookmarkCount - a.bookmarkCount)
                .slice(0, 10);
        } catch(e) { return []; }
    },

    getBookSocialProof: async function() {
        try {
            const res = await fetch(`${this.dbUrl}users.json`);
            const data = await res.json();
            if (!data) return {};
            const proof = {};
            Object.values(data).forEach(u => {
                if (u?.backpack) {
                    u.backpack.forEach(id => { proof[id] = (proof[id] || 0) + 1; });
                }
            });
            return proof;
        } catch(e) { return {}; }
    },

    init: async function() {
        await this._initAuth();
        await this.fetchGlobalStats();
        return true;
    },

    fetchGlobalStats: async function() {
        try {
            const [booksRes, ratingsRes, helpedRes] = await Promise.all([
                fetch(`${this.dbUrl}books.json`),
                fetch(`${this.dbUrl}ratings.json`),
                fetch(`${this.dbUrl}globalStats/helpedCount.json?t=${Date.now()}`)
            ]);
            if (!booksRes.ok) throw new Error("Failed");
            const booksData = await booksRes.json();
            const ratingsData = await ratingsRes.json();
            let helpedData = 0;
            if (helpedRes.ok) { try { helpedData = await helpedRes.json(); } catch(e) {} }
            if (Array.isArray(booksData)) {
                this.books = booksData.filter(b => b !== null && b !== undefined);
            } else if (booksData && typeof booksData === 'object') {
                this.books = Object.values(booksData).filter(b => b !== null && b !== undefined);
            } else {
                this.books = [];
            }
            this.ratings = (ratingsData && typeof ratingsData === 'object') ? Object.values(ratingsData) : [];
            this.helpedCount = (typeof helpedData === 'number') ? helpedData : 0;
            return true;
        } catch(e) { return false; }
    },

    saveToCloud: async function() {
        try {
            await fetch(`${this.dbUrl}books.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.books)
            });
            return true;
        } catch(e) { return false; }
    },

    getBooks: function() { return this.books; },
    getRatings: function() { return this.ratings; },
    getHelpedCount: function() { return this.helpedCount || 0; },

    incrementHelped: async function() {
        try {
            const res = await fetch(`${this.dbUrl}globalStats/helpedCount.json?t=${Date.now()}`);
            let current = await res.json();
            if (typeof current !== 'number') current = 0;
            const newCount = current + 1;
            await fetch(`${this.dbUrl}globalStats/helpedCount.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCount)
            });
            this.helpedCount = newCount;
            return true;
        } catch(e) { return false; }
    },

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
            fetch(`${this.dbUrl}books.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.books)
            });
        }
    },

    submitRating: async function(stars) {
        try {
            this.ratings.push(stars);
            await fetch(`${this.dbUrl}ratings.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stars)
            });
            return true;
        } catch(e) { return false; }
    },

    factoryReset: async function() {
        this.books.forEach(b => b.views = 0);
        await this.saveToCloud();
        await fetch(`${this.dbUrl}ratings.json`, { method: 'DELETE' });
        this.ratings = [];
        await fetch(`${this.dbUrl}globalStats/helpedCount.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(0)
        });
        this.helpedCount = 0;
        return true;
    },

    getBroadcast: async function() {
        try { const res = await fetch(`${this.dbUrl}broadcast.json`); return await res.json(); } catch(e) { return null; }
    },

    setBroadcast: async function(obj) {
        try {
            await fetch(`${this.dbUrl}broadcast.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(obj)
            });
            return true;
        } catch(e) { return false; }
    },

    getMaintenance: async function() {
        try { const res = await fetch(`${this.dbUrl}maintenance.json?t=${Date.now()}`); return await res.json(); } catch(e) { return false; }
    },

    setMaintenance: async function(status) {
        try {
            await fetch(`${this.dbUrl}maintenance.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(status)
            });
            return true;
        } catch(e) { return false; }
    }
};
