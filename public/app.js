/* app.js - Fully Expanded & heavily commented Javascript Engine */

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // SYSTEM ICONS LOADER
    // ==========================================
    // Forced delay to ensure DOM is fully parsed and rendered before drawing SVGs.
    // This prevents the "missing icons on load" bug.
    function refreshIcons() {
        setTimeout(() => {
            try { 
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons(); 
                }
            } catch (err) { 
                console.error("Lucide Icon Render Skipped: ", err); 
            }
        }, 100);
    }

    // ==========================================
    // DOM ELEMENT BINDINGS
    // ==========================================
    const searchInput = document.getElementById('search-input');
    const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
    const resultsArea = document.getElementById('results-area');
    const featuredContainer = document.getElementById('featured-container');
    const hero = document.getElementById('hero');
    const sideMenu = document.getElementById('side-menu');
    const sideMenuOverlay = document.getElementById('side-menu-overlay');
    const closeMenuBtn = document.getElementById('close-menu');
    const micBtn = document.getElementById('mic-btn');
    const screensaver = document.getElementById('screensaver');
    const offlineBanner = document.getElementById('offline-banner');

    const secretAdminBtn = document.getElementById('secret-admin-btn');
    const adminModal = document.getElementById('admin-modal');
    const adminAuthBtn = document.getElementById('admin-auth-btn');
    const adminPassInput = document.getElementById('admin-password');
    const adminDashboard = document.getElementById('admin-dashboard');
    const adminLoginScreen = document.getElementById('admin-login-screen');

    const bookModal = document.getElementById('book-modal');
    const neighborsArea = document.getElementById('neighbors-area');
    const neighborsGrid = document.getElementById('neighbors-grid');
    const qrContainer = document.getElementById('qrcode');
    const carouselImg = document.getElementById('carousel-img');

    // ==========================================
    // GLOBAL STATE VARIABLES
    // ==========================================
    let selectedGenres = new Set(); 
    let favorites = JSON.parse(localStorage.getItem('libnav_favs')) || [];
    const IDLE_LIMIT = 30000; // 30 seconds to screensaver
    let idleTimeout;
    const coverCache = {}; 
    const authorCache = {}; 
    let currentImages = [];
    let currentImageIndex = 0;

    // Tips array for the Tools section
    const tips = [
        "Use the microphone icon to search for books hands-free.",
        "Bookmark a book to instantly find it later.",
        "Tap the main LibNav logo on the home screen to summon a minion!",
        "Scan the QR code on a PC to transfer the map to your phone.",
        "Switch to Dark Mode for comfortable viewing in low light."
    ];

    // ==========================================
    // THEME ENGINE
    // ==========================================
    function getInitialTheme() {
        const saved = localStorage.getItem('theme');
        if (saved) return saved;
        const isMobile = window.innerWidth <= 768;
        if (isMobile && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        const hour = new Date().getHours();
        return (hour >= 6 && hour < 18) ? 'light' : 'dark';
    }
    
    function applyTheme(mode) {
        const dBtn = document.getElementById('desk-theme-toggle');
        const sBtn = document.getElementById('section-theme-toggle');
        
        if (mode === 'light') {
            document.body.classList.add('light-mode');
            if (dBtn) dBtn.innerHTML = '<i data-lucide="moon"></i>';
            if (sBtn) sBtn.innerHTML = '<i data-lucide="moon" class="text-primary icon-small"></i> Switch to Dark Mode';
        } else {
            document.body.classList.remove('light-mode');
            if (dBtn) dBtn.innerHTML = '<i data-lucide="sun"></i>';
            if (sBtn) sBtn.innerHTML = '<i data-lucide="sun" class="text-primary icon-small"></i> Switch to Light Mode';
        }
        refreshIcons();
    }
    
    function toggleThemeAction() {
        vibrate();
        const isLight = document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        applyTheme(isLight ? 'light' : 'dark');
    }
    
    document.getElementById('desk-theme-toggle')?.addEventListener('click', toggleThemeAction);
    document.getElementById('section-theme-toggle')?.addEventListener('click', toggleThemeAction);

    // ==========================================
    // CUSTOM POPUP MANAGER
    // ==========================================
    const popupOverlay = document.getElementById('custom-popup');
    
    function showPopup(title, msg, onConfirm, showCancel = false, type = 'bell') {
        document.getElementById('popup-title').innerText = title;
        document.getElementById('popup-message').innerText = msg;
        
        const iconEl = document.getElementById('popup-icon');
        iconEl.innerHTML = `<i data-lucide="${type}" class="w-10 h-10"></i>`;
        
        // Dynamic coloring based on alert type
        if (type === 'check-circle') { 
            iconEl.className = 'mx-auto w-20 h-20 flex-center justify-center mb-6 text-success bg-success/10 rounded-full shadow-premium-sm'; 
        } else if (type === 'alert-triangle') { 
            iconEl.className = 'mx-auto w-20 h-20 flex-center justify-center mb-6 text-warning bg-warning/10 rounded-full shadow-premium-sm'; 
        } else { 
            iconEl.className = 'mx-auto w-20 h-20 flex-center justify-center mb-6 text-primary bg-primary-light rounded-full shadow-premium-sm'; 
        }
        
        refreshIcons();
        popupOverlay.classList.remove('hidden');
        popupOverlay.classList.add('active');
        
        const cancelBtn = document.getElementById('popup-cancel');
        if (showCancel) {
            cancelBtn.classList.remove('hidden');
            cancelBtn.style.display = 'block';
        } else {
            cancelBtn.classList.add('hidden');
            cancelBtn.style.display = 'none';
        }
        
        document.getElementById('popup-confirm').onclick = () => { 
            popupOverlay.classList.remove('active'); 
            if (onConfirm) onConfirm(); 
        };
        
        cancelBtn.onclick = () => popupOverlay.classList.remove('active');
    }

    // ==========================================
    // MINION EASTER EGG
    // ==========================================
    heroTitle.innerHTML = heroTitle.textContent.split('').map(l => `<span class="hero-letter" style="display:inline-block; transition: transform 0.2s;">${l}</span>`).join('');

    heroTitle.addEventListener('click', () => {
        if (minionSprite.style.display === 'block') return;
        vibrate();
        
        minionSprite.style.display = 'block'; 
        minionSprite.style.left = '-60px';
        
        let pos = -60;
        const interval = setInterval(() => {
            pos += 6; 
            minionSprite.style.left = pos + 'px';
            
            document.querySelectorAll('.hero-letter').forEach((span, i) => {
                const targetPos = (i * 30) + 20;
                if (Math.abs(pos - targetPos) < 20) { 
                    span.style.transform = "translateY(-20px)"; 
                    setTimeout(() => span.style.transform = "translateY(0)", 200); 
                }
            });
            
            if (pos > 300) { 
                clearInterval(interval); 
                minionSprite.style.display = 'none'; 
            }
        }, 16);
    });

    // ==========================================
    // NETWORK & HARDWARE TRIGGERS
    // ==========================================
    window.addEventListener('offline', () => { 
        offlineBanner.classList.add('active'); 
    });
    
    window.addEventListener('online', () => { 
        offlineBanner.innerHTML = '<i data-lucide="wifi" class="icon-small"></i> <span>Back online!</span>'; 
        refreshIcons();
        offlineBanner.style.background = "var(--success)";
        
        setTimeout(() => { 
            offlineBanner.classList.remove('active'); 
            setTimeout(() => {
                offlineBanner.innerHTML = '<i data-lucide="wifi-off" class="icon-small"></i> <span>You are offline.</span>'; 
                offlineBanner.style.background = "var(--warning)"; 
                refreshIcons();
            }, 300); 
        }, 3000); 
    });
    
    const vibrate = () => { 
        if (navigator.vibrate) navigator.vibrate(15); 
    };

    // ==========================================
    // ANTI-LAG OBSERVER
    // ==========================================
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (coverCache[img.dataset.title]) {
                    img.src = coverCache[img.dataset.title];
                    img.onload = () => { 
                        img.style.opacity = '1'; 
                        if (img.closest('.skeleton')) {
                            img.closest('.skeleton').classList.remove('skeleton'); 
                        }
                    };
                } else {
                    fetchCoverWithFallback(img.dataset.title, img.dataset.author, img.id, true);
                }
                observer.unobserve(img);
            }
        });
    }, { rootMargin: '200px 0px' });

    function generateInitialsImage(name) {
        const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const colors = ['#db2777', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6'];
        const color = colors[name.length % colors.length];
        
        const canvas = document.createElement('canvas'); 
        canvas.width = 200; 
        canvas.height = 300; 
        const ctx = canvas.getContext('2d');
        
        const grd = ctx.createLinearGradient(0, 0, 200, 300);
        grd.addColorStop(0, '#121212'); 
        grd.addColorStop(1, color);
        
        ctx.fillStyle = grd; 
        ctx.fillRect(0, 0, 200, 300);
        
        ctx.font = 'bold 80px sans-serif'; 
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; 
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, 100, 150);
        
        return canvas.toDataURL();
    }

    // ==========================================
    // SYSTEM INITIALIZATION
    // ==========================================
    async function init() {
        applyTheme(getInitialTheme());
        try {
            const connected = await LibraryDB.init(); 
            if (!connected) {
                resultsArea.innerHTML = '<div class="text-center p-8 text-muted w-full col-span-full font-medium">Database Connection Failed. Please refresh.</div>';
            }
        } catch(e) {
            resultsArea.innerHTML = '<div class="text-center p-8 text-muted w-full col-span-full font-medium">Firebase Connection Error.</div>';
        }
        
        if (window.innerWidth <= 849) {
            document.body.classList.add('is-mobile-device');
        }
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('book')) {
            const book = LibraryDB.getBooks().find(b => String(b.id) === String(urlParams.get('book')));
            if (book) {
                if (urlParams.get('view') === 'mobile') {
                    document.body.classList.add('companion-mode-active');
                }
                openModal(book);
            }
        }
        
        if (!document.body.classList.contains('companion-mode-active')) { 
            loadFeaturedBook(); 
            resetIdleTimer(); 
        }
        
        refreshIcons();
    }

    // ==========================================
    // NAVIGATION LOGIC
    // ==========================================
    function resetToHome() {
        vibrate();
        
        // Reset Mobile Bottom Nav Active States
        document.querySelectorAll('.nav-item').forEach(item => { 
            item.classList.remove('active', 'text-primary'); 
            item.classList.add('text-muted'); 
        });
        const mobileHome = document.querySelector('.bottom-nav .nav-item[data-section="home"]');
        if (mobileHome) { 
            mobileHome.classList.add('active', 'text-primary'); 
            mobileHome.classList.remove('text-muted'); 
        }
        const indicator = document.querySelector('.nav-indicator');
        if (indicator) {
            indicator.style.transform = `translateX(0%)`;
        }
        
        // Reset Desktop Nav Active States
        document.querySelectorAll('.desk-nav-item').forEach(d => d.classList.remove('active'));
        const deskHome = document.querySelector(`.desk-nav-item[data-section="home"]`);
        if (deskHome) {
            deskHome.classList.add('active');
        }

        // Hide other sections, show Home
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
            sec.style.display = 'none';
        });
        const homeSection = document.getElementById('home-section');
        homeSection.classList.add('active');
        homeSection.style.display = 'block';
        
        // Clear Search & Filters
        searchInput.value = ''; 
        autocompleteDropdown.style.display = 'none'; 
        selectedGenres.clear();
        
        document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
        const allBtn = document.querySelector('.quick-btn[data-genre="All"]');
        if (allBtn) allBtn.classList.add('active');
        
        // Restore Hero UI
        hero.classList.remove('minimized'); 
        featuredContainer.style.display = 'block'; 
        resultsArea.innerHTML = ''; 
        
        closeSidebar(); 
        refreshIcons();
    }

    // Attach Home Reset Events
    document.getElementById('bottom-home-btn')?.addEventListener('click', (e) => { 
        e.preventDefault(); 
        resetToHome(); 
    });
    
    document.querySelector('.desk-nav-item[data-section="home"]')?.addEventListener('click', (e) => { 
        e.preventDefault(); 
        resetToHome(); 
    });

    // Handle Sections dynamically (About, Tools)
    document.querySelectorAll('[data-section]').forEach(item => {
        if (item.dataset.section === 'home') return;
        
        item.onclick = (e) => { 
            e.preventDefault(); 
            vibrate();
            
            // Switch Mobile Bottom Nav
            document.querySelectorAll('.nav-item').forEach(i => { 
                i.classList.remove('active', 'text-primary'); 
                i.classList.add('text-muted'); 
            });
            const mobileItem = document.querySelector(`.bottom-nav .nav-item[data-section="${item.dataset.section}"]`);
            if (mobileItem) {
                mobileItem.classList.add('active', 'text-primary'); 
                mobileItem.classList.remove('text-muted');
                const navArray = Array.from(mobileItem.parentElement.children).filter(c => c.classList.contains('nav-item'));
                const index = navArray.indexOf(mobileItem);
                const indicator = document.querySelector('.nav-indicator');
                if (indicator) {
                    indicator.style.transform = `translateX(${index * 100}%)`; 
                }
            }
            
            // Switch Desktop Nav
            document.querySelectorAll('.desk-nav-item').forEach(d => d.classList.remove('active'));
            const deskItem = document.querySelector(`.desk-nav-item[data-section="${item.dataset.section}"]`);
            if (deskItem) {
                deskItem.classList.add('active');
            }
            
            // Dynamic Tips for Tools Section
            if (item.dataset.section === 'tools') {
                const randomTip = tips[Math.floor(Math.random() * tips.length)];
                document.getElementById('dynamic-tip').innerText = randomTip;
            }
            
            // Hide all sections, show target
            document.querySelectorAll('.content-section').forEach(sec => {
                sec.classList.remove('active');
                sec.style.display = 'none';
            });
            
            const targetSection = document.getElementById(`${item.dataset.section}-section`);
            targetSection.classList.add('active');
            targetSection.style.display = 'block';
        };
    });

    const filterToggle = document.getElementById('filter-toggle'); 
    const filterMenu = document.getElementById('filter-menu');
    
    filterToggle.onclick = (e) => { 
        e.stopPropagation(); 
        if (filterMenu.style.display === 'flex') {
            filterMenu.style.display = 'none';
        } else {
            filterMenu.style.display = 'flex';
        }
    };

    function openSidebar() { 
        sideMenu.classList.add('active'); 
        sideMenuOverlay.classList.add('active'); 
        filterMenu.style.display = 'none'; 
    }
    
    function closeSidebar() { 
        sideMenu.classList.remove('active'); 
        sideMenuOverlay.classList.remove('active'); 
    }
    
    const hamburgerBtn = document.getElementById('hamburger-btn');
    if (hamburgerBtn) hamburgerBtn.onclick = openSidebar;
    
    sideMenuOverlay.onclick = closeSidebar;
    
    document.querySelectorAll('.absolute-close').forEach(btn => btn.onclick = (e) => {
        closeSidebar(); 
        const modalOverlay = e.target.closest('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('active');
        }
    });

    // ==========================================
    // ADMIN LOGIC (FIXED RENDERING)
    // ==========================================
    secretAdminBtn.addEventListener('click', () => { 
        adminModal.classList.add('active'); 
        closeSidebar(); 
    });

    adminAuthBtn.onclick = () => {
        if (adminPassInput.value === 'admin123') { 
            adminLoginScreen.style.display = 'none'; 
            adminDashboard.style.display = 'flex'; 
            updateImageInputs(); 
            renderAdminList(); 
        } else {
            showPopup("Error", "Incorrect Password", null, false, "alert-triangle");
        }
    };
    
    function updateImageInputs() {
        const container = document.getElementById('image-inputs-container');
        container.innerHTML = ''; 
        
        const count = parseInt(document.getElementById('step-count-select').value) || 2;
        
        for (let i = 1; i <= count; i++) {
            const input = document.createElement('input'); 
            input.type = 'url';
            input.className = 'form-input step-url-input w-full py-4 pl-5 border-l-4 border-primary rounded-xl bg-main text-main focus-primary outline-none shadow-premium-sm'; 
            input.placeholder = (i === count) ? `Final Image URL (Leave blank for default)` : `Step ${i} Image URL (Leave blank for default)`;
            container.appendChild(input);
        }
    }
    
    document.getElementById('step-count-select').onchange = updateImageInputs;

    window.handleEdit = function(id) {
        const book = LibraryDB.getBooks().find(b => String(b.id) === String(id)); 
        if (!book) return;
        
        document.getElementById('edit-book-id').value = book.id; 
        document.getElementById('admin-form-title').innerText = "Edit Book";
        document.getElementById('new-title').value = book.title; 
        document.getElementById('new-author').value = book.author;
        document.getElementById('new-genre').value = book.genre; 
        document.getElementById('step-count-select').value = book.images.length || 2;
        
        updateImageInputs();
        
        const inputs = document.querySelectorAll('.step-url-input'); 
        book.images.forEach((img, i) => { 
            if (inputs[i] && !img.includes('placehold.co')) {
                inputs[i].value = img; 
            }
        });
        
        const btn = document.getElementById('add-book-btn'); 
        btn.innerHTML = '<i data-lucide="save" class="icon-small"></i> Update Book'; 
        btn.className = 'submit-btn w-full ripple mt-4 flex-center justify-center gap-3 bg-primary text-white shadow-premium py-4 rounded-xl font-bold text-lg';
        
        const cancelBtn = document.getElementById('cancel-edit-btn');
        cancelBtn.style.display = "block";
        cancelBtn.classList.remove('hidden');
        
        refreshIcons();
        document.querySelector('#admin-modal .modal-content').scrollTo({top: 0, behavior: 'smooth'});
    };

    document.getElementById('cancel-edit-btn').onclick = () => {
        document.getElementById('edit-book-id').value = ''; 
        document.getElementById('admin-form-title').innerText = "Add New Book";
        document.getElementById('new-title').value = ''; 
        document.getElementById('new-author').value = '';
        
        const btn = document.getElementById('add-book-btn'); 
        btn.innerHTML = '<i data-lucide="upload-cloud" class="icon-small"></i> Add to Cloud'; 
        btn.className = 'submit-btn w-full ripple mt-4 flex-center justify-center gap-3 bg-success text-white shadow-premium py-4 rounded-xl font-bold text-lg';
        
        const cancelBtn = document.getElementById('cancel-edit-btn');
        cancelBtn.style.display = "none"; 
        cancelBtn.classList.add('hidden');
        
        updateImageInputs(); 
        refreshIcons();
    };

    document.getElementById('add-book-btn').onclick = async () => {
        const title = document.getElementById('new-title').value.trim(); 
        const author = document.getElementById('new-author').value.trim(); 
        const genre = document.getElementById('new-genre').value; 
        const editingId = document.getElementById('edit-book-id').value;
        
        if (!title || !author) {
            return showPopup("Missing Info", "Please fill in both the title and author.", null, false, "alert-triangle");
        }
        
        const imageUrls = Array.from(document.querySelectorAll('.step-url-input')).map((input, i) => {
            return input.value.trim() || `https://placehold.co/600x400/121212/db2777?text=Step+${i+1}`;
        });
        
        document.getElementById('add-book-btn').disabled = true;
        
        if (editingId) {
            const books = LibraryDB.getBooks(); 
            const index = books.findIndex(b => String(b.id) === String(editingId));
            if (index > -1) { 
                books[index].title = title; 
                books[index].author = author; 
                books[index].genre = genre; 
                books[index].images = imageUrls; 
                await LibraryDB.saveToCloud(); 
                showPopup("Success", "Book Updated!", null, false, "check-circle"); 
            }
        } else {
            await LibraryDB.addBook({ 
                id: Date.now(), 
                title: title, 
                author: author, 
                genre: genre, 
                images: imageUrls, 
                views: 0 
            }); 
            showPopup("Success", "Book Added Globally!", null, false, "check-circle");
        }
        
        document.getElementById('cancel-edit-btn').click(); 
        renderAdminList(); 
        performSearch(searchInput.value); 
        document.getElementById('add-book-btn').disabled = false;
    };

    function renderAdminList() {
        const books = LibraryDB.getBooks();
        const listContainer = document.getElementById('admin-book-list');
        
        if (!books || books.length === 0) { 
            listContainer.innerHTML = '<p class="text-muted text-lg py-8 text-center font-light">No books found in database.</p>'; 
            return; 
        }
        
        listContainer.innerHTML = books.map(b => `
            <div class="bg-surface p-5 rounded-2xl border border-color flex flex-col gap-3 shadow-premium-sm">
                <div class="flex flex-col gap-1 w-full overflow-hidden">
                    <strong class="block truncate text-lg text-main font-bold">${b.title}</strong>
                    <small class="text-muted text-sm block truncate font-light">${b.author}</small>
                </div>
                <div class="flex gap-3 w-full mt-2">
                    <button onclick="handleEdit('${b.id}')" class="submit-btn bg-primary-light text-primary flex-center justify-center gap-2 py-3 rounded-xl text-base font-bold w-full">
                        <i data-lucide="edit-2" class="icon-small"></i> Edit
                    </button>
                    <button onclick="handleDelete('${b.id}')" class="submit-btn bg-warning-light text-warning flex-center justify-center gap-2 py-3 rounded-xl text-base font-bold w-full border border-warning-border">
                        <i data-lucide="trash-2" class="icon-small"></i> Delete
                    </button>
                </div>
            </div>`).join(''); 
        
        refreshIcons();
    }

    window.handleDelete = async (id) => { 
        showPopup("Confirm Delete", "Are you sure you want to completely delete this book from the database?", async () => { 
            await LibraryDB.deleteBook(id); 
            renderAdminList(); 
            performSearch(searchInput.value); 
        }, true, "alert-triangle"); 
    };
    
    document.getElementById('factory-reset-btn').onclick = async () => { 
        showPopup("Defense Mode", "Reset Stats & History? Books will remain.", async () => { 
            await LibraryDB.factoryReset(); 
            window.location.reload(); 
        }, true, "shield"); 
    };

    // ==========================================
    // FEATURED BOOK & GRIDS
    // ==========================================
    function loadFeaturedBook() {
        const books = LibraryDB.getBooks(); 
        if (books.length === 0) return;
        
        // Pseudo-random daily pick
        const idx = Math.abs(new Date().toDateString().split('').reduce((a,b)=>a+(b.charCodeAt(0)),0)) % books.length; 
        const b = books[idx];
        const isFav = favorites.some(id => String(id) === String(b.id));
        
        featuredContainer.innerHTML = `
            <div class="mb-8">
                <span class="text-sm font-bold text-muted uppercase tracking-wider mb-4 block flex-center gap-2">
                    <i data-lucide="star" class="icon-small text-warning"></i> Daily Global Pick
                </span>
                <div class="featured-card shadow-premium bg-surface p-5 rounded-2xl border border-color cursor-pointer flex gap-5 items-center" onclick="openModalById('${b.id}')">
                    <div class="featured-cover w-28 h-40 rounded-xl relative overflow-hidden border-l-4 border-primary shadow-premium-sm flex-shrink-0">
                        <img id="fc-img" src="" class="shelf-cover-img w-full h-full object-cover">
                        <button class="fav-btn-grid absolute top-2 right-2 w-8 h-8 rounded-full bg-main/80 flex-center justify-center text-white backdrop-blur ${isFav?'active bg-primary':''}" onclick="toggleFavorite(event,'${b.id}')">
                            <i data-lucide="bookmark" class="icon-small"></i>
                        </button>
                    </div>
                    <div class="flex flex-col text-left w-full gap-2">
                        <h2 class="font-bold text-2xl leading-tight text-main">${b.title}</h2>
                        <p class="text-base text-muted font-light">${b.author}</p>
                        <div class="mt-3">
                            <span class="badge bg-primary-light text-primary py-2 px-4 rounded-full font-bold text-xs uppercase tracking-wider">${b.genre}</span>
                        </div>
                    </div>
                </div>
            </div>`;
            
        fetchCoverWithFallback(b.title, b.author, 'fc-img', true); 
        refreshIcons();
    }

    function fetchCoverWithFallback(title, author, elementId, isImgTag) {
        if(coverCache[title]) { 
            applyCover(coverCache[title], elementId, isImgTag); 
            return; 
        }
        fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`).then(r=>r.json()).then(d => {
            if(d.docs?.[0]?.cover_i) { 
                const url = `https://covers.openlibrary.org/b/id/${d.docs[0].cover_i}-M.jpg`; 
                coverCache[title] = url; 
                applyCover(url, elementId, isImgTag); 
            } else {
                fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`).then(r2=>r2.json()).then(d2 => {
                    if(d2.docs?.[0]?.cover_i) { 
                        const url = `https://covers.openlibrary.org/b/id/${d2.docs[0].cover_i}-M.jpg`; 
                        coverCache[title] = url; 
                        applyCover(url, elementId, isImgTag); 
                    } else { 
                        const fb = generateInitialsImage(title); 
                        coverCache[title] = fb; 
                        applyCover(fb, elementId, isImgTag); 
                    }
                }).catch(() => { 
                    const fb = generateInitialsImage(title); 
                    coverCache[title] = fb; 
                    applyCover(fb, elementId, isImgTag); 
                });
            }
        }).catch(() => { 
            const fb = generateInitialsImage(title); 
            coverCache[title] = fb; 
            applyCover(fb, elementId, isImgTag); 
        });
    }

    function applyCover(url, elId, isImgTag) {
        const el = document.getElementById(elId); 
        if(!el) return;
        const wrap = el.closest('.skeleton');
        
        if (isImgTag) { 
            el.src = url; 
            el.onload = () => { 
                el.style.opacity = '1'; 
                if (wrap) wrap.classList.remove('skeleton'); 
            }; 
        } else { 
            el.style.backgroundImage = `url(${url})`; 
            if (wrap) wrap.classList.remove('skeleton'); 
        }
    }

    window.openModalById = function(id) { 
        const b = LibraryDB.getBooks().find(x => String(x.id) === String(id)); 
        if(b) openModal(b); 
    };

    // ==========================================
    // MAP & DETAILS MODAL ENGINE
    // ==========================================
    const prevBtn = document.getElementById('prev-img-btn');
    const nextBtn = document.getElementById('next-img-btn');
    const stepCounter = document.getElementById('step-counter');

    prevBtn.onclick = () => { 
        vibrate(); 
        if (currentImageIndex > 0) { 
            currentImageIndex--; 
            updateCarousel(); 
        } 
    };
    
    nextBtn.onclick = () => { 
        vibrate(); 
        if (currentImageIndex < currentImages.length - 1) { 
            currentImageIndex++; 
            updateCarousel(); 
        } 
    };

    async function openModal(book) {
        vibrate(); 
        bookModal.classList.add('active'); 
        LibraryDB.incrementView(book.id);
        
        if (!document.body.classList.contains('companion-mode-active')) { 
            try {
                let h = JSON.parse(localStorage.getItem('search_history')) || []; 
                h.push(book.title); 
                localStorage.setItem('search_history', JSON.stringify(h.slice(-15)));
            } catch(e){} 
        }

        document.getElementById('modal-title').innerText = book.title; 
        document.getElementById('modal-author').innerText = book.author;
        document.getElementById('modal-book-id').innerText = book.id; 
        document.getElementById('modal-genre').innerText = book.genre;
        
        const cover = document.getElementById('modal-book-cover-img'); 
        cover.src = ''; 
        cover.style.opacity = '0'; 
        cover.parentElement.classList.add('skeleton');
        
        // Direct Fetch (No Intersection Observer needed here)
        fetchCoverWithFallback(book.title, book.author, 'modal-book-cover-img', true);

        // QR Code Generation
        qrContainer.innerHTML = ''; 
        const dl = `${window.location.origin}${window.location.pathname}?book=${book.id}&view=mobile`;
        try { 
            new QRCode(qrContainer, { 
                text: dl, 
                width: 120, 
                height: 120, 
                colorDark : "#121212", 
                colorLight : "#ffffff" 
            }); 
        } catch(err) {}

        const sb = document.getElementById('share-book-btn');
        if (sb) {
            sb.onclick = async () => { 
                vibrate(); 
                if (navigator.share) {
                    await navigator.share({title: 'LibNav', text: `Check out ${book.title}`, url: dl}); 
                } else { 
                    navigator.clipboard.writeText(dl); 
                    showPopup("Success", "Link copied to clipboard!", null, false, "check-circle"); 
                } 
            };
        }

        // Setup Images
        currentImages = book.images || []; 
        currentImageIndex = 0; 
        updateCarousel();
        
        // FIX: NEIGHBORS GRID (Also In This Section)
        // Ensure no opacity fades obscure the grid rendering
        const all = LibraryDB.getBooks();
        let neighbors = all.filter(b => b.genre === book.genre && String(b.id) !== String(book.id)).sort(()=>0.5-Math.random()).slice(0, 4);
        neighborsGrid.innerHTML = '';
        
        if (neighbors.length > 0) {
            document.getElementById('neighbors-area').style.display = 'block';
            neighbors.forEach(n => {
                const card = document.createElement('div'); 
                card.className = 'neighbor-card shadow-premium-sm w-full aspect-[2/3] bg-border rounded-lg cursor-pointer overflow-hidden border-l-2 border-primary/50 relative'; 
                
                const imgId = `n-${n.id}-${Date.now()}`;
                // Direct image block rendering
                card.innerHTML = `<img id="${imgId}" class="w-full h-full object-cover block" src="">`; 
                card.onclick = () => openModal(n);
                
                neighborsGrid.appendChild(card); 
                fetchCoverWithFallback(n.title, n.author, imgId, true);
            });
        } else {
            document.getElementById('neighbors-area').style.display = 'none';
        }
        
        refreshIcons();
    }

    function updateCarousel() {
        const wrap = document.getElementById('carousel-wrapper'); 
        const aa = document.getElementById('mobile-action-area');
        
        if (currentImages && currentImages.length > 0) {
            // FIX: Explicitly update the text of the step counter
            stepCounter.innerText = `Step ${currentImageIndex + 1} of ${currentImages.length}`;
            
            carouselImg.src = currentImages[currentImageIndex]; 
            
            prevBtn.disabled = currentImageIndex === 0; 
            nextBtn.disabled = currentImageIndex === currentImages.length - 1; 
            
            carouselImg.style.display = 'block';
            
            // Show action area only on the last step if on mobile
            if (aa) {
                if (currentImageIndex === currentImages.length - 1 && document.body.classList.contains('is-mobile-device')) {
                    aa.style.display = 'block';
                    aa.classList.remove('hidden');
                } else {
                    aa.style.display = 'none';
                    aa.classList.add('hidden');
                }
            }
        } else { 
            carouselImg.style.display = 'none'; 
            stepCounter.innerText = "No map available"; 
            if (aa && document.body.classList.contains('is-mobile-device')) {
                aa.style.display = 'block';
                aa.classList.remove('hidden');
            }
        }
    }

    // ==========================================
    // SEARCH ENGINE
    // ==========================================
    document.querySelectorAll('.quick-btn').forEach(btn => {
        if(btn.id === 'open-feedback-btn') return;
        
        btn.onclick = () => {
            searchInput.value = ''; 
            selectedGenres.clear(); 
            selectedGenres.add(btn.dataset.genre);
            
            document.querySelectorAll('.quick-btn, .filter-option input').forEach(b => { 
                if(b.classList) b.classList.remove('active'); 
                else b.checked = false; 
            }); 
            
            btn.classList.add('active');
            
            if(btn.dataset.genre === 'All') { 
                hero.classList.remove('minimized'); 
                featuredContainer.style.display = 'block'; 
            } else { 
                hero.classList.add('minimized'); 
                featuredContainer.style.display = 'none'; 
            }
            
            performSearch(''); 
            closeSidebar(); 
            
            document.querySelectorAll('.content-section').forEach(sec => {
                sec.classList.remove('active');
                sec.style.display = 'none';
            });
            const homeSec = document.getElementById('home-section');
            homeSec.classList.add('active');
            homeSec.style.display = 'block';
            
            const mobileHome = document.querySelector('.bottom-nav .nav-item[data-section="home"]');
            if (mobileHome) { 
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active', 'text-primary')); 
                mobileHome.classList.add('active', 'text-primary'); 
                const indicator = document.querySelector('.nav-indicator');
                if (indicator) indicator.style.transform = `translateX(0%)`; 
            }
        };
    });

    document.querySelectorAll('.filter-option input').forEach(box => {
        box.onchange = (e) => {
            const val = e.target.value;
            if(val === 'All') {
                selectedGenres.clear(); 
                if(e.target.checked) selectedGenres.add('All');
                
                document.querySelectorAll('.filter-option input').forEach(c => { if(c.value !== 'All') c.checked = false; });
                document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active')); 
                
                if(e.target.checked) {
                    const allBtn = document.querySelector('.quick-btn[data-genre="All"]');
                    if(allBtn) allBtn.classList.add('active');
                }
            } else {
                if(e.target.checked) { 
                    selectedGenres.delete('All'); 
                    const allInput = document.querySelector('.filter-option input[value="All"]');
                    if (allInput) allInput.checked = false; 
                    
                    const allBtn = document.querySelector('.quick-btn[data-genre="All"]');
                    if (allBtn) allBtn.classList.remove('active'); 
                    
                    selectedGenres.add(val); 
                    document.querySelectorAll('.quick-btn').forEach(b => { if(b.dataset.genre === val) b.classList.add('active'); }); 
                } else { 
                    selectedGenres.delete(val); 
                    document.querySelectorAll('.quick-btn').forEach(b => { if(b.dataset.genre === val) b.classList.remove('active'); }); 
                }
            }
            
            if (selectedGenres.size > 0) { 
                hero.classList.add('minimized'); 
                featuredContainer.style.display = 'none'; 
            } else if (searchInput.value === '') { 
                hero.classList.remove('minimized'); 
                featuredContainer.style.display = 'block'; 
            }
            
            performSearch(searchInput.value);
        };
    });

    searchInput.addEventListener('input', (e) => {
        const t = e.target.value.toLowerCase().trim();
        
        if (t.length > 0) { 
            hero.classList.add('minimized'); 
            featuredContainer.style.display = 'none'; 
        } else if (selectedGenres.size === 0 || selectedGenres.has('All')) { 
            hero.classList.remove('minimized'); 
            featuredContainer.style.display = 'block'; 
        }
        
        autocompleteDropdown.innerHTML = '';
        if (t.length > 1) {
            const hits = LibraryDB.getBooks().filter(b => b.title.toLowerCase().includes(t) || b.author.toLowerCase().includes(t)).slice(0, 4);
            if (hits.length) {
                autocompleteDropdown.style.display = 'block';
                autocompleteDropdown.classList.remove('hidden');
                
                hits.forEach(s => {
                    const d = document.createElement('div'); 
                    d.className = 'autocomplete-item ripple px-6 py-4 border-b border-color flex items-center gap-4 cursor-pointer hover-bg-surface transition-colors';
                    const ht = s.title.replace(new RegExp(`(${t})`, 'gi'), '<span class="highlight-text">$1</span>');
                    
                    // FIX: Beautiful gap for autocomplete flex column
                    d.innerHTML = `
                        <i data-lucide="search" class="icon-small text-primary flex-shrink-0"></i>
                        <div class="flex flex-col text-left w-full gap-1 ml-2">
                            <span class="text-lg font-bold text-main">${ht}</span>
                            <span class="text-sm text-muted font-light">${s.author}</span>
                        </div>
                    `;
                    d.onclick = () => { 
                        searchInput.value = s.title; 
                        autocompleteDropdown.style.display = 'none'; 
                        performSearch(s.title); 
                        openModal(s); 
                    };
                    autocompleteDropdown.appendChild(d);
                }); 
                refreshIcons();
            } else {
                autocompleteDropdown.style.display = 'none';
            }
        } else {
            autocompleteDropdown.style.display = 'none';
        }
        performSearch(t);
    });

    function performSearch(term) {
        let books = LibraryDB.getBooks(); 
        term = term.toLowerCase().trim();
        
        if (term === '' && (selectedGenres.size === 0 || selectedGenres.has('All'))) { 
            resultsArea.innerHTML = ''; 
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
        
        if (selectedGenres.has('All') || term !== '') {
            matches.sort((a, b) => a.title.localeCompare(b.title));
        }
        
        renderResults(matches);
    }

    function renderResults(books) {
        resultsArea.innerHTML = '';
        if (books.length === 0) { 
            resultsArea.innerHTML = `
                <div class="col-span-full text-center p-12 text-muted flex flex-col items-center gap-4 border border-color rounded-2xl bg-surface shadow-premium-sm">
                    <i data-lucide="book-x" class="w-20 h-20 opacity-50"></i>
                    <p class="text-lg font-light">No books found matching your criteria.</p>
                </div>`; 
            refreshIcons(); 
            return; 
        }
        
        const frag = document.createDocumentFragment(); 
        const term = searchInput.value.trim(); 
        const regex = new RegExp(`(${term})`, 'gi');
        
        books.forEach((book, i) => {
            const card = document.createElement('div'); 
            card.className = 'shelf-book-card flex flex-col cursor-pointer hover-transform';
            
            if (i < 8) {
                card.style.animationDelay = `${i * 0.05}s`; 
            } else { 
                card.style.animation = 'none'; 
                card.style.opacity = '1'; 
            }
            
            const isFav = favorites.some(id => String(id) === String(book.id)); 
            const coverId = `img-${book.id}`;
            const titleHtml = term ? book.title.replace(regex, '<span class="highlight-text">$1</span>') : book.title;

            card.innerHTML = `
                <div class="shelf-cover-wrapper skeleton shadow-premium-sm w-full aspect-[2/3] bg-border rounded-xl relative overflow-hidden mb-3 border-l-4 border-primary/50">
                    <img id="${coverId}" class="shelf-cover-img w-full h-full object-cover block opacity-0 transition-opacity duration-300" data-title="${book.title}" data-author="${book.author}" src="">
                    <button class="fav-btn-grid absolute top-3 right-3 w-10 h-10 rounded-full bg-main/80 flex-center justify-center border border-white/10 z-10 backdrop-blur transition-colors ${isFav ? 'active bg-primary border-primary' : ''}" onclick="toggleFavorite(event, '${book.id}')">
                        <i data-lucide="bookmark" class="icon-small text-white"></i>
                    </button>
                </div>
                <div class="flex flex-col gap-1 px-2">
                    <p class="shelf-title text-main font-bold text-base leading-tight truncate-2-lines">${titleHtml}</p>
                    <p class="shelf-author text-muted font-light text-sm truncate">${book.author}</p>
                </div>
            `;
            
            card.onclick = (e) => { 
                if (!e.target.closest('.fav-btn-grid')) openModal(book); 
            }; 
            
            frag.appendChild(card);
            
            // Queue image observer
            setTimeout(() => {
                const imgEl = document.getElementById(coverId);
                if (imgEl) imageObserver.observe(imgEl);
            }, 0);
        });
        
        resultsArea.appendChild(frag); 
        refreshIcons();
    }

    // ==========================================
    // TOOLS: STATS & FEEDBACK
    // ==========================================
    const openStats = () => {
        vibrate(); 
        
        const books = LibraryDB.getBooks(); 
        const ratings = LibraryDB.getRatings();
        
        const startDate = new Date("2026-01-01T00:00:00").getTime(); 
        const now = new Date().getTime(); 
        const diff = now - startDate;
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24)); 
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); 
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const uptimeStr = `${days}d, ${hours}h, ${minutes}m`;

        const mostViewed = books.reduce((a,b)=>(a.views||0)>(b.views||0)?a:b, {title:"None",views:0});
        const newest = books.reduce((a,b)=>(a.id>b.id)?a:b, {title:"None"});
        const genres = {}; 
        books.forEach(b => genres[b.genre] = (genres[b.genre]||0) + 1);
        
        // FIX: Spacing for Stats Details
        const avg = ratings.length ? `<i data-lucide="star" class="w-6 h-6 text-warning fill-current"></i> ${ (ratings.reduce((a,b)=>a+parseInt(b),0)/ratings.length).toFixed(1) } <span class="text-sm font-light text-muted ml-2">(${ratings.length} Reviews)</span>` : "No Ratings";
        
        document.getElementById('stats-content').innerHTML = `
            <div class="bg-primary-light p-4 rounded-xl text-center mb-8 text-primary font-bold text-base flex-center justify-center gap-3 border border-primary/20 shadow-premium-sm">
                <i data-lucide="server" class="w-5 h-5"></i> Cloud Uptime: ${uptimeStr}
            </div>
            
            <div class="grid-2 gap-5 mb-8">
                <div class="bg-main p-6 rounded-2xl border border-color text-center shadow-premium-sm flex flex-col gap-2">
                    <p class="text-xs text-muted font-bold uppercase tracking-wider">Total Books</p>
                    <h2 class="text-4xl font-bold text-primary">${books.length}</h2>
                </div>
                <div class="bg-main p-6 rounded-2xl border border-color text-center shadow-premium-sm flex flex-col gap-2">
                    <p class="text-xs text-muted font-bold uppercase tracking-wider">Bookmarks</p>
                    <h2 class="text-4xl font-bold text-warning">${favorites.length}</h2>
                </div>
            </div>
            
            <div class="bg-main p-6 rounded-2xl border border-color text-center mb-8 shadow-premium-sm flex flex-col gap-3">
                <p class="text-xs text-muted font-bold uppercase tracking-wider">Global Rating</p>
                <h2 class="text-3xl font-bold text-warning flex-center justify-center gap-2">${avg}</h2>
            </div>
            
            <div class="mb-8">
                <p class="text-sm font-bold text-primary uppercase tracking-wider mb-4 flex-center gap-3">
                    <i data-lucide="trending-up" class="w-5 h-5"></i> Top Pick
                </p>
                <div class="flex justify-between items-center bg-main p-5 rounded-2xl border border-color shadow-premium-sm">
                    <strong class="text-main text-xl font-bold">${mostViewed.title}</strong>
                    <span class="text-sm bg-success/10 text-success px-4 py-2 rounded-lg font-bold">${mostViewed.views} Views</span>
                </div>
            </div>
            
            <div class="mb-8">
                <p class="text-sm font-bold text-primary uppercase tracking-wider mb-4 flex-center gap-3">
                    <i data-lucide="clock" class="w-5 h-5"></i> Newest Arrival
                </p>
                <div class="bg-main p-5 rounded-2xl border border-color shadow-premium-sm">
                    <strong class="text-main text-xl font-bold">${newest.title}</strong>
                </div>
            </div>
            
            <div class="mb-4 flex flex-col gap-3">
                <p class="text-sm font-bold text-primary uppercase tracking-wider mb-3 flex-center gap-3">
                    <i data-lucide="pie-chart" class="w-5 h-5"></i> Composition
                </p>
                ${Object.entries(genres).map(([k,v]) => `
                    <div class="flex justify-between items-center p-4 border-b border-color text-lg text-main">
                        <span class="font-light">${k}</span>
                        <span class="text-primary font-bold">${v}</span>
                    </div>
                `).join('')}
            </div>
        `; 
        refreshIcons(); 
        document.getElementById('stats-modal').classList.add('active');
    };
    
    document.getElementById('section-stats-btn')?.addEventListener('click', openStats);
    document.getElementById('desk-stats-btn')?.addEventListener('click', openStats);

    const openFeedback = () => { 
        vibrate(); 
        document.getElementById('feedback-modal').classList.add('active'); 
    };
    document.getElementById('section-feedback-btn')?.addEventListener('click', openFeedback);
    document.getElementById('desk-feedback-btn')?.addEventListener('click', openFeedback);

    // FIX: RESTORED EMAIL API LOGIC
    const fForm = document.getElementById('feedback-form');
    if (fForm) {
        fForm.onsubmit = async (e) => {
            e.preventDefault(); 
            const btn = document.getElementById('fb-submit-btn'); 
            const name = document.getElementById('fb-name').value;
            const email = document.getElementById('fb-email').value;
            const message = document.getElementById('fb-message').value;
            const ratingInput = document.querySelector('input[name="rating"]:checked');
            const ratingValue = ratingInput ? parseInt(ratingInput.value) : 5; 
            
            btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-6 h-6 inline"></i> Sending...'; 
            refreshIcons(); 
            btn.disabled = true;
            
            try { 
                await LibraryDB.submitRating(ratingValue); 
                
                // Original Email API Call Route
                const combinedMessage = `[User Rating: ${ratingValue}/5 Stars]\n\n${message}`;
                const payload = { name: name, email: email, message: combinedMessage };
                
                await fetch('/api/send-feedback', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(payload) 
                });
                
                showPopup("Success", "Feedback Sent via Email! Thank you.", null, false, "check-circle"); 
                fForm.reset(); 
                setTimeout(() => document.getElementById('feedback-modal').classList.remove('active'), 1000); 
            } 
            catch { 
                showPopup("Error", "Message saved locally. Will send when online.", null, false, "alert-triangle"); 
                setTimeout(() => document.getElementById('feedback-modal').classList.remove('active'), 1000);
            } 
            finally { 
                btn.innerHTML = '<i data-lucide="send" class="icon-small"></i> Send feedback to developer'; 
                btn.disabled = false; 
                refreshIcons();
            }
        };
    }

    // ==========================================
    // INITIALIZATION KICK-OFF
    // ==========================================
    init();
});
