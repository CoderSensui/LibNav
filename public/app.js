/* app.js - Reverted & Optimized (No Pills, Minion, Popups, Caching) */

const searchInput = document.getElementById('search-input');
const autocompleteDropdown = document.getElementById('autocomplete-dropdown');
const resultsArea = document.getElementById('results-area');
const hero = document.getElementById('hero');
const featuredContainer = document.getElementById('featured-container');
const hamburgerBtn = document.getElementById('hamburger-btn');
const sideMenu = document.getElementById('side-menu');
const sideMenuOverlay = document.getElementById('side-menu-overlay');
const closeMenuBtn = document.getElementById('close-menu');
const homeBtn = document.getElementById('home-btn');
const filterToggle = document.getElementById('filter-toggle'); 
const filterMenu = document.getElementById('filter-menu');
const checkboxes = document.querySelectorAll('.filter-option input[type="checkbox"]');
const micBtn = document.getElementById('mic-btn');
const screensaver = document.getElementById('screensaver');
const quickBtns = document.querySelectorAll('.quick-btn');
const feedbackBtn = document.getElementById('open-feedback-btn');
const feedbackModal = document.getElementById('feedback-modal');
const feedbackForm = document.getElementById('feedback-form');
const fbStatus = document.getElementById('fb-status');
const fbSubmitBtn = document.getElementById('fb-submit-btn');
const offlineBanner = document.getElementById('offline-banner');

const secretAdminBtn = document.getElementById('secret-admin-btn');
const adminModal = document.getElementById('admin-modal');
const adminAuthBtn = document.getElementById('admin-auth-btn');
const adminPassInput = document.getElementById('admin-password');
const adminDashboard = document.getElementById('admin-dashboard');
const adminLoginScreen = document.getElementById('admin-login-screen');
const stepSelect = document.getElementById('step-count-select');
const imageInputsContainer = document.getElementById('image-inputs-container');
const addBookBtn = document.getElementById('add-book-btn');
const adminBookList = document.getElementById('admin-book-list');
const factoryResetBtn = document.getElementById('factory-reset-btn');
const editBookIdInput = document.getElementById('edit-book-id');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const adminFormTitle = document.getElementById('admin-form-title');

const bookModal = document.getElementById('book-modal');
const neighborsArea = document.getElementById('neighbors-area');
const neighborsGrid = document.getElementById('neighbors-grid');
const qrContainer = document.getElementById('qrcode');
const carouselImg = document.getElementById('carousel-img');
const prevBtn = document.getElementById('prev-img-btn');
const nextBtn = document.getElementById('next-img-btn');
const stepCounter = document.getElementById('step-counter');
const shareBookBtn = document.getElementById('share-book-btn');

// POPUP ELEMENTS
const popupOverlay = document.getElementById('custom-popup');
const popupTitle = document.getElementById('popup-title');
const popupMessage = document.getElementById('popup-message');
const popupConfirm = document.getElementById('popup-confirm');
const popupCancel = document.getElementById('popup-cancel');

// MINION ELEMENTS
const heroTitle = document.getElementById('hero-title');
const minionSprite = document.getElementById('minion-sprite');

let selectedGenres = new Set(); 
let favorites = JSON.parse(localStorage.getItem('libnav_favs')) || [];
const IDLE_LIMIT = 30000;
let idleTimeout;
const coverCache = {}; // Aggressive Cache
const authorCache = {}; 
let currentImages = [];
let currentImageIndex = 0;

// --- FEATURE: CUSTOM POPUP ---
function showPopup(title, msg, onConfirm, showCancel = false) {
    popupTitle.innerText = title;
    popupMessage.innerText = msg;
    popupOverlay.classList.add('active');
    
    popupCancel.style.display = showCancel ? 'block' : 'none';
    popupConfirm.onclick = () => {
        popupOverlay.classList.remove('active');
        if(onConfirm) onConfirm();
    };
    popupCancel.onclick = () => popupOverlay.classList.remove('active');
}

// --- FEATURE: MINION EASTER EGG (Middle Logo) ---
heroTitle.innerHTML = heroTitle.textContent.split('').map(l => `<span class="hero-letter" style="display:inline-block; transition: transform 0.2s;">${l}</span>`).join('');
const heroLetters = document.querySelectorAll('.hero-letter');

