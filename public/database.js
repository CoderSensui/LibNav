/* database.js - Global View Counting Enabled */

const LibraryDB = {
    // ⚠️ YOUR SPECIFIC FIREBASE URL
    dbUrl: "https://libnav-dc2c8-default-rtdb.firebaseio.com/", 
    books: [],

    init: async function() {
        console.log("🔥 Connecting to LibNav Global Database...");
        try {
            const response = await fetch(`${this.dbUrl}.json`);
            if (!response.ok) throw new Error("Cloud Connection Failed");
            
            const data = await response.json();
            
            if (data && data.books) {
                this.books = Object.values(data.books).filter(b => b !== null && b !== undefined); 
            } else if (Array.isArray(data)) {
                this.books = data.filter(b => b !== null && b !== undefined);
            } else if (data && typeof data === 'object') {
                this.books = Object.values(data).filter(b => b !== null && b !== undefined);
            } else {
                this.books = []; 
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
            console.error("❌ Sync Error:", error);
            return false;
        }
    },
    
    getBooks: function() { return this.books; },

    addBook: async function(book) {
        this.books.push(book);
        return await this.saveToCloud();
    },

    deleteBook: async function(id) {
        this.books = this.books.filter(b => String(b.id) !== String(id));
        return await this.saveToCloud();
    },

    // NEW: Global View Counter logic
    incrementView: async function(id) {
        const book = this.books.find(b => String(b.id) === String(id));
        if (book) {
            // Initialize views if it doesn't exist, then add 1
            book.views = (book.views || 0) + 1;
            // Save the new count to the cloud silently
            await this.saveToCloud(); 
        }
    }
};
