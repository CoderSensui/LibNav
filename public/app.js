document.addEventListener('DOMContentLoaded', () => {
    function renderIcons() { if(typeof lucide !== 'undefined') lucide.createIcons(); }

    // --- Embedded Database Logic (Fixes the mixed structure issue) ---
    const LibraryDB = {
        dbUrl: "https://libnav-dc2c8-default-rtdb.firebaseio.com/", 
        books: [],
        init: async function() {
            try {
                const response = await fetch(`${this.dbUrl}.json`);
                const data = await response.json();
                // Specifically extract the "books" array
                if (data && data.books && Array.isArray(data.books)) {
                    this.books = data.books.filter(b => b !== null);
                } else {
                    this.books = []; 
                }
                return true;
            } catch (error) {
                console.error("Firebase Error:", error);
                return false;
            }
        },
        getBooks: function() { return this.books; }
    };

    const searchInput = document.getElementById('search-input');
    const resultsArea = document.getElementById('results-area');
    const featuredContainer = document.getElementById('featured-container');
    const hero = document.getElementById('hero');
    const sideMenu = document.getElementById('side-menu');
    const sideMenuOverlay = document.getElementById('side-menu-overlay');
    const micBtn = document.getElementById('mic-btn');
    const bookModal = document.getElementById('book-modal');
    const carouselImg = document.getElementById('carousel-img');
    const stepCounter = document.getElementById('step-counter');

    let selectedGenres = new Set(); 
    let favorites = JSON.parse(localStorage.getItem('libnav_favs')) || [];
    const coverCache = {}; 
    let currentImages = [];
    let currentImageIndex = 0;
    let currentGenre = "";

    function applyTheme(mode) {
        if(mode === 'light') document.body.classList.add('light-mode');
        else document.body.classList.remove('light-mode');
        renderIcons();
    }

    document.getElementById('section-theme-toggle')?.addEventListener('click', () => {
        const isLight = document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        applyTheme(isLight ? 'light' : 'dark');
    });

    // Handle Sections
    function switchSection(sectionId) {
        document.querySelectorAll('.nav-tab, .desk-nav-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`.nav-tab[data-section="${sectionId}"]`)?.classList.add('active');
        document.querySelector(`.desk-nav-item[data-section="${sectionId}"]`)?.classList.add('active');
        
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(`${sectionId}-section`).classList.add('active');
    }

    document.querySelectorAll('[data-section]').forEach(item => {
        item.addEventListener('click', (e) => { e.preventDefault(); switchSection(item.dataset.section); });
    });

    // Initialize App
    async function init() {
        applyTheme(localStorage.getItem('theme') || 'dark');
        await LibraryDB.init();
        loadFeaturedBook(); 
        renderIcons();
    }

    // Fixed Sidebar Categories
    document.getElementById('hamburger-btn').onclick = () => { sideMenu.classList.add('active'); sideMenuOverlay.style.display = 'block'; };
    const closeSidebar = () => { sideMenu.classList.remove('active'); sideMenuOverlay.style.display = 'none'; };
    document.getElementById('close-menu').onclick = closeSidebar; sideMenuOverlay.onclick = closeSidebar;

    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.onclick = () => {
            const genre = btn.dataset.genre;
            searchInput.value = ''; selectedGenres.clear(); 
            
            document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show Home Section without clearing filters
            switchSection('home');
            
            if(genre === 'All') { 
                hero.style.height = 'auto'; hero.style.opacity = '1'; hero.style.margin = '0 0 30px 0'; 
                featuredContainer.style.display = 'block'; 
            } else { 
                selectedGenres.add(genre);
                hero.style.height = '0'; hero.style.opacity = '0'; hero.style.margin = '0'; 
                featuredContainer.style.display = 'none'; 
            }
            
            performSearch(''); 
            closeSidebar(); 
        };
    });

    document.querySelectorAll('.close-btn').forEach(btn => btn.onclick = (e) => {
        const overlay = e.target.closest('.modal-overlay');
        if(overlay) overlay.style.display = 'none';
    });

    // Modal & Map Slider
    const prevBtn = document.getElementById('prev-img-btn');
    const nextBtn = document.getElementById('next-img-btn');

    prevBtn.onclick = () => { if (currentImageIndex > 0) { currentImageIndex--; updateCarousel(); } };
    nextBtn.onclick = () => { if (currentImageIndex < currentImages.length - 1) { currentImageIndex++; updateCarousel(); } };

    window.openModal = function(book) {
        bookModal.style.display = 'flex';
        document.getElementById('modal-title').innerText = book.title; 
        document.getElementById('modal-author').innerText = book.author;
        document.getElementById('modal-book-id').innerText = book.id; 
        document.getElementById('modal-genre').innerText = book.genre;
        
        fetchCover(book.title, book.author, 'modal-book-cover-img');
        fetchAuthorPic(book.author);

        // QR Setup
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = ''; 
        const linkUrl = `${window.location.origin}${window.location.pathname}?book=${book.id}`;
        try { new QRCode(qrContainer, { text: linkUrl, width: 120, height: 120, colorDark : "#121212", colorLight : "#ffffff" }); } catch(err) {}

        // Virtual Shelf Bottom
        const related = LibraryDB.getBooks().filter(b => b.genre === book.genre && b.id !== book.id).slice(0, 4);
        const relatedContainer = document.getElementById('related-shelf');
        relatedContainer.innerHTML = '';
        related.forEach(rBook => {
            const div = document.createElement('div');
            div.className = 'related-card';
            div.innerHTML = `<img src="" id="rel-${rBook.id}">`;
            div.onclick = () => openModal(rBook);
            relatedContainer.appendChild(div);
            fetchCover(rBook.title, rBook.author, `rel-${rBook.id}`);
        });

        // Initialize Slider Map
        currentImages = book.images || []; 
        currentImageIndex = 0; 
        currentGenre = book.genre; 
        updateCarousel();
        renderIcons();
    };

    function updateCarousel() {
        if (currentImages.length > 0) {
            stepCounter.innerText = `${currentGenre} Step ${currentImageIndex + 1}`;
            carouselImg.src = currentImages[currentImageIndex]; 
            prevBtn.style.opacity = currentImageIndex === 0 ? "0.3" : "1";
            prevBtn.style.pointerEvents = currentImageIndex === 0 ? "none" : "auto";
            nextBtn.style.opacity = currentImageIndex === currentImages.length - 1 ? "0.3" : "1";
            nextBtn.style.pointerEvents = currentImageIndex === currentImages.length - 1 ? "none" : "auto";
            carouselImg.style.display = 'block';
        } else { 
            carouselImg.style.display = 'none'; 
            stepCounter.innerText = "No map available"; 
        }
    }

    // Search & Speech
    searchInput.addEventListener('input', (e) => {
        const t = e.target.value.toLowerCase().trim();
        if (t.length > 0) { hero.style.display = 'none'; featuredContainer.style.display = 'none'; } 
        else if (selectedGenres.size === 0 || selectedGenres.has('All')) { hero.style.display = 'block'; featuredContainer.style.display = 'block'; }
        performSearch(t);
    });

    function performSearch(term) {
        let books = LibraryDB.getBooks(); 
        if (term === '' && (selectedGenres.size === 0 || selectedGenres.has('All'))) { resultsArea.innerHTML = ''; return; }
        
        let matches = books.filter(b => {
            const tm = b.title.toLowerCase().includes(term); 
            const am = b.author.toLowerCase().includes(term); 
            let gm = false;
            
            if (selectedGenres.has('All') || selectedGenres.size === 0) gm = true;
            else { 
                if (selectedGenres.has('Favorites') && favorites.includes(String(b.id))) gm = true; 
                if (selectedGenres.has(b.genre)) gm = true; 
            }
            return (tm || am) && gm;
        });
        renderResults(matches);
    }

    function renderResults(books) {
        resultsArea.innerHTML = '';
        if (books.length === 0) { 
            resultsArea.innerHTML = '<div class="empty-state"><i data-lucide="book-x"></i><p>No results found for your search.</p></div>'; 
            renderIcons(); return; 
        }
        
        books.forEach((book) => {
            const card = document.createElement('div'); card.className = 'book-card';
            const isFav = favorites.some(id => String(id) === String(book.id)); 
            
            card.innerHTML = `
                <div class="cover-box">
                    <img id="img-${book.id}" src="">
                    <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${book.id}')"><i data-lucide="bookmark"></i></button>
                </div>
                <div class="book-info"><strong>${book.title}</strong><small>${book.author}</small></div>
            `;
            card.onclick = (e) => { if(!e.target.closest('.fav-btn')) openModal(book); }; 
            resultsArea.appendChild(card);
            fetchCover(book.title, book.author, `img-${book.id}`);
        });
        renderIcons();
    }

    // Fixed Bookmarks Toggle Visuals
    window.toggleFavorite = function(e, bookId) {
        e.stopPropagation(); 
        const btn = e.target.closest('.fav-btn');
        btn.classList.toggle('active'); 
        
        const index = favorites.findIndex(id => String(id) === String(bookId));
        if (index === -1) favorites.push(String(bookId)); else favorites.splice(index, 1);
        localStorage.setItem('libnav_favs', JSON.stringify(favorites));
    };

    // Images Fallback Fetch
    function fetchCover(title, author, elementId) {
        if(coverCache[title]) { document.getElementById(elementId).src = coverCache[title]; return; }
        fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`).then(r=>r.json()).then(d => {
            if(d.docs?.[0]?.cover_i) { 
                const url = `https://covers.openlibrary.org/b/id/${d.docs[0].cover_i}-M.jpg`; 
                coverCache[title] = url; document.getElementById(elementId).src = url; 
            } else document.getElementById(elementId).src = generateInitials(title);
        }).catch(() => document.getElementById(elementId).src = generateInitials(title));
    }

    function fetchAuthorPic(author) {
        const el = document.getElementById('modal-author-pic');
        el.src = generateInitials(author);
        fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(author)}`).then(r=>r.json()).then(d=>{
            if(d.docs?.[0]?.key) el.src = `https://covers.openlibrary.org/a/olid/${d.docs[0].key}-M.jpg`;
        });
    }

    function generateInitials(text) {
        const initials = text.substring(0, 2).toUpperCase();
        const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 300; 
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 200, 300);
        ctx.font = 'bold 80px sans-serif'; ctx.fillStyle = '#db2777'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(initials, 100, 150);
        return canvas.toDataURL();
    }

    function loadFeaturedBook() {
        const books = LibraryDB.getBooks(); if (books.length === 0) return;
        const b = books[Math.floor(Math.random() * books.length)];
        const isFav = favorites.some(id => String(id) === String(b.id));
        featuredContainer.innerHTML = `
            <div style="margin-bottom: 30px;">
                <span style="display:flex; gap:8px; color:var(--warning); font-size:0.8rem; font-weight:bold; margin-bottom:10px;"><i data-lucide="star"></i> DAILY PICK</span>
                <div style="background:var(--surface); border:1px solid var(--border-color); padding:20px; border-radius:16px; display:flex; gap:20px; cursor:pointer;" onclick="openModal(${JSON.stringify(b).replace(/"/g, '&quot;')})">
                    <div style="width:90px; height:135px; border-radius:8px; overflow:hidden; position:relative; flex-shrink:0;">
                        <img id="fc-img" src="" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div style="display:flex; flex-direction:column; justify-content:center; gap:8px;">
                        <h2 style="font-size:1.2rem;">${b.title}</h2>
                        <p style="color:var(--text-muted);">${b.author}</p>
                        <span style="background:var(--primary-light); color:var(--primary); padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:bold; align-self:flex-start;">${b.genre}</span>
                    </div>
                </div>
            </div>`;
        fetchCover(b.title, b.author, 'fc-img');
    }

    // Feedback (Fetch Only)
    document.getElementById('section-feedback-btn')?.addEventListener('click', () => { document.getElementById('feedback-modal').style.display = 'flex'; });
    const fForm = document.getElementById('feedback-form');
    if(fForm) fForm.onsubmit = async (e) => {
        e.preventDefault(); 
        const btn = document.getElementById('fb-submit-btn'); 
        btn.innerHTML = '<i data-lucide="loader-2"></i> Sending...'; renderIcons(); btn.disabled = true;
        
        const payload = { 
            name: document.getElementById('fb-name').value, 
            email: document.getElementById('fb-email').value, 
            message: `[Rating: ${document.querySelector('input[name="rating"]:checked')?.value}/5]\n\n${document.getElementById('fb-message').value}` 
        };
        
        try { 
            await fetch('/api/send-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            alert("Feedback sent successfully!"); 
            fForm.reset(); document.getElementById('feedback-modal').style.display = 'none';
        } catch { 
            alert("Error sending feedback. Please try again later."); 
        } finally { 
            btn.innerHTML = '<i data-lucide="send"></i> Send feedback'; btn.disabled = false; renderIcons();
        }
    };

    // Speech Recognition 
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; 
        const recognition = new SpeechRecognition(); 
        
        micBtn.onclick = () => { if (micBtn.classList.contains('active-mic')) recognition.stop(); else recognition.start(); };
        recognition.onstart = () => { micBtn.classList.add('active-mic'); searchInput.placeholder = "Listening..."; };
        recognition.onend = () => { micBtn.classList.remove('active-mic'); searchInput.placeholder = "Search title or author..."; };
        recognition.onresult = (e) => { searchInput.value = e.results[0][0].transcript; searchInput.dispatchEvent(new Event('input')); };
    } else {
        micBtn.style.display = 'none';
    }

    // Admin Access Panel
    document.getElementById('secret-admin-btn').addEventListener('click', () => document.getElementById('admin-modal').style.display = 'flex');
    document.getElementById('admin-auth-btn').onclick = () => {
        if (document.getElementById('admin-password').value === 'admin123') { 
            document.getElementById('admin-login-screen').style.display = 'none'; 
            document.getElementById('admin-dashboard').style.display = 'block'; 
        } else { alert("Incorrect Password"); }
    };

    init();
});
