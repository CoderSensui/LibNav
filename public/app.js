document.addEventListener('DOMContentLoaded', () => {

    function renderIcons() { if(typeof lucide !== 'undefined') lucide.createIcons(); }

    // ----------------------------------------------------
    // FULL FIREBASE CLOUD LOGIC (Embedded directly as requested)
    // ----------------------------------------------------
    const LibraryDB = {
        dbUrl: "https://libnav-dc2c8-default-rtdb.firebaseio.com/", 
        books: [],
        ratings: [],
        
        init: async function() {
            try {
                const response = await fetch(`${this.dbUrl}.json`);
                if (!response.ok) throw new Error("Network error");
                
                const data = await response.json() || {};
                
                // Book parsing (handles arrays AND objects)
                if (data.books && Array.isArray(data.books)) {
                    this.books = data.books.filter(b => b !== null);
                } else if (data.books) {
                    this.books = Object.values(data.books).filter(b => b !== null);
                } else {
                    this.books = [];
                }

                // Ratings parsing (handles Firebase auto-generated key objects)
                if (data.ratings) {
                    this.ratings = Object.values(data.ratings).filter(r => r !== null && typeof r === 'number');
                } else {
                    this.ratings = [];
                }

                return true;
            } catch (error) {
                console.error("Firebase Error:", error);
                return false;
            }
        },
        
        getBooks: function() { return this.books; },
        getRatings: function() { return this.ratings; },
        
        saveBooks: async function() {
            try {
                await fetch(`${this.dbUrl}books.json`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.books)
                });
                return true;
            } catch(e) { return false; }
        },
        
        incrementView: async function(id) {
            const book = this.books.find(b => String(b.id) === String(id));
            if (book) {
                book.views = (book.views || 0) + 1;
                this.saveBooks(); // Updates silently in background
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
            } catch (err) { return false; }
        },
        
        factoryReset: async function() {
            // 1. Reset all views to 0
            this.books.forEach(b => b.views = 0);
            await this.saveBooks();
            
            // 2. Delete all ratings
            await fetch(`${this.dbUrl}ratings.json`, { method: 'DELETE' });
            this.ratings = [];
            
            return true;
        }
    };
    // ----------------------------------------------------

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
    const IDLE_LIMIT = 30000;
    let idleTimeout;
    const coverCache = {}; 
    let currentImages = [];
    let currentImageIndex = 0;
    let currentGenre = "";
    let uptimeInterval = null;

    const tips = [
        "Use the microphone icon to search for books hands-free.",
        "Bookmark a book to instantly find it later.",
        "Tap the main LibNav logo on the home screen to summon a minion!",
        "Scan the QR code on a PC to transfer the map to your phone."
    ];

    function applyTheme(mode) {
        if(mode === 'light') document.body.classList.add('light-mode');
        else document.body.classList.remove('light-mode');
        renderIcons();
    }

    function toggleThemeAction() {
        const isLight = document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        applyTheme(isLight ? 'light' : 'dark');
    }
    document.getElementById('section-theme-toggle')?.addEventListener('click', toggleThemeAction);

    function showPopup(title, msg, type = 'info', onConfirm = null, showCancel = false) {
        document.getElementById('popup-title').innerText = title;
        document.getElementById('popup-message').innerText = msg;
        const pop = document.getElementById('custom-popup');
        const iconWrapper = document.getElementById('popup-icon');
        
        if (type === 'success') {
            iconWrapper.innerHTML = '<i data-lucide="check-circle-2"></i>';
            iconWrapper.style.color = 'var(--success)';
            iconWrapper.style.background = 'rgba(16,185,129,0.1)';
        } else if (type === 'error') {
            iconWrapper.innerHTML = '<i data-lucide="alert-triangle"></i>';
            iconWrapper.style.color = 'var(--warning)';
            iconWrapper.style.background = 'rgba(245,158,11,0.1)';
        } else {
            iconWrapper.innerHTML = '<i data-lucide="bell"></i>';
            iconWrapper.style.color = 'var(--primary)';
            iconWrapper.style.background = 'var(--primary-light)';
        }

        pop.style.display = 'flex';
        
        const cancelBtn = document.getElementById('popup-cancel');
        cancelBtn.style.display = showCancel ? 'flex' : 'none';
        
        document.getElementById('popup-confirm').onclick = () => { pop.style.display = 'none'; if(onConfirm) onConfirm(); };
        cancelBtn.onclick = () => pop.style.display = 'none';
        renderIcons();
    }

    document.getElementById('hero-title').addEventListener('click', () => {
        const minion = document.getElementById('minion-sprite');
        if(minion.style.display === 'block') return;
        minion.style.display = 'block'; minion.style.left = '-60px';
        let pos = -60;
        const interval = setInterval(() => {
            pos += 6; minion.style.left = pos + 'px';
            if(pos > 300) { clearInterval(interval); minion.style.display = 'none'; }
        }, 16);
    });

    const filterToggle = document.getElementById('filter-toggle'); 
    const filterMenu = document.getElementById('filter-menu');
    filterToggle.onclick = (e) => { e.stopPropagation(); filterMenu.style.display = filterMenu.style.display === 'flex' ? 'none' : 'flex'; };

    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if(coverCache[img.dataset.title]) {
                    img.src = coverCache[img.dataset.title];
                    const wrap = img.closest('.skeleton');
                    if(wrap) wrap.classList.remove('skeleton');
                } else {
                    fetchCoverWithFallback(img.dataset.title, img.dataset.author, img.id, true);
                }
                observer.unobserve(img);
            }
        });
    }, { rootMargin: '200px 0px' });

    function generateInitialsImage(name) {
        if (!name) name = "Unknown";
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 300; 
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#1e1e20'; ctx.fillRect(0, 0, 200, 300);
        ctx.font = 'bold 80px sans-serif'; ctx.fillStyle = '#db2777'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(initials, 100, 150);
        return canvas.toDataURL();
    }

    async function init() {
        const saved = localStorage.getItem('theme') || 'dark';
        applyTheme(saved);
        
        await LibraryDB.init(); // Execute the embedded database script
        
        if (window.innerWidth <= 849) document.body.classList.add('is-mobile-device');
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('book')) {
            const book = LibraryDB.getBooks().find(b => String(b.id) === String(urlParams.get('book')));
            if (book) {
                if (urlParams.get('view') === 'mobile') document.body.classList.add('companion-mode-active');
                openModal(book);
            }
        }
        if (!document.body.classList.contains('companion-mode-active')) { loadFeaturedBook(); resetIdleTimer(); }
        renderIcons();
    }

    function switchSection(sectionId) {
        document.querySelectorAll('.nav-tab').forEach(i => i.classList.remove('active'));
        const mobileTab = document.querySelector(`.nav-tab[data-section="${sectionId}"]`);
        if(mobileTab) mobileTab.classList.add('active');
        
        document.querySelectorAll('.desk-nav-item').forEach(d => d.classList.remove('active'));
        const deskTab = document.querySelector(`.desk-nav-item[data-section="${sectionId}"]`);
        if(deskTab) deskTab.classList.add('active');
        
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(`${sectionId}-section`).classList.add('active');
        
        if(sectionId === 'tools') {
            document.getElementById('dynamic-tip').innerText = tips[Math.floor(Math.random() * tips.length)];
        }
        if(sectionId === 'home') {
            searchInput.value = ''; autocompleteDropdown.style.display = 'none'; selectedGenres.clear();
            document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
            document.querySelector('.menu-item[data-genre="All"]')?.classList.add('active');
            document.querySelectorAll('.filter-option input').forEach(c => c.checked = false); // clear filters

            hero.style.height = 'auto'; hero.style.opacity = '1'; hero.style.margin = '0 0 30px 0'; hero.style.display = 'block';
            featuredContainer.style.display = 'block'; resultsArea.innerHTML = ''; 
            loadFeaturedBook();
        }
    }

    document.querySelectorAll('[data-section]').forEach(item => {
        item.addEventListener('click', (e) => { e.preventDefault(); switchSection(item.dataset.section); });
    });

    document.getElementById('hamburger-btn').onclick = () => { sideMenu.classList.add('active'); sideMenuOverlay.style.display = 'block'; filterMenu.style.display='none'; };
    const closeSidebar = () => { sideMenu.classList.remove('active'); sideMenuOverlay.style.display = 'none'; };
    document.getElementById('close-menu').onclick = closeSidebar; sideMenuOverlay.onclick = closeSidebar;
    
    document.querySelectorAll('.close-btn').forEach(btn => btn.onclick = (e) => {
        const overlay = e.target.closest('.modal-overlay');
        if(overlay) {
            overlay.style.display = 'none';
            if(overlay.id === 'stats-modal' && uptimeInterval) clearInterval(uptimeInterval);
        }
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
            
            // Switch to Home tab visually without forcing a hard reset
            document.querySelectorAll('.nav-tab, .desk-nav-item').forEach(i => i.classList.remove('active'));
            document.querySelector(`.nav-tab[data-section="home"]`)?.classList.add('active');
            document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(`home-section`).classList.add('active');
            
            if(genre === 'All') { 
                hero.style.display = 'block'; 
                featuredContainer.style.display = 'block'; 
            } else { 
                selectedGenres.add(genre);
                hero.style.display = 'none'; 
                featuredContainer.style.display = 'none'; 
            }
            
            performSearch(''); 
            closeSidebar(); 
        };
    });

    // --- Top Left Share Button Logic ---
    document.getElementById('top-share-btn').onclick = async () => {
        const id = document.getElementById('modal-book-id').innerText;
        const url = `${window.location.origin}${window.location.pathname}?book=${id}`;
        const title = document.getElementById('modal-title').innerText;
        
        if (navigator.share) {
            try { await navigator.share({ title: 'LibNav Map', text: `Here is the map to find ${title}`, url: url }); } 
            catch (err) { console.log('Share dismissed'); }
        } else {
            navigator.clipboard.writeText(url);
            showPopup("Link Copied!", "Share this link with anyone.", 'success');
        }
    };

    // Modal Nav Logic
    const prevBtn = document.getElementById('prev-img-btn');
    const nextBtn = document.getElementById('next-img-btn');

    prevBtn.onclick = () => { if (currentImageIndex > 0) { currentImageIndex--; updateCarousel(); } };
    nextBtn.onclick = () => { if (currentImageIndex < currentImages.length - 1) { currentImageIndex++; updateCarousel(); } };

    async function openModal(book) {
        bookModal.style.display = 'flex'; LibraryDB.incrementView(book.id);
        
        document.getElementById('modal-title').innerText = book.title; 
        document.getElementById('modal-author').innerText = book.author;
        document.getElementById('modal-book-id').innerText = book.id; 
        document.getElementById('modal-genre').innerText = book.genre;
        
        const cover = document.getElementById('modal-book-cover-img'); 
        cover.src = ''; cover.style.opacity = '0'; cover.parentElement.classList.add('skeleton');
        fetchCoverWithFallback(book.title, book.author, 'modal-book-cover-img', true);
        
        fetchAuthorPic(book.author);

        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = ''; const dl = `${window.location.origin}${window.location.pathname}?book=${book.id}&view=mobile`;
        try { new QRCode(qrContainer, { text: dl, width: 120, height: 120, colorDark : "#131314", colorLight : "#ffffff" }); } catch(err) {}

        const related = LibraryDB.getBooks().filter(b => b.genre === book.genre && b.id !== book.id).slice(0, 4);
        const relatedContainer = document.getElementById('related-shelf');
        relatedContainer.innerHTML = '';
        related.forEach(rBook => {
            const div = document.createElement('div');
            div.className = 'related-card';
            div.innerHTML = `<img src="" id="rel-${rBook.id}">`;
            div.onclick = () => openModal(rBook);
            relatedContainer.appendChild(div);
            fetchCoverWithFallback(rBook.title, rBook.author, `rel-${rBook.id}`, true);
        });

        currentImages = book.images || []; currentImageIndex = 0; currentGenre = book.genre; updateCarousel();
        renderIcons();
    }

    function updateCarousel() {
        const aa = document.getElementById('mobile-action-area');
        if (currentImages && currentImages.length > 0) {
            stepCounter.innerText = `${currentGenre} Step ${currentImageIndex + 1}`;
            carouselImg.src = currentImages[currentImageIndex]; 
            prevBtn.style.opacity = currentImageIndex === 0 ? "0.3" : "1";
            prevBtn.style.pointerEvents = currentImageIndex === 0 ? "none" : "auto";
            nextBtn.style.opacity = currentImageIndex === currentImages.length - 1 ? "0.3" : "1";
            nextBtn.style.pointerEvents = currentImageIndex === currentImages.length - 1 ? "none" : "auto";
            carouselImg.style.display = 'block';
            if (aa) aa.style.display = (currentImageIndex === currentImages.length - 1 && document.body.classList.contains('is-mobile-device')) ? 'flex' : 'none';
        } else { 
            carouselImg.style.display = 'none'; stepCounter.innerText = "No map available"; 
            if (aa && document.body.classList.contains('is-mobile-device')) aa.style.display = 'flex';
        }
    }

    document.querySelectorAll('.filter-option input').forEach(box => {
        box.onchange = (e) => {
            const val = e.target.value;
            if(val === 'All') {
                selectedGenres.clear(); if(e.target.checked) selectedGenres.add('All');
                document.querySelectorAll('.filter-option input').forEach(c => { if(c.value !== 'All') c.checked = false; });
                document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active')); if(e.target.checked) document.querySelector('.menu-item[data-genre="All"]').classList.add('active');
            } else {
                if(e.target.checked) { selectedGenres.delete('All'); document.querySelector('.filter-option input[value="All"]').checked = false; document.querySelector('.menu-item[data-genre="All"]').classList.remove('active'); selectedGenres.add(val); document.querySelectorAll('.menu-item').forEach(b => { if(b.dataset.genre===val) b.classList.add('active'); }); } 
                else { selectedGenres.delete(val); document.querySelectorAll('.menu-item').forEach(b => { if(b.dataset.genre===val) b.classList.remove('active'); }); }
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
                autocompleteDropdown.style.display = 'block';
                hits.forEach(s => {
                    const d = document.createElement('div'); d.className = 'auto-item';
                    const ht = s.title.replace(new RegExp(`(${t})`, 'gi'), '<span class="text-primary font-bold">$1</span>');
                    d.innerHTML = `<i data-lucide="search" style="color:var(--primary);"></i><div class="auto-text"><strong>${ht}</strong><small>${s.author}</small></div>`;
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
        if (selectedGenres.has('All') || term !== '') matches.sort((a, b) => a.title.localeCompare(b.title));
        renderResults(matches);
    }

    function renderResults(books) {
        resultsArea.innerHTML = '';
        if (books.length === 0) { resultsArea.innerHTML = '<div class="empty-state"><i data-lucide="book-x"></i><p>No books found.</p></div>'; renderIcons(); return; }
        const frag = document.createDocumentFragment(); const term = searchInput.value.trim(); const regex = new RegExp(`(${term})`, 'gi');
        books.forEach((book) => {
            const card = document.createElement('div'); card.className = 'book-card';
            const isFav = favorites.some(id => String(id) === String(book.id)); const coverId = `img-${book.id}`;
            const titleHtml = term ? book.title.replace(regex, '<span class="text-primary">$1</span>') : book.title;

            card.innerHTML = `
                <div class="cover-box skeleton">
                    <img id="${coverId}" data-title="${book.title}" data-author="${book.author}" src="">
                    <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${book.id}')"><i data-lucide="bookmark"></i></button>
                </div>
                <div class="book-info"><strong>${titleHtml}</strong><small>${book.author}</small></div>
            `;
            card.onclick = (e) => { if(!e.target.closest('.fav-btn')) openModal(book); }; frag.appendChild(card);
            setTimeout(() => imageObserver.observe(document.getElementById(coverId)), 0);
        });
        resultsArea.appendChild(frag); renderIcons();
    }

    window.toggleFavorite = function(e, bookId) {
        e.stopPropagation(); 
        const btn = e.target.closest('.fav-btn');
        btn.classList.toggle('active'); 
        
        const index = favorites.findIndex(id => String(id) === String(bookId));
        if (index === -1) {
            favorites.push(String(bookId));
        } else {
            favorites.splice(index, 1);
        }
        localStorage.setItem('libnav_favs', JSON.stringify(favorites));
    }

    document.onclick = (e) => { if(!e.target.closest('.search-wrapper')) autocompleteDropdown.style.display='none'; if(!e.target.closest('.search-wrapper') && !e.target.closest('#filter-toggle')) filterMenu.style.display='none'; };
    function resetIdleTimer() { clearTimeout(idleTimeout); screensaver.style.display='none'; idleTimeout = setTimeout(() => { if(!document.body.classList.contains('companion-mode-active')) { switchSection('home'); document.querySelectorAll('.modal-overlay').forEach(m=>m.style.display='none'); screensaver.style.display='flex'; } }, IDLE_LIMIT); }
    window.onload = resetIdleTimer; document.onmousemove = resetIdleTimer; document.onclick = resetIdleTimer; document.ontouchstart = resetIdleTimer;

    function fetchCoverWithFallback(title, author, elementId, isImgTag) {
        if(coverCache[title]) { applyCover(coverCache[title], elementId, isImgTag); return; }
        fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`).then(r=>r.json()).then(d => {
            if(d.docs?.[0]?.cover_i) { const url = `https://covers.openlibrary.org/b/id/${d.docs[0].cover_i}-M.jpg`; coverCache[title] = url; applyCover(url, elementId, isImgTag); } 
            else {
                fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`).then(r2=>r2.json()).then(d2 => {
                    if(d2.docs?.[0]?.cover_i) { const url = `https://covers.openlibrary.org/b/id/${d2.docs[0].cover_i}-M.jpg`; coverCache[title] = url; applyCover(url, elementId, isImgTag); } 
                    else { const fb = generateInitialsImage(title); coverCache[title] = fb; applyCover(fb, elementId, isImgTag); }
                }).catch(() => { const fb = generateInitialsImage(title); coverCache[title] = fb; applyCover(fb, elementId, isImgTag); });
            }
        }).catch(() => { const fb = generateInitialsImage(title); coverCache[title] = fb; applyCover(fb, elementId, isImgTag); });
    }

    function fetchAuthorPic(author) {
        const el = document.getElementById('modal-author-pic');
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

    // Daily pick
    function loadFeaturedBook() {
        const books = LibraryDB.getBooks(); if (books.length === 0) return;
        
        // 1 Book per day logic using Date String parsing
        const dateStr = new Date().toDateString();
        const dailyIndex = Math.abs(dateStr.split('').reduce((a,b)=>a+(b.charCodeAt(0)),0)) % books.length;
        const b = books[dailyIndex];
        
        const isFav = favorites.some(id => String(id) === String(b.id));
        featuredContainer.innerHTML = `
            <div class="featured-wrap">
                <span class="feat-tag"><i data-lucide="star"></i> Daily Global Pick (${dateStr})</span>
                <div class="featured-card" onclick="openModalById('${b.id}')" style="position:relative;">
                    <div class="feat-img-wrap"><img id="fc-img" src=""></div>
                    <div class="feat-info"><h2>${b.title}</h2><p>${b.author}</p><span class="book-badge">${b.genre}</span></div>
                    <button class="fav-btn ${isFav?'active':''}" style="top:20px; right:20px; background:var(--surface-lighter);" onclick="toggleFavorite(event,'${b.id}')"><i data-lucide="bookmark"></i></button>
                </div>
            </div>`;
        fetchCoverWithFallback(b.title, b.author, 'fc-img', true); renderIcons();
    }

    // STATS MODAL & CALCULATIONS (Bug-Proofed)
    const openStats = () => {
        const books = LibraryDB.getBooks(); 
        const ratings = LibraryDB.getRatings();
        
        // Safe Reduce (Provides initial value so empty arrays don't crash)
        const mostViewed = books.length > 0 ? books.reduce((a,b)=>(a.views||0)>(b.views||0)?a:b, {title:"None",views:0}) : {title:"None",views:0};
        const newest = books.length > 0 ? books.reduce((a,b)=>(a.id>b.id)?a:b, {title:"None"}) : {title:"None"};
        const genres = {}; books.forEach(b=>genres[b.genre]=(genres[b.genre]||0)+1);
        
        // Safe Ratings Calculation
        let avgDisplay = "No Ratings";
        if (ratings && ratings.length > 0) {
            const sum = ratings.reduce((a, b) => a + b, 0);
            const avg = (sum / ratings.length).toFixed(1);
            avgDisplay = `⭐ ${avg} <span style="font-size:0.8rem;color:var(--text-muted);">(${ratings.length} Reviews)</span>`;
        }
        
        document.getElementById('stats-content').innerHTML = `
            <div class="stats-banner"><i data-lucide="server"></i> <span id="uptime-display">Calculating uptime...</span></div>
            <div class="stats-grid">
                <div class="stat-box"><small>TOTAL BOOKS</small><h2>${books.length}</h2></div>
                <div class="stat-box"><small>BOOKMARKS</small><h2 style="color:var(--warning);">${favorites.length}</h2></div>
            </div>
            <div class="stat-box full"><small>GLOBAL RATING</small><h2>${avgDisplay}</h2></div>
            <div class="stat-row"><p><i data-lucide="trending-up"></i> Top Pick</p><div><strong>${mostViewed.title}</strong><span class="view-tag">${mostViewed.views || 0} Views</span></div></div>
            <div class="stat-row"><p><i data-lucide="clock"></i> Newest Arrival</p><div><strong>${newest.title}</strong></div></div>
            <div class="stat-list"><p><i data-lucide="pie-chart"></i> Composition</p>${Object.entries(genres).map(([k,v])=>`<div class="stat-list-item"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
        `; 
        renderIcons(); document.getElementById('stats-modal').style.display = 'flex';

        const updateUptime = () => {
            const startDate = new Date("2026-01-01T00:00:00").getTime(); 
            const diff = new Date().getTime() - startDate;
            const d = Math.floor(diff / (1000 * 60 * 60 * 24)); 
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); 
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            
            const uptimeEl = document.getElementById('uptime-display');
            if (uptimeEl) uptimeEl.innerText = `Cloud Uptime: ${d}d, ${h}h, ${m}m, ${s}s`;
        };
        
        if (uptimeInterval) clearInterval(uptimeInterval);
        updateUptime(); 
        uptimeInterval = setInterval(updateUptime, 1000); 
    };
    document.getElementById('section-stats-btn')?.addEventListener('click', openStats);

    const openFeedback = () => { document.getElementById('feedback-modal').style.display = 'flex'; };
    document.getElementById('section-feedback-btn')?.addEventListener('click', openFeedback);

    const fForm = document.getElementById('feedback-form');
    if(fForm) fForm.onsubmit = async (e) => {
        e.preventDefault(); const btn = document.getElementById('fb-submit-btn'); 
        const name = document.getElementById('fb-name').value;
        const email = document.getElementById('fb-email').value;
        const message = document.getElementById('fb-message').value;
        const rating = parseInt(document.querySelector('input[name="rating"]:checked')?.value || 5); 
        
        btn.innerHTML = '<i data-lucide="loader-2"></i> Sending...'; renderIcons(); btn.disabled = true;
        try { 
            await LibraryDB.submitRating(rating); 
            const combinedMessage = `[User Rating: ${rating}/5 Stars]\n\n${message}`;
            const payload = { name: name, email: email, message: combinedMessage };
            
            await fetch('/api/send-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            showPopup("Success", "Feedback & Rating Sent!", "success"); 
            fForm.reset(); document.getElementById('feedback-modal').style.display = 'none';
        } 
        catch { showPopup("Error", "Message saved locally.", null, false); document.getElementById('feedback-modal').style.display = 'none';} 
        finally { btn.innerHTML = '<i data-lucide="send"></i> Send feedback'; btn.disabled = false; renderIcons();}
    };

    window.showSuccessScreen = function() { document.getElementById('book-modal').style.display = 'none'; document.getElementById('success-modal').style.display = 'flex'; }
    window.closeSuccessScreen = function() { document.getElementById('success-modal').style.display = 'none'; window.location.href = window.location.pathname; }

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; const recognition = new SpeechRecognition(); recognition.lang = 'en-US';
        micBtn.onclick = () => { if (micBtn.classList.contains('active-mic')) recognition.stop(); else recognition.start(); };
        recognition.onstart = () => { micBtn.classList.add('active-mic'); searchInput.placeholder = "Listening..."; };
        recognition.onend = () => { micBtn.classList.remove('active-mic'); searchInput.placeholder = "Search..."; };
        recognition.onresult = (e) => { searchInput.value = e.results[0][0].transcript; searchInput.dispatchEvent(new Event('input')); };
    } else micBtn.style.display = 'none';

    // Admin Tools
    document.getElementById('secret-admin-btn').addEventListener('click', () => { document.getElementById('admin-modal').style.display = 'flex'; });
    document.getElementById('admin-auth-btn').onclick = () => {
        if (document.getElementById('admin-password').value === 'admin123') { 
            document.getElementById('admin-login-screen').style.display = 'none'; 
            document.getElementById('admin-dashboard').style.display = 'block'; 
            updateImageInputs(); 
            renderAdminList(); 
        } else { showPopup("Error", "Incorrect Password", "error"); }
    };
    
    function updateImageInputs() {
        const container = document.getElementById('image-inputs-container');
        container.innerHTML = ''; 
        const count = parseInt(document.getElementById('step-count-select').value) || 2;
        for (let i = 1; i <= count; i++) {
            const input = document.createElement('input'); 
            input.type = 'url';
            input.className = 'input-field step-url-input'; 
            input.placeholder = `Step ${i} Image URL (Leave blank for default)`;
            container.appendChild(input);
        }
    }
    document.getElementById('step-count-select').onchange = updateImageInputs;

    window.handleEdit = function(id) {
        const book = LibraryDB.getBooks().find(b => String(b.id) === String(id)); if (!book) return;
        document.getElementById('edit-book-id').value = book.id; 
        document.getElementById('admin-form-title').innerText = "Edit Book";
        document.getElementById('new-title').value = book.title; document.getElementById('new-author').value = book.author;
        document.getElementById('new-genre').value = book.genre; document.getElementById('step-count-select').value = book.images.length || 2;
        updateImageInputs();
        const inputs = document.querySelectorAll('.step-url-input'); 
        book.images.forEach((img, i) => { if (inputs[i] && !img.includes('placehold.co')) inputs[i].value = img; });
        document.getElementById('add-book-btn').innerHTML = '<i data-lucide="save"></i> Update Book'; 
        document.getElementById('cancel-edit-btn').style.display = "flex"; renderIcons();
    };

    document.getElementById('cancel-edit-btn').onclick = () => {
        document.getElementById('edit-book-id').value = ''; document.getElementById('admin-form-title').innerText = "Add New Book";
        document.getElementById('new-title').value = ''; document.getElementById('new-author').value = '';
        document.getElementById('add-book-btn').innerHTML = '<i data-lucide="upload-cloud"></i> Add to Cloud'; 
        document.getElementById('cancel-edit-btn').style.display = "none"; updateImageInputs(); renderIcons();
    };

    document.getElementById('add-book-btn').onclick = async () => {
        const title = document.getElementById('new-title').value.trim(); const author = document.getElementById('new-author').value.trim(); const genre = document.getElementById('new-genre').value; const editingId = document.getElementById('edit-book-id').value;
        if (!title || !author) return showPopup("Missing Info", "Please fill in title and author.", "error");
        const imageUrls = Array.from(document.querySelectorAll('.step-url-input')).map((input, i) => input.value.trim() || `https://placehold.co/600x400/121212/db2777?text=${genre}+Step+${i+1}`);
        if (editingId) {
            const index = LibraryDB.books.findIndex(b => String(b.id) === String(editingId));
            if (index > -1) { LibraryDB.books[index].title = title; LibraryDB.books[index].author = author; LibraryDB.books[index].genre = genre; LibraryDB.books[index].images = imageUrls; await LibraryDB.saveBooks(); showPopup("Success", "Book Updated!", "success"); }
        } else {
            LibraryDB.books.push({ id: Date.now(), title: title, author: author, genre: genre, images: imageUrls, views: 0 }); await LibraryDB.saveBooks(); showPopup("Success", "Book Added!", "success");
        }
        document.getElementById('cancel-edit-btn').click(); renderAdminList(); performSearch(searchInput.value);
    };

    function renderAdminList() {
        const books = LibraryDB.getBooks();
        const listContainer = document.getElementById('admin-book-list');
        if (!books || books.length === 0) { listContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted);">No books found.</p>'; return; }
        listContainer.innerHTML = books.map(b => `
            <div class="admin-list-item">
                <div class="info"><strong>${b.title}</strong><small>${b.author}</small></div>
                <div class="actions">
                    <button onclick="handleEdit('${b.id}')" class="btn-edit"><i data-lucide="edit-2"></i> Edit</button>
                    <button onclick="handleDelete('${b.id}')" class="btn-delete"><i data-lucide="trash-2"></i> Delete</button>
                </div>
            </div>`).join(''); 
        renderIcons();
    }

    window.handleDelete = async (id) => { showPopup("Confirm Delete", "Delete this book?", "error", async () => { LibraryDB.books = LibraryDB.books.filter(b => String(b.id) !== String(id)); await LibraryDB.saveBooks(); renderAdminList(); performSearch(searchInput.value); showPopup("Deleted", "Book removed.", "info"); }, true); };
    
    // ADMIN SOFT RESET BUTTON
    document.getElementById('factory-reset-btn').onclick = async () => { 
        showPopup("Soft Reset", "Reset all views to 0 and delete all ratings?", "error", async () => { 
            await LibraryDB.factoryReset(); 
            showPopup("Reset Complete", "Values wiped.", "success", () => {
                window.location.reload(); 
            });
        }, true); 
    };

    init();
});
