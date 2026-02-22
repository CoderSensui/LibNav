/* app.js - Fully Expanded, Bulletproof Javascript Engine */

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // SYSTEM ICONS LOADER (DELAYED FOR SAFETY)
    // ==========================================
    function refreshIcons() {
        setTimeout(() => {
            try { 
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons(); 
                }
            } catch (err) { 
                console.error("Lucide Icon Render Error: ", err); 
            }
        }, 50);
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
    const micBtn = document.getElementById('mic-btn');
    const screensaver = document.getElementById('screensaver');
    
    const adminModal = document.getElementById('admin-modal');
    const adminAuthBtn = document.getElementById('admin-auth-btn');
    const adminPassInput = document.getElementById('admin-password');
    const adminDashboard = document.getElementById('admin-dashboard');
    const adminLoginScreen = document.getElementById('admin-login-screen');

    const bookModal = document.getElementById('book-modal');
    const neighborsGrid = document.getElementById('neighbors-grid');
    const qrContainer = document.getElementById('qrcode');
    const carouselImg = document.getElementById('carousel-img');
    const stepCounter = document.getElementById('step-counter');

    // ==========================================
    // GLOBAL STATE VARIABLES
    // ==========================================
    let selectedGenres = new Set(); 
    let favorites = JSON.parse(localStorage.getItem('libnav_favs')) || [];
    const IDLE_LIMIT = 30000; 
    let idleTimeout;
    const coverCache = {}; 
    const authorCache = {}; 
    let currentImages = [];
    let currentImageIndex = 0;
    let currentGenre = ""; 

    // Dynamic Tips Array
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
            if (sBtn) sBtn.innerHTML = '<i data-lucide="moon" class="text-primary w-7 h-7"></i> <span>Switch to Dark Mode</span>';
        } else {
            document.body.classList.remove('light-mode');
            if (dBtn) dBtn.innerHTML = '<i data-lucide="sun"></i>';
            if (sBtn) sBtn.innerHTML = '<i data-lucide="sun" class="text-primary w-7 h-7"></i> <span>Switch to Light Mode</span>';
        }
        refreshIcons();
    }
    
    function toggleThemeAction() {
        vibrate();
        const isLight = document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        applyTheme(isLight ? 'light' : 'dark');
    }
    
    const deskThemeToggle = document.getElementById('desk-theme-toggle');
    if (deskThemeToggle) deskThemeToggle.addEventListener('click', toggleThemeAction);
    
    const sectionThemeToggle = document.getElementById('section-theme-toggle');
    if (sectionThemeToggle) sectionThemeToggle.addEventListener('click', toggleThemeAction);

    // ==========================================
    // CUSTOM POPUP ALERTS
    // ==========================================
    const popupOverlay = document.getElementById('custom-popup');
    
    function showPopup(title, msg, onConfirm, showCancel = false, type = 'bell') {
        document.getElementById('popup-title').innerText = title;
        document.getElementById('popup-message').innerText = msg;
        
        const iconEl = document.getElementById('popup-icon');
        iconEl.innerHTML = `<i data-lucide="${type}" class="w-12 h-12"></i>`;
        
        if (type === 'check-circle') { 
            iconEl.className = 'mx-auto w-24 h-24 flex-center justify-center mb-6 text-success bg-success/10 rounded-full shadow-inner'; 
        } else if (type === 'alert-triangle') { 
            iconEl.className = 'mx-auto w-24 h-24 flex-center justify-center mb-6 text-warning bg-warning/10 rounded-full shadow-inner'; 
        } else { 
            iconEl.className = 'mx-auto w-24 h-24 flex-center justify-center mb-6 text-primary bg-primary-light rounded-full shadow-inner'; 
        }
        
        refreshIcons();
        popupOverlay.classList.remove('hidden');
        popupOverlay.style.display = 'flex';
        
        const cancelBtn = document.getElementById('popup-cancel');
        if (showCancel) {
            cancelBtn.classList.remove('hidden');
            cancelBtn.style.display = 'block';
        } else {
            cancelBtn.classList.add('hidden');
            cancelBtn.style.display = 'none';
        }
        
        document.getElementById('popup-confirm').onclick = () => { 
            popupOverlay.classList.add('hidden');
            popupOverlay.style.display = 'none'; 
            if (onConfirm) onConfirm(); 
        };
        
        cancelBtn.onclick = () => {
            popupOverlay.classList.add('hidden');
            popupOverlay.style.display = 'none';
        };
    }

    // ==========================================
    // MINION EASTER EGG
    // ==========================================
    const heroTitleElement = document.getElementById('hero-title');
    if (heroTitleElement) {
        heroTitleElement.innerHTML = heroTitleElement.textContent.split('').map(l => `<span class="hero-letter" style="display:inline-block; transition: transform 0.2s;">${l}</span>`).join('');

        heroTitleElement.addEventListener('click', () => {
            const minionSprite = document.getElementById('minion-sprite');
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
    }

    // ==========================================
    // NETWORK STATE MONITORING
    // ==========================================
    window.addEventListener('offline', () => { 
        offlineBanner.classList.remove('hidden');
        offlineBanner.style.display = 'flex'; 
    });
    
    window.addEventListener('online', () => { 
        offlineBanner.innerHTML = '<i data-lucide="wifi" class="icon-small"></i> <span>Back online!</span>'; 
        refreshIcons();
        offlineBanner.style.background = "var(--success)";
        
        setTimeout(() => { 
            offlineBanner.classList.add('hidden');
            offlineBanner.style.display = 'none'; 
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
    // IMAGE OBSERVER & FALLBACKS
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
        if (!name) name = "Book";
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
    // INITIALIZATION & DATABASE MOUNTING
    // ==========================================
    async function init() {
        applyTheme(getInitialTheme());
        try {
            const connected = await LibraryDB.init(); 
            if (!connected) {
                resultsArea.innerHTML = '<div class="text-center p-12 text-muted w-full col-span-full font-medium text-lg">Database Connection Failed. Please refresh.</div>';
            }
        } catch(e) {
            resultsArea.innerHTML = '<div class="text-center p-12 text-muted w-full col-span-full font-medium text-lg">Firebase Connection Error. Check Network.</div>';
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
    // SIDEBAR & CATEGORY LOGIC (STRICT EVENT BINDING)
    // ==========================================
    function openSidebar() { 
        sideMenu.classList.add('active'); 
        sideMenuOverlay.classList.remove('hidden');
        sideMenuOverlay.style.display = 'block'; 
        document.getElementById('filter-menu').classList.add('hidden');
        document.getElementById('filter-menu').style.display = 'none';
    }
    
    function closeSidebar() { 
        sideMenu.classList.remove('active'); 
        sideMenuOverlay.classList.add('hidden');
        sideMenuOverlay.style.display = 'none'; 
    }
    
    const hamburgerBtnLocal = document.getElementById('hamburger-btn');
    if (hamburgerBtnLocal) hamburgerBtnLocal.onclick = openSidebar;
    
    sideMenuOverlay.onclick = closeSidebar;
    
    document.querySelectorAll('.absolute-close').forEach(btn => {
        btn.onclick = (e) => {
            closeSidebar(); 
            const modalOverlay = e.target.closest('.modal-overlay');
            if (modalOverlay) {
                modalOverlay.classList.add('hidden');
                modalOverlay.style.display = 'none';
            }
        }
    });

    // FIX: Attach Event Listeners to ALL Sidebar Buttons Specifically
    const sidebarButtons = document.querySelectorAll('.menu-item');
    sidebarButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            vibrate();
            
            const targetGenre = btn.getAttribute('data-genre');
            searchInput.value = ''; 
            selectedGenres.clear(); 
            
            // Remove active from all sidebar items and uncheck filter boxes
            sidebarButtons.forEach(b => b.classList.remove('active')); 
            document.querySelectorAll('.filter-option input').forEach(box => box.checked = false);
            
            // Add active to the clicked item
            btn.classList.add('active');
            
            if (targetGenre === 'All') { 
                // Show Hero and Featured Pick for "All"
                hero.style.height = 'auto'; 
                hero.style.opacity = '1'; 
                hero.style.margin = '0 0 30px 0'; 
                hero.style.overflow = 'visible';
                featuredContainer.style.display = 'block'; 
            } else { 
                // Hide Hero and Add Genre to Set for Specific Searches
                selectedGenres.add(targetGenre);
                hero.style.height = '0'; 
                hero.style.opacity = '0'; 
                hero.style.margin = '0'; 
                hero.style.overflow = 'hidden';
                featuredContainer.style.display = 'none'; 
            }
            
            performSearch(''); 
            closeSidebar(); 
            switchSection('home');
        });
    });

    // ==========================================
    // TOP NAVIGATION LOGIC
    // ==========================================
    function switchSection(sectionId) {
        // Switch Mobile Bottom Nav
        document.querySelectorAll('.nav-item').forEach(i => { 
            i.classList.remove('active', 'text-primary'); 
            i.classList.add('text-muted'); 
        });
        const mobileTab = document.querySelector(`.bottom-nav .nav-item[data-section="${sectionId}"]`);
        if (mobileTab) {
            mobileTab.classList.add('active', 'text-primary'); 
            mobileTab.classList.remove('text-muted');
            const navArray = Array.from(mobileTab.parentElement.children).filter(c => c.classList.contains('nav-item'));
            const index = navArray.indexOf(mobileTab);
            const indicator = document.querySelector('.nav-indicator');
            if (indicator) {
                indicator.style.transform = `translateX(${index * 100}%)`; 
            }
        }
        
        // Switch Desktop Nav
        document.querySelectorAll('.desk-nav-item').forEach(d => d.classList.remove('active'));
        const deskTab = document.querySelector(`.desk-nav-item[data-section="${sectionId}"]`);
        if (deskTab) {
            deskTab.classList.add('active');
        }
        
        // Switch Sections
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
            sec.style.display = 'none';
        });
        
        const targetSection = document.getElementById(`${sectionId}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.style.display = 'block';
        }
        
        // Tool Tips Logic
        if (sectionId === 'tools') {
            const dynamicTip = document.getElementById('dynamic-tip');
            if (dynamicTip) {
                dynamicTip.innerText = tips[Math.floor(Math.random() * tips.length)];
            }
        }
        
        // Home Reset Logic
        if (sectionId === 'home') {
            searchInput.value = ''; 
            autocompleteDropdown.classList.add('hidden');
            autocompleteDropdown.style.display = 'none'; 
            selectedGenres.clear();
            
            document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
            const allBtn = document.querySelector('.menu-item[data-genre="All"]');
            if (allBtn) allBtn.classList.add('active');
            
            hero.style.height = 'auto'; 
            hero.style.opacity = '1'; 
            hero.style.margin = '0 0 30px 0';
            hero.style.overflow = 'visible';
            
            featuredContainer.style.display = 'block'; 
            resultsArea.innerHTML = ''; 
        }
        
        refreshIcons();
    }

    // Attach Top Nav Listeners
    document.querySelectorAll('[data-section]').forEach(item => {
        item.addEventListener('click', (e) => { 
            e.preventDefault(); 
            vibrate();
            switchSection(item.dataset.section); 
        });
    });

    // ==========================================
    // FILTER DROPDOWN & SEARCH LOGIC
    // ==========================================
    const filterToggle = document.getElementById('filter-toggle'); 
    const filterMenu = document.getElementById('filter-menu');
    
    if (filterToggle && filterMenu) {
        filterToggle.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            if (filterMenu.classList.contains('hidden')) {
                filterMenu.classList.remove('hidden');
                filterMenu.style.display = 'flex';
            } else {
                filterMenu.classList.add('hidden');
                filterMenu.style.display = 'none';
            }
        });
    }

    document.querySelectorAll('.filter-option input').forEach(box => {
        box.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'All') {
                selectedGenres.clear(); 
                if (e.target.checked) selectedGenres.add('All');
                
                document.querySelectorAll('.filter-option input').forEach(c => { 
                    if (c.value !== 'All') c.checked = false; 
                });
                
                document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active')); 
                const sidebarAll = document.querySelector('.menu-item[data-genre="All"]');
                if (e.target.checked && sidebarAll) {
                    sidebarAll.classList.add('active');
                }
            } else {
                if (e.target.checked) { 
                    selectedGenres.delete('All'); 
                    const allFilter = document.querySelector('.filter-option input[value="All"]');
                    if (allFilter) allFilter.checked = false; 
                    
                    const sidebarAll = document.querySelector('.menu-item[data-genre="All"]');
                    if (sidebarAll) sidebarAll.classList.remove('active'); 
                    
                    selectedGenres.add(val); 
                    
                    const sidebarTarget = document.querySelector(`.menu-item[data-genre="${val}"]`);
                    if (sidebarTarget) sidebarTarget.classList.add('active'); 
                } else { 
                    selectedGenres.delete(val); 
                    const sidebarTarget = document.querySelector(`.menu-item[data-genre="${val}"]`);
                    if (sidebarTarget) sidebarTarget.classList.remove('active'); 
                }
            }
            
            if (selectedGenres.size > 0 && !selectedGenres.has('All')) { 
                hero.style.height = '0'; 
                hero.style.opacity = '0'; 
                hero.style.margin = '0'; 
                hero.style.overflow = 'hidden';
                featuredContainer.style.display = 'none'; 
            } else if (searchInput.value === '') { 
                hero.style.height = 'auto'; 
                hero.style.opacity = '1'; 
                hero.style.margin = '0 0 30px 0'; 
                hero.style.overflow = 'visible';
                featuredContainer.style.display = 'block'; 
            }
            
            performSearch(searchInput.value);
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const t = e.target.value.toLowerCase().trim();
            
            if (t.length > 0) { 
                hero.style.height = '0'; 
                hero.style.opacity = '0'; 
                hero.style.margin = '0'; 
                hero.style.overflow = 'hidden';
                featuredContainer.style.display = 'none'; 
            } else if (selectedGenres.size === 0 || selectedGenres.has('All')) { 
                hero.style.height = 'auto'; 
                hero.style.opacity = '1'; 
                hero.style.margin = '0 0 30px 0'; 
                hero.style.overflow = 'visible';
                featuredContainer.style.display = 'block'; 
            }
            
            autocompleteDropdown.innerHTML = '';
            if (t.length > 1) {
                const hits = LibraryDB.getBooks().filter(b => b.title.toLowerCase().includes(t) || b.author.toLowerCase().includes(t)).slice(0, 4);
                if (hits.length) {
                    autocompleteDropdown.classList.remove('hidden');
                    autocompleteDropdown.style.display = 'block';
                    
                    hits.forEach(s => {
                        const d = document.createElement('div'); 
                        d.className = 'autocomplete-item ripple px-6 py-5 border-b border-color flex items-center gap-5 cursor-pointer hover-bg-surface transition-colors';
                        const ht = s.title.replace(new RegExp(`(${t})`, 'gi'), '<span class="text-primary font-bold">$1</span>');
                        
                        d.innerHTML = `
                            <i data-lucide="search" class="icon-small text-primary flex-shrink-0"></i>
                            <div class="flex flex-col text-left w-full gap-1 ml-2">
                                <span class="text-lg font-bold text-main">${ht}</span>
                                <span class="text-sm text-muted font-light">${s.author}</span>
                            </div>
                        `;
                        
                        d.onclick = () => { 
                            searchInput.value = s.title; 
                            autocompleteDropdown.classList.add('hidden');
                            autocompleteDropdown.style.display = 'none'; 
                            performSearch(s.title); 
                            openModal(s); 
                        };
                        autocompleteDropdown.appendChild(d);
                    }); 
                    refreshIcons();
                } else {
                    autocompleteDropdown.classList.add('hidden');
                    autocompleteDropdown.style.display = 'none';
                }
            } else {
                autocompleteDropdown.classList.add('hidden');
                autocompleteDropdown.style.display = 'none';
            }
            performSearch(t);
        });
    }

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
            // FIX: Fancy Empty State
            resultsArea.innerHTML = `
                <div class="flex flex-col items-center justify-center w-full col-span-full py-16 text-center bg-surface border border-color rounded-3xl shadow-premium-sm mt-4">
                    <i data-lucide="book-x" class="w-24 h-24 text-muted opacity-40 mb-6"></i>
                    <h2 class="hero-title text-4xl text-primary mb-3">No matching stories</h2>
                    <p class="text-muted text-xl font-light">Try searching a different title or author.</p>
                </div>
            `; 
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
            const titleHtml = term ? book.title.replace(regex, '<span class="text-primary font-bold">$1</span>') : book.title;

            card.innerHTML = `
                <div class="shelf-cover-wrapper skeleton shadow-premium-sm w-full aspect-[2/3] bg-border rounded-xl relative overflow-hidden mb-4 border-l-4 border-primary/40">
                    <img id="${coverId}" class="shelf-cover-img w-full h-full object-cover block opacity-0 transition-opacity duration-300" data-title="${book.title}" data-author="${book.author}" src="">
                    
                    <button class="fav-btn-grid absolute top-3 right-3 w-12 h-12 rounded-full bg-main/80 flex-center justify-center border border-white/10 z-10 backdrop-blur transition-colors ${isFav ? 'active' : ''}" data-book-id="${book.id}">
                        <i data-lucide="bookmark" class="icon-small text-white"></i>
                    </button>
                </div>
                <div class="flex flex-col gap-1 px-2">
                    <p class="shelf-title text-main font-bold text-lg leading-tight truncate-2-lines">${titleHtml}</p>
                    <p class="shelf-author text-muted font-light text-base truncate">${book.author}</p>
                </div>
            `;
            
            // Re-bind Click Events Safely
            card.addEventListener('click', (e) => {
                const favBtn = e.target.closest('.fav-btn-grid');
                if (favBtn) {
                    e.stopPropagation();
                    vibrate();
                    
                    // Instant Visual Toggle
                    favBtn.classList.toggle('active');
                    
                    const id = favBtn.getAttribute('data-book-id');
                    const index = favorites.findIndex(favId => String(favId) === String(id));
                    if (index === -1) {
                        favorites.push(String(id));
                    } else {
                        favorites.splice(index, 1);
                    }
                    localStorage.setItem('libnav_favs', JSON.stringify(favorites));
                    
                    // Note: We don't trigger a full re-render here to prevent the UI from jumping.
                } else {
                    openModal(book);
                }
            });
            
            frag.appendChild(card);
            
            setTimeout(() => {
                const imgEl = document.getElementById(coverId);
                if (imgEl) imageObserver.observe(imgEl);
            }, 0);
        });
        
        resultsArea.appendChild(frag); 
        refreshIcons();
    }

    // ==========================================
    // UTILITIES
    // ==========================================
    document.addEventListener('click', (e) => { 
        if (autocompleteDropdown && !e.target.closest('.search-wrapper')) {
            autocompleteDropdown.classList.add('hidden');
            autocompleteDropdown.style.display = 'none';
        }
        if (filterMenu && !e.target.closest('.search-wrapper') && !e.target.closest('#filter-toggle')) {
            filterMenu.classList.add('hidden');
            filterMenu.style.display = 'none';
        }
    });
    
    function resetIdleTimer() { 
        clearTimeout(idleTimeout); 
        if (screensaver) {
            screensaver.classList.add('hidden');
            screensaver.style.display = 'none'; 
        }
        
        idleTimeout = setTimeout(() => { 
            if (!document.body.classList.contains('companion-mode-active')) { 
                switchSection('home'); 
                document.querySelectorAll('.modal-overlay').forEach(m => {
                    m.classList.add('hidden');
                    m.style.display = 'none';
                }); 
                if (screensaver) {
                    screensaver.classList.remove('hidden');
                    screensaver.style.display = 'flex'; 
                }
            } 
        }, IDLE_LIMIT); 
    }
    
    window.addEventListener('load', resetIdleTimer); 
    document.addEventListener('mousemove', resetIdleTimer); 
    document.addEventListener('click', resetIdleTimer); 
    document.addEventListener('touchstart', resetIdleTimer);

    // ==========================================
    // ADMIN PANEL LOGIC (FIXED)
    // ==========================================
    if (secretAdminBtn) {
        secretAdminBtn.addEventListener('click', () => { 
            adminModal.classList.remove('hidden');
            adminModal.style.display = 'flex'; 
            closeSidebar(); 
        });
    }

    if (adminAuthBtn) {
        adminAuthBtn.onclick = () => {
            if (adminPassInput && adminPassInput.value === 'admin123') { 
                adminLoginScreen.style.display = 'none'; 
                adminDashboard.classList.remove('hidden');
                adminDashboard.style.display = 'flex'; 
                updateImageInputs(); 
                renderAdminList(); 
            } else {
                showPopup("Error", "Incorrect Password", null, false, "alert-triangle");
            }
        };
    }
    
    function updateImageInputs() {
        const container = document.getElementById('image-inputs-container');
        if (!container) return;
        
        container.innerHTML = ''; 
        
        const countSelect = document.getElementById('step-count-select');
        const count = countSelect ? parseInt(countSelect.value) : 2;
        
        for (let i = 1; i <= count; i++) {
            const input = document.createElement('input'); 
            input.type = 'url';
            input.className = 'form-input step-url-input w-full py-5 pl-6 border-l-4 border-primary rounded-xl bg-main text-main focus-primary outline-none shadow-premium-sm text-lg'; 
            input.placeholder = (i === count) ? `Final Image URL (Leave blank for default)` : `Step ${i} Image URL (Leave blank for default)`;
            container.appendChild(input);
        }
    }
    
    const stepCountSelect = document.getElementById('step-count-select');
    if (stepCountSelect) {
        stepCountSelect.addEventListener('change', updateImageInputs);
    }

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
        btn.innerHTML = '<i data-lucide="save" class="w-6 h-6"></i> Update Book'; 
        btn.className = 'submit-btn w-full ripple shadow-premium flex-center justify-center gap-3 bg-primary text-white py-5 rounded-xl font-bold text-xl';
        
        const cancelBtn = document.getElementById('cancel-edit-btn');
        cancelBtn.style.display = "block";
        cancelBtn.classList.remove('hidden');
        
        refreshIcons();
        document.querySelector('#admin-modal .modal-content').scrollTo({top: 0, behavior: 'smooth'});
    };

    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) {
        cancelEditBtn.onclick = () => {
            document.getElementById('edit-book-id').value = ''; 
            document.getElementById('admin-form-title').innerText = "Add New Book";
            document.getElementById('new-title').value = ''; 
            document.getElementById('new-author').value = '';
            
            const btn = document.getElementById('add-book-btn'); 
            btn.innerHTML = '<i data-lucide="upload-cloud" class="w-6 h-6"></i> Add to Cloud'; 
            btn.className = 'submit-btn w-full ripple shadow-premium flex-center justify-center gap-3 bg-success text-white py-5 rounded-xl font-bold text-xl';
            
            cancelEditBtn.style.display = "none"; 
            cancelEditBtn.classList.add('hidden');
            
            updateImageInputs(); 
            refreshIcons();
        };
    }

    const addBookBtn = document.getElementById('add-book-btn');
    if (addBookBtn) {
        addBookBtn.onclick = async () => {
            const title = document.getElementById('new-title').value.trim(); 
            const author = document.getElementById('new-author').value.trim(); 
            const genre = document.getElementById('new-genre').value; 
            const editingId = document.getElementById('edit-book-id').value;
            
            if (!title || !author) {
                return showPopup("Missing Info", "Please fill in both the title and author.", null, false, "alert-triangle");
            }
            
            const imageUrls = Array.from(document.querySelectorAll('.step-url-input')).map((input, i) => {
                return input.value.trim() || `https://placehold.co/600x400/121212/db2777?text=${genre}+Step+${i+1}`;
            });
            
            addBookBtn.disabled = true;
            
            if (editingId) {
                const books = LibraryDB.getBooks(); 
                const index = books.findIndex(b => String(b.id) === String(editingId));
                if (index > -1) { 
                    books[index].title = title; 
                    books[index].author = author; 
                    books[index].genre = genre; 
                    books[index].images = imageUrls; 
                    await LibraryDB.saveToCloud(); 
                    showPopup("Success", "Book Updated in Database!", null, false, "check-circle"); 
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
                showPopup("Success", "New Book Added Globally!", null, false, "check-circle");
            }
            
            const cancelBtn = document.getElementById('cancel-edit-btn');
            if (cancelBtn) cancelBtn.click(); 
            
            renderAdminList(); 
            
            if(searchInput) performSearch(searchInput.value); 
            
            addBookBtn.disabled = false;
        };
    }

    // FIX: Admin Panel Button Text UI
    function renderAdminList() {
        const books = LibraryDB.getBooks();
        const listContainer = document.getElementById('admin-book-list');
        
        if (!books || books.length === 0) { 
            listContainer.innerHTML = '<p class="text-muted text-xl py-10 text-center font-light">No books found in database.</p>'; 
            return; 
        }
        
        listContainer.innerHTML = books.map(b => `
            <div class="bg-surface p-6 rounded-2xl border border-color flex flex-col gap-4 shadow-premium-sm">
                <div class="flex flex-col gap-2 w-full overflow-hidden">
                    <strong class="block truncate text-xl text-main font-bold">${b.title}</strong>
                    <small class="text-muted text-base block truncate font-light">${b.author}</small>
                </div>
                <div class="flex gap-4 w-full mt-2">
                    <button onclick="handleEdit('${b.id}')" class="submit-btn bg-primary-light text-primary flex-center justify-center gap-3 py-4 rounded-xl text-lg font-bold w-full ripple">
                        <i data-lucide="edit-2" class="w-5 h-5"></i> Edit
                    </button>
                    <button onclick="handleDelete('${b.id}')" class="submit-btn bg-warning-light text-warning flex-center justify-center gap-3 py-4 rounded-xl text-lg font-bold w-full border border-warning-border ripple">
                        <i data-lucide="trash-2" class="w-5 h-5"></i> Delete
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
    
    const factoryResetBtn = document.getElementById('factory-reset-btn');
    if (factoryResetBtn) {
        factoryResetBtn.onclick = async () => { 
            showPopup("Defense Mode", "Reset Stats & History? Books will remain.", async () => { 
                await LibraryDB.factoryReset(); 
                window.location.reload(); 
            }, true, "shield"); 
        };
    }

    // ==========================================
    // FEATURED BOOK & GRIDS
    // ==========================================
    function loadFeaturedBook() {
        const books = LibraryDB.getBooks(); 
        if (books.length === 0) return;
        
        const idx = Math.abs(new Date().toDateString().split('').reduce((a,b)=>a+(b.charCodeAt(0)),0)) % books.length; 
        const b = books[idx];
        const isFav = favorites.some(id => String(id) === String(b.id));
        
        if (featuredContainer) {
            featuredContainer.innerHTML = `
                <div class="mb-10">
                    <span class="text-sm font-bold text-muted uppercase tracking-widest mb-4 block flex-center gap-3">
                        <i data-lucide="star" class="w-5 h-5 text-warning"></i> Daily Global Pick
                    </span>
                    <div class="featured-card shadow-premium bg-surface p-6 rounded-3xl border border-color cursor-pointer flex gap-6 items-center hover-transform" onclick="openModalById('${b.id}')">
                        
                        <div class="featured-cover w-32 h-48 rounded-xl relative overflow-hidden border-l-4 border-primary shadow-premium flex-shrink-0 skeleton">
                            <img id="fc-img" src="" class="shelf-cover-img w-full h-full object-cover opacity-0 transition-opacity duration-300">
                            <button class="fav-btn-grid absolute top-3 right-3 w-10 h-10 rounded-full bg-main/80 flex-center justify-center border border-white/10 z-10 backdrop-blur transition-colors ${isFav ? 'active bg-primary border-primary' : ''}" data-book-id="${b.id}">
                                <i data-lucide="bookmark" class="icon-small text-white"></i>
                            </button>
                        </div>
                        
                        <div class="flex flex-col text-left w-full gap-2">
                            <h2 class="font-black text-3xl leading-tight text-main mb-1">${b.title}</h2>
                            <p class="text-lg text-muted font-light">${b.author}</p>
                            <div class="mt-4">
                                <span class="badge bg-primary-light text-primary py-2 px-5 rounded-full font-bold text-xs uppercase tracking-wider">${b.genre}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
                
            // Fix featured bookmark click
            const featuredFavBtn = featuredContainer.querySelector('.fav-btn-grid');
            if (featuredFavBtn) {
                featuredFavBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    vibrate();
                    featuredFavBtn.classList.toggle('active');
                    featuredFavBtn.classList.toggle('bg-primary');
                    featuredFavBtn.classList.toggle('border-primary');
                    
                    const index = favorites.findIndex(favId => String(favId) === String(b.id));
                    if (index === -1) {
                        favorites.push(String(b.id));
                    } else {
                        favorites.splice(index, 1);
                    }
                    localStorage.setItem('libnav_favs', JSON.stringify(favorites));
                });
            }
                
            fetchCoverWithFallback(b.title, b.author, 'fc-img', true); 
            refreshIcons();
        }
    }

    function fetchCoverWithFallback(title, author, elementId, isImgTag) {
        if (coverCache[title]) { 
            applyCover(coverCache[title], elementId, isImgTag); 
            return; 
        }
        
        fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`)
            .then(r => r.json())
            .then(d => {
                if (d.docs?.[0]?.cover_i) { 
                    const url = `https://covers.openlibrary.org/b/id/${d.docs[0].cover_i}-L.jpg`; 
                    coverCache[title] = url; 
                    applyCover(url, elementId, isImgTag); 
                } else {
                    // Fallback to title only
                    fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`)
                        .then(r2 => r2.json())
                        .then(d2 => {
                            if (d2.docs?.[0]?.cover_i) { 
                                const url = `https://covers.openlibrary.org/b/id/${d2.docs[0].cover_i}-L.jpg`; 
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

    // FIX: Fallback for Author Profile Picture
    function fetchAuthorPic(author) {
        const el = document.getElementById('modal-author-pic');
        if (!el) return;
        
        el.src = generateInitialsImage(author); // Default instantly
        
        if (authorCache[author]) {
            el.src = authorCache[author];
            if (el.closest('.skeleton')) el.closest('.skeleton').classList.remove('skeleton');
            return;
        }
        
        fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(author)}`)
            .then(r => r.json())
            .then(d => {
                if (d.docs?.[0]?.key) { 
                    const u = `https://covers.openlibrary.org/a/olid/${d.docs[0].key}-M.jpg`;
                    authorCache[author] = u;
                    el.src = u;
                }
            })
            .catch(() => {})
            .finally(() => {
                if (el.closest('.skeleton')) el.closest('.skeleton').classList.remove('skeleton');
            });
    }

    function applyCover(url, elId, isImgTag) {
        const el = document.getElementById(elId); 
        if (!el) return;
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

    if (prevBtn) {
        prevBtn.onclick = () => { 
            vibrate(); 
            if (currentImageIndex > 0) { 
                currentImageIndex--; 
                updateCarousel(); 
            } 
        };
    }
    
    if (nextBtn) {
        nextBtn.onclick = () => { 
            vibrate(); 
            if (currentImageIndex < currentImages.length - 1) { 
                currentImageIndex++; 
                updateCarousel(); 
            } 
        };
    }

    async function openModal(book) {
        vibrate(); 
        bookModal.classList.remove('hidden');
        bookModal.style.display = 'flex'; 
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
        
        // Fetch Main Cover
        const cover = document.getElementById('modal-book-cover-img'); 
        if (cover) {
            cover.src = ''; 
            cover.style.opacity = '0'; 
            if (cover.parentElement) cover.parentElement.classList.add('skeleton');
            fetchCoverWithFallback(book.title, book.author, 'modal-book-cover-img', true);
        }
        
        // Fetch Elegant Author Pic
        const authPic = document.getElementById('modal-author-pic');
        if (authPic) {
            authPic.src = ''; 
            if (authPic.parentElement) authPic.parentElement.classList.add('skeleton');
            fetchAuthorPic(book.author);
        }

        // Generate QR
        qrContainer.innerHTML = ''; 
        const dl = `${window.location.origin}${window.location.pathname}?book=${book.id}&view=mobile`;
        try { 
            new QRCode(qrContainer, { 
                text: dl, 
                width: 140, 
                height: 140, 
                colorDark : "#121212", 
                colorLight : "#ffffff" 
            }); 
        } catch(err) {}

        // Handle Share Actions
        const handleShare = async () => { 
            vibrate();
            if (navigator.share) {
                await navigator.share({title: 'LibNav', text: `Check out ${book.title}`, url: dl}); 
            } else { 
                navigator.clipboard.writeText(dl); 
                showPopup("Success", "Link copied to clipboard!", null, false, "check-circle"); 
            } 
        };
        
        const mobileShare = document.getElementById('mobile-share-btn');
        if (mobileShare) mobileShare.onclick = handleShare;
        
        const pcShare = document.getElementById('share-book-btn');
        if (pcShare) pcShare.onclick = handleShare;

        // Reset Carousel Data
        currentImages = book.images || []; 
        currentImageIndex = 0; 
        currentGenre = book.genre; 
        updateCarousel();
        
        // FIX: RENDER NEIGHBORS GRID (Direct Injection, No Opacity tricks)
        const all = LibraryDB.getBooks();
        let neighbors = all.filter(b => b.genre === book.genre && String(b.id) !== String(book.id)).sort(()=>0.5-Math.random()).slice(0, 4);
        
        if (neighborsGrid) {
            neighborsGrid.innerHTML = '';
            
            if (neighbors.length > 0) {
                document.getElementById('neighbors-area').style.display = 'block';
                
                neighbors.forEach(n => {
                    const card = document.createElement('div'); 
                    card.className = 'neighbor-card shadow-premium-sm w-full aspect-[2/3] bg-border rounded-xl cursor-pointer overflow-hidden border border-color relative hover-transform'; 
                    
                    const imgId = `n-${n.id}-${Date.now()}`;
                    // Direct rendering, no opacity CSS to break it
                    card.innerHTML = `<img id="${imgId}" class="w-full h-full object-cover block" src="">`; 
                    card.onclick = () => openModal(n);
                    
                    neighborsGrid.appendChild(card); 
                    fetchCoverWithFallback(n.title, n.author, imgId, true);
                });
            } else {
                document.getElementById('neighbors-area').style.display = 'none';
            }
        }
        
        refreshIcons();
    }

    function updateCarousel() {
        const wrap = document.getElementById('carousel-wrapper'); 
        const aa = document.getElementById('mobile-action-area');
        
        if (currentImages && currentImages.length > 0) {
            // FIX: DYNAMIC STEP TEXT
            if (stepCounter) {
                stepCounter.innerText = `${currentGenre} Step ${currentImageIndex + 1}`;
            }
            
            if (carouselImg) {
                carouselImg.src = currentImages[currentImageIndex]; 
                carouselImg.style.display = 'block';
            }
            
            if (prevBtn) {
                prevBtn.style.opacity = currentImageIndex === 0 ? "0.3" : "1";
                prevBtn.style.pointerEvents = currentImageIndex === 0 ? "none" : "auto";
            }
            if (nextBtn) {
                nextBtn.style.opacity = currentImageIndex === currentImages.length - 1 ? "0.3" : "1";
                nextBtn.style.pointerEvents = currentImageIndex === currentImages.length - 1 ? "none" : "auto";
            }
            
            if (aa) {
                if (currentImageIndex === currentImages.length - 1 && document.body.classList.contains('is-mobile-device')) {
                    aa.style.display = 'flex';
                    aa.classList.remove('hidden');
                } else {
                    aa.style.display = 'none';
                    aa.classList.add('hidden');
                }
            }
        } else { 
            if (carouselImg) carouselImg.style.display = 'none'; 
            if (stepCounter) stepCounter.innerText = "No map available"; 
            if (aa && document.body.classList.contains('is-mobile-device')) {
                aa.style.display = 'flex';
                aa.classList.remove('hidden');
            }
        }
    }

    // ==========================================
    // LIVE STATISTICS
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
        
        const avg = ratings.length ? `<i data-lucide="star" class="w-7 h-7 text-warning fill-current"></i> ${ (ratings.reduce((a,b)=>a+parseInt(b),0)/ratings.length).toFixed(1) } <span class="text-sm font-light text-muted ml-3">(${ratings.length} Reviews)</span>` : "No Ratings";
        
        document.getElementById('stats-content').innerHTML = `
            <div class="bg-primary-light p-5 rounded-2xl text-center mb-8 text-primary font-bold text-base flex-center justify-center gap-3 border border-primary/20 shadow-premium-sm">
                <i data-lucide="server" class="w-6 h-6"></i> Cloud Uptime: ${uptimeStr}
            </div>
            
            <div class="grid-2 gap-5 mb-8">
                <div class="bg-main p-6 rounded-2xl border border-color text-center shadow-premium-sm flex flex-col gap-2">
                    <p class="text-sm text-muted font-bold uppercase tracking-wider">Total Books</p>
                    <h2 class="text-5xl font-black text-primary">${books.length}</h2>
                </div>
                <div class="bg-main p-6 rounded-2xl border border-color text-center shadow-premium-sm flex flex-col gap-2">
                    <p class="text-sm text-muted font-bold uppercase tracking-wider">Bookmarks</p>
                    <h2 class="text-5xl font-black text-warning">${favorites.length}</h2>
                </div>
            </div>
            
            <div class="bg-main p-8 rounded-2xl border border-color text-center mb-8 shadow-premium-sm flex flex-col gap-4">
                <p class="text-sm text-muted font-bold uppercase tracking-wider">Global Rating</p>
                <h2 class="text-4xl font-black text-warning flex-center justify-center gap-2">${avg}</h2>
            </div>
            
            <div class="mb-8">
                <p class="text-sm font-bold text-primary uppercase tracking-widest mb-4 flex-center gap-3">
                    <i data-lucide="trending-up" class="w-5 h-5"></i> Top Pick
                </p>
                <div class="flex justify-between items-center bg-main p-6 rounded-2xl border border-color shadow-premium-sm">
                    <strong class="text-main text-xl font-bold">${mostViewed.title}</strong>
                    <span class="text-sm bg-success/10 text-success px-4 py-2 rounded-xl font-bold border border-success/20">${mostViewed.views} Views</span>
                </div>
            </div>
            
            <div class="mb-8">
                <p class="text-sm font-bold text-primary uppercase tracking-widest mb-4 flex-center gap-3">
                    <i data-lucide="clock" class="w-5 h-5"></i> Newest Arrival
                </p>
                <div class="bg-main p-6 rounded-2xl border border-color shadow-premium-sm">
                    <strong class="text-main text-xl font-bold">${newest.title}</strong>
                </div>
            </div>
            
            <div class="mb-4 flex flex-col gap-3">
                <p class="text-sm font-bold text-primary uppercase tracking-widest mb-4 flex-center gap-3">
                    <i data-lucide="pie-chart" class="w-5 h-5"></i> Composition
                </p>
                ${Object.entries(genres).map(([k,v]) => `
                    <div class="flex justify-between items-center p-5 border-b border-color text-lg text-main">
                        <span class="font-light">${k}</span>
                        <span class="text-primary font-black">${v}</span>
                    </div>
                `).join('')}
            </div>
        `; 
        refreshIcons(); 
        
        const statsModal = document.getElementById('stats-modal');
        if (statsModal) {
            statsModal.classList.remove('hidden');
            statsModal.style.display = 'flex';
        }
    };
    
    document.getElementById('section-stats-btn')?.addEventListener('click', openStats);
    document.getElementById('desk-stats-btn')?.addEventListener('click', openStats);

    // ==========================================
    // FEEDBACK ENGINE (RESTORED TO EMAIL API)
    // ==========================================
    const openFeedback = () => { 
        vibrate(); 
        const fbModal = document.getElementById('feedback-modal');
        if (fbModal) {
            fbModal.classList.remove('hidden');
            fbModal.style.display = 'flex'; 
        }
    };
    
    document.getElementById('section-feedback-btn')?.addEventListener('click', openFeedback);
    document.getElementById('desk-feedback-btn')?.addEventListener('click', openFeedback);

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
                
                // Original Email API Call Route Restored
                const combinedMessage = `[User Rating: ${ratingValue}/5 Stars]\n\n${message}`;
                const payload = { name: name, email: email, message: combinedMessage };
                
                await fetch('/api/send-feedback', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(payload) 
                });
                
                showPopup("Success", "Feedback Sent via Email! Thank you.", null, false, "check-circle"); 
                fForm.reset(); 
                
                const fbModal = document.getElementById('feedback-modal');
                setTimeout(() => {
                    if(fbModal) {
                        fbModal.classList.add('hidden');
                        fbModal.style.display = 'none';
                    }
                }, 1000); 
            } 
            catch { 
                showPopup("Error", "Message saved locally. Will send when online.", null, false, "alert-triangle"); 
                const fbModal = document.getElementById('feedback-modal');
                setTimeout(() => {
                    if(fbModal) {
                        fbModal.classList.add('hidden');
                        fbModal.style.display = 'none';
                    }
                }, 1000);
            } 
            finally { 
                btn.innerHTML = '<i data-lucide="send" class="w-6 h-6"></i> Send feedback to developer'; 
                btn.disabled = false; 
                refreshIcons();
            }
        };
    }

    // ==========================================
    // MICROPHONE SEARCH
    // ==========================================
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; 
        const recognition = new SpeechRecognition(); 
        recognition.lang = 'en-US';
        
        micBtn.onclick = () => { 
            vibrate();
            if (micBtn.classList.contains('text-primary')) {
                recognition.stop(); 
            } else {
                recognition.start(); 
            }
        };
        
        recognition.onstart = () => { 
            micBtn.classList.add('text-primary'); 
            micBtn.style.background = 'var(--primary-light)';
            searchInput.placeholder = "Listening..."; 
        };
        
        recognition.onend = () => { 
            micBtn.classList.remove('text-primary'); 
            micBtn.style.background = 'var(--surface)';
            searchInput.placeholder = "Search title or author..."; 
        };
        
        recognition.onresult = (e) => { 
            searchInput.value = e.results[0][0].transcript; 
            searchInput.dispatchEvent(new Event('input')); 
        };
        
        recognition.onerror = (e) => { 
            console.log('Mic Error', e); 
            searchInput.placeholder = "Mic blocked/error."; 
            setTimeout(() => {
                searchInput.placeholder = "Search title or author...";
            }, 2000); 
        };
    } else {
        if(micBtn) micBtn.style.display = 'none';
    }

    window.showSuccessScreen = function() { 
        vibrate(); 
        document.getElementById('book-modal').style.display = 'none'; 
        const sm = document.getElementById('success-modal');
        if(sm) {
            sm.classList.remove('hidden');
            sm.style.display = 'flex'; 
        }
    }
    
    window.closeSuccessScreen = function() { 
        const sm = document.getElementById('success-modal');
        if(sm) {
            sm.classList.add('hidden');
            sm.style.display = 'none'; 
        }
        window.location.href = window.location.pathname; 
    }

    init();
});