heroTitle.addEventListener('click', () => {
    minionSprite.style.display = 'block';
    minionSprite.style.left = '-60px';
    minionSprite.style.top = '0px';
    
    let pos = -60;
    const interval = setInterval(() => {
        pos += 5;
        minionSprite.style.left = pos + 'px';
        
        heroLetters.forEach((span, i) => {
            const spanPos = (i * 30) + 20; 
            if(Math.abs(pos - spanPos) < 20) {
                span.style.transform = "translateY(-20px)";
                setTimeout(() => span.style.transform = "translateY(0)", 200);
            }
        });

        if(pos > 300) {
            clearInterval(interval);
            minionSprite.style.display = 'none';
        }
    }, 16);
});

// --- FEATURE: OFFLINE BANNER ---
window.addEventListener('offline', () => { offlineBanner.classList.add('active'); offlineBanner.innerText = "📡 You are offline. Viewing cached library."; offlineBanner.style.background = "#ef4444"; });
window.addEventListener('online', () => { 
    offlineBanner.innerText = "🟢 Back online!"; offlineBanner.style.background = "#16a34a";
    setTimeout(() => offlineBanner.classList.remove('active'), 3000); 
});

// --- FEATURE: HAPTICS ---
const vibrate = () => { if (navigator.vibrate) navigator.vibrate(10); };

// --- FEATURE: DYNAMIC INITIALS GENERATOR ---
function generateInitialsImage(name) {
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const colors = ['#e11d48', '#d97706', '#16a34a', '#2563eb', '#9333ea', '#db2777'];
    const color = colors[name.length % colors.length];
    
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 300; 
    const ctx = canvas.getContext('2d');
    
    const grd = ctx.createLinearGradient(0, 0, 200, 300);
    grd.addColorStop(0, '#1e293b');
    grd.addColorStop(1, color);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 200, 300);
    
    ctx.font = 'bold 80px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, 100, 150);
    
    return canvas.toDataURL();
}

// --- FEATURE: ANTI-LAG & AGGRESSIVE CACHING ---
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if(coverCache[img.dataset.title]) {
                img.src = coverCache[img.dataset.title];
                img.onload = () => { img.style.opacity = '1'; img.closest('.skeleton')?.classList.remove('skeleton'); };
            } else {
                fetchCoverWithFallback(img.dataset.title, img.dataset.author, img.id, true);
            }
            observer.unobserve(img);
        }
    });
}, { rootMargin: '200px 0px' });

async function init() {
    loadTheme();
    const connected = await LibraryDB.init(); 
    if (!connected) resultsArea.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;">Connection Error</div>';
    
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('book');
    if (window.innerWidth <= 768) document.body.classList.add('is-mobile-device');

    if (bookId) {
        const book = LibraryDB.getBooks().find(b => String(b.id) === String(bookId));
        if (book) {
            if (urlParams.get('view') === 'mobile') document.body.classList.add('companion-mode-active');
            openModal(book);
        }
    }

    if (!document.body.classList.contains('companion-mode-active')) {
        loadFeaturedBook(); 
        resultsArea.innerHTML = ''; 
        resetIdleTimer();
    }
}

// --- ADMIN LOGIC ---
secretAdminBtn.addEventListener('click', () => { adminModal.classList.add('active'); closeSidebar(); });

adminAuthBtn.addEventListener('click', () => {
    if(adminPassInput.value === 'admin123') {
        adminLoginScreen.style.display = 'none'; adminDashboard.style.display = 'block';
        updateImageInputs(); renderAdminList();
    } else showPopup("Error", "Incorrect Password");
});

function updateImageInputs() {
    imageInputsContainer.innerHTML = ''; 
    const count = parseInt(stepSelect.value);
    for (let i = 1; i <= count; i++) {
        const input = document.createElement('input');
        input.className = 'form-input step-url-input';
        input.style.borderLeft = "4px solid var(--primary-pink)";
        input.placeholder = (i===count) ? `Final Image URL` : `Step ${i} Image URL`;
        imageInputsContainer.appendChild(input);
    }
}
stepSelect.addEventListener('change', updateImageInputs);

