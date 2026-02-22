/* app.js - Fully Restored & Optimized Logic */

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

let selectedGenres = new Set(); 
let favorites = JSON.parse(localStorage.getItem('libnav_favs')) || [];
const IDLE_LIMIT = 30000;
let idleTimeout;
const coverCache = {}; 
const authorCache = {}; 
let currentImages = [];
let currentImageIndex = 0;

// --- INITIALIZE ICONS ---
function refreshIcons() {
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

// --- SMART THEME ENGINE ---
const themeBtn = document.getElementById('theme-toggle');
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
    if(mode === 'light') {
        document.body.classList.add('light-mode');
        themeBtn.innerHTML = '<i data-lucide="moon"></i>';
    } else {
        document.body.classList.remove('light-mode');
        themeBtn.innerHTML = '<i data-lucide="sun"></i>';
    }
    refreshIcons();
}
themeBtn.onclick = () => {
    vibrate();
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    applyTheme(isLight ? 'light' : 'dark');
};

// --- CUSTOM POPUP ---
const popupOverlay = document.getElementById('custom-popup');
function showPopup(title, msg, onConfirm, showCancel = false, type = 'bell') {
    document.getElementById('popup-title').innerText = title;
    document.getElementById('popup-message').innerText = msg;
    
    const iconEl = document.getElementById('popup-icon');
    iconEl.innerHTML = `<i data-lucide="${type}" class="w-8 h-8"></i>`;
    if(type === 'check-circle') { iconEl.className = 'mx-auto w-16 h-16 flex-center justify-center mb-4 text-success bg-success/10 rounded-full'; }
    else if(type === 'alert-triangle') { iconEl.className = 'mx-auto w-16 h-16 flex-center justify-center mb-4 text-warning bg-warning/10 rounded-full'; }
    else { iconEl.className = 'mx-auto w-16 h-16 flex-center justify-center mb-4 text-primary bg-primary-light rounded-full'; }
    
    refreshIcons();
    popupOverlay.classList.add('active');
    
    const cancelBtn = document.getElementById('popup-cancel');
    cancelBtn.style.display = showCancel ? 'block' : 'none';
    
    document.getElementById('popup-confirm').onclick = () => {
        popupOverlay.classList.remove('active');
        if(onConfirm) onConfirm();
    };
    cancelBtn.onclick = () => popupOverlay.classList.remove('active');
}

// --- MINION EASTER EGG (Middle Logo) ---
const heroTitle = document.getElementById('hero-title');
const minionSprite = document.getElementById('minion-sprite');
heroTitle.innerHTML = heroTitle.textContent.split('').map(l => `<span class="hero-letter" style="display:inline-block; transition: transform 0.2s;">${l}</span>`).join('');

heroTitle.addEventListener('click', () => {
    minionSprite.style.display = 'block'; minionSprite.style.left = '-60px';
    let pos = -60;
    const interval = setInterval(() => {
        pos += 5; minionSprite.style.left = pos + 'px';
        document.querySelectorAll('.hero-letter').forEach((span, i) => {
            if(Math.abs(pos - ((i*30)+20)) < 20) { span.style.transform = "translateY(-20px)"; setTimeout(() => span.style.transform = "translateY(0)", 200); }
        });
        if(pos > 300) { clearInterval(interval); minionSprite.style.display = 'none'; }
    }, 16);
});

// --- ADMIN PANEL TRIGGER ---
secretAdminBtn.addEventListener('click', () => { adminModal.classList.add('active'); closeSidebar(); });

// --- NETWORK BANNER ---
window.addEventListener('offline', () => { offlineBanner.classList.add('active'); });
window.addEventListener('online', () => { 
    offlineBanner.innerHTML = '<i data-lucide="wifi" class="w-4 h-4"></i> <span>Back online!</span>'; refreshIcons();
    offlineBanner.style.background = "var(--success)";
    setTimeout(() => { offlineBanner.classList.remove('active'); setTimeout(()=> {offlineBanner.innerHTML='<i data-lucide="wifi-off" class="w-4 h-4"></i> <span>You are offline.</span>'; offlineBanner.style.background="var(--warning)"; refreshIcons();}, 300); }, 3000); 
});
const vibrate = () => { if (navigator.vibrate) navigator.vibrate(10); };

