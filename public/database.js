/* database.js - Robust Firebase Cloud Engine */

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
            
            // Defensive coding: Handle different Firebase data structures safely
            if (data && data.books) {
                this.books = Object.values(data.books); 
            } else if (Array.isArray(data)) {
                this.books = data;
            } else if (data && typeof data === 'object') {
                this.books = Object.values(data);
            } else {
                this.books = []; // Fallback if database is completely empty
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
        this.books = this.books.filter(b => b.id !== id);
        return await this.saveToCloud();
    }
};
