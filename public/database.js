/* database.js - vFinal (5 Genres, 20 Books Each) */

const LibraryDB = {
    key: 'libnav_final_db', 
    books: [],

    init: async function() {
        // Clear old junk from browser memory to ensure new books load
        if(localStorage.getItem('library_books_vFinal')) localStorage.removeItem('library_books_vFinal');
        await this.loadBooks();
    },
    
    loadBooks: async function() {
        try {
            const response = await fetch('books.json');
            if (!response.ok) throw new Error("File not found");
            this.books = await response.json();
            console.log("📚 100 placeholder books loaded.");
        } catch (error) {
            console.error("❌ Error loading books.json:", error);
            this.books = []; 
        }
        localStorage.setItem(this.key, JSON.stringify(this.books));
    },
    
    getBooks: function() {
        return this.books;
    }
};

LibraryDB.init();
