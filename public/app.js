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
    const qrModal = document.getElementById('qr-modal'); 
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
    let currentSort = 'default';
    let recentSearches = JSON.parse(localStorage.getItem('libnav_recent')) || [];

    const tips = [
        "Use two fingers to pinch and zoom around the navigation map to see exact shelf details!",
        "Books marked with a 'HOT' badge are currently the most viewed titles on campus.",
        "Lost internet? LibNav caches your recent data so you can still find your way offline.",
        "Tap the microphone icon in the search bar to find books completely hands-free.",
        "Bookmark a book to instantly find it in your Saved list later.",
        "Browsing on PC? Scan the QR code to seamlessly transfer the map to your phone."
    ];

    function applyTheme(mode) {
        const themeIcon = document.getElementById('theme-btn-icon');
        const themeText = document.getElementById('theme-btn-text');
        if(mode === 'light') {
            document.body.classList.add('light-mode');
            if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
            if (themeText) themeText.innerText = "Switch to Dark Mode";
        } else {
            document.body.classList.remove('light-mode');
            if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
            if (themeText) themeText.innerText = "Switch to Light Mode";
        }
        renderIcons();
    }

    function toggleThemeAction() {
        const isLight = document.body.classList.contains('light-mode');
        const newMode = isLight ? 'dark' : 'light';
        localStorage.setItem('theme', newMode);
        applyTheme(newMode);
    }
    
    document.getElementById('section-theme-toggle')?.addEventListener('click', toggleThemeAction);
    
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
    
    let logoTapCount = 0;
    let logoTapTimer;
    const triggerEasterEgg = () => {
        logoTapCount++;
        clearTimeout(logoTapTimer);
        if (logoTapCount === 2) {
            const shush = document.getElementById('shush-overlay');
            if (shush) {
                shush.style.display = 'flex';
                if (navigator.vibrate) navigator.vibrate([100, 50, 200]); 
                setTimeout(() => { shush.style.display = 'none'; }, 2000);
            }
            logoTapCount = 0;
        } else {
            logoTapTimer = setTimeout(() => { logoTapCount = 0; }, 400);
        }
    };
    
    document.getElementById('hero-title')?.addEventListener('click', triggerEasterEgg);
    document.getElementById('desktop-logo')?.addEventListener('click', triggerEasterEgg);
    
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
        try { await LibraryDB.init(); } catch(e) {}
        
        if (window.innerWidth <= 849) {
            document.body.classList.add('is-mobile-device');
        } else {
            document.body.classList.add('sidebar-closed'); 
        }
        
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

    function switchSection(sectionId, fromCategory = false) {
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
        if(sectionId === 'home' && !fromCategory) {
            searchInput.value = ''; autocompleteDropdown.style.display = 'none'; selectedGenres.clear();
            document.querySelectorAll('.menu-item, .filter-option input').forEach(b => {
                if(b.classList) b.classList.remove('active');
                else b.checked = false;
            });
            document.querySelector('.menu-item[data-genre="All"]')?.classList.add('active');
            const allCheck = document.querySelector('.filter-option input[value="All"]');
            if(allCheck) allCheck.checked = true;
            hero.style.display = 'block'; hero.style.height = 'auto'; hero.style.opacity = '1'; hero.style.margin = '0 0 30px 0';
            featuredContainer.style.display = 'block'; resultsArea.innerHTML = '';
        }
    }

    document.querySelectorAll('[data-section]').forEach(item => {
        item.addEventListener('click', (e) => { e.preventDefault(); switchSection(item.dataset.section); });
    });

    const filterToggle = document.getElementById('filter-toggle'); 
    const filterMenu = document.getElementById('filter-menu');
    filterToggle.onclick = (e) => { e.stopPropagation(); filterMenu.style.display = filterMenu.style.display === 'flex' ? 'none' : 'flex'; };

    document.getElementById('hamburger-btn').onclick = () => { 
        if (window.innerWidth >= 850) {
            document.body.classList.toggle('sidebar-closed');
        } else {
            sideMenu.classList.add('active'); 
            sideMenuOverlay.style.display = 'block'; 
            filterMenu.style.display='none'; 
        }
    };
    const closeSidebar = () => { 
        if (window.innerWidth >= 850) {
            document.body.classList.add('sidebar-closed'); 
        } else {
            sideMenu.classList.remove('active'); 
            sideMenuOverlay.style.display = 'none'; 
        }
    };
    document.getElementById('close-menu').onclick = closeSidebar; 
    sideMenuOverlay.onclick = closeSidebar;
    
    document.querySelectorAll('.close-btn').forEach(btn => btn.onclick = (e) => {
        const overlay = e.target.closest('.modal-overlay');
        if(overlay) overlay.style.display = 'none';
    });

    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.onclick = () => {
            const genre = btn.dataset.genre;
            selectedGenres.clear();
            
            document.querySelectorAll('.menu-item, .filter-option input').forEach(b => { 
                if(b.classList) b.classList.remove('active'); 
                else b.checked = false; 
            }); 
            
            btn.classList.add('active');
            const checkbox = document.querySelector(`.filter-option input[value="${genre}"]`);
            if (checkbox) checkbox.checked = true;
            
            if(genre !== 'All') selectedGenres.add(genre);
            
            const hero = document.getElementById('hero');
            const feat = document.getElementById('featured-container');
            if(hero) { hero.style.display = 'none'; hero.style.opacity = '0'; }
            if(feat) { feat.style.display = 'none'; }
            
            if (genre === 'All' && searchInput.value.trim() === '') {
                performSearch('', true);
            } else {
                performSearch(searchInput.value);
            }
            
            if(window.innerWidth < 850) closeSidebar(); 
            switchSection('home', true);
        };
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
            if (searchInput.value.trim() !== '') { 
                performSearch(searchInput.value); 
            }
        };
    });
    
    
    document.getElementById('admin-auth-btn').onclick = () => {
        if (document.getElementById('admin-password').value === 'admin123') { 
            document.getElementById('admin-login-screen').style.display = 'none'; 
            document.getElementById('admin-dashboard').style.display = 'block'; 
            updateImageInputs(); 
            renderAdminList(); 
        } else { showPopup("Error", "Incorrect Password", null, false); }
    };
    
    const adminMainView = document.getElementById('admin-main-view');
    const adminFormView = document.getElementById('admin-form-view');
    const adminBatchView = document.getElementById('admin-batch-view');

    function resetAdminForm() {
        document.getElementById('edit-book-id').value = ''; 
        document.getElementById('admin-form-title').innerText = "Add New Book";
        document.getElementById('new-title').value = ''; 
        document.getElementById('new-author').value = '';
        const newCheck = document.getElementById('new-arrival-check'); if(newCheck) newCheck.checked = false;
        document.getElementById('add-book-btn').innerHTML = '<i data-lucide="upload-cloud"></i> Save to Cloud'; 
        updateImageInputs(); 
        renderIcons();
    }

    document.getElementById('open-add-view-btn').onclick = () => {
        resetAdminForm();
        adminMainView.style.display = 'none';
        adminFormView.style.display = 'block';
    };

    document.getElementById('close-form-view-btn').onclick = () => {
        adminFormView.style.display = 'none';
        adminMainView.style.display = 'block';
    };

    document.getElementById('open-batch-view-btn').onclick = () => {
        updateBatchImageInputs();
        adminMainView.style.display = 'none';
        adminBatchView.style.display = 'block';
    };

    document.getElementById('close-batch-view-btn').onclick = () => {
        adminBatchView.style.display = 'none';
        adminMainView.style.display = 'block';
    };

    function updateImageInputs() {
        const container = document.getElementById('image-inputs-container');
        container.innerHTML = ''; 
        const count = parseInt(document.getElementById('step-count-select').value) || 2;
        for (let i = 1; i <= count; i++) {
            const input = document.createElement('input'); 
            input.type = 'url';
            input.className = 'input-field step-url-input'; 
            input.placeholder = (i === count) ? `Final Image URL (Leave blank for default)` : `Step ${i} Image URL (Leave blank for default)`;
            container.appendChild(input);
        }
    }
    document.getElementById('step-count-select').onchange = updateImageInputs;

    function updateBatchImageInputs() {
        const container = document.getElementById('batch-image-inputs-container');
        container.innerHTML = ''; 
        const count = parseInt(document.getElementById('batch-step-count').value) || 2;
        for (let i = 1; i <= count; i++) {
            const input = document.createElement('input'); 
            input.type = 'url';
            input.className = 'input-field batch-step-url-input'; 
            input.placeholder = (i === count) ? `Final Image URL (Leave blank for default)` : `Step ${i} Image URL (Leave blank for default)`;
            container.appendChild(input);
        }
    }
    document.getElementById('batch-step-count').onchange = updateBatchImageInputs;

    window.handleEdit = function(id) {
        const book = LibraryDB.getBooks().find(b => String(b.id) === String(id)); if (!book) return;
        document.getElementById('edit-book-id').value = book.id; 
        document.getElementById('admin-form-title').innerText = "Edit Book";
        document.getElementById('new-title').value = book.title; document.getElementById('new-author').value = book.author;
        document.getElementById('new-genre').value = book.genre; document.getElementById('step-count-select').value = book.images.length || 2;
        const newCheck = document.getElementById('new-arrival-check'); if(newCheck) newCheck.checked = !!book.isNew;
        updateImageInputs();
        const inputs = document.querySelectorAll('.step-url-input'); 
        book.images.forEach((img, i) => { if (inputs[i] && !img.includes('placehold.co')) inputs[i].value = img; });
        document.getElementById('add-book-btn').innerHTML = '<i data-lucide="save"></i> Update Book'; 
        
        adminMainView.style.display = 'none';
        adminFormView.style.display = 'block';
        renderIcons();
    };

    document.getElementById('add-book-btn').onclick = async () => {
        const title = document.getElementById('new-title').value.trim(); const author = document.getElementById('new-author').value.trim(); const genre = document.getElementById('new-genre').value; const editingId = document.getElementById('edit-book-id').value;
        const isNewBox = document.getElementById('new-arrival-check'); const isNew = isNewBox ? isNewBox.checked : false;
        if (!title || !author) return showPopup("Missing Info", "Please fill in title and author.", null, false);
        const imageUrls = Array.from(document.querySelectorAll('.step-url-input')).map((input, i) => input.value.trim() || `https://placehold.co/600x400/121212/db2777?text=${genre}+Step+${i+1}`);
        if (editingId) {
            const books = LibraryDB.getBooks(); const index = books.findIndex(b => String(b.id) === String(editingId));
            if (index > -1) { books[index].title = title; books[index].author = author; books[index].genre = genre; books[index].images = imageUrls; books[index].isNew = isNew; await LibraryDB.saveToCloud(); showPopup("Success", "Book Updated!", null, false); }
        } else {
            await LibraryDB.addBook({ id: Date.now(), title: title, author: author, genre: genre, images: imageUrls, views: 0, isNew: isNew }); showPopup("Success", "Book Added!", null, false);
        }
        document.getElementById('close-form-view-btn').click(); renderAdminList(); performSearch(searchInput.value);
    };

    document.getElementById('run-batch-btn').onclick = () => {
        const genre = document.getElementById('batch-genre').value;
        showPopup("Warning", `Overwrite map images for ALL books in "${genre}"?`, async () => {
            const imageUrls = Array.from(document.querySelectorAll('.batch-step-url-input')).map((input, i) => input.value.trim() || `https://placehold.co/600x400/121212/db2777?text=${genre}+Step+${i+1}`);
            const books = LibraryDB.getBooks();
            let count = 0;
            books.forEach(b => {
                if (b.genre === genre) {
                    b.images = imageUrls;
                    count++;
                }
            });
            if (count > 0) {
                await LibraryDB.saveToCloud();
                showPopup("Success", `Updated maps for ${count} books in ${genre}!`, null, false);
                document.getElementById('close-batch-view-btn').click();
                renderAdminList();
            } else {
                showPopup("Notice", `No books found in ${genre}.`, null, false);
            }
        }, true);
    };

    function renderAdminList() {
        const books = LibraryDB.getBooks();
        const listContainer = document.getElementById('admin-book-list');
        const searchTerm = (document.getElementById('admin-search')?.value || '').toLowerCase().trim();
        let filteredBooks = books;
        if (searchTerm) {
            filteredBooks = books.filter(b => b.title.toLowerCase().includes(searchTerm) || b.author.toLowerCase().includes(searchTerm));
        }
        if (!filteredBooks || filteredBooks.length === 0) { 
            listContainer.innerHTML = '<p style="text-align:center;color:var(--text-muted); padding:20px 0;">No books match your search.</p>'; 
            return; 
        }
        listContainer.innerHTML = filteredBooks.map(b => `
            <div class="admin-list-item">
                <div class="info"><strong>${b.title}</strong><small>${b.author}</small></div>
                <div class="actions">
                    <button onclick="handleEdit('${b.id}')" class="btn-edit"><i data-lucide="edit-2"></i> Edit</button>
                    <button onclick="handleDelete('${b.id}')" class="btn-delete"><i data-lucide="trash-2"></i> Delete</button>
                </div>
            </div>`).join(''); 
        renderIcons();
    }

    document.getElementById('admin-search')?.addEventListener('input', renderAdminList);
    window.handleDelete = async (id) => { showPopup("Confirm Delete", "Delete this book?", async () => { await LibraryDB.deleteBook(id); renderAdminList(); performSearch(searchInput.value); }, true); };
    document.getElementById('factory-reset-btn').onclick = async () => { showPopup("Defense Mode", "Reset Stats?", async () => { await LibraryDB.factoryReset(); window.location.reload(); }, true); };

    function loadFeaturedBook() {
        const books = LibraryDB.getBooks(); if (books.length === 0) return;
        const idx = Math.abs(new Date().toDateString().split('').reduce((a,b)=>a+(b.charCodeAt(0)),0)) % books.length; const b = books[idx];
        const isFav = favorites.some(id => String(id) === String(b.id));
        featuredContainer.innerHTML = `
            <div class="featured-wrap">
                <span class="feat-tag"><i data-lucide="star"></i> Daily Global Pick</span>
                <div class="featured-card book-card" onclick="openModalById('${b.id}')"> <div class="feat-img-wrap">
                        <img id="fc-img" src="">
                        <button class="fav-btn ${isFav?'active':''}" onclick="toggleFavorite(event,'${b.id}')"><i data-lucide="bookmark"></i></button>
                    </div>
                    <div class="feat-info"><h2>${b.title}</h2><p>${b.author}</p><span class="book-badge">${b.genre}</span></div>
                </div>
            </div>`;
        fetchCoverWithFallback(b.title, b.author, 'fc-img', true); renderIcons();
    }

    function fetchCoverWithFallback(title, author, elementId, isImgTag) {
        const cacheKey = `${title}-${author}`; 
        if(coverCache[cacheKey]) { applyCover(coverCache[cacheKey], elementId, isImgTag); return; }
        fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`).then(r=>r.json()).then(d => {
            if(d.docs && d.docs.length > 0 && d.docs[0].cover_i) { 
                const url = `https://covers.openlibrary.org/b/id/${d.docs[0].cover_i}-M.jpg`; 
                coverCache[cacheKey] = url; 
                applyCover(url, elementId, isImgTag); 
            } else {
                fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`).then(r2=>r2.json()).then(d2 => {
                    if(d2.docs && d2.docs.length > 0 && d2.docs[0].cover_i) { 
                        const url = `https://covers.openlibrary.org/b/id/${d2.docs[0].cover_i}-M.jpg`; 
                        coverCache[cacheKey] = url; 
                        applyCover(url, elementId, isImgTag); 
                    } else { 
                        const fb = generateInitialsImage(title); coverCache[cacheKey] = fb; applyCover(fb, elementId, isImgTag); 
                    }
                }).catch(() => { const fb = generateInitialsImage(title); coverCache[cacheKey] = fb; applyCover(fb, elementId, isImgTag); });
            }
        }).catch(() => { 
            const fb = generateInitialsImage(title); coverCache[cacheKey] = fb; applyCover(fb, elementId, isImgTag); 
        });
    }
    
    function fetchAuthorPic(author) {
        const el = document.getElementById('umh-author-pic');
        if(!el) return;
        
        const fallback = generateInitialsImage(author);
        el.src = fallback;
        el.onerror = function() { this.src = fallback; };
        
        fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(author)}`).then(r=>r.json()).then(d=>{
            if(d.docs?.[0]?.key) {
                const url = `https://covers.openlibrary.org/a/olid/${d.docs[0].key}-M.jpg?default=false`;
                el.src = url;
            }
        }).catch(e => console.log("Author fetch error:", e));
    }

    function applyCover(url, elId, isImgTag) {
        const el = document.getElementById(elId); if(!el) return;
        if(isImgTag) { el.src = url; el.onload = () => { el.style.opacity = '1'; const wrap = el.closest('.skeleton'); if(wrap) wrap.classList.remove('skeleton'); }; }
        else { el.style.backgroundImage = `url(${url})`; }
    }

    
