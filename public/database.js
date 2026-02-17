/* database.js */

const LibraryDB = {
    key: 'libnav_final_db', 
    books: [],

    init: async function() {
        if(localStorage.getItem('library_books_vFinal')) localStorage.removeItem('library_books_vFinal');
        await this.loadBooks();
    },
    
    loadBooks: async function() {
        try {
            const response = await fetch('books.json');
            if (!response.ok) throw new Error("File not found");
            this.books = await response.json();
            console.log("📚 Placeholder books loaded.");
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
