document.addEventListener('DOMContentLoaded', () => {
    function renderIcons() { if(typeof lucide !== 'undefined') lucide.createIcons(); }

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

    const quickTips = [
        "Use the microphone icon to search for books hands-free.",
        "Bookmark a book to instantly find it later.",
        "Tap the main LibNav logo on the home screen to summon a minion!",
        "Scan the QR code on a PC to transfer the map to your phone."
    ];

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
        
        document.getElementById('popup-confirm').onclick = () => { 
            pop.style.display = 'none'; 
            if(onConfirm) onConfirm(); 
        };
        cancelBtn.onclick = () => pop.style.display = 'none';
        renderIcons();
    }

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

    // NAVIGATION LOGIC
    function switchSection(sectionId) {
        document.querySelectorAll('.nav-tab, .desk-nav-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`.nav-tab[data-section="${sectionId}"]`)?.classList.add('active');
        document.querySelector(`.desk-nav-item[data-section="${sectionId}"]`)?.classList.add('active');
        
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(`${sectionId}-section`).classList.add('active');

        if (sectionId === 'tools') {
            const tipEl = document.getElementById('dynamic-tip');
            if(tipEl) tipEl.innerText = quickTips[Math.floor(Math.random() * quickTips.length)];
        }

        // FULL HOME RESET LOGIC
        if (sectionId === 'home') {
            searchInput.value = ''; 
            autocompleteDropdown.style.display = 'none'; 
            selectedGenres.clear();
            
            // Uncheck all filters
            document.querySelectorAll('.filter-option input').forEach(c => c.checked = false);
            
            // Reset Sidebar active states
            document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
            document.querySelector('.menu-item[data-genre="All"]')?.classList.add('active');
            
            // Restore Hero & Featured
            hero.style.display = 'block'; 
            featuredContainer.style.display = 'block'; 
            resultsArea.innerHTML = ''; 
            
            // Reload featured to ensure bookmark state is fresh
            loadFeaturedBook();
        }
    }

    document.querySelectorAll('[data-section]').forEach(item => {
        item.addEventListener('click', (e) => { e.preventDefault(); switchSection(item.dataset.section); });
    });

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
    document.onclick = (e) => { 
        if(!e.target.closest('.search-wrapper') && !e.target.closest('#filter-toggle')) filterMenu.style.display='none'; 
    };

    async function init() {
        applyTheme(localStorage.getItem('theme') || 'dark');
        await LibraryDB.init();
        loadFeaturedBook(); 
        performSearch(''); // <--- This forces the grid to load immediately
        renderIcons();
    }

    document.getElementById('hamburger-btn').onclick = () => { sideMenu.classList.add('active'); sideMenuOverlay.style.display = 'block'; };
    const closeSidebar = () => { sideMenu.classList.remove('active'); sideMenuOverlay.style.display = 'none'; };
    document.getElementById('close-menu').onclick = closeSidebar; 
    sideMenuOverlay.onclick = closeSidebar;

    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.onclick = () => {
            const genre = btn.dataset.genre;
            searchInput.value = ''; selectedGenres.clear(); 
            
            document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Manually switch to home view without doing a full reset (preserve genre selection)
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

    document.querySelectorAll('.close-btn').forEach(btn => btn.onclick = (e) => {
        const overlay = e.target.closest('.modal-overlay');
        if(overlay) {
            overlay.style.display = 'none';
            if(overlay.id === 'stats-modal' && uptimeInterval) clearInterval(uptimeInterval);
        }
    });

    // SHARE LOGIC
    document.getElementById('mobile-share-btn').onclick = async () => {
        const id = document.getElementById('modal-book-id').innerText;
        const url = `${window.location.origin}${window.location.pathname}?book=${id}`;
        const title = document.getElementById('modal-title').innerText;
        
        if (navigator.share) {
            try {
                await navigator.share({ title: 'LibNav Map', text: `Here is the map to find ${title}`, url: url });
            } catch (err) { console.log('Share dismissed'); }
        } else {
            navigator.clipboard.writeText(url);
            showPopup("Link Copied!", "Share this link with anyone.", 'success');
        }
    };

    const prevBtn = document.getElementById('prev-img-btn');
    const nextBtn = document.getElementById('next-img-btn');

    prevBtn.onclick = () => { if (currentImageIndex > 0) { currentImageIndex--; updateCarousel(); } };
    nextBtn.onclick = () => { if (currentImageIndex < currentImages.length - 1) { currentImageIndex++; updateCarousel(); } };

    window.openModal = function(book) {
        bookModal.style.display = 'flex';
        LibraryDB.incrementView(book.id);

        document.getElementById('modal-title').innerText = book.title; 
        document.getElementById('modal-author').innerText = book.author;
        document.getElementById('modal-book-id').innerText = book.id; 
        document.getElementById('modal-genre').innerText = book.genre;
        
        fetchCover(book.title, book.author, 'modal-book-cover-img');
        fetchAuthorPic(book.author);

        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = ''; 
        const linkUrl = `${window.location.origin}${window.location.pathname}?book=${book.id}`;
        try { new QRCode(qrContainer, { text: linkUrl, width: 120, height: 120, colorDark : "#131314", colorLight : "#ffffff" }); } catch(err) {}

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
            if (selectedGenres.size > 0 && !selectedGenres.has('All')) { hero.style.display='none'; featuredContainer.style.display = 'none'; } 
            else if (searchInput.value === '') { hero.style.display='block'; featuredContainer.style.display = 'block'; }
            performSearch(searchInput.value);
        };
    });

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

    // Toggle Favorite Function (Global)
    window.toggleFavorite = function(e, bookId) {
        e.stopPropagation(); 
        const btn = e.target.closest('.fav-btn');
        btn.classList.toggle('active'); 
        
        const index = favorites.findIndex(id => String(id) === String(bookId));
        if (index === -1) {
            favorites.push(String(bookId));
            showPopup("Saved", "Book added to bookmarks", "success"); // Optional feedback
        } else {
            favorites.splice(index, 1);
        }
        localStorage.setItem('libnav_favs', JSON.stringify(favorites));
    };

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

    // DAILY PICK LOGIC (1 BOOK PER DAY)
    function loadFeaturedBook() {
        const books = LibraryDB.getBooks(); if (books.length === 0) return;
        
        // This math uses the Date String (e.g., "Mon Feb 23 2026") to create a consistent index for 24 hours
        const dateStr = new Date().toDateString();
        const dailyIndex = Math.abs(dateStr.split('').reduce((a,b)=>a+(b.charCodeAt(0)),0)) % books.length;
        const b = books[dailyIndex];
        
        const isFav = favorites.some(id => String(id) === String(b.id));
        featuredContainer.innerHTML = `
            <div style="margin-bottom: 30px;">
                <span style="display:flex; gap:8px; color:var(--warning); font-size:0.8rem; font-weight:bold; margin-bottom:10px;"><i data-lucide="star"></i> DAILY PICK (${dateStr})</span>
                <div style="background:var(--surface); border:1px solid var(--border-color); padding:20px; border-radius:16px; display:flex; gap:20px; cursor:pointer; position:relative;" onclick="openModalById('${b.id}')">
                    <div style="width:90px; height:135px; border-radius:8px; overflow:hidden; position:relative; flex-shrink:0;">
                        <img id="fc-img" src="" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div style="display:flex; flex-direction:column; justify-content:center; gap:8px;">
                        <h2 style="font-size:1.2rem;">${b.title}</h2>
                        <p style="color:var(--text-muted);">${b.author}</p>
                        <span style="background:var(--primary-light); color:var(--primary); padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:bold; align-self:flex-start;">${b.genre}</span>
                    </div>
                    <button class="fav-btn ${isFav ? 'active' : ''}" style="top:20px; right:20px; background:var(--surface-lighter);" onclick="toggleFavorite(event, '${b.id}')"><i data-lucide="bookmark"></i></button>
                </div>
            </div>`;
        fetchCover(b.title, b.author, 'fc-img');
        renderIcons();
    }
    
    window.openModalById = function(id) { const b = LibraryDB.getBooks().find(x => String(x.id) === String(id)); if(b) openModal(b); };

    // STATS MODAL (REAL DATA)
    document.getElementById('section-stats-btn')?.addEventListener('click', () => {
        const books = LibraryDB.getBooks();
        const ratings = LibraryDB.getRatings(); // Real ratings from DB
        
        const mostViewed = books.reduce((a,b)=>(a.views||0)>(b.views||0)?a:b, {title:"None",views:0});
        const newest = books.reduce((a,b)=>(a.id>b.id)?a:b, {title:"None"});
        const genres = {}; books.forEach(b=>genres[b.genre]=(genres[b.genre]||0)+1);
        
        // Calculate Real Average
        let avgDisplay = "No Ratings";
        if (ratings.length > 0) {
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
            <div class="stat-box full"><small>GLOBAL RATING</small><h2 style="color:var(--warning);">${avgDisplay}</h2></div>
            <div class="stat-row"><p><i data-lucide="trending-up"></i> Top Pick</p><div><strong>${mostViewed.title}</strong><span class="view-tag">${mostViewed.views || 0} Views</span></div></div>
            <div class="stat-row"><p><i data-lucide="clock"></i> Newest Arrival</p><div><strong>${newest.title}</strong></div></div>
            <div class="stat-list"><p><i data-lucide="pie-chart"></i> Composition</p>${Object.entries(genres).map(([k,v])=>`<div class="stat-list-item"><span>${k}</span><strong style="color:var(--primary);">${v}</strong></div>`).join('')}</div>
        `; 
        
        renderIcons(); 
        document.getElementById('stats-modal').style.display = 'flex';

        const updateUptime = () => {
            const startDate = new Date("2026-01-01T00:00:00").getTime();
            const now = new Date().getTime();
            const diff = now - startDate;
            
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
    });

    // Feedback Logic 
    document.getElementById('section-feedback-btn')?.addEventListener('click', () => { document.getElementById('feedback-modal').style.display = 'flex'; });
    const fForm = document.getElementById('feedback-form');
    if(fForm) fForm.onsubmit = async (e) => {
        e.preventDefault(); 
        const btn = document.getElementById('fb-submit-btn'); 
        btn.innerHTML = '<i data-lucide="loader-2"></i> Sending...'; renderIcons(); btn.disabled = true;
        
        const rating = parseInt(document.querySelector('input[name="rating"]:checked')?.value || 5);
        
        const payload = { 
            name: document.getElementById('fb-name').value, 
            email: document.getElementById('fb-email').value, 
            message: `[Rating: ${rating}/5]\n\n${document.getElementById('fb-message').value}` 
        };
        
        try { 
            // 1. Submit Rating to Firebase
            await LibraryDB.submitRating(rating);
            
            // 2. Send Email
            await fetch('/api/send-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            
            showPopup("Feedback Sent", "Thank you! Rating saved & email sent.", "success");
            fForm.reset(); document.getElementById('feedback-modal').style.display = 'none';
        } catch { 
            showPopup("Message Saved", "Email failed, but your rating was saved to the cloud.", "info");
            fForm.reset(); document.getElementById('feedback-modal').style.display = 'none';
        } finally { 
            btn.innerHTML = '<i data-lucide="send"></i> Send feedback'; btn.disabled = false; renderIcons();
        }
    };

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
        document.getElementById('new-title').value = book.title; 
        document.getElementById('new-author').value = book.author;
        document.getElementById('new-genre').value = book.genre; 
        document.getElementById('step-count-select').value = book.images ? book.images.length : 2;
        
        updateImageInputs();
        const inputs = document.querySelectorAll('.step-url-input'); 
        if(book.images) {
            book.images.forEach((img, i) => { if (inputs[i] && !img.includes('placehold.co')) inputs[i].value = img; });
        }
        document.getElementById('add-book-btn').innerHTML = '<i data-lucide="save"></i> Update'; 
        document.getElementById('cancel-edit-btn').style.display = "flex"; renderIcons();
    };

    document.getElementById('cancel-edit-btn').onclick = () => {
        document.getElementById('edit-book-id').value = ''; 
        document.getElementById('admin-form-title').innerText = "Add New Book";
        document.getElementById('new-title').value = ''; 
        document.getElementById('new-author').value = '';
        document.getElementById('add-book-btn').innerHTML = '<i data-lucide="upload-cloud"></i> Save'; 
        document.getElementById('cancel-edit-btn').style.display = "none"; updateImageInputs(); renderIcons();
    };

    document.getElementById('add-book-btn').onclick = async () => {
        const title = document.getElementById('new-title').value.trim(); 
        const author = document.getElementById('new-author').value.trim(); 
        const genre = document.getElementById('new-genre').value; 
        const editingId = document.getElementById('edit-book-id').value;
        
        if (!title || !author) return showPopup("Missing Info", "Please fill in title and author.", "error");
        
        const imageUrls = Array.from(document.querySelectorAll('.step-url-input')).map((input, i) => input.value.trim() || `https://placehold.co/600x400/121212/db2777?text=${genre}+Step+${i+1}`);
        
        if (editingId) {
            const index = LibraryDB.books.findIndex(b => String(b.id) === String(editingId));
            if (index > -1) { 
                LibraryDB.books[index].title = title; LibraryDB.books[index].author = author; LibraryDB.books[index].genre = genre; LibraryDB.books[index].images = imageUrls; 
                await LibraryDB.saveBooks(); showPopup("Success", "Book Updated!", "success"); 
            }
        } else {
            const newBook = { id: Date.now(), title: title, author: author, genre: genre, images: imageUrls, views: 0 };
            LibraryDB.books.push(newBook);
            await LibraryDB.saveBooks(); 
            showPopup("Success", "Book Added!", "success");
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

    window.handleDelete = async (id) => { 
        showPopup("Confirm Delete", "Are you sure you want to delete this book?", "error", async () => { 
            LibraryDB.books = LibraryDB.books.filter(b => String(b.id) !== String(id));
            await LibraryDB.saveBooks();
            renderAdminList(); 
            performSearch(searchInput.value); 
            showPopup("Deleted", "Book removed from system.", "info");
        }, true); 
    };

    // Soft Reset Hook
    document.getElementById('factory-reset-btn')?.addEventListener('click', () => {
        showPopup("Confirm Reset", "This will zero all views and delete all ratings. Continue?", "error", async () => {
            await LibraryDB.factoryReset();
            showPopup("Reset Complete", "System data has been wiped.", "success", () => {
                window.location.reload();
            });
        }, true);
    });

    init();
});