// --- ANTI-LAG OBSERVER ---
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if(coverCache[img.dataset.title]) {
                img.src = coverCache[img.dataset.title];
                img.onload = () => { img.style.opacity = '1'; img.closest('.skeleton')?.classList.remove('skeleton'); };
            } else fetchCoverWithFallback(img.dataset.title, img.dataset.author, img.id, true);
            observer.unobserve(img);
        }
    });
}, { rootMargin: '200px 0px' });

function generateInitialsImage(name) {
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const colors = ['#db2777', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6'];
    const color = colors[name.length % colors.length];
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 300; 
    const ctx = canvas.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 200, 300);
    grd.addColorStop(0, '#1e293b'); grd.addColorStop(1, color);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 200, 300);
    ctx.font = 'bold 80px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials, 100, 150);
    return canvas.toDataURL();
}

async function init() {
    applyTheme(getInitialTheme());
    const connected = await LibraryDB.init(); 
    if (!connected) resultsArea.innerHTML = '<div class="text-center p-4 text-muted">Connection Error</div>';
    
    if (window.innerWidth <= 768) document.body.classList.add('is-mobile-device');
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('book')) {
        const book = LibraryDB.getBooks().find(b => String(b.id) === String(urlParams.get('book')));
        if (book) {
            if (urlParams.get('view') === 'mobile') document.body.classList.add('companion-mode-active');
            openModal(book);
        }
    }
    if (!document.body.classList.contains('companion-mode-active')) { loadFeaturedBook(); resetIdleTimer(); }
    refreshIcons();
}

// --- FULLY RESTORED HOME BUTTON LOGIC ---
function resetToHome() {
    vibrate();
    
    // Reset Tabs
    document.querySelectorAll('.nav-item').forEach(item => { item.classList.remove('active', 'text-primary'); item.classList.add('text-muted'); });
    const mobileHome = document.querySelector('.bottom-nav .nav-item[data-section="home"]');
    if(mobileHome) mobileHome.classList.add('active', 'text-primary');
    const indicator = document.querySelector('.nav-indicator');
    if(indicator) indicator.style.transform = `translateX(0%)`;
    
    document.querySelectorAll('.desk-nav-item').forEach(d => d.classList.remove('active'));
    const deskHome = document.querySelector(`.desk-nav-item[data-section="home"]`);
    if(deskHome) deskHome.classList.add('active');

    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById('home-section').classList.add('active');
    
    // Reset Search & Filters
    searchInput.value = '';
    autocompleteDropdown.style.display = 'none';
    selectedGenres.clear();
    document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.quick-btn[data-genre="All"]').classList.add('active');
    
    hero.classList.remove('minimized');
    featuredContainer.style.display = 'block';
    resultsArea.innerHTML = ''; 
    closeMenuBtn.click();
}

// Bind Home Button
document.getElementById('bottom-home-btn')?.addEventListener('click', (e) => { e.preventDefault(); resetToHome(); });
document.querySelector('.desk-nav-item[data-section="home"]')?.addEventListener('click', (e) => { e.preventDefault(); resetToHome(); });

// About Tab Binding
document.querySelectorAll('[data-section="about"]').forEach(item => {
    item.onclick = (e) => { 
        e.preventDefault(); vibrate();
        document.querySelectorAll('.nav-item').forEach(i => { i.classList.remove('active', 'text-primary'); i.classList.add('text-muted'); });
        document.querySelectorAll('.desk-nav-item').forEach(d => d.classList.remove('active'));
        item.classList.add('active', 'text-primary');
        const indicator = document.querySelector('.nav-indicator');
        if(indicator) indicator.style.transform = `translateX(200%)`; // About is index 2
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById('about-section').classList.add('active');
    };
});

document.getElementById('mobile-cat-btn').onclick = (e) => { e.preventDefault(); vibrate(); sideMenu.classList.add('active'); sideMenuOverlay.classList.add('active'); };
document.getElementById('desk-cat-btn').onclick = (e) => { e.preventDefault(); vibrate(); sideMenu.classList.add('active'); sideMenuOverlay.classList.add('active'); };
const hamburgerBtn = document.getElementById('hamburger-btn');
if(hamburgerBtn) hamburgerBtn.onclick = () => { sideMenu.classList.add('active'); sideMenuOverlay.classList.add('active'); };
closeMenuBtn.onclick = () => { sideMenu.classList.remove('active'); sideMenuOverlay.classList.remove('active'); };
sideMenuOverlay.onclick = closeMenuBtn.onclick;

