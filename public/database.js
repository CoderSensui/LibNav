const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCd1ngYCXhsROkzOES0VkgR05DZLblWYiM",
    authDomain: "libnav-dc2c8.firebaseapp.com",
    databaseURL: "https:
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
    dbUrl: "https:
    books: [],
    helpedCount: 0,
    currentUser: null,
    currentUserData: null,
    _authStateListeners: [],
    _sdkLoaded: false,

    _loadSDK() {
        if (this._sdkLoaded) return Promise.resolve();
        if (this._sdkLoading) return this._sdkLoading;
        this._sdkLoading = new Promise((resolve, reject) => {
            const urls = [
                "https:
                "https:
                "https:
            ];
            let done = 0;
            const timeout = setTimeout(() => reject(new Error('SDK timeout')), 8000);
            urls.forEach(src => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = () => { if (++done === urls.length) { clearTimeout(timeout); this._sdkLoaded = true; resolve(); } };
                s.onerror = () => { clearTimeout(timeout); reject(new Error('SDK load failed')); };
                document.head.appendChild(s);
            });
        });
        return this._sdkLoading;
    },

    async _initAuth() {
        try {
            await this._loadSDK();
            if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
            await Promise.race([
                new Promise(resolve => {
                    let done = false;
                    firebase.auth().onAuthStateChanged(async user => {
                        if (user) { this.currentUser = user; await this._loadUserData(user.uid).catch(() => {}); }
                        else { this.currentUser = null; this.currentUserData = null; }
                        this._authStateListeners.forEach(fn => fn(user));
                        if (!done) { done = true; resolve(); }
                    });
                }),
                new Promise(r => setTimeout(r, 8000))
            ]);
        } catch(e) {
            this.currentUser = null; this.currentUserData = null;
            this._authStateListeners.forEach(fn => fn(null));
        }
    },

    onAuthStateChanged(cb) { this._authStateListeners.push(cb); },

    async _getAuthToken() {
        try { if (this.currentUser) return await this.currentUser.getIdToken(); } catch(e) {}
        return null;
    },

    async _loadUserData(uid) {
        try {
            const token = this.currentUser ? await this.currentUser.getIdToken(true).catch(() => null) : null;
            const auth = token ? `?auth=${token}` : '';
            const res = await fetch(`${this.dbUrl}users/${uid}.json${auth}`);
            const data = res.ok ? await res.json() : null;
            if (data) {
                if (data.helpedCount === undefined) data.helpedCount = 0;
                if (data.backpack === undefined) data.backpack = [];
                if (data.bookmarkCount === undefined) data.bookmarkCount = 0;
                this.currentUserData = data;
            } else {
                const fresh = { displayName: this.currentUser?.displayName || 'Student', email: this.currentUser?.email || '', bookmarkCount: 0, helpedCount: 0, backpack: [], createdAt: Date.now() };
                if (token) await fetch(`${this.dbUrl}users/${uid}.json?auth=${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fresh) });
                this.currentUserData = fresh;
            }
        } catch(e) { this.currentUserData = null; }
    },

    async signUp(email, password, displayName) {
        await this._loadSDK();
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName });
        await cred.user.sendEmailVerification();
        const fresh = { displayName, email, bookmarkCount: 0, helpedCount: 0, backpack: [], createdAt: Date.now() };
        try {
            const token = await cred.user.getIdToken();
            await fetch(`${this.dbUrl}users/${cred.user.uid}.json?auth=${token}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fresh) });
        } catch(e) {}
        this.currentUserData = fresh;
        return cred.user;
    },

    async signIn(email, password) {
        await this._loadSDK();
        const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
        if (!cred.user.emailVerified) {
            await firebase.auth().signOut();
            const err = new Error('Email not verified.'); err.code = 'auth/email-not-verified'; throw err;
        }
        this.currentUser = cred.user;
        await this._loadUserData(cred.user.uid);
        return cred.user;
    },

    async signInWithGoogle() {
        await this._loadSDK();
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const cred = await firebase.auth().signInWithPopup(provider);
        this.currentUser = cred.user;
        await this._loadUserData(cred.user.uid);
        return cred.user;
    },

    async signOut() {
        await this._loadSDK();
        await firebase.auth().signOut();
        this.currentUser = null; this.currentUserData = null;
    },

    async sendVerificationEmail() {
        if (this.currentUser && !this.currentUser.emailVerified) await this.currentUser.sendEmailVerification();
    },

    async sendPasswordReset(email) {
        await this._loadSDK();
        await firebase.auth().sendPasswordResetEmail(email);
    },

    async isAdmin() {
        if (!this.currentUser) return false;
        try {
            const res = await fetch(`${this.dbUrl}admins/${this.currentUser.uid}.json`);
            return (await res.json()) === true;
        } catch(e) { return false; }
    },

    getBackpack() { return this.currentUserData?.backpack || []; },

    async _patchUser(updates) {
        if (!this.currentUser) return false;
        try {
            const token = await this._getAuthToken();
            const auth = token ? `?auth=${token}` : '';
            await fetch(`${this.dbUrl}users/${this.currentUser.uid}.json${auth}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
            return true;
        } catch(e) { return false; }
    },

    async addToBackpack(bookId) {
        if (!this.currentUser || !this.currentUserData) return false;
        const bp = this.getBackpack();
        if (bp.includes(String(bookId))) return true;
        bp.push(String(bookId));
        this.currentUserData.backpack = bp;
        const newCount = (this.currentUserData.bookmarkCount || 0) + 1;
        this.currentUserData.bookmarkCount = newCount;
        return this._patchUser({ backpack: bp, bookmarkCount: newCount });
    },

    async removeFromBackpack(bookId) {
        if (!this.currentUser || !this.currentUserData) return false;
        const bp = this.getBackpack().filter(id => id !== String(bookId));
        this.currentUserData.backpack = bp;
        const newCount = Math.max(0, (this.currentUserData.bookmarkCount || 0) - 1);
        this.currentUserData.bookmarkCount = newCount;
        return this._patchUser({ backpack: bp, bookmarkCount: newCount });
    },

    async incrementUserHelped() {
        if (!this.currentUser || !this.currentUserData) return false;
        const newCount = (this.currentUserData.helpedCount || 0) + 1;
        this.currentUserData.helpedCount = newCount;
        await this._patchUser({ helpedCount: newCount });
        return newCount;
    },

    async getLeaderboard() {
        try {
            const token = await this._getAuthToken();
            if (!token) return null;
            const res = await fetch(`${this.dbUrl}users.json?auth=${token}&orderBy="helpedCount"&limitToLast=10`);
            if (!res.ok) return (res.status === 401 || res.status === 403) ? null : [];
            const data = await res.json();
            if (!data) return [];
            return Object.entries(data)
                .filter(([, u]) => u && u.displayName && !u.isPrivate)
                .map(([uid, u]) => ({ uid, displayName: u.displayName, helpedCount: u.helpedCount || 0, bookmarkCount: u.bookmarkCount || 0, avatarStyle: u.avatarStyle || null, rank: getRank(u.helpedCount || 0) }))
                .sort((a, b) => b.helpedCount - a.helpedCount);
        } catch(e) { return []; }
    },

    async getBookSocialProof() { return {}; },

    async init() {
        await this._initAuth();
        await this.fetchGlobalStats();
        return true;
    },

    async fetchGlobalStats() {
        try {
            const [booksRes, helpedRes] = await Promise.all([
                fetch(`${this.dbUrl}books.json`),
                fetch(`${this.dbUrl}globalStats/helpedCount.json?t=${Date.now()}`)
            ]);
            if (!booksRes.ok) throw new Error("Failed");
            const booksData = await booksRes.json();
            let helpedData = 0;
            if (helpedRes.ok) { try { helpedData = await helpedRes.json(); } catch(e) {} }
            this.books = Array.isArray(booksData)
                ? booksData.filter(Boolean)
                : (booksData && typeof booksData === 'object' ? Object.values(booksData).filter(Boolean) : []);
            this.helpedCount = typeof helpedData === 'number' ? helpedData : 0;
            return true;
        } catch(e) { return false; }
    },

    async fetchReviews() {
        try {
            const res = await fetch(`${this.dbUrl}reviews.json`);
            if (!res.ok) return {};
            const data = await res.json();
            return data && typeof data === 'object' ? data : {};
        } catch(e) { return {}; }
    },

    async submitReview(stars, message) {
        if (!this.currentUser) throw new Error('Not logged in');
        const token = await this._getAuthToken();
        if (!token) throw new Error('No token');
        const uid = this.currentUser.uid;
        const displayName = this.currentUserData?.displayName || this.currentUser.displayName || 'Student';
        const avatarStyle = this.currentUserData?.avatarStyle || null;
        const review = { uid, displayName, avatarStyle, stars: parseInt(stars), message: message.trim(), updatedAt: Date.now() };
        await fetch(`${this.dbUrl}reviews/${uid}.json?auth=${token}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review)
        });
        return review;
    },

    async deleteReview() {
        if (!this.currentUser) return false;
        const token = await this._getAuthToken();
        if (!token) return false;
        await fetch(`${this.dbUrl}reviews/${this.currentUser.uid}.json?auth=${token}`, { method: 'DELETE' });
        return true;
    },

    async saveToCloud() {
        try {
            await fetch(`${this.dbUrl}books.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.books) });
            return true;
        } catch(e) { return false; }
    },

    getBooks() { return this.books; },
    getHelpedCount() { return this.helpedCount || 0; },

    async incrementHelped() {
        try {
            const res = await fetch(`${this.dbUrl}globalStats/helpedCount.json?t=${Date.now()}`);
            let current = await res.json();
            if (typeof current !== 'number') current = 0;
            const newCount = current + 1;
            await fetch(`${this.dbUrl}globalStats/helpedCount.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCount) });
            this.helpedCount = newCount;
            return true;
        } catch(e) { return false; }
    },

    async addBook(book) { this.books.push(book); return this.saveToCloud(); },

    incrementView(id) {
        const book = this.books.find(b => String(b.id) === String(id));
        if (book) {
            book.views = (book.views || 0) + 1;
            fetch(`${this.dbUrl}books.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.books) });
        }
    },

    async factoryReset() {
        this.books.forEach(b => b.views = 0);
        await this.saveToCloud();
        await fetch(`${this.dbUrl}reviews.json`, { method: 'DELETE' });
        await fetch(`${this.dbUrl}globalStats/helpedCount.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(0) });
        this.helpedCount = 0;
        return true;
    },

    async updateUserProfile(displayName, avatarStyle) {
        if (!this.currentUser || !this.currentUserData) return false;
        const updates = {};
        if (displayName?.trim()) { updates.displayName = displayName.trim(); this.currentUserData.displayName = displayName.trim(); try { await this.currentUser.updateProfile({ displayName: displayName.trim() }); } catch(e) {} }
        if (avatarStyle !== undefined) { updates.avatarStyle = avatarStyle; this.currentUserData.avatarStyle = avatarStyle; updates.avatarUrl = null; this.currentUserData.avatarUrl = null; }
        return this._patchUser(updates);
    },

    async getBroadcast() {
        try { const res = await fetch(`${this.dbUrl}broadcast.json`); return await res.json(); } catch(e) { return null; }
    },

    async setBroadcast(obj) {
        try {
            const token = await this._getAuthToken();
            const auth = token ? `?auth=${token}` : '';
            await fetch(`${this.dbUrl}broadcast.json${auth}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
            return true;
        } catch(e) { return false; }
    },

    async getMaintenance() {
        try { const res = await fetch(`${this.dbUrl}maintenance.json?t=${Date.now()}`); return await res.json(); } catch(e) { return false; }
    },

    async setMaintenance(status) {
        try {
            const token = await this._getAuthToken();
            const auth = token ? `?auth=${token}` : '';
            await fetch(`${this.dbUrl}maintenance.json${auth}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(status) });
            return true;
        } catch(e) { return false; }
    }
};
