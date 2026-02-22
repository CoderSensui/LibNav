/* app.js - Full Fixed Engine */

document.addEventListener('DOMContentLoaded', () => {

    function renderIcons() {
        if(typeof lucide !== 'undefined') lucide.createIcons();
    }

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
    const neighborsGrid = document.getElementById('neighbors-grid');
    const carouselImg = document.getElementById('carousel-img');
    const stepCounter = document.getElementById('step-counter');

    let selectedGenres = new Set(); 
    let favorites = JSON.parse(localStorage.getItem('libnav_favs')) || [];
    const IDLE_LIMIT = 30000;
    let idleTimeout;
    const coverCache = {}; 
    const authorCache = {}; 
    let currentImages = [];
    let currentImageIndex = 0;
    let currentGenre = ""; // Track for step text

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

    function showPopup(title, msg, onConfirm, showCancel = false) {
        document.getElementById('popup-title').innerText = title;
        document.getElementById('popup-message').innerText = msg;
        const pop = document.getElementById('custom-popup');
        pop.style.display = 'flex';
        
        const cancelBtn = document.getElementById('popup-cancel');
        cancelBtn.style.display = showCancel ? 'block' : 'none';
        
        document.getElementById('popup-confirm').onclick = () => { pop.style.display = 'none'; if(onConfirm) onConfirm(); };
        cancelBtn.onclick = () => pop.style.display = 'none';
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

    document.getElementById('secret-admin-btn').addEventListener('click', () => { adminModal.style.display = 'flex'; });

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
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 300; 
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#121212'; ctx.fillRect(0, 0, 200, 300);
        ctx.font = 'bold 80px sans-serif'; ctx.fillStyle = '#db2777'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(initials, 100, 150);
        return canvas.toDataURL();
    }

    async function init() {
        const saved = localStorage.getItem('theme') || 'dark';
        applyTheme(saved);
        
        try {
            await LibraryDB.init(); 
        } catch(e) {
            resultsArea.innerHTML = '<p style="color:red; text-align:center;">Database Error</p>';
        }
        
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
            hero.style.height = 'auto'; hero.style.opacity = '1'; hero.style.margin = '0 0 30px 0';
            featuredContainer.style.display = 'block'; resultsArea.innerHTML = ''; 
        }
    }

    document.querySelectorAll('[data-section]').forEach(item => {
        item.addEventListener('click', (e) => { e.preventDefault(); switchSection(item.dataset.section); });
    });

    const filterToggle = document.getElementById('filter-toggle'); 
    const filterMenu = document.getElementById('filter-menu');
    filterToggle.onclick = (e) => { e.stopPropagation(); filterMenu.style.display = filterMenu.style.display === 'flex' ? 'none' : 'flex'; };

    document.getElementById('hamburger-btn').onclick = () => { sideMenu.classList.add('active'); sideMenuOverlay.style.display = 'block'; filterMenu.style.display='none'; };
    const closeSidebar = () => { sideMenu.classList.remove('active'); sideMenuOverlay.style.display = 'none'; };
    document.getElementById('close-menu').onclick = closeSidebar; sideMenuOverlay.onclick = closeSidebar;
    
    document.querySelectorAll('.close-btn').forEach(btn => btn.onclick = (e) => {
        e.target.closest('.modal-overlay').style.display = 'none';
    });

    document.getElementById('admin-auth-btn').onclick = () => {
        if (document.getElementById('admin-password').value === 'admin123') { 
            document.getElementById('admin-login-screen').style.display = 'none'; 
            document.getElementById('admin-dashboard').style.display = 'block'; 
            updateImageInputs(); 
            renderAdminList(); 
        } else { showPopup("Error", "Incorrect Password", null, false); }
    };
    
    function updateImageInputs() {
        const container = document.getElementById('image-inputs-container');
        container.innerHTML = ''; 
        const count = parseInt(document.getElementById('step-count-select').value) || 2;
        for (let i = 1; i <= count; i++) {
            const input = document.createElement('input'); 
            input.type = 'url';
            input.className = 'input-field step-url-input'; 
            input.style.borderLeft = "4px solid var(--primary)";
            input.placeholder = (i === count) ? `Final Image URL (Leave blank for default)` : `Step ${i} Image URL (Leave blank for default)`;
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
        document.getElementById('cancel-edit-btn').style.display = "block"; renderIcons();
    };

    document.getElementById('cancel-edit-btn').onclick = () => {
        document.getElementById('edit-book-id').value = ''; document.getElementById('admin-form-title').innerText = "Add New Book";
        document.getElementById('new-title').value = ''; document.getElementById('new-author').value = '';
        document.getElementById('add-book-btn').innerHTML = '<i data-lucide="upload-cloud"></i> Add to Cloud'; 
        document.getElementById('cancel-edit-btn').style.display = "none"; updateImageInputs(); renderIcons();
    };

    document.getElementById('add-book-btn').onclick = async () => {
        const title = document.getElementById('new-title').value.trim(); const author = document.getElementById('new-author').value.trim(); const genre = document.getElementById('new-genre').value; const editingId = document.getElementById('edit-book-id').value;
        if (!title || !author) return showPopup("Missing Info", "Please fill in title and author.", null, false);
        const imageUrls = Array.from(document.querySelectorAll('.step-url-input')).map((input, i) => input.value.trim() || `https://placehold.co/600x400/121212/db2777?text=${genre}+Step+${i+1}`);
        if (editingId) {
            const books = LibraryDB.getBooks(); const index = books.findIndex(b => String(b.id) === String(editingId));
            if (index > -1) { books[index].title = title; books[index].author = author; books[index].genre = genre; books[index].images = imageUrls; await LibraryDB.saveToCloud(); showPopup("Success", "Book Updated!", null, false); }
        } else {
            await LibraryDB.addBook({ id: Date.now(), title: title, author: author, genre: genre, images: imageUrls, views: 0 }); showPopup("Success", "Book Added!", null, false);
        }
        document.getElementById('cancel-edit-btn').click(); renderAdminList(); performSearch(searchInput.value);
    };

    function renderAdminList() {
        const books = LibraryDB.getBooks();
        const listContainer = document.getElementById('admin-book-list');
        if (!books || books.length === 0) { listContainer.innerHTML = '<p>No books found.</p>'; return; }
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

    window.handleDelete = async (id) => { showPopup("Confirm Delete", "Delete this book?", async () => { await LibraryDB.deleteBook(id); renderAdminList(); performSearch(searchInput.value); }, true); };
    document.getElementById('factory-reset-btn').onclick = async () => { showPopup("Defense Mode", "Reset Stats?", async () => { await LibraryDB.factoryReset(); window.location.reload(); }, true); };

    function loadFeaturedBook() {
        const books = LibraryDB.getBooks(); if (books.length === 0) return;
        const idx = Math.abs(new Date().toDateString().split('').reduce((a,b)=>a+(b.charCodeAt(0)),0)) % books.length; const b = books[idx];
        const isFav = favorites.some(id => String(id) === String(b.id));
        featuredContainer.innerHTML = `
            <div class="featured-wrap">
                <span class="feat-tag"><i data-lucide="star"></i> Daily Global Pick</span>
                <div class="featured-card" onclick="openModalById('${b.id}')">
                    <div class="feat-img-wrap"><img id="fc-img" src="">
                    <button class="fav-btn ${isFav?'active':''}" onclick="toggleFavorite(event,'${b.id}')"><i data-lucide="bookmark"></i></button></div>
                    <div class="feat-info"><h2>${b.title}</h2><p>by ${b.author}</p><span class="book-badge">${b.genre}</span></div>
                </div>
            </div>`;
        fetchCoverWithFallback(b.title, b.author, 'fc-img', true); renderIcons();
    }

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
    
    function fetchAuthorPic(author, elementId) {
        const el = document.getElementById(elementId);
        if(!el) return;
        if(authorCache[author]) { el.src = authorCache[author]; el.onload = () => el.parentElement.classList.remove('skeleton'); return; }
        fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(author)}`).then(r => r.json()).then(d => {
            if(d.docs?.[0]?.key) { const u = `https://covers.openlibrary.org/a/olid/${d.docs[0].key}-M.jpg`; authorCache[author] = u; el.src = u; }
            else { el.src = generateInitialsImage(author); }
            el.onload = () => el.parentElement.classList.remove('skeleton');
        }).catch(() => { el.src = generateInitialsImage(author); el.parentElement.classList.remove('skeleton'); });
    }

    function applyCover(url, elId, isImgTag) {
        const el = document.getElementById(elId); if(!el) return;
        if(isImgTag) { el.src = url; el.onload = () => { el.style.opacity = '1'; const wrap = el.closest('.skeleton'); if(wrap) wrap.classList.remove('skeleton'); }; }
        else { el.style.backgroundImage = `url(${url})`; }
    }

    window.openModalById = function(id) { const b = LibraryDB.getBooks().find(x => String(x.id) === String(id)); if(b) openModal(b); };

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
        
        // Fetch Author
        const authPic = document.getElementById('modal-author-pic');
        authPic.src = ''; authPic.parentElement.classList.add('skeleton');
        fetchAuthorPic(book.author, 'modal-author-pic');

        qrContainer.innerHTML = ''; const dl = `${window.location.origin}${window.location.pathname}?book=${book.id}&view=mobile`;
        try { new QRCode(qrContainer, { text: dl, width: 120, height: 120, colorDark : "#121212", colorLight : "#ffffff" }); } catch(err) {}

        const sb = document.getElementById('share-book-btn');
        if (sb) sb.onclick = async () => { if (navigator.share) await navigator.share({title: 'LibNav', text: `Check out ${book.title}`, url: dl}); else { navigator.clipboard.writeText(dl); showPopup("Success", "Link copied!", null, false); } };

        currentImages = book.images || []; currentImageIndex = 0; currentGenre = book.genre; updateCarousel();
        
        const all = LibraryDB.getBooks();
        let neighbors = all.filter(b => b.genre === book.genre && String(b.id) !== String(book.id)).sort(()=>0.5-Math.random()).slice(0, 4);
        neighborsGrid.innerHTML = '';
        if (neighbors.length > 0) {
            document.getElementById('neighbors-area').style.display = 'block';
            neighbors.forEach(n => {
                const card = document.createElement('div'); card.className = 'neighbor-card'; const imgId = `n-${n.id}-${Date.now()}`;
                card.innerHTML = `<img id="${imgId}" src="">`; card.onclick = () => openModal(n);
                neighborsGrid.appendChild(card); fetchCoverWithFallback(n.title, n.author, imgId, true);
            });
        } else document.getElementById('neighbors-area').style.display = 'none';
        renderIcons();
    }

    function updateCarousel() {
        const aa = document.getElementById('mobile-action-area');
        if (currentImages && currentImages.length > 0) {
            stepCounter.innerText = `${currentGenre} Step ${currentImageIndex + 1}`;
            carouselImg.src = currentImages[currentImageIndex]; 
            prevBtn.style.opacity = currentImageIndex === 0 ? "0.3" : "1";
            nextBtn.style.opacity = currentImageIndex === currentImages.length - 1 ? "0.3" : "1";
            carouselImg.style.display = 'block';
            if (aa) aa.style.display = (currentImageIndex === currentImages.length - 1 && document.body.classList.contains('is-mobile-device')) ? 'block' : 'none';
        } else { 
            carouselImg.style.display = 'none'; stepCounter.innerText = "No map available"; 
            if (aa && document.body.classList.contains('is-mobile-device')) aa.style.display = 'block';
        }
    }

    // --- FIX SIDEBAR CLICKABILITY ---
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetGenre = btn.dataset.genre;
            searchInput.value = ''; selectedGenres.clear(); 
            
            document.querySelectorAll('.menu-item, .filter-option input').forEach(b => { 
                if(b.classList) b.classList.remove('active'); 
                else b.checked = false; 
            }); 
            
            btn.classList.add('active');
            
            if(targetGenre === 'All') { 
                hero.style.height = 'auto'; hero.style.opacity = '1'; hero.style.margin = '0 0 30px 0'; 
                featuredContainer.style.display = 'block'; 
                // "All" filter logic reset handled correctly
            } 
            else { 
                selectedGenres.add(targetGenre);
                hero.style.height = '0'; hero.style.opacity = '0'; hero.style.margin = '0'; 
                featuredContainer.style.display = 'none'; 
            }
            performSearch(''); closeSidebar(); switchSection('home');
        });
    });

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
            if (selectedGenres.size > 0 && !selectedGenres.has('All')) { hero.style.height = '0'; hero.style.opacity = '0'; hero.style.margin = '0'; featuredContainer.style.display = 'none'; } 
            else if (searchInput.value === '') { hero.style.height = 'auto'; hero.style.opacity = '1'; hero.style.margin = '0 0 30px 0'; featuredContainer.style.display = 'block'; }
            performSearch(searchInput.value);
        };
    });

    searchInput.addEventListener('input', (e) => {
        const t = e.target.value.toLowerCase().trim();
        if (t.length > 0) { hero.style.height = '0'; hero.style.opacity = '0'; hero.style.margin = '0'; featuredContainer.style.display = 'none'; } 
        else if (selectedGenres.size === 0 || selectedGenres.has('All')) { hero.style.height = 'auto'; hero.style.opacity = '1'; hero.style.margin = '0 0 30px 0'; featuredContainer.style.display = 'block'; }
        
        autocompleteDropdown.innerHTML = '';
        if (t.length > 1) {
            const hits = LibraryDB.getBooks().filter(b => b.title.toLowerCase().includes(t) || b.author.toLowerCase().includes(t)).slice(0, 4);
            if (hits.length) {
                autocompleteDropdown.style.display = 'block';
                hits.forEach(s => {
                    const d = document.createElement('div'); d.className = 'auto-item';
                    const ht = s.title.replace(new RegExp(`(${t})`, 'gi'), '<span class="text-primary font-bold">$1</span>');
                    d.innerHTML = `<i data-lucide="search" style="color:var(--primary);"></i><div class="auto-text"><strong>${ht}</strong><small style="color:var(--text-muted);">${s.author}</small></div>`;
                    d.onclick = () => { searchInput.value = s.title; autocompleteDropdown.style.display = 'none'; performSearch(s.title); openModal(s); };
                    autocompleteDropdown.appendChild(d);
                }); renderIcons();
            } else autocompleteDropdown.style.display = 'none';
        } else autocompleteDropdown.style.display = 'none';
        performSearch(t);
    });

    function performSearch(term) {
        let books = LibraryDB.getBooks(); term = term.toLowerCase().trim();
        
        // If empty term and "All" is selected or empty set -> render all books
        if (term === '' && (selectedGenres.size === 0 || selectedGenres.has('All'))) { 
            renderResults(books); 
            return; 
        }
        
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
        if (books.length === 0) { resultsArea.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);"><i data-lucide="book-x" style="width:50px;height:50px;margin-bottom:10px;opacity:0.5;"></i><p>No books found.</p></div>'; renderIcons(); return; }
        const frag = document.createDocumentFragment(); const term = searchInput.value.trim(); const regex = new RegExp(`(${term})`, 'gi');
        books.forEach((book, i) => {
            const card = document.createElement('div'); card.className = 'book-card';
            const isFav = favorites.some(id => String(id) === String(book.id)); const coverId = `img-${book.id}`;
            const titleHtml = term ? book.title.replace(regex, '<span style="color:var(--primary);">$1</span>') : book.title;

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
        e.stopPropagation(); vibrate(); const index = favorites.findIndex(id => String(id) === String(bookId));
        if (index === -1) favorites.push(String(bookId)); else favorites.splice(index, 1);
        localStorage.setItem('libnav_favs', JSON.stringify(favorites)); performSearch(searchInput.value); loadFeaturedBook();
    }

    document.onclick = (e) => { if(!e.target.closest('.search-wrapper')) autocompleteDropdown.style.display='none'; if(!e.target.closest('.search-wrapper') && !e.target.closest('#filter-toggle')) filterMenu.style.display='none'; };
    function resetIdleTimer() { clearTimeout(idleTimeout); screensaver.style.display='none'; idleTimeout = setTimeout(() => { if(!document.body.classList.contains('companion-mode-active')) { switchSection('home'); document.querySelectorAll('.modal-overlay').forEach(m=>m.style.display='none'); screensaver.style.display='flex'; } }, IDLE_LIMIT); }
    window.onload = resetIdleTimer; document.onmousemove = resetIdleTimer; document.onclick = resetIdleTimer; document.ontouchstart = resetIdleTimer;
    
    const openStats = () => {
        const books = LibraryDB.getBooks(); const ratings = LibraryDB.getRatings();
        const startDate = new Date("2026-01-01T00:00:00").getTime(); const diff = new Date().getTime() - startDate;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24)); const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const mostViewed = books.reduce((a,b)=>(a.views||0)>(b.views||0)?a:b, {title:"None",views:0});
        const newest = books.reduce((a,b)=>(a.id>b.id)?a:b, {title:"None"});
        const genres = {}; books.forEach(b=>genres[b.genre]=(genres[b.genre]||0)+1);
        const avg = ratings.length ? `⭐ ${(ratings.reduce((a,b)=>a+parseInt(b),0)/ratings.length).toFixed(1)} <span style="font-size:0.8rem;color:var(--text-muted);">(${ratings.length} Reviews)</span>` : "No Ratings";
        
        document.getElementById('stats-content').innerHTML = `
            <div class="stats-banner"><i data-lucide="server"></i> Cloud Uptime: ${days}d, ${hours}h, ${minutes}m</div>
            <div class="stats-grid">
                <div class="stat-box"><small>TOTAL BOOKS</small><h2>${books.length}</h2></div>
                <div class="stat-box"><small>BOOKMARKS</small><h2 style="color:var(--warning);">${favorites.length}</h2></div>
            </div>
            <div class="stat-box full"><small>GLOBAL RATING</small><h2>${avg}</h2></div>
            <div class="stat-row"><p><i data-lucide="trending-up"></i> Top Pick</p><div><strong>${mostViewed.title}</strong><span class="view-tag">${mostViewed.views} Views</span></div></div>
            <div class="stat-row"><p><i data-lucide="clock"></i> Newest Arrival</p><div><strong>${newest.title}</strong></div></div>
            <div class="stat-list"><p><i data-lucide="pie-chart"></i> Composition</p>${Object.entries(genres).map(([k,v])=>`<div class="stat-list-item"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
        `; renderIcons(); document.getElementById('stats-modal').style.display = 'flex';
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
        const rating = document.querySelector('input[name="rating"]:checked')?.value || 5; 
        
        btn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> Sending...'; renderIcons(); btn.disabled = true;
        try { 
            await LibraryDB.submitRating(parseInt(rating)); 
            const combinedMessage = `[User Rating: ${rating}/5 Stars]\n\n${message}`;
            const payload = { name: name, email: email, message: combinedMessage };
            
            await fetch('/api/send-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            showPopup("Success", "Feedback Sent via Email! Thank you.", null, false, "check-circle"); 
            fForm.reset(); document.getElementById('feedback-modal').style.display = 'none';
        } 
        catch { showPopup("Error", "Message saved locally.", null, false, "alert-triangle"); document.getElementById('feedback-modal').style.display = 'none';} 
        finally { btn.innerHTML = '<i data-lucide="send"></i> Send feedback to developer'; btn.disabled = false; renderIcons();}
    };

    window.showSuccessScreen = function() { document.getElementById('book-modal').style.display = 'none'; document.getElementById('success-modal').style.display = 'flex'; }
    window.closeSuccessScreen = function() { document.getElementById('success-modal').style.display = 'none'; window.location.href = window.location.pathname; }

    // --- FIX MIC ERROR HANDLING ---
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; 
        const recognition = new SpeechRecognition(); 
        recognition.lang = 'en-US';
        micBtn.onclick = () => { if (micBtn.classList.contains('active-mic')) recognition.stop(); else recognition.start(); };
        recognition.onstart = () => { micBtn.classList.add('active-mic'); searchInput.placeholder = "Listening..."; };
        recognition.onend = () => { micBtn.classList.remove('active-mic'); searchInput.placeholder = "Search title or author..."; };
        recognition.onresult = (e) => { searchInput.value = e.results[0][0].transcript; searchInput.dispatchEvent(new Event('input')); };
        recognition.onerror = (e) => { console.log('Mic Error', e); searchInput.placeholder = "Mic blocked/error."; setTimeout(()=>{searchInput.placeholder = "Search title or author...";}, 2000); };
    } else micBtn.style.display = 'none';

    init();
});