window.handleEdit = function(id) {
    const book = LibraryDB.getBooks().find(b => String(b.id) === String(id));
    if(!book) return;
    editBookIdInput.value = book.id;
    adminFormTitle.innerText = "Edit Book";
    document.getElementById('new-title').value = book.title;
    document.getElementById('new-author').value = book.author;
    document.getElementById('new-genre').value = book.genre;
    document.getElementById('step-count-select').value = book.images.length || 2;
    updateImageInputs();
    const inputs = document.querySelectorAll('.step-url-input');
    book.images.forEach((img, i) => { if(inputs[i] && !img.includes('placehold.co')) inputs[i].value = img; });
    addBookBtn.innerText = "💾 Update Book"; addBookBtn.style.background = "#3b82f6";
    cancelEditBtn.style.display = "block";
    document.querySelector('#admin-modal .modal-content').scrollTo({top:0,behavior:'smooth'});
};

cancelEditBtn.onclick = () => {
    editBookIdInput.value = ''; adminFormTitle.innerText = "Add New Book";
    document.getElementById('new-title').value = ''; document.getElementById('new-author').value = '';
    addBookBtn.innerText = "+ Add to Cloud"; addBookBtn.style.background = "#4ade80";
    cancelEditBtn.style.display = "none"; updateImageInputs();
};

addBookBtn.addEventListener('click', async () => {
    const title = document.getElementById('new-title').value.trim();
    const author = document.getElementById('new-author').value.trim();
    const genre = document.getElementById('new-genre').value;
    const editingId = editBookIdInput.value;
    
    if(!title || !author) return showPopup("Missing Info", "Please fill in title and author.");
    
    const imageUrls = Array.from(document.querySelectorAll('.step-url-input')).map((input, i) => {
        return input.value.trim() || `https://placehold.co/600x400/252f46/ffc4d6?text=Step+${i+1}`;
    });
    
    addBookBtn.disabled = true; addBookBtn.innerText = "Saving...";
    
    if(editingId) {
        const books = LibraryDB.getBooks();
        const index = books.findIndex(b => String(b.id) === String(editingId));
        if(index > -1) {
            books[index].title = title; books[index].author = author;
            books[index].genre = genre; books[index].images = imageUrls;
            await LibraryDB.saveToCloud(); 
            showPopup("Success", "Book Updated Successfully!");
        }
    } else {
        await LibraryDB.addBook({ id: Date.now(), title, author, genre, images: imageUrls, views: 0 });
        showPopup("Success", "Book Added Globally!");
    }
    cancelEditBtn.click(); renderAdminList(); performSearch(searchInput.value); addBookBtn.disabled = false;
});

function renderAdminList() {
    adminBookList.innerHTML = LibraryDB.getBooks().map(b => `
        <div style="background:var(--bg-chip);padding:12px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;">
            <div style="overflow:hidden;"><strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.title}</strong><small>${b.author}</small></div>
            <div style="display:flex;gap:5px;">
                <button onclick="handleEdit('${b.id}')" style="background:#3b82f6;color:white;border:none;padding:5px 10px;border-radius:6px;">Edit</button>
                <button onclick="handleDelete('${b.id}')" style="background:#ef4444;color:white;border:none;padding:5px 10px;border-radius:6px;">Del</button>
            </div>
        </div>`).join('');
}

window.handleDelete = async (id) => { 
    showPopup("Confirm Delete", "Are you sure you want to delete this book?", async () => {
        await LibraryDB.deleteBook(id); renderAdminList(); performSearch(searchInput.value);
    }, true);
};

factoryResetBtn.onclick = async () => {
    showPopup("Defense Mode", "Reset Stats & History? Books will remain.", async () => {
        await LibraryDB.factoryReset(); window.location.reload();
    }, true);
};