window.openModalById = function(id) { const b = LibraryDB.getBooks().find(x => String(x.id) === String(id)); if(b) openModal(b); };

    // --- CAROUSEL LOGIC (SWIPE, ZOOM, DOTS) ---
    const prevBtn = document.getElementById('prev-img-btn');
    const nextBtn = document.getElementById('next-img-btn');
    const carouselWrapper = document.getElementById('carousel-wrapper');
    const zoomModal = document.getElementById('zoom-modal');
    const zoomedImage = document.getElementById('zoomed-image');
    const zoomTrigger = document.getElementById('zoom-trigger-btn');

    if(prevBtn) prevBtn.onclick = () => { if (currentImageIndex > 0) { currentImageIndex--; updateCarousel(); } };
    if(nextBtn) nextBtn.onclick = () => { if (currentImageIndex < currentImages.length - 1) { currentImageIndex++; updateCarousel(); } };

    let touchStartX = 0;
    let touchEndX = 0;

    if(carouselWrapper) {
        carouselWrapper.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
        carouselWrapper.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, {passive: true});
    }

    function handleSwipe() {
        const threshold = 50; 
        if (touchEndX < touchStartX - threshold) {
            if (currentImageIndex < currentImages.length - 1) { currentImageIndex++; updateCarousel(); } 
        }
        if (touchEndX > touchStartX + threshold) {
            if (currentImageIndex > 0) { currentImageIndex--; updateCarousel(); } 
        }
    }

    // --- ZOOM LOGIC FIXED ---
    if(zoomTrigger) {
        zoomTrigger.onclick = (e) => {
            e.stopPropagation();
            if(currentImages && currentImages.length > 0) {
                zoomedImage.src = currentImages[currentImageIndex];
                zoomModal.style.display = 'flex';
            }
        };
    }
    
    document.getElementById('close-zoom-btn').onclick = () => zoomModal.style.display = 'none';
    zoomModal.onclick = (e) => { if(e.target === zoomModal || e.target === zoomedImage) zoomModal.style.display = 'none'; };

    async function openModal(book) {
        bookModal.style.display = 'flex'; LibraryDB.incrementView(book.id);
        document.getElementById('modal-book-id').innerText = book.id;
        
        const modalBox = bookModal.querySelector('.modal-box');
        modalBox.classList.remove('dynamic-theme');
        let hash = 0;
        for (let i = 0; i < book.title.length; i++) { hash = book.title.charCodeAt(i) + ((hash << 5) - hash); }
        const hue = Math.abs(hash) % 360; 
        const glowColor = `hsla(${hue}, 80%, 60%, 0.3)`; 
        modalBox.style.setProperty('--dynamic-color', glowColor);
        modalBox.classList.add('dynamic-theme');
     
        document.getElementById('umh-title').innerText = book.title;
        document.getElementById('umh-author-name').innerText = book.author;
        document.getElementById('umh-genre').innerText = book.genre;
        
        const cover = document.getElementById('umh-book-cover');
        if(cover) {
            cover.src = ''; cover.style.opacity = '0'; cover.parentElement.classList.add('skeleton');
            fetchCoverWithFallback(book.title, book.author, 'umh-book-cover', true);
        }
        fetchAuthorPic(book.author);

        const qrContainer = document.getElementById('qrcode');
        if (qrContainer) {
            qrContainer.innerHTML = ''; 
            const dl = `${window.location.origin}${window.location.pathname}?book=${book.id}&view=mobile`;
            try { new QRCode(qrContainer, { text: dl, width: 140, height: 140, colorDark : "#121212", colorLight : "#ffffff" }); } catch(err) {}
        }
        const showQrBtn = document.getElementById('show-qr-btn');
        if(showQrBtn) showQrBtn.onclick = () => { qrModal.style.display = 'flex'; };
        const topShare = document.getElementById('top-share-btn');
        if (topShare) topShare.onclick = () => {
             const url = `${window.location.origin}${window.location.pathname}?book=${book.id}`;
             navigator.clipboard.writeText(`Check out "${book.title}" on LibNav: ${url}`); 
             const toast = document.getElementById('toast-notification');
             toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000);
        };

        const related = LibraryDB.getBooks().filter(b => b.genre === book.genre && b.id !== book.id).slice(0, 25);
        const relatedContainer = document.getElementById('related-shelf');
        if (relatedContainer) {
            relatedContainer.innerHTML = '';
            related.forEach(rBook => {
                const div = document.createElement('div');
                div.className = 'related-card skeleton'; 
                div.innerHTML = `<img id="rel-${rBook.id}" src="" style="opacity:0" onload="this.style.opacity=1;this.parentElement.classList.remove('skeleton')">`;
                div.onclick = () => openModal(rBook);
                relatedContainer.appendChild(div);
                fetchCoverWithFallback(rBook.title, rBook.author, `rel-${rBook.id}`, true);
            });
        }

        currentImages = book.images || []; 
        currentImageIndex = 0; 
        currentGenre = book.genre; 
        updateCarousel(); 
        
        const hint = document.getElementById('swipe-hint');
        if(hint && window.innerWidth < 850) {
            hint.style.display = 'flex';
            hint.style.animation = 'none';
            hint.offsetHeight; /* Trigger reflow */
            hint.style.animation = 'swipeFade 2.5s ease-in-out forwards';
        } else if (hint) {
            hint.style.display = 'none';
        }
        renderIcons();
    }
    
    function updateCarousel() {
        const aa = document.getElementById('mobile-action-area');
        const dotsContainer = document.getElementById('carousel-dots');
        
        if (currentImages && currentImages.length > 0) {
            carouselImg.src = currentImages[currentImageIndex];
            carouselImg.style.display = 'block';
            
            if(stepCounter) stepCounter.innerText = `Step ${currentImageIndex + 1} of ${currentImages.length}`;
            if(prevBtn) { prevBtn.style.opacity = currentImageIndex === 0 ? "0.3" : "1"; prevBtn.style.pointerEvents = currentImageIndex === 0 ? "none" : "auto"; }
            if(nextBtn) { nextBtn.style.opacity = currentImageIndex === currentImages.length - 1 ? "0.3" : "1"; nextBtn.style.pointerEvents = currentImageIndex === currentImages.length - 1 ? "none" : "auto"; }
            
            if (dotsContainer) {
                dotsContainer.innerHTML = currentImages.map((_, i) => 
                    `<span class="dot ${i === currentImageIndex ? 'active' : ''}"></span>`
                ).join('');
            }

            if (aa) aa.style.display = (currentImageIndex === currentImages.length - 1 && document.body.classList.contains('is-mobile-device')) ? 'flex' : 'none';
        } else { 
            carouselImg.style.display = 'none'; 
            if(stepCounter) stepCounter.innerText = "No map available"; 
            if(dotsContainer) dotsContainer.innerHTML = '';
            if (aa && document.body.classList.contains('is-mobile-device')) aa.style.display = 'flex';
        }
    }
    

    const recentDropdown = document.getElementById('recent-searches-dropdown');
    
    function saveRecentSearch(query) {
        if (!query.trim()) return;
        recentSearches = recentSearches.filter(q => q.toLowerCase() !== query.toLowerCase());
        recentSearches.unshift(query.trim());
        if (recentSearches.length > 5) recentSearches.pop();
        localStorage.setItem('libnav_recent', JSON.stringify(recentSearches));
    }

    function renderRecentSearches() {
        if (recentSearches.length === 0 || !recentDropdown) { if(recentDropdown) recentDropdown.style.display = 'none'; return; }
        recentDropdown.innerHTML = `
            <div class="recent-header">
                <span><i data-lucide="history" style="width: 16px; height: 16px;"></i> Recent Searches</span>
                <button class="clear-recent" onclick="clearRecentSearches()"><i data-lucide="trash-2" style="width:14px;height:14px;"></i> Clear</button>
            </div>
            ${recentSearches.map(q => `<div class="auto-item" onclick="selectRecent('${q.replace(/'/g, "\\'")}')"><i data-lucide="search" style="color: var(--text-muted); width: 18px; height: 18px;"></i><div class="auto-text"><strong style="color: var(--text-main); font-size: 1.05rem;">${q}</strong></div></div>`).join('')}
        `;
        renderIcons();
    }

    window.clearRecentSearches = function() {
        recentSearches = [];
        localStorage.removeItem('libnav_recent');
        if(recentDropdown) recentDropdown.style.display = 'none';
    };

    window.selectRecent = function(query) {
        searchInput.value = query; 
        if(recentDropdown) recentDropdown.style.display = 'none';
        performSearch(query);
    };

    searchInput.addEventListener('focus', () => {
        if (!searchInput.value.trim() && recentSearches.length > 0 && recentDropdown) {
            renderRecentSearches();
            recentDropdown.style.display = 'block';
        }
    });

    document.addEventListener('click', (e) => {
        if (recentDropdown && !searchInput.contains(e.target) && !recentDropdown.contains(e.target)) {
            recentDropdown.style.display = 'none';
        }
    });

    searchInput.addEventListener('change', () => {
        saveRecentSearch(searchInput.value);
    });

    searchInput.addEventListener('input', (e) => {
        const t = e.target.value.toLowerCase().trim();
        if (t.length > 0) { hero.style.display = 'none'; featuredContainer.style.display = 'none'; } 
        else if (selectedGenres.size === 0 || selectedGenres.has('All')) { hero.style.display = 'block'; featuredContainer.style.display = 'block'; }
        
        autocompleteDropdown.innerHTML = '';
        if (t.length > 1) {
            if(recentDropdown) recentDropdown.style.display = 'none';
            const hits = LibraryDB.getBooks().filter(b => b.title.toLowerCase().includes(t) || b.author.toLowerCase().includes(t)).slice(0, 4);
            if (hits.length) {
                autocompleteDropdown.style.display = 'block';
                hits.forEach(s => {
                    const d = document.createElement('div'); d.className = 'auto-item';
                    const ht = s.title.replace(new RegExp(`(${t})`, 'gi'), '<span class="text-primary font-bold">$1</span>');
                    d.innerHTML = `<i data-lucide="search" style="color:var(--primary);"></i><div class="auto-text"><strong>${ht}</strong><small>${s.author}</small></div>`;
                    d.onclick = () => { searchInput.value = s.title; saveRecentSearch(s.title); autocompleteDropdown.style.display = 'none'; performSearch(s.title); openModal(s); };
                    autocompleteDropdown.appendChild(d);
                }); renderIcons();
            } else autocompleteDropdown.style.display = 'none';
        } else {
            autocompleteDropdown.style.display = 'none';
            if(recentSearches.length > 0 && recentDropdown) { renderRecentSearches(); recentDropdown.style.display = 'block'; }
        }
        performSearch(t);
    });

    document.getElementById('sort-toggle')?.addEventListener('click', () => {
        const btn = document.getElementById('sort-toggle');
        if (currentSort === 'default') { currentSort = 'A-Z'; btn.style.color = 'var(--primary)'; btn.style.borderColor = 'var(--primary)'; }
        else if (currentSort === 'A-Z') { currentSort = 'Z-A'; }
        else { currentSort = 'default'; btn.style.color = ''; btn.style.borderColor = ''; }
        performSearch(searchInput.value);
    });

    const bttBtn = document.getElementById('back-to-top-btn');
    window.addEventListener('scroll', () => {
        if (bttBtn) {
            if (window.scrollY > 300) bttBtn.classList.add('visible');
            else bttBtn.classList.remove('visible');
        }
    });
    bttBtn?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    function performSearch(term, forceShowAll = false) {
        let books = LibraryDB.getBooks(); term = term.toLowerCase().trim();
        if (!forceShowAll && term === '' && (selectedGenres.size === 0 || selectedGenres.has('All'))) { 
            document.getElementById('results-area').innerHTML = ''; 
            return; 
        }
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
        matches.sort((a, b) => a.title.localeCompare(b.title));
        renderResults(matches);
    }

    document.getElementById('quick-bookmark-btn')?.addEventListener('click', () => {
        const btn = document.getElementById('quick-bookmark-btn');
        if (selectedGenres.has('Favorites')) {
            searchInput.value = '';
            selectedGenres.clear();
            btn.style.color = '';
            document.querySelectorAll('.menu-item, .filter-option input').forEach(b => { 
                if(b.classList) b.classList.remove('active'); 
                else b.checked = false; 
            });
            hero.style.display = 'block'; hero.style.height = 'auto'; hero.style.opacity = '1'; hero.style.margin = '0 0 30px 0';
            featuredContainer.style.display = 'block'; document.getElementById('results-area').innerHTML = '';
            switchSection('home');
        } else {
            searchInput.value = '';
            selectedGenres.clear();
            selectedGenres.add('Favorites');
            btn.style.color = 'var(--primary)';
            document.querySelectorAll('.menu-item, .filter-option input').forEach(b => { 
                if(b.classList) b.classList.remove('active'); 
                else b.checked = false; 
            });
            hero.style.display = 'none'; 
            featuredContainer.style.display = 'none';
            performSearch('');
            switchSection('home', true);
            const results = document.getElementById('results-area');
            if (results.innerHTML.trim() === '') {
                resultsArea.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon-wrap"><i data-lucide="bookmark-minus"></i></div>
                        <h3>No Bookmarks Yet</h3>
                        <p>Hold or hover over any book cover to add it to your reading list.</p>
                    </div>`;
                renderIcons();
            }
        }
    });

    setTimeout(() => {
        document.querySelectorAll('.menu-item[data-genre="All"], .filter-option input[value="All"]').forEach(el => {
            if(el.classList) el.classList.remove('active');
            else el.checked = false;
        });
    }, 100);

    function renderResults(books) {
        resultsArea.innerHTML = '';
        if (books.length === 0) { 
            resultsArea.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-wrap"><i data-lucide="ghost"></i></div>
                    <h3>Whoops! Ghost Town.</h3>
                    <p>We couldn't find any books matching your search. Try a different title or author.</p>
                </div>`; 
            renderIcons(); return; 
        }
        
        if (selectedGenres.has('Favorites') && books.length > 0) {
            const exportHtml = `
                <div class="saved-actions-bar">
                    <span><i data-lucide="bookmark-check"></i> Your Reading List</span>
                    <button class="btn-export" onclick="exportSavedList()"><i data-lucide="share"></i> Share</button>
                </div>
            `;
            resultsArea.insertAdjacentHTML('beforeend', exportHtml);
        }

        const allBooks = LibraryDB.getBooks();
        const maxViews = allBooks.reduce((max, b) => Math.max(max, b.views || 0), 0);
        const trendingBookId = maxViews > 0 ? allBooks.find(b => b.views === maxViews)?.id : null;

        const frag = document.createDocumentFragment(); const term = searchInput.value.trim(); const regex = new RegExp(`(${term})`, 'gi');
        books.forEach((book, i) => {
            const card = document.createElement('div'); card.className = 'book-card';
            const isFav = favorites.some(id => String(id) === String(book.id)); const coverId = `img-${book.id}`;
            const titleHtml = term ? book.title.replace(regex, '<span class="text-primary">$1</span>') : book.title;

            let badgesHtml = '';
            if (book.isNew) badgesHtml += '<div class="new-badge">NEW</div>';
            if (book.id === trendingBookId) {
                badgesHtml += '<div class="hot-badge"><i data-lucide="flame" style="width:12px;height:12px;fill:white;"></i> HOT</div>';
            }

            card.innerHTML = `
                <div class="cover-box skeleton">
                    ${badgesHtml}
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

    window.exportSavedList = function() {
        const books = LibraryDB.getBooks().filter(b => favorites.includes(String(b.id)));
        let text = "📚 My LibNav Reading List:\n\n";
        books.forEach((b, i) => { text += `${i + 1}. ${b.title} by ${b.author}\n`; });
        navigator.clipboard.writeText(text);
        const toast = document.getElementById('toast-notification');
        if(toast) {
            toast.innerHTML = '<i data-lucide="check-circle"></i> Reading List Copied!';
            toast.classList.add('show');
            renderIcons();
            setTimeout(() => toast.classList.remove('show'), 3000);
        }
    };

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

        if (selectedGenres.has('Favorites') && index !== -1) {
            const card = btn.closest('.book-card');
            if (card) card.remove();
            
            if (favorites.length === 0) {
                const resultsArea = document.getElementById('results-area');
                resultsArea.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon-wrap"><i data-lucide="bookmark-minus"></i></div>
                        <h3>No Bookmarks Yet</h3>
                        <p>Hold or hover over any book cover to add it to your reading list.</p>
                    </div>`;
                renderIcons();
            }
        }
    };

    document.onclick = (e) => { if(!e.target.closest('.search-wrapper')) autocompleteDropdown.style.display='none'; if(!e.target.closest('.search-wrapper') && !e.target.closest('#filter-toggle')) filterMenu.style.display='none'; };
    
    async function fetchScreensaverFact() {
        const factEl = document.getElementById('screensaver-fact');
        if(!factEl) return;
        factEl.innerText = "Loading a fun fact...";
        try {
            const res = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random');
            const data = await res.json();
            factEl.innerText = data.text;
        } catch(e) {
            factEl.innerText = "Reading is to the mind what exercise is to the body.";
        }
    }

    function resetIdleTimer() { 
        clearTimeout(idleTimeout); 
        screensaver.style.display='none'; 
        idleTimeout = setTimeout(() => { 
            if(!document.body.classList.contains('companion-mode-active')) { 
                switchSection('home'); 
                document.querySelectorAll('.modal-overlay').forEach(m=>m.style.display='none'); 
                screensaver.style.display='flex'; 
                fetchScreensaverFact();
                renderIcons();
            } 
        }, IDLE_LIMIT); 
    }
    
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt => 
        document.addEventListener(evt, resetIdleTimer, true)
    );
    window.onload = resetIdleTimer;
    
    let uptimeInterval = null;
    const openStats = () => {
        const books = LibraryDB.getBooks(); 
        const ratings = LibraryDB.getRatings() || [];
        
        const mostViewed = books.reduce((a,b)=>(a.views||0)>(b.views||0)?a:b, {title:"None",views:0, author:"N/A"});
        const newest = books.reduce((a,b)=>(a.id>b.id)?a:b, {title:"None", author:"N/A"});
        const genres = {}; books.forEach(b=>genres[b.genre]=(genres[b.genre]||0)+1);
        
        const avg = ratings.length > 0 ? `${(ratings.reduce((a,b)=>a+parseInt(b),0)/ratings.length).toFixed(1)}` : "0.0";
        
        document.getElementById('stats-modal').firstElementChild.classList.add('stats-layout');

        document.getElementById('stats-content').innerHTML = `
            <div class="stats-header-neon">
                <h2>System Dashboard</h2>
                <div class="uptime-pill"><i data-lucide="radio"></i> <span id="uptime-display">Booting...</span></div>
            </div>
            
         <div class="stats-compact-grid">
             <div class="bento-card compact-card stats-split-card">
                    <div class="split-stat-item">
                        <div class="csr-icon yellow" style="margin: 0;"><i data-lucide="star"></i></div>
                        <div><strong style="font-size: 1.6rem; color: var(--text-main); line-height: 1; display: block; margin-bottom: 3px;">${avg}</strong> <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Global Rating (${ratings.length} Reviews)</span></div>
                    </div>
                    
                    <div class="split-divider"></div>
                    
                    <div class="split-stat-item">
                        <div class="csr-icon pink" style="margin: 0;"><i data-lucide="bookmark"></i></div>
                        <div><strong style="font-size: 1.6rem; color: var(--text-main); line-height: 1; display: block; margin-bottom: 3px;">${favorites.length}</strong> <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Bookmarks</span></div>
                    </div>
                </div>
                
               <div class="bento-card" style="position: relative;">     <div style="position: absolute; top: 20px; right: 20px; background: var(--primary-light); color: var(--primary); padding: 6px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">${mostViewed.views || 0} Views</div>
                    <div class="bento-highlight" style="display: flex; flex-direction: row; align-items: center; gap: 18px;">
                        <div class="bento-icon" style="min-width: 50px; width: 50px; height: 50px; background: var(--primary); color: white; border: none; box-shadow: 0 0 15px rgba(219,39,119,0.5); border-radius: 14px; display: flex; justify-content: center; align-items: center; margin: 0; flex-shrink: 0;"><i data-lucide="flame"></i></div>
                        <div class="bento-highlight-info" style="display: flex; flex-direction: column; text-align: left;">
                            <div class="bento-title" style="color: var(--primary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin-bottom: 4px;">Trending Pick</div>
                            <h3 style="color: var(--text-main); font-size: 1.4rem; margin: 0 0 4px 0; line-height: 1.2;">${mostViewed.title || 'No Data'}</h3>
                            <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0;">${mostViewed.author || ''}</p>
                            <span style="background: var(--primary-light); color: var(--primary); padding: 4px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: bold; width: fit-content; text-transform: uppercase;">${mostViewed.genre || 'Unknown'}</span>
                        
                        </div>
                    </div>
                </div>

                <div class="bento-card bento-span-2">
                    <div class="bento-highlight" style="display: flex; flex-direction: row; align-items: center; gap: 18px;">
                        <div class="bento-icon" style="min-width: 50px; width: 50px; height: 50px; background: var(--surface-lighter); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 14px; display: flex; justify-content: center; align-items: center; margin: 0; flex-shrink: 0;"><i data-lucide="sparkles"></i></div>
                        <div class="bento-highlight-info" style="display: flex; flex-direction: column; text-align: left;">
                            <div class="bento-title" style="color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin-bottom: 4px;">Latest Arrival</div>
                            <h3 style="color: var(--text-main); font-size: 1.4rem; margin: 0 0 4px 0; line-height: 1.2;">${newest.title || 'No Data'}</h3>
                            <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0;">${newest.author || ''}</p>
                        </div>
                    </div>
                </div>
                       
                <div class="bento-card compact-card full-width bento-span-2">
                    <div class="csr-header">
                        <span><i data-lucide="pie-chart" style="width:18px;"></i> Catalog Composition</span>
                        <small>Vault: ${books.length} Books</small>
                    </div>
                    <div class="neon-bars">
                        ${Object.entries(genres).map(([k,v])=>`
                            <div class="neon-bar-row">
                                <div class="neon-bar-labels"><span>${k}</span> <span>${v} Vol</span></div>
                                <div class="neon-bar-track"><div class="neon-bar-fill" style="width: ${(v/books.length)*100}%"></div></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `; 
        renderIcons(); 
        document.getElementById('stats-modal').style.display = 'flex';

        const updateUptime = () => {
            const startDate = new Date("2026-01-01T00:00:00").getTime(); const diff = new Date().getTime() - startDate;
            const d = Math.floor(diff / (1000 * 60 * 60 * 24)); const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); 
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)); const s = Math.floor((diff % (1000 * 60)) / 1000);
            const el = document.getElementById('uptime-display'); if(el) el.innerText = `Online: ${d}d ${h}h ${m}m ${s}s`;
        };
        if(uptimeInterval) clearInterval(uptimeInterval); updateUptime(); uptimeInterval = setInterval(updateUptime, 1000);
    };
    
    // --- FIXED STATS & FEEDBACK LISTENERS ---
    const statsBtn = document.getElementById('section-stats-btn');
    if(statsBtn) statsBtn.onclick = openStats;

    const feedbackBtn = document.getElementById('section-feedback-btn');
    const openFeedback = () => { document.getElementById('feedback-modal').style.display = 'flex'; };
    if(feedbackBtn) feedbackBtn.onclick = openFeedback;

    const fForm = document.getElementById('feedback-form');
    if(fForm) fForm.onsubmit = async (e) => {
        e.preventDefault(); const btn = document.getElementById('fb-submit-btn'); 
        const name = document.getElementById('fb-name').value;
        const email = document.getElementById('fb-email').value;
        const message = document.getElementById('fb-message').value;
        const rating = document.querySelector('input[name="rating"]:checked')?.value || 5; 
        btn.innerHTML = '<i data-lucide="loader-2"></i> Sending...'; renderIcons(); btn.disabled = true;
        try { 
            await LibraryDB.submitRating(parseInt(rating)); 
            const combinedMessage = `[User Rating: ${rating}/5 Stars]\n\n${message}`;
            const payload = { name: name, email: email, message: combinedMessage };
            await fetch('/api/send-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            showPopup("Success", "Feedback Sent via Email! Thank you.", null, false); 
            fForm.reset(); document.getElementById('feedback-modal').style.display = 'none';
        } 
        catch { showPopup("Error", "Message saved locally.", null, false); document.getElementById('feedback-modal').style.display = 'none';} 
        finally { btn.innerHTML = '<i data-lucide="send"></i> Send feedback'; btn.disabled = false; renderIcons();}
    };

    window.showSuccessScreen = function() { document.getElementById('book-modal').style.display = 'none'; document.getElementById('success-modal').style.display = 'flex'; }
    
    window.closeSuccessScreen = function() { 
        document.getElementById('success-modal').style.display = 'none'; 
        document.body.classList.remove('companion-mode-active'); 
        switchSection('home'); 
    }

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; const recognition = new SpeechRecognition(); recognition.lang = 'en-US';
        micBtn.onclick = () => { if (micBtn.classList.contains('active-mic')) recognition.stop(); else recognition.start(); };
        recognition.onstart = () => { micBtn.classList.add('active-mic'); searchInput.placeholder = "Listening..."; };
        recognition.onend = () => { micBtn.classList.remove('active-mic'); searchInput.placeholder = "Search..."; };
        recognition.onresult = (e) => { searchInput.value = e.results[0][0].transcript; searchInput.dispatchEvent(new Event('input')); };
    } else micBtn.style.display = 'none';

    let lastScrollY = window.scrollY;
    const topNav = document.querySelector('.search-wrapper') || document.querySelector('.top-nav'); 
    
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        if (currentScrollY > 100) { 
            if (currentScrollY > lastScrollY + 10) {
                if(topNav) topNav.classList.add('header-hidden');
                lastScrollY = currentScrollY;
            } else if (currentScrollY < lastScrollY - 10) {
                if(topNav) topNav.classList.remove('header-hidden');
                lastScrollY = currentScrollY;
            }
        } else {
            if(topNav) topNav.classList.remove('header-hidden');
            lastScrollY = currentScrollY;
        }
    }, { passive: true });

    let holdTimer;
    document.getElementById('results-area').addEventListener('touchstart', (e) => {
        const card = e.target.closest('.book-card');
        if (!card) return;
        document.querySelectorAll('.book-card.show-actions').forEach(c => c.classList.remove('show-actions'));
        holdTimer = setTimeout(() => {
            if(navigator.vibrate) navigator.vibrate(50); 
            card.classList.add('show-actions');
        }, 500); 
    }, {passive: true});
    document.getElementById('results-area').addEventListener('touchend', () => clearTimeout(holdTimer));
    document.getElementById('results-area').addEventListener('touchmove', () => clearTimeout(holdTimer));

    document.addEventListener('click', (e) => {
        if(!e.target.closest('.book-card')) {
             document.querySelectorAll('.book-card.show-actions').forEach(c => c.classList.remove('show-actions'));
        }
    });

    window.addEventListener('online', () => {
        document.getElementById('offline-banner').style.display = 'none';
    });
    window.addEventListener('offline', () => {
        document.getElementById('offline-banner').style.display = 'flex';
    });
    if (!navigator.onLine) {
        document.getElementById('offline-banner').style.display = 'flex';
    }

    renderIcons(); 
    setTimeout(renderIcons, 200); 
    setTimeout(renderIcons, 500); 
    setTimeout(renderIcons, 1000);

    // --- PINCH TO ZOOM LOGIC ---
    let currentScale = 1; let initialDistance = 0;
    
    carouselImg.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialDistance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        }
    }, {passive: true});

    carouselImg.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault(); // Prevents the whole page from scrolling
            const currentDistance = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            const scaleChange = currentDistance / initialDistance;
            currentScale = Math.min(Math.max(1, currentScale * scaleChange), 3.5); // Max zoom 3.5x
            carouselImg.style.transform = `scale(${currentScale})`;
            initialDistance = currentDistance;
        }
    }, {passive: false});

    // Reset zoom when swiping to the next image
    const resetZoom = () => { currentScale = 1; carouselImg.style.transform = `scale(1)`; };
    if(prevBtn) prevBtn.addEventListener('click', resetZoom);
    if(nextBtn) nextBtn.addEventListener('click', resetZoom);
    if(carouselWrapper) carouselWrapper.addEventListener('touchend', resetZoom, {passive: true});

    // --- ONBOARDING POPUP LOGIC ---
    const welcomeModal = document.getElementById('welcome-modal');
    if (!localStorage.getItem('libnav_onboarded')) {
        setTimeout(() => { welcomeModal.style.display = 'flex'; }, 1000);
    }
    document.getElementById('start-libnav-btn').onclick = () => {
        if (document.getElementById('never-show-welcome').checked) {
            localStorage.setItem('libnav_onboarded', 'true');
        }
        welcomeModal.style.display = 'none';
    };

    // --- ADMIN BROADCAST CONTROLS ---
    document.getElementById('open-broadcast-view-btn').onclick = () => {
        document.getElementById('admin-broadcast-view').style.display = 'flex';
    };
    document.getElementById('close-broadcast-admin-btn').onclick = () => {
        document.getElementById('admin-broadcast-view').style.display = 'none';
    };
    
    document.getElementById('send-broadcast-btn').onclick = async () => {
        const t = document.getElementById('bc-title').value.trim();
        const m = document.getElementById('bc-msg').value.trim();
        if(!t || !m) return showPopup("Error", "Fill out both fields.", null, false);
        
        const bcObj = { id: 'bc_' + Date.now(), title: t, message: m };
        await LibraryDB.setBroadcast(bcObj);
        showPopup("Success", "Broadcast sent to all users!", null, false);
        document.getElementById('admin-broadcast-view').style.display = 'none';
    };

    document.getElementById('clear-broadcast-btn').onclick = async () => {
        await LibraryDB.setBroadcast(null);
        showPopup("Cleared", "Active broadcast removed.", null, false);
        document.getElementById('admin-broadcast-view').style.display = 'none';
    };

    // --- USER BROADCAST LISTENER ---
    setTimeout(async () => {
        const activeBc = await LibraryDB.getBroadcast();
        if (activeBc && activeBc.id) {
            const seenBc = localStorage.getItem('libnav_seen_broadcast');
            if (seenBc !== activeBc.id) {
                document.getElementById('ub-title').innerText = activeBc.title;
                document.getElementById('ub-msg').innerText = activeBc.message;
                document.getElementById('user-broadcast-modal').style.display = 'flex';
                
                document.getElementById('ub-got-it-btn').onclick = () => {
                    localStorage.setItem('libnav_seen_broadcast', activeBc.id);
                    document.getElementById('user-broadcast-modal').style.display = 'none';
                };
            }
        }
    }, 2000); // Check 2 seconds after load
    
    init();
});
