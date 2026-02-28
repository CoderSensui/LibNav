const LibraryDB = {
    dbUrl: "https://libnav-dc2c8-default-rtdb.firebaseio.com/",
    books: [],
    ratings: [],

    init: async function() {
        try {
            const [booksRes, ratingsRes] = await Promise.all([
                fetch(`${this.dbUrl}books.json`),
                fetch(`${this.dbUrl}ratings.json`)
            ]);
            if (booksRes.ok) {
                const booksData = await booksRes.json();
                this.books = Array.isArray(booksData) ? booksData.filter(b => b) : (booksData ? Object.values(booksData).filter(b => b) : []);
            }
            if (ratingsRes.ok) {
                const ratingsData = await ratingsRes.json();
                this.ratings = ratingsData ? Object.values(ratingsData) : [];
            }
            return true;
        } catch (error) { return false; }
    },

    saveToCloud: async function() {
        try {
            await fetch(`${this.dbUrl}books.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.books) });
            return true;
        } catch (error) { return false; }
    },

    getBooks: function() { return this.books; },
    getRatings: function() { return this.ratings; },

    // --- BULLETPROOF HELPED COUNTER ---
    getHelpedCount: async function() {
        try {
            const res = await fetch(`${this.dbUrl}helpedCount.json`);
            const count = await res.json();
            return typeof count === 'number' ? count : 0;
        } catch (err) { return 0; }
    },

    incrementHelped: async function() {
        try {
            let current = await this.getHelpedCount();
            current++;
            await fetch(`${this.dbUrl}helpedCount.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(current)
            });
            return true;
        } catch (err) { return false; }
    },
    // ----------------------------------

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
            fetch(`${this.dbUrl}books.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.books) });
        }
    },

    submitRating: async function(stars) {
        try {
            this.ratings.push(stars);
            await fetch(`${this.dbUrl}ratings.json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stars) });
            return true;
        } catch (err) { return false; }
    },

    factoryReset: async function() {
        this.books.forEach(b => b.views = 0);
        await this.saveToCloud();
        await fetch(`${this.dbUrl}ratings.json`, { method: 'DELETE' });
        this.ratings = [];
        await fetch(`${this.dbUrl}helpedCount.json`, { method: 'PUT', body: '0' });
        return true;
    },

    getBroadcast: async function() {
        try { const res = await fetch(`${this.dbUrl}broadcast.json`); return await res.json(); } catch(e) { return null; }
    },
    setBroadcast: async function(broadcastObj) {
        try { await fetch(`${this.dbUrl}broadcast.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(broadcastObj) }); return true; } catch(e) { return false; }
    },

    getMaintenance: async function() {
        try { const res = await fetch(`${this.dbUrl}maintenance.json`); return await res.json(); } catch(e) { return false; }
    },
    setMaintenance: async function(status) {
        try { await fetch(`${this.dbUrl}maintenance.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(status) }); return true; } catch(e) { return false; }
    },

    verifyAdminPassword: async function(inputPass) {
        try {
            const res = await fetch(`${this.dbUrl}admin_password.json`);
            const realPass = await res.json();
            if (!realPass) {
                await fetch(`${this.dbUrl}admin_password.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify("admin123") });
                return inputPass === "admin123";
            }
            return inputPass === realPass;
        } catch(e) { return inputPass === "admin123"; }
    },

    createAdminSession: async function() {
        const token = crypto.randomUUID();
        const expiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
        try {
            await fetch(`${this.dbUrl}admin_sessions/${token}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, expiry }) });
            return token;
        } catch(e) { return null; }
    },

    verifyAdminSession: async function(token) {
        if (!token) return false;
        try {
            const res = await fetch(`${this.dbUrl}admin_sessions/${token}.json`);
            const session = await res.json();
            if (!session || !session.expiry || Date.now() > session.expiry) { await this.destroyAdminSession(token); return false; }
            return true;
        } catch(e) { return false; }
    },

    destroyAdminSession: async function(token) {
        if (!token) return;
        try { await fetch(`${this.dbUrl}admin_sessions/${token}.json`, { method: 'DELETE' }); } catch(e) {}
        localStorage.removeItem('libnav_admin_token');
    }
};