// --- FEATURED BOOK ---
function loadFeaturedBook() {
    const books = LibraryDB.getBooks(); if(books.length===0) return;
    const idx = Math.abs(new Date().toDateString().split('').reduce((a,b)=>a+(b.charCodeAt(0)),0)) % books.length;
    const b = books[idx];
    const isFav = favorites.some(id => String(id) === String(b.id));
    featuredContainer.innerHTML = `
        <div class="featured-section">
            <span class="featured-label">Daily Global Pick</span>
            <div class="featured-card" onclick="openModalById('${b.id}')" style="cursor:pointer;">
                <div class="featured-cover skeleton" id="fc-wrap"><img id="fc-img" src="" style="opacity:0;transition:0.3s;width:100%;height:100%;object-fit:cover;">
                <button class="fav-btn-grid ${isFav?'active':''}" style="top:5px;right:5px;border-radius:50%;width:30px;height:30px;" onclick="toggleFavorite(event,'${b.id}')"><svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg></button></div>
                <div class="featured-info"><h2>${b.title}</h2><p>by ${b.author}</p><span class="chip">${b.genre}</span></div>
            </div>
        </div>`;
    fetchCoverWithFallback(b.title, b.author, 'fc-img', true);
}

function fetchCoverWithFallback(title, author, elementId, isImgTag) {
    if(coverCache[title]) { applyCover(coverCache[title], elementId, isImgTag); return; }
    
    fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`)
    .then(r=>r.json()).then(d => {
        if(d.docs?.[0]?.cover_i) {
            const url = `https://covers.openlibrary.org/b/id/${d.docs[0].cover_i}-M.jpg`;
            coverCache[title] = url; applyCover(url, elementId, isImgTag);
        } else {
            fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`)
            .then(r2=>r2.json()).then(d2 => {
                if(d2.docs?.[0]?.cover_i) {
                    const url = `https://covers.openlibrary.org/b/id/${d2.docs[0].cover_i}-M.jpg`;
                    coverCache[title] = url; applyCover(url, elementId, isImgTag);
                } else {
                    const fallback = generateInitialsImage(title); coverCache[title] = fallback; applyCover(fallback, elementId, isImgTag);
                }
            }).catch(() => {
                const fallback = generateInitialsImage(title); coverCache[title] = fallback; applyCover(fallback, elementId, isImgTag);
            });
        }
    }).catch(() => {
        const fallback = generateInitialsImage(title); coverCache[title] = fallback; applyCover(fallback, elementId, isImgTag);
    });
}

function applyCover(url, elementId, isImgTag) {
    const el = document.getElementById(elementId);
    if(!el) return;
    const wrapper = el.closest('.skeleton');
    if(isImgTag) { el.src = url; el.onload = () => { el.style.opacity = '1'; if(wrapper) wrapper.classList.remove('skeleton'); }; }
    else { el.style.backgroundImage = `url(${url})`; if(wrapper) wrapper.classList.remove('skeleton'); }
}

window.openModalById = function(id) { const b = LibraryDB.getBooks().find(x => String(x.id) === String(id)); if(b) openModal(b); };

