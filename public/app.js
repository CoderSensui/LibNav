/* app.js - Global Sync & Auto-Placeholders */

const searchInput = document.getElementById('search-input');
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

// --- SECRET ADMIN ELEMENTS ---
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

// --- MODAL ELEMENTS ---
const bookModal = document.getElementById('book-modal');
const neighborsArea = document.getElementById('neighbors-area');
const neighborsList = document.getElementById('neighbors-list');
const qrContainer = document.getElementById('qrcode');
const carouselImg = document.getElementById('carousel-img');
const prevBtn = document.getElementById('prev-img-btn');
const nextBtn = document.getElementById('next-img-btn');
const stepCounter = document.getElementById('step-counter');

let selectedGenres = new Set(); 
let favorites = JSON.parse(localStorage.getItem('libnav_favs')) || [];
const IDLE_LIMIT = 30000;
let idleTimeout;
const coverCache = {}; 
const authorCache = {}; 
let currentImages = [];
let currentImageIndex = 0;

async function init() {
    loadTheme();
    // Initialize Cloud Database
    const connected = await LibraryDB.init(); 
    
    if (!connected) {
        resultsArea.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding:20px;">Firebase Connection Error. Check rules.</div>';
        return;
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const viewMode = urlParams.get('view'); 
    const bookId = urlParams.get('book');

    const isMobileDevice = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobileDevice) document.body.classList.add('is-mobile-device');

    if (bookId) {
        const allBooks = LibraryDB.getBooks();
        const deepLinkedBook = allBooks.find(b => String(b.id) === String(bookId));
        if (deepLinkedBook) {
            if (viewMode === 'mobile') {
                document.body.classList.add('companion-mode-active');
                if(document.querySelector('.close-modal')) document.querySelector('.close-modal').style.display = 'none';
            } else {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            openModal(deepLinkedBook);
        }
    }

    if (!document.body.classList.contains('companion-mode-active')) {
        loadFeaturedBook(); 
        resultsArea.innerHTML = ''; 
        resetIdleTimer();
    }
}

// ==========================================
// ADMIN PANEL (AUTO-PLACEHOLDERS)
// ==========================================

secretAdminBtn.addEventListener('click', () => {
    adminModal.classList.add('active');
    closeSidebar();
});

adminAuthBtn.addEventListener('click', () => {
    if(adminPassInput.value === 'admin123') {
        adminLoginScreen.style.display = 'none';
        adminDashboard.style.display = 'block';
        updateImageInputs(); 
        renderAdminList();
    } else {
        alert('Wrong Password!');
    }
});

function updateImageInputs() {
    const count = parseInt(stepSelect.value);
    imageInputsContainer.innerHTML = ''; 
    
    for (let i = 1; i <= count; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-input step-url-input';
        input.style.borderLeft = "4px solid var(--primary-pink)";
        input.placeholder = (i === count) ? `Final Image URL (Arrived)` : `Step ${i} Image URL`;
        imageInputsContainer.appendChild(input);
    }
}

stepSelect.addEventListener('change', updateImageInputs);

addBookBtn.addEventListener('click', async () => {
    const title = document.getElementById('new-title').value.trim();
    const author = document.getElementById('new-author').value.trim();
    const genre = document.getElementById('new-genre').value;
    
    const urlInputs = document.querySelectorAll('.step-url-input');
    
    // NEW: Auto-Placeholder Logic
    // If input is empty, generate a placeholder link
    const imageUrls = Array.from(urlInputs).map((input, index) => {
        const val = input.value.trim();
        if(val) return val;
        // Generate placeholder based on step number
        return `https://placehold.co/600x400/252f46/ffc4d6?text=Step+${index + 1}+Map`;
    });
    
    if(!title || !author) return alert('Please fill in title and author.');
    
    addBookBtn.disabled = true;
    addBookBtn.innerText = "Saving to Cloud...";
    
    const newBook = {
        id: Date.now(), 
        title: title,
        author: author,
        genre: genre,
        images: imageUrls,
        views: 0 // Initialize view count
    };
    
    const success = await LibraryDB.addBook(newBook);
    
    if(success) {
        alert('Book Added Globally!');
        document.getElementById('new-title').value = '';
        document.getElementById('new-author').value = '';
        updateImageInputs(); 
        renderAdminList();
        performSearch(searchInput.value);
    }
    
    addBookBtn.disabled = false;
    addBookBtn.innerText = "+ Add Book to Cloud";
});

function renderAdminList() {
    const books = LibraryDB.getBooks();
    adminBookList.innerHTML = books.map(b => `
        <div style="background:var(--bg-chip); padding:10px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
            <div style="overflow:hidden;">
                <strong style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${b.title}</strong>
                <span style="font-size:0.8rem; color:var(--text-muted);">${b.author}</span>
            </div>
            <button onclick="handleDelete('${b.id}')" style="background:#ef4444; color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; flex-shrink:0; margin-left:10px;">Delete</button>
        </div>
    `).join('');
}

window.handleDelete = async function(id) {
    if(confirm('Delete this book globally from the cloud?')) {
        await LibraryDB.deleteBook(id);
        renderAdminList();
        performSearch(searchInput.value); 
    }
};

// ==========================================
// FEATURED BOOK (GLOBAL DATE SEED)
// ==========================================
function loadFeaturedBook() {
    const books = LibraryDB.getBooks();
    if(books.length === 0) return;

    // ALGORITHM: Use today's date string as a seed so EVERYONE gets the same book
    const dateString = new Date().toDateString(); // e.g. "Sat Feb 21 2026"
    // Simple hash function to turn string into number
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
        hash = dateString.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % books.length;
    
    const featuredBook = books[index];
    if(!featuredBook) return;

    featuredContainer.innerHTML = `
        <div class="featured-section">
            <span class="featured-label">Daily Global Pick</span>
            <div class="featured-card" onclick="openModalById('${featuredBook.id}')">
                <div class="featured-cover" id="feat-cover-${featuredBook.id}"></div>
                <div class="featured-info">
                    <h2 style="font-size:1.3rem; margin-bottom:2px; line-height: 1.2;">${featuredBook.title}</h2>
                    <p style="color:var(--text-muted); font-size:0.9rem;">by ${featuredBook.author}</p>
                    <div style="margin-top:8px;"><span class="chip" style="margin:0;">${featuredBook.genre}</span></div>
                </div>
            </div>
        </div>`;

    fetchCoverWithFallback(featuredBook.title, featuredBook.author, `feat-cover-${featuredBook.id}`, false);
}

// ==========================================
// STATS & GLOBAL MOST VIEWED
// ==========================================
document.getElementById('stats-trigger').onclick = () => {
    const books = LibraryDB.getBooks();
    
    // Find GLOBAL most viewed book
    let mostViewedBook = books.reduce((prev, current) => {
        return (prev.views || 0) > (current.views || 0) ? prev : current;
    }, { title: "No data yet", views: 0 });

    // Fallback if no views at all
    if(!mostViewedBook.views) mostViewedBook = { title: "Start browsing!", views: 0 };

    document.getElementById('stats-content').innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
            <div style="background:var(--bg-chip); padding:15px; border-radius:15px; text-align:center;"><p style="color:var(--text-muted); font-size:0.8rem;">Total Books</p><h2 style="font-size:1.8rem;">${books.length}</h2></div>
            <div style="background:var(--bg-chip); padding:15px; border-radius:15px; text-align:center;"><p style="color:var(--text-muted); font-size:0.8rem;">Global Reads</p><h2 style="font-size:1.8rem; color:#4ade80;">${mostViewedBook.views}</h2></div>
        </div>
        <div style="margin-bottom:20px;">
            <p style="color:var(--text-muted); font-size:0.9rem;">👑 Most Viewed Globally</p>
            <h3 class="text-pink" style="font-size:1.3rem; margin-top:5px;">${mostViewedBook.title}</h3>
        </div>
    `;
    document.getElementById('stats-modal').classList.add('active');
};

// ==========================================
// STANDARD RENDER & LOGIC
// ==========================================

function fetchCoverWithFallback(title, author, elementId, isImgTag) {
    if (coverCache[title]) {
        applyCover(coverCache[title], elementId, isImgTag);
        return;
    }
    fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`)
    .then(res => res.json()).then(data => {
        if (data.docs && data.docs[0] && data.docs[0].cover_i) {
            const url = `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-M.jpg`;
            coverCache[title] = url;
            applyCover(url, elementId, isImgTag);
        } else {
            fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`)
            .then(res2 => res2.json()).then(data2 => {
                if (data2.docs && data2.docs[0] && data2.docs[0].cover_i) {
                    const fallbackUrl = `https://covers.openlibrary.org/b/id/${data2.docs[0].cover_i}-M.jpg`;
                    coverCache[title] = fallbackUrl;
                    applyCover(fallbackUrl, elementId, isImgTag);
                }
            }).catch(() => {});
        }
    }).catch(() => {});
}