// --- RESTORED ADMIN LOGIC ---
adminAuthBtn.onclick = () => {
    if(adminPassInput.value === 'admin123') { adminLoginScreen.style.display = 'none'; adminDashboard.style.display = 'block'; updateImageInputs(); renderAdminList(); } 
    else showPopup("Error", "Incorrect Password", null, false, "alert-triangle");
};
function updateImageInputs() {
    imageInputsContainer.innerHTML = ''; const count = parseInt(document.getElementById('step-count-select').value);
    for (let i=1; i<=count; i++) {
        const input = document.createElement('input'); input.className = 'form-input step-url-input border-l-4 border-primary'; input.placeholder = (i===count) ? `Final Image URL` : `Step ${i} URL`;
        imageInputsContainer.appendChild(input);
    }
}
document.getElementById('step-count-select').onchange = updateImageInputs;

window.handleEdit = function(id) {
    const book = LibraryDB.getBooks().find(b => String(b.id) === String(id)); if(!book) return;
    document.getElementById('edit-book-id').value = book.id; document.getElementById('admin-form-title').innerText = "Edit Book";
    document.getElementById('new-title').value = book.title; document.getElementById('new-author').value = book.author;
    document.getElementById('new-genre').value = book.genre; document.getElementById('step-count-select').value = book.images.length || 2;
    updateImageInputs();
    const inputs = document.querySelectorAll('.step-url-input'); book.images.forEach((img, i) => { if(inputs[i] && !img.includes('placehold.co')) inputs[i].value = img; });
    const btn = document.getElementById('add-book-btn'); btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Update Book'; btn.className = 'submit-btn w-full ripple mt-2 flex-center justify-center gap-2 bg-primary text-white';
    document.getElementById('cancel-edit-btn').style.display = "block"; refreshIcons();
};

document.getElementById('cancel-edit-btn').onclick = () => {
    document.getElementById('edit-book-id').value = ''; document.getElementById('admin-form-title').innerText = "Add New Book";
    document.getElementById('new-title').value = ''; document.getElementById('new-author').value = '';
    const btn = document.getElementById('add-book-btn'); btn.innerHTML = '<i data-lucide="upload-cloud" class="w-4 h-4"></i> Add to Cloud'; btn.className = 'submit-btn w-full ripple mt-2 flex-center justify-center gap-2 bg-success text-white';
    document.getElementById('cancel-edit-btn').style.display = "none"; updateImageInputs(); refreshIcons();
};

document.getElementById('add-book-btn').onclick = async () => {
    const title = document.getElementById('new-title').value.trim(); const author = document.getElementById('new-author').value.trim(); const genre = document.getElementById('new-genre').value; const editingId = document.getElementById('edit-book-id').value;
    if(!title || !author) return showPopup("Missing Info", "Fill in title and author.", null, false, "alert-triangle");
    const imageUrls = Array.from(document.querySelectorAll('.step-url-input')).map((input, i) => input.value.trim() || `https://placehold.co/600x400/0f172a/db2777?text=Step+${i+1}`);
    document.getElementById('add-book-btn').disabled = true;
    if(editingId) {
        const books = LibraryDB.getBooks(); const index = books.findIndex(b => String(b.id) === String(editingId));
        if(index > -1) { books[index].title = title; books[index].author = author; books[index].genre = genre; books[index].images = imageUrls; await LibraryDB.saveToCloud(); showPopup("Success", "Book Updated!", null, false, "check-circle"); }
    } else {
        await LibraryDB.addBook({ id: Date.now(), title, author, genre, images: imageUrls, views: 0 }); showPopup("Success", "Book Added!", null, false, "check-circle");
    }
    document.getElementById('cancel-edit-btn').click(); renderAdminList(); performSearch(searchInput.value); document.getElementById('add-book-btn').disabled = false;
};