async function openModal(book) {
    vibrate(); 
    bookModal.classList.add('active');
    LibraryDB.incrementView(book.id);
    if (!document.body.classList.contains('companion-mode-active')) updateHistory(book.title);

    document.getElementById('modal-title').innerText = book.title;
    document.getElementById('modal-author').innerText = book.author;
    document.getElementById('modal-book-id').innerText = book.id;
    document.getElementById('modal-genre').innerText = book.genre;

    const cover = document.getElementById('modal-book-cover-img');
    cover.src=''; cover.style.opacity='0'; cover.parentElement.classList.add('skeleton');
    fetchCoverWithFallback(book.title, book.author, 'modal-book-cover-img', true);

    const authorImg = document.getElementById('modal-author-pic');
    authorImg.style.display = 'none'; authorImg.src = ''; authorImg.classList.add('skeleton');
    if (authorCache[book.author]) { authorImg.src = authorCache[book.author]; authorImg.style.display = 'block'; authorImg.classList.remove('skeleton'); } 
    else if(book.author) {
        fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(book.author)}`).then(r => r.json()).then(d => {
            if(d.docs?.[0]?.key) { const url = `https://covers.openlibrary.org/a/olid/${d.docs[0].key}-M.jpg`; authorCache[book.author] = url; authorImg.src = url; authorImg.style.display = 'block'; authorImg.onload = () => authorImg.classList.remove('skeleton'); }
            else { authorImg.src = generateInitialsImage(book.author); authorImg.style.display = 'block'; authorImg.onload = () => authorImg.classList.remove('skeleton'); }
        }).catch(() => {});
    }

    qrContainer.innerHTML = '';
    const deepLink = `${window.location.origin}${window.location.pathname}?book=${book.id}&view=mobile`;
    try { new QRCode(qrContainer, { text: deepLink, width: 120, height: 120, colorDark : "#0b1121", colorLight : "#ffffff" }); } catch(err) {}

    if(shareBookBtn) {
        shareBookBtn.onclick = async () => {
            vibrate();
            if(navigator.share) await navigator.share({ title: 'LibNav', text: `Check out ${book.title}`, url: deepLink });
            else { navigator.clipboard.writeText(deepLink); showPopup("Success", "Link copied to clipboard!"); }
        };
    }

    currentImages = book.images || []; currentImageIndex = 0; updateCarousel();

    const all = LibraryDB.getBooks();
    let neighbors = all.filter(b => b.genre === book.genre && String(b.id) !== String(book.id)).sort(()=>0.5-Math.random()).slice(0, 4);
    neighborsGrid.innerHTML = '';
    if (neighbors.length > 0) {
        neighborsArea.style.display = 'block';
        neighbors.forEach(n => {
            const card = document.createElement('div'); card.className = 'neighbor-card skeleton';
            const imgId = `n-${n.id}-${Date.now()}`;
            card.innerHTML = `<img id="${imgId}" class="neighbor-cover" src="">`;
            card.onclick = () => openModal(n);
            neighborsGrid.appendChild(card);
            fetchCoverWithFallback(n.title, n.author, imgId, true);
        });
    } else neighborsArea.style.display = 'none';
}

function updateCarousel() {
    const wrapper = document.getElementById('carousel-wrapper');
    const actionArea = document.getElementById('mobile-action-area');
    if(currentImages.length>0) {
        wrapper.classList.add('skeleton'); carouselImg.style.opacity='0';
        carouselImg.onload = () => { carouselImg.style.opacity='1'; wrapper.classList.remove('skeleton'); };
        carouselImg.src = currentImages[currentImageIndex];
        stepCounter.innerText = `Step ${currentImageIndex+1} of ${currentImages.length}`;
        prevBtn.disabled = currentImageIndex === 0; nextBtn.disabled = currentImageIndex === currentImages.length-1;
        carouselImg.style.display = 'block';
        if(actionArea) actionArea.style.display = (currentImageIndex===currentImages.length-1 && document.body.classList.contains('is-mobile-device')) ? 'block' : 'none';
    } else {
        carouselImg.style.display = 'none'; wrapper.classList.remove('skeleton'); stepCounter.innerText = "No map";
    }
}

// SIDE MENU LOGIC (Reverted)
homeBtn.onclick = () => { searchInput.value=''; autocompleteDropdown.style.display='none'; selectedGenres.clear(); checkboxes.forEach(c=>c.checked=false); quickBtns.forEach(b=>b.classList.remove('active')); hero.classList.remove('minimized'); featuredContainer.style.display='block'; homeBtn.classList.add('home-hidden'); resultsArea.innerHTML = ''; };
hamburgerBtn.onclick = () => { sideMenu.classList.add('active'); sideMenuOverlay.classList.add('active'); filterMenu.style.display='none'; };
closeMenuBtn.onclick = () => { sideMenu.classList.remove('active'); sideMenuOverlay.classList.remove('active'); };
sideMenuOverlay.onclick = closeMenuBtn.onclick;
filterToggle.onclick = (e) => { e.stopPropagation(); filterMenu.style.display = (filterMenu.style.display==='flex'?'none':'flex'); sideMenu.classList.remove('active'); sideMenuOverlay.classList.remove('active'); };
document.onclick = (e) => { if(!e.target.closest('.search-wrapper')) autocompleteDropdown.style.display='none'; };

