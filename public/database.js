/* database.js - Firebase Backend */

const LibraryDB = {
    dbUrl: "https://libnav-dc2c8-default-rtdb.firebaseio.com/", 
    books: [],

    init: async function() {
        try {
            const response = await fetch(`${this.dbUrl}books.json`);
            if (!response.ok) throw new Error("Sync Failed");
            const data = await response.json();
            this.books = data || [];
            return true;
        } catch (error) {
            console.error("Firebase Error:", error);
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

    addBook: async function(book) {
        this.books.push(book);
        return await this.saveToCloud();
    },

    deleteBook: async function(id) {
        this.books = this.books.filter(b => b.id !== id);
        return await this.saveToCloud();
    }
};