function renderAdminList() {
    document.getElementById('admin-book-list').innerHTML = LibraryDB.getBooks().map(b => `
        <div class="bg-surface p-3 rounded-xl border flex justify-between items-center shadow-premium-sm">
            <div class="overflow-hidden"><strong class="block truncate text-sm">${b.title}</strong><small class="text-muted text-xs">${b.author}</small></div>
            <div class="flex gap-2">
                <button onclick="handleEdit('${b.id}')" class="icon-btn text-primary bg-primary-light w-8 h-8 flex-shrink-0"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                <button onclick="handleDelete('${b.id}')" class="icon-btn text-warning bg-warning/10 w-8 h-8 flex-shrink-0"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        </div>`).join(''); refreshIcons();
}

window.handleDelete = async (id) => { showPopup("Confirm Delete", "Are you sure you want to delete this book?", async () => { await LibraryDB.deleteBook(id); renderAdminList(); performSearch(searchInput.value); }, true, "alert-triangle"); };
document.getElementById('factory-reset-btn').onclick = async () => { showPopup("Defense Mode", "Reset Stats & History? Books will remain.", async () => { await LibraryDB.factoryReset(); window.location.reload(); }, true, "shield"); };

// --- FEATURED BOOK ---
function loadFeaturedBook() {
    const books = LibraryDB.getBooks(); if(books.length===0) return;
    const idx = Math.abs(new Date().toDateString().split('').reduce((a,b)=>a+(b.charCodeAt(0)),0)) % books.length; const b = books[idx];
    const isFav = favorites.some(id => String(id) === String(b.id));
    featuredContainer.innerHTML = `
        <div class="mb-6"><span class="text-xs font-bold text-muted uppercase tracking-wider mb-2 block">Daily Global Pick</span>
            <div class="featured-card shadow-premium" onclick="openModalById('${b.id}')">
                <div class="featured-cover skeleton"><img id="fc-img" src="" class="shelf-cover-img">
                <button class="fav-btn-grid ${isFav?'active':''}" onclick="toggleFavorite(event,'${b.id}')"><i data-lucide="heart" class="w-4 h-4"></i></button></div>
                <div class="text-left"><h2 class="font-bold text-lg leading-tight mb-1">${b.title}</h2><p class="text-sm text-muted mb-2">by ${b.author}</p><span class="badge bg-primary-light text-primary">${b.genre}</span></div>
            </div>
        </div>`;
    fetchCoverWithFallback(b.title, b.author, 'fc-img', true); refreshIcons();
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

function applyCover(url, elId, isImgTag) {
    const el = document.getElementById(elId); if(!el) return;
    const wrap = el.closest('.skeleton');
    if(isImgTag) { el.src = url; el.onload = () => { el.style.opacity = '1'; if(wrap) wrap.classList.remove('skeleton'); }; }
    else { el.style.backgroundImage = `url(${url})`; if(wrap) wrap.classList.remove('skeleton'); }
}

window.openModalById = function(id) { const b = LibraryDB.getBooks().find(x => String(x.id) === String(id)); if(b) openModal(b); };

async function openModal(book) {
    vibrate(); bookModal.classList.add('active'); LibraryDB.incrementView(book.id);
    if (!document.body.classList.contains('companion-mode-active')) { try{let h=JSON.parse(localStorage.getItem('search_history'))||[]; h.push(book.title); localStorage.setItem('search_history',JSON.stringify(h.slice(-15)));}catch(e){} }

    document.getElementById('modal-title').innerText = book.title; document.getElementById('modal-author').innerText = book.author;
    document.getElementById('modal-book-id').innerText = book.id; document.getElementById('modal-genre').innerText = book.genre;
    const cover = document.getElementById('modal-book-cover-img'); cover.src=''; cover.style.opacity='0'; cover.parentElement.classList.add('skeleton');
    fetchCoverWithFallback(book.title, book.author, 'modal-book-cover-img', true);

    const authorImg = document.getElementById('modal-author-pic'); authorImg.style.display = 'none'; authorImg.src = ''; authorImg.classList.add('skeleton');
    if (authorCache[book.author]) { authorImg.src = authorCache[book.author]; authorImg.style.display = 'block'; authorImg.classList.remove('skeleton'); } 
    else if(book.author) {
        fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(book.author)}`).then(r => r.json()).then(d => {
            if(d.docs?.[0]?.key) { const u = `https://covers.openlibrary.org/a/olid/${d.docs[0].key}-M.jpg`; authorCache[book.author] = u; authorImg.src = u; }
            else { authorImg.src = generateInitialsImage(book.author); }
            authorImg.style.display = 'block'; authorImg.onload = () => authorImg.classList.remove('skeleton');
        }).catch(() => {});
    }

    qrContainer.innerHTML = ''; const dl = `${window.location.origin}${window.location.pathname}?book=${book.id}&view=mobile`;
    try { new QRCode(qrContainer, { text: dl, width: 120, height: 120, colorDark : "#0f172a", colorLight : "#ffffff" }); } catch(err) {}

    const sb = document.getElementById('share-book-btn');
    if(sb) sb.onclick = async () => { vibrate(); if(navigator.share) await navigator.share({title:'LibNav', text:`Check out ${book.title}`, url:dl}); else { navigator.clipboard.writeText(dl); showPopup("Success", "Link copied!", null, false, "check-circle"); } };

    currentImages = book.images || []; currentImageIndex = 0; updateCarousel();
    const neighbors = LibraryDB.getBooks().filter(b => b.genre === book.genre && String(b.id) !== String(book.id)).sort(()=>0.5-Math.random()).slice(0, 4);
    neighborsGrid.innerHTML = '';
    if (neighbors.length > 0) {
        document.getElementById('neighbors-area').style.display = 'block';
        neighbors.forEach(n => {
            const card = document.createElement('div'); card.className = 'neighbor-card skeleton shadow-premium-sm'; const imgId = `n-${n.id}-${Date.now()}`;
            card.innerHTML = `<img id="${imgId}" class="shelf-cover-img" src="">`; card.onclick = () => openModal(n);
            neighborsGrid.appendChild(card); fetchCoverWithFallback(n.title, n.author, imgId, true);
        });
    } else document.getElementById('neighbors-area').style.display = 'none';
}