function applyCover(url, elementId, isImgTag) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (isImgTag) { el.src = url; el.onload = () => el.style.opacity = '1'; } 
    else { el.style.backgroundImage = `url(${url})`; }
}

window.openModalById = function(id) {
    const book = LibraryDB.getBooks().find(b => String(b.id) === String(id));
    if(book) openModal(book);
}

async function openModal(book) {
    try {
        bookModal.classList.add('active');
        
        // NEW: Increment Global View Count
        LibraryDB.incrementView(book.id);

        document.getElementById('modal-title').innerText = book.title || 'Unknown';
        document.getElementById('modal-author').innerText = book.author || 'Unknown';
        document.getElementById('modal-book-id').innerText = book.id || 'N/A';
        document.getElementById('modal-genre').innerText = book.genre || 'Misc';

        const authorImg = document.getElementById('modal-author-pic');
        authorImg.style.display = 'none'; 
        authorImg.src = '';
        
        if (authorCache[book.author]) {
             authorImg.src = authorCache[book.author];
             authorImg.style.display = 'block';
        } else if(book.author) {
            fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(book.author)}`)
            .then(res => res.json()).then(data => {
                if(data.docs && data.docs[0] && data.docs[0].key) {
                    const url = `https://covers.openlibrary.org/a/olid/${data.docs[0].key}-M.jpg`;
                    authorCache[book.author] = url;
                    authorImg.src = url;
                    authorImg.style.display = 'block';
                }
            }).catch(e => console.log(e));
        }

        qrContainer.innerHTML = '';
        try {
            new QRCode(qrContainer, {
                text: `${window.location.origin}${window.location.pathname}?book=${book.id}&view=mobile`,
                width: 120, height: 120,
                colorDark : "#0b1121", colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.M
            });
        } catch(err) { console.error(err); }

        currentImages = book.images || []; 
        currentImageIndex = 0; 
        updateCarousel(); 

        const allBooks = LibraryDB.getBooks();
        const neighbors = allBooks.filter(b => b.genre === book.genre && String(b.id) !== String(book.id)); 
        
        neighborsList.innerHTML = '';
        if (neighbors.length > 0) {
            neighborsArea.style.display = 'block';
            const spineColors = ['#3E2723', '#4E342E', '#5D4037', '#6D4C41', '#795548', '#8D6E63'];
            neighbors.forEach(n => {
                const spine = document.createElement('div');
                spine.className = 'book-spine'; 
                spine.innerText = n.title;
                const randomHeight = Math.floor(Math.random() * (110 - 85 + 1) + 85);
                spine.style.height = `${randomHeight}px`;
                spine.style.backgroundColor = spineColors[Math.floor(Math.random() * spineColors.length)];
                spine.onclick = () => openModal(n);
                neighborsList.appendChild(spine);
            });
        } else neighborsArea.style.display = 'none';
        
    } catch(err) { console.error(err); }
}