function resetIdleTimer() { clearTimeout(idleTimeout); screensaver.classList.remove('active'); idleTimeout = setTimeout(() => { if(!document.body.classList.contains('companion-mode-active')) { homeBtn.click(); document.querySelectorAll('.modal-overlay').forEach(m=>m.classList.remove('active')); closeMenuBtn.click(); filterMenu.style.display='none'; screensaver.classList.add('active'); } }, IDLE_LIMIT); }
window.onload = resetIdleTimer; document.onmousemove = resetIdleTimer; document.onclick = resetIdleTimer; document.ontouchstart = resetIdleTimer;

quickBtns.forEach(btn => {
    if(btn.id === 'open-feedback-btn') return;
    btn.onclick = () => {
        searchInput.value = ''; hero.classList.add('minimized'); featuredContainer.style.display = 'none'; homeBtn.classList.remove('home-hidden');
        selectedGenres.clear(); selectedGenres.add(btn.dataset.genre);
        checkboxes.forEach(box => { box.checked = (box.value === btn.dataset.genre); });
        quickBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active');
        performSearch(''); closeMenuBtn.onclick();
    };
});

checkboxes.forEach(box => {
    box.onchange = (e) => {
        const val = e.target.value;
        if(val === 'All') {
            selectedGenres.clear(); if(e.target.checked) selectedGenres.add('All');
            checkboxes.forEach(c => { if(c.value !== 'All') c.checked = false; });
            quickBtns.forEach(b => b.classList.remove('active')); if(e.target.checked) document.querySelector('.quick-btn[data-genre="All"]').classList.add('active');
        } else {
            if(e.target.checked) { selectedGenres.delete('All'); document.querySelector('input[value="All"]').checked = false; document.querySelector('.quick-btn[data-genre="All"]').classList.remove('active'); selectedGenres.add(val); quickBtns.forEach(b => { if(b.dataset.genre===val) b.classList.add('active'); }); } 
            else { selectedGenres.delete(val); quickBtns.forEach(b => { if(b.dataset.genre===val) b.classList.remove('active'); }); }
        }
        if (selectedGenres.size > 0) { hero.classList.add('minimized'); featuredContainer.style.display = 'none'; homeBtn.classList.remove('home-hidden'); } 
        else if (searchInput.value === '') { hero.classList.remove('minimized'); featuredContainer.style.display = 'block'; homeBtn.classList.add('home-hidden'); }
        performSearch(searchInput.value);
    };
});

// AUTOCOMPLETE & HIGHLIGHTING
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term.length > 0) { hero.classList.add('minimized'); featuredContainer.style.display = 'none'; homeBtn.classList.remove('home-hidden'); } 
    else if (selectedGenres.size === 0) { hero.classList.remove('minimized'); featuredContainer.style.display = 'block'; homeBtn.classList.add('home-hidden'); }
    
    autocompleteDropdown.innerHTML = '';
    if(term.length > 1) {
        const hits = LibraryDB.getBooks().filter(b => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term)).slice(0, 4);
        if(hits.length) {
            autocompleteDropdown.style.display = 'block';
            hits.forEach(s => {
                const d = document.createElement('div'); d.className = 'autocomplete-item';
                const highlighted = s.title.replace(new RegExp(`(${term})`, 'gi'), '<span class="highlight-text">$1</span>');
                d.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary-pink)" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><div style="display:flex;flex-direction:column;"><span>${highlighted}</span><small style="color:var(--text-muted);font-size:0.75rem;">${s.author}</small></div>`;
                d.onclick = () => { searchInput.value = s.title; autocompleteDropdown.style.display = 'none'; performSearch(s.title); openModal(s); };
                autocompleteDropdown.appendChild(d);
            });
        } else autocompleteDropdown.style.display = 'none';
    } else autocompleteDropdown.style.display = 'none';
    performSearch(term);
});

function performSearch(term) {
    let books = LibraryDB.getBooks(); term = term.toLowerCase().trim();
    if (term === '' && selectedGenres.size === 0) { resultsArea.innerHTML = ''; return; }
    let matches = books.filter(book => {
        const tMatch = book.title.toLowerCase().includes(term);
        const aMatch = book.author.toLowerCase().includes(term);
        let gMatch = false;
        if (selectedGenres.has('All')) gMatch = true;
        else if (selectedGenres.size > 0) { if (selectedGenres.has('Favorites') && favorites.includes(String(book.id))) gMatch = true; if (selectedGenres.has(book.genre)) gMatch = true; } 
        else gMatch = true;
        return (tMatch || aMatch) && gMatch;
    });
    if (selectedGenres.has('All') || term !== '') matches.sort((a, b) => a.title.localeCompare(b.title));
    renderResults(matches);
}

