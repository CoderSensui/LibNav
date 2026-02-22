document.addEventListener('DOMContentLoaded', () => {

    function renderIcons() { if(typeof lucide !== 'undefined') lucide.createIcons(); }

    // --- Embedded Database Logic ---
    const LibraryDB = {
        dbUrl: "https://libnav-dc2c8-default-rtdb.firebaseio.com/", 
        books: [],
        ratings: [],
        init: async function() {
            try {
                const response = await fetch(`${this.dbUrl}.json`);
                if (!response.ok) throw new Error("Network error");
                const data = await response.json() || {};
                
                if (data.books && Array.isArray(data.books)) {
                    this.books = data.books.filter(b => b !== null);
                } else if (data.books) {
                    this.books = Object.values(data.books).filter(b => b !== null);
                } else { this.books = []; }

                if (data.ratings) {
                    this.ratings = Object.values(data.ratings).filter(r => r !== null && typeof r === 'number');
                } else { this.ratings = []; }

                return true;
            } catch (error) { return false; }
        },
        getBooks: function() { return this.books; },
        getRatings: function() { return this.ratings; },
        saveBooks: async function() {
            try { await fetch(`${this.dbUrl}books.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.books) }); return true; } catch(e) { return false; }
        },
        incrementView: async function(id) {
            const book = this.books.find(b => String(b.id) === String(id));
            if (book) { book.views = (book.views || 0) + 1; this.saveBooks(); }
        },
        submitRating: async function(stars) {
            try {
                this.ratings.push(stars);
                await fetch(`${this.dbUrl}ratings.json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stars) });
                return true;
            } catch (err) { return false; }
        },
        factoryReset: async function() {
            this.books.forEach(b => b.views = 0);
            await this.saveBooks();
            await fetch(`${this.dbUrl}ratings.json`, { method: 'DELETE' });
            this.ratings = [];
            return true;
        }
    };

    const searchInput = document.getElementById('search-input');
    const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
    const resultsArea = document.getElementById('results-area');
    const featuredContainer = document.getElementById('featured-container');
    const hero = document.getElementById('hero');
    const sideMenu = document.getElementById('side-menu');
    const sideMenuOverlay = document.getElementById('side-menu-overlay');
    const micBtn = document.getElementById('mic-btn');
    const screensaver = document.getElementById('screensaver');
    const adminModal = document.getElementById('admin-modal');
    const bookModal = document.getElementById('book-modal');
    const carouselImg = document.getElementById('carousel-img');
    const stepCounter = document.getElementById('step-counter');

    let selectedGenres = new Set(); 
    let favorites = JSON.parse(localStorage.getItem('libnav_favs')) || [];
    const IDLE_LIMIT = 60000; // 1 minute
    let idleTimeout;
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

    function showPopup(title, msg, onConfirm, showCancel = false) {
        document.getElementById('popup-title').innerText = title;
        document.getElementById('popup-message').innerText = msg;
        const pop = document.getElementById('custom-popup');
        pop.style.display = 'flex';
        const cancelBtn = document.getElementById('popup-cancel');
        cancelBtn.style.display = showCancel ? 'flex' : 'none';
        document.getElementById('popup-confirm').onclick = () => { pop.style.display = 'none'; if(onConfirm) onConfirm(); };
        cancelBtn.onclick = () => pop.style.display = 'none';
    }

    // Screensaver Logic Fix
    function resetIdleTimer() {
        clearTimeout(idleTimeout);
        screensaver.style.display = 'none';
        idleTimeout = setTimeout(() => {
            // Close overlays if idle
            document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
            switchSection('home');
            screensaver.style.display = 'flex';
        }, IDLE_LIMIT);
    }
    // Attach listener to multiple user interactions to accurately track idle time
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => 
        document.addEventListener(evt, resetIdleTimer, true)
    );

    async function init() {
        const saved = localStorage.getItem('theme') || 'dark';
        applyTheme(saved);
        try { await LibraryDB.init(); } catch(e) {}
        loadFeaturedBook(); 
        resetIdleTimer();
        renderIcons();
    }

    function switchSection(sectionId) {
        document.querySelectorAll('.nav-tab, .desk-nav-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`.nav-tab[data-section="${sectionId}"]`)?.classList.add('active');
        document.querySelector(`.desk-nav-item[data-section="${sectionId}"]`)?.classList.add('active');
        
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(`${sectionId}-section`).classList.add('active');

        if(sectionId === 'home') {
            searchInput.value = ''; autocompleteDropdown.style.display = 'none'; selectedGenres.clear();
            document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
            document.querySelector('.menu-item[data-genre="All"]')?.classList.add('active');
            hero.style.height = 'auto'; hero.style.opacity = '1'; hero.style.margin = '0 0 30px 0';
            featuredContainer.style.display = 'block'; resultsArea.innerHTML = ''; 
        }
    }

    document.querySelectorAll('[data-section]').forEach(item => {
        item.addEventListener('click', (e) => { e.preventDefault(); switchSection(item.dataset.section); });
    });

    document.getElementById('hamburger-btn').onclick = () => { sideMenu.classList.add('active'); sideMenuOverlay.style.display = 'block'; };
    const closeSidebar = () => { sideMenu.classList.remove('active'); sideMenuOverlay.style.display = 'none'; };
    document.getElementById('close-menu').onclick = closeSidebar; sideMenuOverlay.onclick = closeSidebar;
    
    document.querySelectorAll('.close-btn').forEach(btn => btn.onclick = (e) => {
        const overlay = e.target.closest('.modal-overlay');
        if(overlay) overlay.style.display = 'none';
    });

    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.onclick = () => {
            const genre = btn.dataset.genre;
            searchInput.value = ''; selectedGenres.clear(); 
            
            document.querySelectorAll('.menu-item, .filter-option input').forEach(b => { 
                if(b.classList) b.classList.remove('active'); 
                else b.checked = false; 
            }); 
            
            btn.classList.add('active');
            
            if(genre === 'All') { 
                hero.style.height = 'auto'; hero.style.opacity = '1'; hero.style.margin = '0 0 30px 0'; 
                featuredContainer.style.display = 'block'; 
            } else { 
                selectedGenres.add(genre);
                hero.style.height = '0'; hero.style.opacity = '0'; hero.style.margin = '0'; 
                featuredContainer.style.display = 'none'; 
            }
            
            performSearch(''); 
            if(window.innerWidth < 850) closeSidebar(); // only close sidebar on mobile
            switchSection('home');
        };
    });

    // Share Button Logic
    document.getElementById('top-share-btn').onclick = async () => {
        const id = document.getElementById('modal-book-id').innerText;
        const url = `${window.location.origin}${window.location.pathname}?book=${id}`;
        const title = document.getElementById('modal-title').innerText;
        if (navigator.share) {
            try { await navigator.share({ title: 'LibNav Map', text: `Check out ${title}`, url: url }); } catch (err) {}
        } else {
            navigator.clipboard.writeText(url);
            showPopup("Success", "Link copied to clipboard!", null, false);
        }
    };

    // --- CAROUSEL AND MODAL LOGIC ---
    const prevBtn = document.getElementById('prev-img-btn');
    const nextBtn = document.getElementById('next-img-btn');

    prevBtn.onclick = () => { if (currentImageIndex > 0) { currentImageIndex--; updateCarousel(); } };
    nextBtn.onclick = () => { if (currentImageIndex < currentImages.length - 1) { currentImageIndex++; updateCarousel(); } };

    async function openModal(book) {
        bookModal.style.display = 'flex'; 
        LibraryDB.incrementView(book.id);
        
        document.getElementById('modal-title').innerText = book.title; 
        document.getElementById('modal-author').innerText = book.author;
        document.getElementById('modal-book-id').innerText = book.id; 
        document.getElementById('modal-genre').innerText = book.genre;
        
        fetchCoverWithFallback(book.title, book.author, 'modal-book-cover-img', true);
        fetchAuthorPic(book.author);

        // QR Code Generator Fix
        const qrContainer = document.getElementById('qrcode');
        if (qrContainer) {
            qrContainer.innerHTML = ''; 
            const dl = `${window.location.origin}${window.location.pathname}?book=${book.id}&view=mobile`;
            try { new QRCode(qrContainer, { text: dl, width: 130, height: 130, colorDark : "#000000", colorLight : "#ffffff" }); } catch(err) {}
        }

        // Virtual Shelf Bottom Populator
        const related = LibraryDB.getBooks().filter(b => b.genre === book.genre && b.id !== book.id).slice(0, 4);
        const relatedContainer = document.getElementById('related-shelf');
        relatedContainer.innerHTML = '';
        related.forEach(rBook => {
            const div = document.createElement('div');
            div.className = 'related-card';
            div.innerHTML = `<img id="rel-${rBook.id}" src="">`;
            div.onclick = () => openModal(rBook);
            relatedContainer.appendChild(div);
            fetchCoverWithFallback(rBook.title, rBook.author, `rel-${rBook.id}`, true);
        });

        currentImages = book.images || []; 
        currentImageIndex = 0; 
        currentGenre = book.genre; 
        updateCarousel();
        renderIcons();
    }

    function updateCarousel() {
        if (currentImages && currentImages.length > 0) {
            // STEP TEXT FIX: Updates properly from Step 1, Step 2, etc.
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

    // Filters and Search 
    const filterToggle = document.getElementById('filter-toggle'); 
    const filterMenu = document.getElementById('filter-menu');
    if (filterToggle) filterToggle.onclick = (e) => { e.stopPropagation(); filterMenu.style.display = filterMenu.style.display === 'flex' ? 'none' : 'flex'; };
    document.onclick = (e) => { 
        if(!e.target.closest('.search-wrapper')) autocompleteDropdown.style.display='none'; 
        if(!e.target.closest('.search-wrapper') && filterMenu) filterMenu.style.display='none'; 
    };

    document.querySelectorAll('.filter-option input').forEach(box => {
        box.onchange = (e) => {
            const val = e.target.value;
            if(val === 'All') {
                selectedGenres.clear(); if(e.target.checked) selectedGenres.add('All');
                document.querySelectorAll('.filter-option input').forEach(c => { if(c.value !== 'All') c.checked = false; });
            } else {
                if(e.target.checked) { selectedGenres.delete('All'); document.querySelector('.filter-option input[value="All"]').checked = false; selectedGenres.add(val); } 
                else { selectedGenres.delete(val); }
            }
            if (selectedGenres.size > 0 && !selectedGenres.has('All')) { hero.style.display = 'none'; featuredContainer.style.display = 'none'; } 
            else if (searchInput.value === '') { hero.style.display = 'block'; featuredContainer.style.display = 'block'; }
            performSearch(searchInput.value);
        };
    });

    searchInput.addEventListener('input', (e) => {
        const t = e.target.value.toLowerCase().trim();
        if (t.length > 0) { hero.style.display = 'none'; featuredContainer.style.display = 'none'; } 
        else if (selectedGenres.size === 0 || selectedGenres.has('All')) { hero.style.display = 'block'; featuredContainer.style.display = 'block'; }
        
        autocompleteDropdown.innerHTML = '';
        if (t.length > 1) {
            const hits = LibraryDB.getBooks().filter(b => b.title.toLowerCase().includes(t) || b.author.toLowerCase().includes(t)).slice(0, 4);
            if (hits.length) {
                autocompleteDropdown.style.display = 'flex';
                hits.forEach(s => {
                    const d = document.createElement('div'); d.className = 'auto-item';
                    const ht = s.title.replace(new RegExp(`(${t})`, 'gi'), '<span style="color:var(--primary); font-weight:bold;">$1</span>');
                    d.innerHTML = `<i data-lucide="search" style="color:var(--primary);"></i><div><strong>${ht}</strong><br><small style="color:var(--text-muted)">${s.author}</small></div>`;
                    d.onclick = () => { searchInput.value = s.title; autocompleteDropdown.style.display = 'none'; performSearch(s.title); openModal(s); };
                    autocompleteDropdown.appendChild(d);
                }); renderIcons();
            } else autocompleteDropdown.style.display = 'none';
        } else autocompleteDropdown.style.display = 'none';
        performSearch(t);
    });

    function performSearch(term) {
        let books = LibraryDB.getBooks(); term = term.toLowerCase().trim();
        if (term === '' && (selectedGenres.size === 0 || selectedGenres.has('All'))) { resultsArea.innerHTML = ''; return; }
        let matches = books.filter(b => {
            const tm = b.title.toLowerCase().includes(term); const am = b.author.toLowerCase().includes(term); let gm = false;
            if (selectedGenres.has('All') || selectedGenres.size === 0) gm = true;
            else { if (selectedGenres.has('Favorites') && favorites.includes(String(b.id))) gm = true; if (selectedGenres.has(b.genre)) gm = true; }
            return (tm || am) && gm;
        });
        renderResults(matches);
    }

    function renderResults(books) {
        resultsArea.innerHTML = '';
        if (books.length === 0) { resultsArea.innerHTML = '<div class="empty-state"><i data-lucide="book-x"></i><p>No books found.</p></div>'; renderIcons(); return; }
        books.forEach((book) => {
            const card = document.createElement('div'); card.className = 'book-card';
            const isFav = favorites.some(id => String(id) === String(book.id));
            card.innerHTML = `
                <div class="cover-box skeleton">
                    <img id="img-${book.id}" src="">
                    <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${book.id}')"><i data-lucide="bookmark"></i></button>
                </div>
                <div class="book-info"><strong>${book.title}</strong><small>${book.author}</small></div>
            `;
            card.onclick = (e) => { if(!e.target.closest('.fav-btn')) openModal(book); }; 
            resultsArea.appendChild(card);
            fetchCoverWithFallback(book.title, book.author, `img-${book.id}`, true);
        });
        renderIcons();
    }

    window.toggleFavorite = function(e, bookId) {
        e.stopPropagation(); 
        const btn = e.target.closest('.fav-btn');
        btn.classList.toggle('active'); 
        const index = favorites.findIndex(id => String(id) === String(bookId));
        if (index === -1) favorites.push(String(bookId)); else favorites.splice(index, 1);
        localStorage.setItem('libnav_favs', JSON.stringify(favorites));
    }

    // Cover and Image Fetching
    function loadFeaturedBook() {
        const books = LibraryDB.getBooks(); if (books.length === 0) return;
        const idx = Math.abs(new Date().toDateString().split('').reduce((a,b)=>a+(b.charCodeAt(0)),0)) % books.length; 
        const b = books[idx];
        const isFav = favorites.some(id => String(id) === String(b.id));
        featuredContainer.innerHTML = `
            <div class="featured-wrap">
                <span class="feat-tag"><i data-lucide="star"></i> Daily Global Pick</span>
                <div class="featured-card" onclick="openModalById('${b.id}')">
                    <div class="feat-img-wrap skeleton"><img id="fc-img" src=""></div>
                    <div class="feat-info"><h2>${b.title}</h2><p style="color:var(--text-muted)">${b.author}</p><span class="book-badge">${b.genre}</span></div>
                    <button class="fav-btn ${isFav?'active':''}" style="top:15px; right:15px;" onclick="toggleFavorite(event,'${b.id}')"><i data-lucide="bookmark"></i></button>
                </div>
            </div>`;
        fetchCoverWithFallback(b.title, b.author, 'fc-img', true); renderIcons();
    }

    function generateInitialsImage(name) {
        if(!name) name = "UK";
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 300; 
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e1e20'; ctx.fillRect(0, 0, 200, 300);
        ctx.font = 'bold 80px sans-serif'; ctx.fillStyle = '#db2777'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(initials, 100, 150);
        return canvas.toDataURL();
    }

    function fetchCoverWithFallback(title, author, elementId, isImgTag = true) {
        if(coverCache[title]) { applyCover(coverCache[title], elementId, isImgTag); return; }
        fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`).then(r=>r.json()).then(d => {
            if(d.docs?.[0]?.cover_i) { const url = `https://covers.openlibrary.org/b/id/${d.docs[0].cover_i}-M.jpg`; coverCache[title] = url; applyCover(url, elementId, isImgTag); } 
            else { const fb = generateInitialsImage(title); coverCache[title] = fb; applyCover(fb, elementId, isImgTag); }
        }).catch(() => { const fb = generateInitialsImage(title); coverCache[title] = fb; applyCover(fb, elementId, isImgTag); });
    }

    function fetchAuthorPic(author) {
        const el = document.getElementById('modal-author-pic');
        if(!el) return;
        el.src = generateInitialsImage(author); 
        fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(author)}`).then(r=>r.json()).then(d=>{
            if(d.docs?.[0]?.key) el.src = `https://covers.openlibrary.org/a/olid/${d.docs[0].key}-M.jpg`;
        });
    }

    function applyCover(url, elId, isImgTag) {
        const el = document.getElementById(elId); if(!el) return;
        if(isImgTag) { el.src = url; el.onload = () => { el.style.opacity = '1'; const wrap = el.closest('.skeleton'); if(wrap) wrap.classList.remove('skeleton'); }; }
        else { el.style.backgroundImage = `url(${url})`; }
    }

    window.openModalById = function(id) { const b = LibraryDB.getBooks().find(x => String(x.id) === String(id)); if(b) openModal(b); };

    // Stats
    let uptimeInterval = null;
    document.getElementById('section-stats-btn')?.addEventListener('click', () => {
        const books = LibraryDB.getBooks(); const ratings = LibraryDB.getRatings();
        const mostViewed = books.length > 0 ? books.reduce((a,b)=>(a.views||0)>(b.views||0)?a:b, {title:"None",views:0}) : {title:"None",views:0};
        const newest = books.length > 0 ? books.reduce((a,b)=>(a.id>b.id)?a:b, {title:"None"}) : {title:"None"};
        const genres = {}; books.forEach(b=>genres[b.genre]=(genres[b.genre]||0)+1);
        const avg = ratings.length ? `⭐ ${(ratings.reduce((a,b)=>a+parseInt(b),0)/ratings.length).toFixed(1)} <span style="font-size:0.8rem;color:var(--text-muted);">(${ratings.length} Reviews)</span>` : "No Ratings";
        
        document.getElementById('stats-content').innerHTML = `
            <div class="stats-banner"><i data-lucide="server"></i> <span id="uptime-display">Calculating uptime...</span></div>
            <div class="stats-grid">
                <div class="stat-box"><small>TOTAL BOOKS</small><h2>${books.length}</h2></div>
                <div class="stat-box"><small>BOOKMARKS</small><h2 style="color:var(--warning);">${favorites.length}</h2></div>
            </div>
            <div class="stat-box full"><small>GLOBAL RATING</small><h2>${avg}</h2></div>
            <div class="stat-row"><p><i data-lucide="trending-up"></i> Top Pick</p><div><strong>${mostViewed.title}</strong><span class="view-tag">${mostViewed.views || 0} Views</span></div></div>
            <div class="stat-row"><p><i data-lucide="clock"></i> Newest Arrival</p><div><strong>${newest.title}</strong></div></div>
            <div class="stat-list"><p><i data-lucide="pie-chart"></i> Composition</p>${Object.entries(genres).map(([k,v])=>`<div class="stat-list-item"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
        `; renderIcons(); document.getElementById('stats-modal').style.display = 'flex';

        const updateUptime = () => {
            const startDate = new Date("2026-01-01T00:00:00").getTime(); const diff = new Date().getTime() - startDate;
            const d = Math.floor(diff / (1000 * 60 * 60 * 24)); const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); 
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)); const s = Math.floor((diff % (1000 * 60)) / 1000);
            const el = document.getElementById('uptime-display'); if(el) el.innerText = `Cloud Uptime: ${d}d, ${h}h, ${m}m, ${s}s`;
        };
        if(uptimeInterval) clearInterval(uptimeInterval); updateUptime(); uptimeInterval = setInterval(updateUptime, 1000);
    });

    // Speech 
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; const recognition = new SpeechRecognition(); recognition.lang = 'en-US';
        micBtn.onclick = () => { if (micBtn.classList.contains('active-mic')) recognition.stop(); else recognition.start(); };
        recognition.onstart = () => { micBtn.classList.add('active-mic'); searchInput.placeholder = "Listening..."; };
        recognition.onend = () => { micBtn.classList.remove('active-mic'); searchInput.placeholder = "Search..."; };
        recognition.onresult = (e) => { searchInput.value = e.results[0][0].transcript; searchInput.dispatchEvent(new Event('input')); };
    } else micBtn.style.display = 'none';

    // Admin Tools
    document.getElementById('admin-auth-btn').onclick = () => {
        if (document.getElementById('admin-password').value === 'admin123') { 
            document.getElementById('admin-login-screen').style.display = 'none'; 
            document.getElementById('admin-dashboard').style.display = 'block'; 
            renderAdminList(); 
        } else { showPopup("Error", "Incorrect Password", null, false); }
    };
    
    function renderAdminList() {
        const books = LibraryDB.getBooks();
        const listContainer = document.getElementById('admin-book-list');
        if (!books || books.length === 0) { listContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);">No books found.</p>'; return; }
        listContainer.innerHTML = books.map(b => `
            <div class="admin-list-item">
                <div class="info"><strong>${b.title}</strong><small>${b.author}</small></div>
                <div class="actions">
                    <button onclick="handleDelete('${b.id}')" class="btn-delete"><i data-lucide="trash-2"></i> Delete</button>
                </div>
            </div>`).join(''); 
        renderIcons();
    }
    window.handleDelete = async (id) => { showPopup("Confirm", "Delete this book?", async () => { await LibraryDB.deleteBook(id); renderAdminList(); performSearch(searchInput.value); }, true); };
    document.getElementById('factory-reset-btn').onclick = async () => { showPopup("Warning", "Reset all stats?", async () => { await LibraryDB.factoryReset(); window.location.reload(); }, true); };

    init();
});