function updateCarousel() {
    const actionArea = document.getElementById('mobile-action-area');
    if (currentImages.length > 0) {
        carouselImg.src = currentImages[currentImageIndex];
        stepCounter.innerText = `Step ${currentImageIndex + 1} of ${currentImages.length}`;
        prevBtn.disabled = currentImageIndex === 0;
        nextBtn.disabled = currentImageIndex === currentImages.length - 1;
        carouselImg.style.display = 'block';
        if (actionArea) {
            if (document.body.classList.contains('is-mobile-device') || document.body.classList.contains('companion-mode-active')) {
                if (currentImageIndex === currentImages.length - 1) {
                    actionArea.style.display = 'block';
                } else { actionArea.style.display = 'none'; }
            } else { actionArea.style.display = 'none'; }
        }
    } else {
        carouselImg.style.display = 'none';
        stepCounter.innerText = "No map images available";
        prevBtn.disabled = true; nextBtn.disabled = true;
        if (actionArea) actionArea.style.display = 'none';
    }
}

homeBtn.addEventListener('click', () => {
    searchInput.value = '';
    selectedGenres.clear();
    checkboxes.forEach(c => c.checked = false);
    quickBtns.forEach(b => b.classList.remove('active'));
    hero.classList.remove('minimized');
    featuredContainer.style.display = 'block';
    homeBtn.classList.add('home-hidden');
    resultsArea.innerHTML = ''; 
});