function updateCarousel() {
    const wrap = document.getElementById('carousel-wrapper'); const aa = document.getElementById('mobile-action-area');
    if(currentImages.length>0) {
        wrap.classList.add('skeleton'); carouselImg.style.opacity='0';
        carouselImg.onload = () => { carouselImg.style.opacity='1'; wrap.classList.remove('skeleton'); };
        carouselImg.src = currentImages[currentImageIndex]; stepCounter.innerText = `Step ${currentImageIndex+1} of ${currentImages.length}`;
        prevBtn.disabled = currentImageIndex === 0; nextBtn.disabled = currentImageIndex === currentImages.length-1; carouselImg.style.display = 'block';
        if(aa) aa.style.display = (currentImageIndex===currentImages.length-1 && document.body.classList.contains('is-mobile-device')) ? 'block' : 'none';
    } else { carouselImg.style.display = 'none'; wrap.classList.remove('skeleton'); stepCounter.innerText = "No map"; }
}

// --- SEARCH & CATEGORY LOGIC ---
document.querySelectorAll('.quick-btn').forEach(btn => {
    if(btn.id === 'open-feedback-btn') return;
    btn.onclick = () => {
        searchInput.value = ''; selectedGenres.clear(); selectedGenres.add(btn.dataset.genre);
        document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
        if(btn.dataset.genre === 'All') { hero.classList.remove('minimized'); featuredContainer.style.display = 'block'; } 
        else { hero.classList.add('minimized'); featuredContainer.style.display = 'none'; }
        performSearch(''); closeMenuBtn.click(); 
        document.getElementById('home-section').classList.add('active'); document.getElementById('about-section').classList.remove('active');
    };
});

