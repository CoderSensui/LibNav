const LibraryDB = {
    dbUrl: "https://libnav-dc2c8-default-rtdb.firebaseio.com/", 
    books: [],
    ratings: [],

    init: async function() {
        console.log("🔥 Connecting to LibNav Global Database...");
        try {
            const response = await fetch(`${this.dbUrl}.json`);
            if (!response.ok) throw new Error("Cloud Connection Failed");
            
            const data = await response.json() || {};
            
            if (data.books) {
                this.books = Object.values(data.books).filter(b => b !== null && b !== undefined); 
            } else if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                this.books = data.filter(b => b !== null && b !== undefined);
            } else {
                this.books = []; 
            }

            if (data.ratings) {
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

    incrementView: async function(id) {
        const book = this.books.find(b => String(b.id) === String(id));
        if (book) {
            book.views = (book.views || 0) + 1;
            fetch(`${this.dbUrl}books.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.books)
            });
        }
    },

    submitRating: async function(stars) {
        try {
            this.ratings.push(stars);
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

    factoryReset: async function() {
        this.books.forEach(b => b.views = 0);
        
        await this.saveToCloud();

        await fetch(`${this.dbUrl}ratings.json`, { method: 'DELETE' });
        
        this.ratings = [];
        
        return true;
    },

      // --- ADD THESE AT THE END OF LibraryDB (Before the final }; ) ---
    getBroadcast: async function() {
        try { const res = await fetch(`${this.dbUrl}broadcast.json`); return await res.json(); } catch(e) { return null; }
    },
    setBroadcast: async function(broadcastObj) {
        try { await fetch(`${this.dbUrl}broadcast.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(broadcastObj) }); return true; } catch(e) { return false; }
    },

    // --- NEW MAINTENANCE FUNCTIONS ---
    getMaintenance: async function() {
        try { const res = await fetch(`${this.dbUrl}maintenance.json`); return await res.json(); } catch(e) { return false; }
    },
    setMaintenance: async function(status) {
        try { await fetch(`${this.dbUrl}maintenance.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(status) }); return true; } catch(e) { return false; }
    },

    document.getElementById('admin-auth-btn').onclick = async () => {
        const btn = document.getElementById('admin-auth-btn');
        const passInput = document.getElementById('admin-password').value;
        
        // Show loading state while checking database
        btn.innerHTML = 'Verifying...';
        btn.disabled = true;

        // Check Firebase
        const isValid = await LibraryDB.verifyAdminPassword(passInput);

        if (isValid) { 
            // Save admin VIP token
            localStorage.setItem('libnav_admin_token', 'VIP_GRANTED');
            
            document.getElementById('admin-login-screen').style.display = 'none'; 
            document.getElementById('admin-dashboard').style.display = 'block'; 
            document.getElementById('admin-password').value = ''; // clear password field
            updateImageInputs(); 
            renderAdminList(); 
        } else { 
            showPopup("Access Denied", "Incorrect Security Key.", null, false); 
        }
        
        // Reset button
        btn.innerHTML = 'Login';
        btn.disabled = false;
    };
};