function openSidebar() { sideMenu.classList.add('active'); sideMenuOverlay.classList.add('active'); filterMenu.style.display = 'none'; }
function closeSidebar() { sideMenu.classList.remove('active'); sideMenuOverlay.classList.remove('active'); }
hamburgerBtn.addEventListener('click', openSidebar);
closeMenuBtn.addEventListener('click', closeSidebar);
sideMenuOverlay.addEventListener('click', closeSidebar);

filterToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    filterMenu.style.display = (filterMenu.style.display === 'flex') ? 'none' : 'flex';
    closeSidebar();
});

function resetIdleTimer() { clearTimeout(idleTimeout); screensaver.classList.remove('active'); idleTimeout = setTimeout(goIdle, IDLE_LIMIT); }
function goIdle() {
    if(document.body.classList.contains('companion-mode-active')) return;
    homeBtn.click();
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    closeSidebar();
    filterMenu.style.display = 'none';
    screensaver.classList.add('active');
}
window.onload = resetIdleTimer; document.onmousemove = resetIdleTimer; document.onkeypress = resetIdleTimer; document.onclick = resetIdleTimer; document.ontouchstart = resetIdleTimer;

quickBtns.forEach(btn => {
    if(btn.id === 'open-feedback-btn') return;
    btn.addEventListener('click', () => {
        const genre = btn.dataset.genre;
        searchInput.value = '';
        hero.classList.add('minimized');
        featuredContainer.style.display = 'none';
        homeBtn.classList.remove('home-hidden');
        selectedGenres.clear();
        selectedGenres.add(genre);
        checkboxes.forEach(box => {
            box.checked = (box.value === genre);
            if(genre === 'All' && box.value !== 'All') box.checked = false;
        });
        quickBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        performSearch('');
        closeSidebar();
    });
});

checkboxes.forEach(box => {
    box.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'All') {
            if (e.target.checked) {
                selectedGenres.clear(); selectedGenres.add('All');
                checkboxes.forEach(c => { if (c.value !== 'All') c.checked = false; });
                quickBtns.forEach(b => b.classList.remove('active'));
                const allBtn = document.querySelector('.quick-btn[data-genre="All"]');
                if(allBtn) allBtn.classList.add('active');
            } else { selectedGenres.clear(); document.querySelector('.quick-btn[data-genre="All"]').classList.remove('active'); }
        } else {
            if (e.target.checked) {
                if (selectedGenres.has('All')) { selectedGenres.delete('All'); document.querySelector('input[value="All"]').checked = false; document.querySelector('.quick-btn[data-genre="All"]').classList.remove('active'); }
                selectedGenres.add(val);
                quickBtns.forEach(b => { if (b.dataset.genre === val) b.classList.add('active'); });
            } else {
                selectedGenres.delete(val);
                quickBtns.forEach(b => { if (b.dataset.genre === val) b.classList.remove('active'); });
            }
        }
        
        if (selectedGenres.size > 0) { 
            hero.classList.add('minimized'); 
            featuredContainer.style.display = 'none'; 
            homeBtn.classList.remove('home-hidden'); 
        } else if (searchInput.value === '') { 
            hero.classList.remove('minimized'); 
            featuredContainer.style.display = 'block'; 
            homeBtn.classList.add('home-hidden'); 
        }
        performSearch(searchInput.value);
    });
});

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term.length > 0) { 
        hero.classList.add('minimized'); 
        featuredContainer.style.display = 'none'; 
        homeBtn.classList.remove('home-hidden'); 
    } else if (selectedGenres.size === 0) { 
        hero.classList.remove('minimized'); 
        featuredContainer.style.display = 'block'; 
        homeBtn.classList.add('home-hidden'); 
    }
    performSearch(term);
});

