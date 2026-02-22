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

            // 2. Load Ratings (Handles both object format and array format)
            if (data.ratings) {
                // If ratings are stored as "-Key": 5, Object.values gets [5, 5, 4]
                this.ratings = Object.values(data.ratings).filter(r => r !== null && r !== undefined && typeof r === 'number');
            } else {
                this.ratings = [];
            }

            console.log(`✅ Success: ${this.books.length} books loaded. Ratings: ${this.ratings.length}`);
            return true;
        } catch (error) {
            console.error("❌ Firebase Error:", error);
            return false;
        }
    },

    saveToCloud: async function() {
        try {
            // We only save the books array here
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
            // Fire and forget update to speed up UI
            fetch(`${this.dbUrl}books.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.books)
            });
        }
    },

    // 5-STAR RATING SYSTEM
    submitRating: async function(stars) {
        try {
            this.ratings.push(stars);
            // Push a new rating to the list (auto-ID)
            await fetch(`${this.dbUrl}ratings.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stars)
            });
            return true;
        } catch (err) { 
            console.error("Rating save failed", err); 
            return false;
        }
    },

    // SOFT FACTORY RESET (Clears Views & Ratings)
    factoryReset: async function() {
        // 1. Reset local book views
        this.books.forEach(b => b.views = 0);
        
        // 2. Save reset books to cloud
        await this.saveToCloud();

        // 3. Delete ratings node entirely
        await fetch(`${this.dbUrl}ratings.json`, { method: 'DELETE' });
        
        // 4. Clear local ratings
        this.ratings = [];
        
        // 5. Clear local storage favorites (Optional, but good for a full reset)
        // localStorage.removeItem('libnav_favs'); 
        
        return true;
    }
};
