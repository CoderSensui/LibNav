const LibraryDB = {
    dbUrl: "https://libnav-dc2c8-default-rtdb.firebaseio.com/",
    books: [],
    ratings: [],
    helpedRecords: [], // Stores the list of helped objects

    init: async function() {
        // Keeps init simple for the main app load
        await this.fetchGlobalStats(); 
        return true;
    },

    // Fetches fresh data when opening the Stats modal
    fetchGlobalStats: async function() {
        try {
            const [booksRes, ratingsRes, helpedRes] = await Promise.all([
                fetch(`${this.dbUrl}books.json`),
                fetch(`${this.dbUrl}ratings.json`),
                fetch(`${this.dbUrl}helped.json`) // Fetching the list of helped events
            ]);

            if (!booksRes.ok) throw new Error("Failed to load");

            const booksData = await booksRes.json();
            const ratingsData = await ratingsRes.json();
            const helpedData = await helpedRes.json();

            // Handle Books
            if (Array.isArray(booksData)) {
                this.books = booksData.filter(b => b !== null && b !== undefined);
            } else if (booksData && typeof booksData === 'object') {
                this.books = Object.values(booksData).filter(b => b !== null && b !== undefined);
            } else {
                this.books = [];
            }

            // Handle Ratings
            if (ratingsData && typeof ratingsData === 'object') {
                this.ratings = Object.values(ratingsData);
            } else {
                this.ratings = [];
            }

            // Handle Helped Counts
            if (helpedData && typeof helpedData === 'object') {
                this.helpedRecords = Object.values(helpedData);
            } else {
                this.helpedRecords = [];
            }
            return true;
        } catch (error) {
            console.error("DB Error", error);
            return false;
        }
    },

    saveToCloud: async function() {
        try {
            await fetch(`${this.dbUrl}books.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.books)
            });
            return true;
        } catch (error) { return false; }
    },

    getBooks: function() { return this.books; },
    getRatings: function() { return this.ratings; },
    
    // Returns the length of the array (e.g., 5 people helped)
    getHelpedCount: function() { return this.helpedRecords.length; },

    // MIRRORED LOGIC: Adds a record object to the list, just like reviews
    incrementHelped: async function() {
        try {
            // FIXED: We wrap the timestamp in an object. Firebase prefers objects when creating new list nodes via POST.
            const record = { timestamp: Date.now() }; 
            
            // Optimistically update local data so it feels fast
            this.helpedRecords.push(record);
            
            // Send to Firebase
            await fetch(`${this.dbUrl}helped.json`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            });
            return true;
        } catch (err) { 
            console.error("Firebase Write Failed:", err);
            return false; 
        }
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
        } catch (err) {
            return false;
        }
    },

    factoryReset: async function() {
        this.books.forEach(b => b.views = 0);
        await this.saveToCloud();

        await fetch(`${this.dbUrl}ratings.json`, { method: 'DELETE' });
        this.ratings = [];

        await fetch(`${this.dbUrl}helped.json`, { method: 'DELETE' });
        this.helpedRecords = [];

        // Clean up any old local storage items
        localStorage.removeItem('libnav_helped_local');

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
        const session = { token, expiry };
        try {
            await fetch(`${this.dbUrl}admin_sessions/${token}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session) });
            return token;
        } catch(e) { return null; }
    },

    verifyAdminSession: async function(token) {
        if (!token) return false;
        try {
            const res = await fetch(`${this.dbUrl}admin_sessions/${token}.json`);
            const session = await res.json();
            if (!session || !session.expiry) return false;
            if (Date.now() > session.expiry) { await this.destroyAdminSession(token); return false; }
            return true;
        } catch(e) { return false; }
    },

    destroyAdminSession: async function(token) {
        if (!token) return;
        try { await fetch(`${this.dbUrl}admin_sessions/${token}.json`, { method: 'DELETE' }); } catch(e) {}
        localStorage.removeItem('libnav_admin_token');
    }
};
