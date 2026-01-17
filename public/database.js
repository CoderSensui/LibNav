/* database.js - vFinal (Clean Fetch) */

const LibraryDB = {
    key: 'library_books_vFinal', 
    books: [],

    init: async function() {
        // Clear old keys to avoid conflicts
        if(localStorage.getItem('library_books_v10')) localStorage.removeItem('library_books_v10');
        await this.loadBooks();
    },
    
    loadBooks: async function() {
        try {
            const response = await fetch('books.json');
            if (!response.ok) throw new Error("Could not load books.json");
            this.books = await response.json();
            console.log("📚 Books loaded from file.");
        } catch (error) {
            console.error("❌ Database Error:", error);
            this.books = []; // Empty if file missing
        }
        // Cache the result
        localStorage.setItem(this.key, JSON.stringify(this.books));
    },
    
    getBooks: function() {
        return this.books;
    },

    getMapUrl: function(genre) {
        // Helper if you ever need genre-based map images again
        return 'map.svg'; 
    }
};

LibraryDB.init();
