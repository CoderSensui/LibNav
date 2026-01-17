/* database.js - v9 (Async & Scalable) */

const LibraryDB = {
    key: 'library_books_v9',
    
    // This will now be populated asynchronously
    books: [],

    init: async function() {
        // Try to get from LocalStorage first for speed
        const stored = localStorage.getItem(this.key);
        if (stored) {
            this.books = JSON.parse(stored);
            console.log("Loaded books from cache.");
        } else {
            // Fetch from external JSON file if not in storage
            await this.loadBooks();
        }
    },
    
    loadBooks: async function() {
        try {
            const response = await fetch('books.json');
            if (!response.ok) throw new Error("Failed to load books.json");
            
            this.books = await response.json();
            localStorage.setItem(this.key, JSON.stringify(this.books));
            console.log("Loaded books from JSON file.");
        } catch (error) {
            console.error("Database Error:", error);
            this.books = []; 
        }
    },
    
    getBooks: function() {
        return this.books;
    }
};

// Start initialization immediately
LibraryDB.init();