function renderResults(books) {
    resultsArea.innerHTML = '';
    if (books.length === 0) { resultsArea.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;">No books found.</div>'; return; }
    
    const frag = document.createDocumentFragment();
    const term = searchInput.value.trim();
    const regex = new RegExp(`(${term})`, 'gi');

    books.forEach((book, index) => {
        const card = document.createElement('div'); card.className = 'shelf-book-card';
        if(index < 8) card.style.animationDelay = `${index * 0.05}s`; else { card.style.animation = 'none'; card.style.opacity = '1'; }
        
        const isFav = favorites.some(id => String(id) === String(book.id));
        const coverId = `img-${book.id}`;
        const titleHtml = term ? book.title.replace(regex, '<span class="highlight-text">$1</span>') : book.title;

        card.innerHTML = `
            <div class="shelf-cover-wrapper skeleton">
                <img id="${coverId}" class="shelf-cover-img" data-title="${book.title}" data-author="${book.author}" src="">
                <button class="fav-btn-grid ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${book.id}')">
                    <svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
                </button>
            </div>
            <div class="shelf-info"><p class="shelf-title">${titleHtml}</p><p class="shelf-author">${book.author}</p></div>
        `;
        card.onclick = (e) => { if(!e.target.closest('.fav-btn-grid')) openModal(book); };
        frag.appendChild(card);
        setTimeout(() => imageObserver.observe(document.getElementById(coverId)), 0);
    });
    resultsArea.appendChild(frag);
}

window.toggleFavorite = function(e, bookId) {
    e.stopPropagation(); vibrate();
    const index = favorites.findIndex(id => String(id) === String(bookId));
    if (index === -1) favorites.push(String(bookId)); else favorites.splice(index, 1);
    localStorage.setItem('libnav_favs', JSON.stringify(favorites));
    performSearch(searchInput.value); loadFeaturedBook();
}

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition(); recognition.lang = 'en-US';
    micBtn.onclick = () => { if (micBtn.classList.contains('listening')) recognition.stop(); else recognition.start(); };
    recognition.onstart = () => { micBtn.classList.add('listening'); searchInput.placeholder = "Listening..."; };
    recognition.onend = () => { micBtn.classList.remove('listening'); searchInput.placeholder = "Search..."; };
    recognition.onresult = (e) => { searchInput.value = e.results[0][0].transcript; searchInput.dispatchEvent(new Event('input')); };
} else micBtn.style.display = 'none';