searchInput.addEventListener('input', (e) => {
    const t = e.target.value.toLowerCase().trim();
    if (t.length > 0) { hero.classList.add('minimized'); featuredContainer.style.display = 'none'; } 
    else if (selectedGenres.size === 0 || selectedGenres.has('All')) { hero.classList.remove('minimized'); featuredContainer.style.display = 'block'; }
    
    autocompleteDropdown.innerHTML = '';
    if(t.length > 1) {
        const hits = LibraryDB.getBooks().filter(b => b.title.toLowerCase().includes(t) || b.author.toLowerCase().includes(t)).slice(0, 4);
        if(hits.length) {
            autocompleteDropdown.style.display = 'block';
            hits.forEach(s => {
                const d = document.createElement('div'); d.className = 'autocomplete-item ripple';
                const ht = s.title.replace(new RegExp(`(${t})`, 'gi'), '<span class="highlight-text">$1</span>');
                d.innerHTML = `<i data-lucide="search" class="w-4 h-4 text-primary"></i><div class="flex flex-col text-left w-full"><span class="text-sm font-bold text-main block">${ht}</span><span class="text-xs text-muted block">${s.author}</span></div>`;
                d.onclick = () => { searchInput.value = s.title; autocompleteDropdown.style.display = 'none'; performSearch(s.title); openModal(s); };
                autocompleteDropdown.appendChild(d);
            }); refreshIcons();
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
    if (books.length === 0) { resultsArea.innerHTML = '<div class="col-span-full text-center p-8 text-muted"><i data-lucide="book-x" class="w-12 h-12 mx-auto mb-2 opacity-50"></i><p>No books found.</p></div>'; refreshIcons(); return; }
    const frag = document.createDocumentFragment(); const term = searchInput.value.trim(); const regex = new RegExp(`(${term})`, 'gi');
    books.forEach((book, i) => {
        const card = document.createElement('div'); card.className = 'shelf-book-card';
        if(i < 8) card.style.animationDelay = `${i * 0.05}s`; else { card.style.animation = 'none'; card.style.opacity = '1'; }
        const isFav = favorites.some(id => String(id) === String(book.id)); const coverId = `img-${book.id}`;
        const titleHtml = term ? book.title.replace(regex, '<span class="highlight-text">$1</span>') : book.title;

        card.innerHTML = `
            <div class="shelf-cover-wrapper skeleton shadow-premium-sm">
                <img id="${coverId}" class="shelf-cover-img" data-title="${book.title}" data-author="${book.author}" src="">
                <button class="fav-btn-grid ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${book.id}')">
                    <i data-lucide="heart" class="w-4 h-4"></i>
                </button>
            </div>
            <div class="shelf-info"><p class="shelf-title">${titleHtml}</p><p class="shelf-author">${book.author}</p></div>
        `;
        card.onclick = (e) => { if(!e.target.closest('.fav-btn-grid')) openModal(book); }; frag.appendChild(card);
        setTimeout(() => imageObserver.observe(document.getElementById(coverId)), 0);
    });
    resultsArea.appendChild(frag); refreshIcons();
}

// --- UTILS & TRIGGERS ---
document.onclick = (e) => { if(!e.target.closest('.search-wrapper')) autocompleteDropdown.style.display='none'; };
function resetIdleTimer() { clearTimeout(idleTimeout); screensaver.classList.remove('active'); idleTimeout = setTimeout(() => { if(!document.body.classList.contains('companion-mode-active')) { resetToHome(); document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.remove('active')); screensaver.classList.add('active'); } }, IDLE_LIMIT); }
window.onload = resetIdleTimer; document.onmousemove = resetIdleTimer; document.onclick = resetIdleTimer; document.ontouchstart = resetIdleTimer;
document.querySelectorAll('.close-modal').forEach(btn => btn.onclick = (e) => e.target.closest('.modal-overlay').classList.remove('active'));

// RESTORED: Precise Time Formatting & Review Counts
document.getElementById('stats-trigger').onclick = () => {
    vibrate(); 
    const books = LibraryDB.getBooks(); const ratings = LibraryDB.getRatings();
    
    // Time Formatting (Days, Hours, Minutes)
    const startDate = new Date("2026-01-01T00:00:00").getTime();
    const now = new Date().getTime();
    const diff = now - startDate;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const uptimeStr = `${days}d, ${hours}h, ${minutes}m`;

    const mostViewed = books.reduce((a,b)=>(a.views||0)>(b.views||0)?a:b, {title:"None",views:0});
    const newest = books.reduce((a,b)=>(a.id>b.id)?a:b, {title:"None"});
    const genres = {}; books.forEach(b=>genres[b.genre]=(genres[b.genre]||0)+1);
    
    // Rating with Review Count
    const avg = ratings.length ? `⭐ ${(ratings.reduce((a,b)=>a+parseInt(b),0)/ratings.length).toFixed(1)} <span class="text-sm font-normal text-muted">(${ratings.length} Reviews)</span>` : "No Ratings";
    
    document.getElementById('stats-content').innerHTML = `
        <div class="bg-primary-light p-3 rounded-xl text-center mb-4 text-primary font-bold text-sm flex-center justify-center gap-2 border border-primary/20"><i data-lucide="server" class="w-4 h-4"></i> Cloud Uptime: ${uptimeStr}</div>
        <div class="grid-2 gap-3 mb-4">
            <div class="bg-surface p-4 rounded-xl border text-center shadow-premium-sm"><p class="text-xs text-muted mb-1 font-bold uppercase">Total Books</p><h2 class="text-2xl font-bold text-primary">${books.length}</h2></div>
            <div class="bg-surface p-4 rounded-xl border text-center shadow-premium-sm"><p class="text-xs text-muted mb-1 font-bold uppercase">Bookmarks</p><h2 class="text-2xl font-bold text-warning">${favorites.length}</h2></div>
        </div>
        <div class="bg-surface p-4 rounded-xl border text-center mb-4 shadow-premium-sm"><p class="text-xs text-muted mb-1 font-bold uppercase">Global Rating</p><h2 class="text-xl font-bold text-warning">${avg}</h2></div>
        <div class="mb-4"><p class="text-xs font-bold text-muted uppercase tracking-wider mb-2 flex-center gap-1"><i data-lucide="trending-up" class="w-3 h-3"></i> Top Pick</p><div class="flex justify-between items-center bg-surface p-3 rounded-lg border"><strong>${mostViewed.title}</strong><span class="text-xs bg-success/10 text-success px-2 py-1 rounded font-bold">${mostViewed.views} Views</span></div></div>
        <div class="mb-4"><p class="text-xs font-bold text-muted uppercase tracking-wider mb-2 flex-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> Newest</p><div class="bg-surface p-3 rounded-lg border"><strong>${newest.title}</strong></div></div>
        <div class="mb-2"><p class="text-xs font-bold text-muted uppercase tracking-wider mb-2 flex-center gap-1"><i data-lucide="pie-chart" class="w-3 h-3"></i> Composition</p>${Object.entries(genres).map(([k,v])=>`<div class="flex justify-between p-2 border-b border-color text-sm"><span>${k}</span><span class="text-primary font-bold">${v}</span></div>`).join('')}</div>
    `; refreshIcons(); document.getElementById('stats-modal').classList.add('active');
};

// RESTORED FEEDBACK LOGIC
document.getElementById('open-feedback-btn').onclick = () => { vibrate(); document.getElementById('feedback-modal').classList.add('active'); closeMenuBtn.click(); };
const fForm = document.getElementById('feedback-form');
if(fForm) fForm.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('fb-submit-btn');
    const rating = document.querySelector('input[name="rating"]:checked')?.value || 5; 
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin w-4 h-4 inline"></i> Sending...'; refreshIcons(); btn.disabled = true;
    try { 
        await LibraryDB.submitRating(parseInt(rating)); 
        showPopup("Success", "Feedback Sent! Thank you.", null, false, "check-circle"); 
        fForm.reset(); 
        setTimeout(() => document.getElementById('feedback-modal').classList.remove('active'), 1000); 
    } catch { showPopup("Saved", "Rating Saved Locally."); } 
    finally { btn.innerText = "Send Feedback"; btn.disabled = false; }
};

window.showSuccessScreen = function() { vibrate(); document.getElementById('book-modal').classList.remove('active'); document.getElementById('success-modal').classList.add('active'); }
window.closeSuccessScreen = function() { document.getElementById('success-modal').classList.remove('active'); window.location.href = window.location.pathname; }

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; const recognition = new SpeechRecognition(); recognition.lang = 'en-US';
    micBtn.onclick = () => { vibrate(); if (micBtn.classList.contains('text-warning')) recognition.stop(); else recognition.start(); };
    recognition.onstart = () => { micBtn.classList.add('text-warning'); searchInput.placeholder = "Listening..."; };
    recognition.onend = () => { micBtn.classList.remove('text-warning'); searchInput.placeholder = "Search..."; };
    recognition.onresult = (e) => { searchInput.value = e.results[0][0].transcript; searchInput.dispatchEvent(new Event('input')); };
} else micBtn.style.display = 'none';

init();
