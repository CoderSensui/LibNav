/* database.js - Powered by JSONBin.io (Cloud) */

const LibraryDB = {
    // YOUR CLOUD CREDENTIALS
    binId: "69994556ae596e708f3c0715",
    apiKey: "$2a$10$OP.f7BAIsHpCyfBXqprbgevRwToFbx.jpbQTPXoftEPTxBWHqRmvy", // Master Key
    
    books: [],

    // Initialize: Fetch data from the Cloud
    init: async function() {
        console.log("☁️ Connecting to Global Database...");
        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${this.binId}`, {
                method: 'GET',
                headers: {
                    'X-Master-Key': this.apiKey
                }
            });

            if (!response.ok) throw new Error("Cloud Connection Failed");
            
            const data = await response.json();
            
            // JSONBin v3 stores the actual array inside "record"
            this.books = data.record || [];
            console.log(`✅ Loaded ${this.books.length} books from Cloud.`);
            return true;
        } catch (error) {
            console.error("❌ Critical Error:", error);
            alert("Could not connect to the database. Please check your internet.");
            this.books = []; // Fallback to empty
            return false;
        }
    },

    // Save: Push updates to the Cloud (Overwrites the file)
    saveToCloud: async function() {
        try {
            const response = await fetch(`https://api.jsonbin.io/v3/b/${this.binId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey
                },
                body: JSON.stringify(this.books)
            });

            if (!response.ok) throw new Error("Save Failed");
            console.log("☁️ Sync Successful!");
            return true;
        } catch (error) {
            console.error("Save Error:", error);
            alert("Failed to save changes to the cloud.");
            return false;
        }
    },
    
    getBooks: function() {
        return this.books;
    },

    // --- ADMIN FUNCTIONS (Async now) ---

    addBook: async function(book) {
        this.books.push(book);
        return await this.saveToCloud();
    },

    deleteBook: async function(id) {
        this.books = this.books.filter(book => book.id !== id);
        return await this.saveToCloud();
    },
    
    // Only use this if you mess up the database and need to reset!
    resetToDefaults: async function(defaultBooks) {
        this.books = defaultBooks;
        return await this.saveToCloud();
    }
};