document.getElementById('stats-trigger').onclick = () => {
    const books = LibraryDB.getBooks(); const ratings = LibraryDB.getRatings();
    const uptime = Math.floor((new Date()-new Date("2026-01-01"))/(1000*60*60*24));
    const mostViewed = books.reduce((a,b)=>(a.views||0)>(b.views||0)?a:b, {title:"None",views:0});
    const newest = books.reduce((a,b)=>(a.id>b.id)?a:b, {title:"None"});
    const genres = {}; books.forEach(b=>genres[b.genre]=(genres[b.genre]||0)+1);
    const avg = ratings.length ? (ratings.reduce((a,b)=>a+parseInt(b),0)/ratings.length).toFixed(1) : "N/A";
    
    document.getElementById('stats-content').innerHTML = `
        <div style="background:var(--bg-chip);padding:10px;border-radius:12px;text-align:center;border:1px solid var(--primary-pink);margin-bottom:15px;"><p style="color:var(--primary-pink);font-size:0.8rem;font-weight:bold;margin:0;">🟢 Uptime: ${uptime} Days</p></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;">
            <div style="background:var(--bg-chip);padding:12px;border-radius:12px;text-align:center;"><p style="color:var(--text-muted);font-size:0.75rem;">Total Books</p><h2 style="font-size:1.5rem;margin:0;">${books.length}</h2></div>
            <div style="background:var(--bg-chip);padding:12px;border-radius:12px;text-align:center;"><p style="color:var(--text-muted);font-size:0.75rem;">Your Bookmarks</p><h2 style="font-size:1.5rem;color:#ef4444;margin:0;">${favorites.length}</h2></div>
        </div>
        <div style="background:var(--bg-chip);padding:12px;border-radius:12px;text-align:center;margin-bottom:15px;"><p style="color:var(--text-muted);font-size:0.75rem;">Global Website Rating</p><h2 style="font-size:1.3rem;color:#fbbf24;margin:0;">⭐ ${avg}</h2></div>
        <div style="margin-bottom:15px;"><p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:2px;">📈 Trending Now</p><div style="display:flex;justify-content:space-between;align-items:center;"><h3 class="text-pink" style="font-size:1.1rem;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%;">${mostViewed.title}</h3><span style="font-size:0.8rem;color:#4ade80;font-weight:bold;">${mostViewed.views} Views</span></div></div>
        <div style="margin-bottom:15px;"><p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:2px;">🆕 Newest Arrival</p><h3 style="font-size:1rem;margin:0;color:var(--text-main);">${newest.title}</h3></div>
        <div style="margin-bottom:10px;"><p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:5px;">📚 Library Composition</p>${Object.entries(genres).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border-color);font-size:0.9rem;"><span>${k}</span><span class="text-pink" style="font-weight:bold;">${v}</span></div>`).join('')}</div>
    `;
    document.getElementById('stats-modal').classList.add('active');
};

function updateHistory(title) { try { let hist = JSON.parse(localStorage.getItem('search_history')) || []; hist.push(title); localStorage.setItem('search_history', JSON.stringify(hist.slice(-15))); } catch(e) {} }

prevBtn.onclick = () => { vibrate(); if (currentImageIndex > 0) { currentImageIndex--; updateCarousel(); } };
nextBtn.onclick = () => { vibrate(); if (currentImageIndex < currentImages.length - 1) { currentImageIndex++; updateCarousel(); } };
document.querySelectorAll('.close-modal').forEach(btn => btn.onclick = (e) => e.target.closest('.modal-overlay').classList.remove('active'));
if (feedbackBtn) feedbackBtn.onclick = () => { feedbackModal.classList.add('active'); closeSidebar(); };

if (feedbackForm) feedbackForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('fb-name').value;
    const email = document.getElementById('fb-email').value;
    const message = document.getElementById('fb-message').value;
    const ratingInput = document.querySelector('input[name="rating"]:checked');
    const ratingValue = ratingInput ? parseInt(ratingInput.value) : 5; 
    fbSubmitBtn.disabled = true; fbSubmitBtn.innerText = "Sending...";
    try {
        await LibraryDB.submitRating(ratingValue);
        const payload = { name, email, message: `[Rating: ${ratingValue}/5]\n\n${message}` };
        await fetch('/api/send-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        showPopup("Success", "Feedback Sent! Thank you.");
        feedbackForm.reset(); setTimeout(() => feedbackModal.classList.remove('active'), 1000); 
    } catch { showPopup("Saved", "Rating Saved Locally."); setTimeout(() => feedbackModal.classList.remove('active'), 1000); }
    finally { fbSubmitBtn.disabled = false; fbSubmitBtn.innerText = "Send"; }
};

const themeBtn = document.getElementById('theme-toggle');
const moonSVG = '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
const lightbulbSVG = '<svg viewBox="0 0 24 24"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/></svg>';
themeBtn.onclick = () => { vibrate(); document.body.classList.toggle('light-mode'); localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark'); themeBtn.innerHTML = document.body.classList.contains('light-mode') ? moonSVG : lightbulbSVG; };
function loadTheme() { if(localStorage.getItem('theme') === 'light') { document.body.classList.add('light-mode'); themeBtn.innerHTML = moonSVG; } else { themeBtn.innerHTML = lightbulbSVG; } }
window.showSuccessScreen = function() { vibrate(); document.getElementById('book-modal').classList.remove('active'); document.getElementById('success-modal').classList.add('active'); }
window.closeSuccessScreen = function() { document.getElementById('success-modal').classList.remove('active'); window.location.href = window.location.pathname; }

init();