function performSearch(term) {
    let books = LibraryDB.getBooks();
    term = term.toLowerCase().trim();
    
    if (term === '' && selectedGenres.size === 0) {
        resultsArea.innerHTML = '';
        return;
    }

    let matches = books.filter(book => {
        const titleMatch = book.title.toLowerCase().includes(term);
        const authorMatch = book.author.toLowerCase().includes(term);
        let genreMatch = false;
        
        if (selectedGenres.has('All')) genreMatch = true;
        else if (selectedGenres.size > 0) {
            if (selectedGenres.has('Favorites') && favorites.includes(book.id)) genreMatch = true;
            if (selectedGenres.has(book.genre)) genreMatch = true;
        } else {
            genreMatch = true; 
        }
        return (titleMatch || authorMatch) && genreMatch;
    });
    
    if (selectedGenres.has('All') || term !== '') {
        matches.sort((a, b) => a.title.localeCompare(b.title));
    }
    
    renderResults(matches);
}

function renderResults(books) {
    resultsArea.innerHTML = '';
    
    if (books.length === 0) {
        resultsArea.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--text-muted); padding:40px 20px;">No books found matching criteria.</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();

    books.forEach((book, index) => {
        const card = document.createElement('div');
        card.className = 'shelf-book-card';
        card.style.animationDelay = (index < 12) ? `${index * 0.04}s` : '0s';
        
        const isFav = favorites.includes(book.id);
        const coverId = `img-${book.id}`;
        
        card.innerHTML = `
            <div class="shelf-cover-wrapper">
                <img id="${coverId}" class="shelf-cover-img" src="" loading="lazy" alt="${book.title}">
                <button class="fav-btn-grid ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${book.id}')">
                    <svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
                </button>
            </div>
            <div class="shelf-info">
                <p class="shelf-title">${book.title}</p>
                <p class="shelf-author">${book.author}</p>
            </div>
        `;
        
        card.onclick = (e) => { 
            if(!e.target.closest('.fav-btn-grid')) {
                openModal(book); 
            }
        };

        fragment.appendChild(card);
        fetchCoverWithFallback(book.title, book.author, coverId, true);
    });
    
    resultsArea.appendChild(fragment);
}

window.toggleFavorite = function(e, bookId) {
    e.stopPropagation(); 
    const index = favorites.findIndex(id => String(id) === String(bookId));
    if (index === -1) favorites.push(bookId); 
    else favorites.splice(index, 1);
    localStorage.setItem('libnav_favs', JSON.stringify(favorites));
    performSearch(searchInput.value); 
}

prevBtn.onclick = () => { if (currentImageIndex > 0) { currentImageIndex--; updateCarousel(); } };
nextBtn.onclick = () => { if (currentImageIndex < currentImages.length - 1) { currentImageIndex++; updateCarousel(); } };
document.querySelectorAll('.close-modal').forEach(btn => btn.onclick = (e) => e.target.closest('.modal-overlay').classList.remove('active'));

if (feedbackBtn) feedbackBtn.addEventListener('click', () => { feedbackModal.classList.add('active'); closeSidebar(); });
if (feedbackForm) feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('fb-name').value;
    const email = document.getElementById('fb-email').value;
    const message = document.getElementById('fb-message').value;
    fbSubmitBtn.disabled = true; fbSubmitBtn.innerText = "Sending...";
    try {
        const response = await fetch('/api/send-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, message }) });
        if (response.ok) { fbStatus.style.color = "#4ade80"; fbStatus.innerText = "Sent!"; feedbackForm.reset(); setTimeout(() => feedbackModal.classList.remove('active'), 2000); } else throw new Error();
    } catch { fbStatus.style.color = "#ef4444"; fbStatus.innerText = "Error."; }
    finally { fbSubmitBtn.disabled = false; fbSubmitBtn.innerText = "Send"; }
});

const themeBtn = document.getElementById('theme-toggle');
const moonSVG = '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
const lightbulbSVG = '<svg viewBox="0 0 24 24"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/></svg>';

themeBtn.onclick = () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeBtn.innerHTML = isLight ? moonSVG : lightbulbSVG;
};

function loadTheme() {
    if(localStorage.getItem('theme') === 'light') { document.body.classList.add('light-mode'); themeBtn.innerHTML = moonSVG; } 
    else { themeBtn.innerHTML = lightbulbSVG; }
}

window.showSuccessScreen = function() { document.getElementById('book-modal').classList.remove('active'); document.getElementById('success-modal').classList.add('active'); }
window.closeSuccessScreen = function() { document.getElementById('success-modal').classList.remove('active'); window.location.href = window.location.pathname; }

init();
