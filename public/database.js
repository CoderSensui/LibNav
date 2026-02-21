/* database.js - Ultimate Firebase Cloud Engine */

const LibraryDB = {
    // ⚠️ YOUR SPECIFIC FIREBASE URL
    dbUrl: "https://libnav-dc2c8-default-rtdb.firebaseio.com/", 
    books: [],
    ratings: [],

    init: async function() {
        console.log("🔥 Connecting to LibNav Global Database...");
        try {
            const response = await fetch(`${this.dbUrl}.json`);
            if (!response.ok) throw new Error("Cloud Connection Failed");
            
            const data = await response.json() || {};
            
            // 1. Load Books
            if (data.books) {
                this.books = Object.values(data.books).filter(b => b !== null && b !== undefined); 
            } else if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                this.books = data.filter(b => b !== null && b !== undefined);
            } else {
                this.books = []; 
            }

            // 2. Load Ratings
            if (data.ratings) {
                this.ratings = Object.values(data.ratings).filter(r => r !== null && r !== undefined);
            } else {
                this.ratings = [];
            }

            console.log(`✅ Success: ${this.books.length} books loaded.`);
            return true;
        } catch (error) {
            console.error("❌ Firebase Error:", error);
            return false;
        }
    },

    saveToCloud: async function() {
        try {
            const response = await fetch(`${this.dbUrl}books.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.books)
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    },
    
    getBooks: function() { return this.books; },
    getRatings: function() { return this.ratings; },

    addBook: async function(book) {
        this.books.push(book);
        return await this.saveToCloud();
    },

    deleteBook: async function(id) {
        this.books = this.books.filter(b => String(b.id) !== String(id));
        return await this.saveToCloud();
    },

    // GLOBAL VIEW TRACKER
    incrementView: async function(id) {
        const book = this.books.find(b => String(b.id) === String(id));
        if (book) {
            book.views = (book.views || 0) + 1;
            await this.saveToCloud(); 
        }
    },

    // 5-STAR RATING SYSTEM
    submitRating: async function(stars) {
        try {
            this.ratings.push(stars);
            await fetch(`${this.dbUrl}ratings.json`, {
                method: 'POST', // Push a new entry
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stars)
            });
        } catch (err) { console.error("Rating save failed", err); }
    },

    // SOFT FACTORY RESET
    factoryReset: async function() {
        // 1. Reset all views to 0
        this.books.forEach(b => b.views = 0);
        await this.saveToCloud();
        
        // 2. Delete all ratings
        await fetch(`${this.dbUrl}ratings.json`, { method: 'DELETE' });
        this.ratings = [];

        // 3. Clear Local Storage
        localStorage.clear();
        return true;
    }
};
