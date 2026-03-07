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

    _loadSDK: function() {
        if (this._sdkLoaded) return Promise.resolve();
        if (this._sdkLoading) return this._sdkLoading;
        this._sdkLoading = new Promise((resolve, reject) => {
            const urls = [
                "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
                "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js",
                "https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"
            ];
            let done = 0;
            const timeout = setTimeout(() => reject(new Error('Firebase SDK load timeout')), 8000);
            urls.forEach(src => {
                const s = document.createElement('script');
                s.src = src;
                s.onload = () => {
                    done++;
                    if (done === urls.length) {
                        clearTimeout(timeout);
                        this._sdkLoaded = true;
                        resolve();
                    }
                };
                s.onerror = () => { clearTimeout(timeout); reject(new Error('Firebase SDK load failed')); };
                document.head.appendChild(s);
            });
        });
        return this._sdkLoading;
    },

    _initAuth: async function() {
        try {
            await this._loadSDK();
            if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
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

    _loadUserData: async function(uid) {
        try {
            
            const res = await fetch(`${this.dbUrl}users/${uid}.json`);
            const data = res.ok ? await res.json() : null;
            if (data) {
                
                if (data.helpedCount === undefined) data.helpedCount = 0;
                if (data.backpack === undefined) data.backpack = [];
                if (data.bookmarkCount === undefined) data.bookmarkCount = 0;
                this.currentUserData = data;
                
                const needsPatch = (data.helpedCount === 0 && data.backpack !== undefined);
                if (data.helpedCount === undefined || data.backpack === undefined) {
                    firebase.database().ref(`users/${uid}`).update({ helpedCount: 0, backpack: data.backpack || [], bookmarkCount: data.bookmarkCount || 0 }).catch(() => {});
                }
            } else {
                
                const fresh = {
                    displayName: this.currentUser?.displayName || 'Student',
                    email: this.currentUser?.email || '',
                    bookmarkCount: 0,
                    helpedCount: 0,
                    backpack: [],
                    createdAt: Date.now()
                };
                await firebase.database().ref(`users/${uid}`).set(fresh).catch(() => {});
                this.currentUserData = fresh;
            }
        } catch(e) {
            console.warn('_loadUserData error:', e);
            this.currentUserData = null;
        }
    },

    signUp: async function(email, password, displayName) {
        await this._loadSDK();
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName });
        await cred.user.sendEmailVerification();
        const fresh = { displayName, email, bookmarkCount: 0, helpedCount: 0, backpack: [], createdAt: Date.now() };
        try {
            await firebase.database().ref(`users/${cred.user.uid}`).set(fresh);
        } catch(e) {}
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
            await firebase.database().ref(`users/${this.currentUser.uid}`).update({ backpack: bp, bookmarkCount: newCount });
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
            await firebase.database().ref(`users/${this.currentUser.uid}`).update({ backpack: bp, bookmarkCount: newCount });
            return true;
        } catch(e) { return false; }
    },

    incrementUserHelped: async function() {
        if (!this.currentUser || !this.currentUserData) return false;
        const newCount = (this.currentUserData.helpedCount || 0) + 1;
        this.currentUserData.helpedCount = newCount;
        try {
            await firebase.database().ref(`users/${this.currentUser.uid}`).update({ helpedCount: newCount });
            return newCount;
        } catch(e) { return false; }
    },

    _getAuthToken: async function() {
        try {
            if (this.currentUser) {
                return await this.currentUser.getIdToken(true);
            }
        } catch(e) {}
        return null;
    },

    getLeaderboard: async function() {
        try {
            const token = await this._getAuthToken();
            if (!token) return null; 

            
            
            const queryUrl = `${this.dbUrl}users.json?auth=${token}&orderBy="helpedCount"&limitToLast=10`;
            const res = await fetch(queryUrl);
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) return null;
                return [];
            }
            const data = await res.json();
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

    getBookSocialProof: async function() {
        
        
        
        return {};
    },

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

    saveToCloud: async function() {
        try {
            await firebase.database().ref('books').set(this.books);
            return true;
        } catch(e) { return false; }
    },

    getBooks: function() { return this.books; },
    getHelpedCount: function() { return this.helpedCount || 0; },

    _patchUser: async function(updates) {
        if (!this.currentUser) return false;
        try {
            await firebase.database().ref(`users/${this.currentUser.uid}`).update(updates);
            return true;
        } catch(e) { return false; }
    },

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
        const token = await this._getAuthToken();
        if (!token) throw new Error('No token');
        const uid = this.currentUser.uid;
        const displayName = this.currentUserData?.displayName || this.currentUser.displayName || 'Student';
        const avatarStyle = this.currentUserData?.avatarStyle || null;
        const email = this.currentUser.email || '';
        const review = { uid, displayName, email, avatarStyle, stars: parseInt(stars), message: message.trim(), updatedAt: Date.now() };
        await firebase.database().ref(`reviews/${uid}`).set(review);
        return review;
    },

    deleteReview: async function() {
        if (!this.currentUser) return false;
        const token = await this._getAuthToken();
        if (!token) return false;
        await firebase.database().ref(`reviews/${this.currentUser.uid}`).remove();
        return true;
    },

    incrementHelped: async function() {
        try {
            const ref = firebase.database().ref('globalStats/helpedCount');
            const snap = await ref.once('value');
            const current = (typeof snap.val() === 'number') ? snap.val() : 0;
            const newCount = current + 1;
            await ref.set(newCount);
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
            firebase.database().ref('books').set(this.books).catch(() => {});
        }
    },

    factoryReset: async function() {
        this.books.forEach(b => b.views = 0);
        await this.saveToCloud();
        await firebase.database().ref('reviews').remove();
        await firebase.database().ref('globalStats/helpedCount').set(0);
        this.helpedCount = 0;
        return true;
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
            await firebase.database().ref(`users/${this.currentUser.uid}`).update(updates);
            return true;
        } catch(e) { return false; }
    },

    getBroadcast: async function() {
        try { const res = await fetch(`${this.dbUrl}broadcast.json`); return await res.json(); } catch(e) { return null; }
    },

    setBroadcast: async function(obj) {
        try {
            await firebase.database().ref('broadcast').set(obj);
            return true;
        } catch(e) { return false; }
    },
    
    getMaintenance: async function() {
        try { const res = await fetch(`${this.dbUrl}maintenance.json?t=${Date.now()}`); return await res.json(); } catch(e) { return false; }
    },

    setMaintenance: async function(status) {
        try {
            await firebase.database().ref('maintenance').set(status);
            return true;
        } catch(e) { return false; }
    }
};
