/* app.js - v4 (QR Code & Deep Linking) */

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

let selectedGenres = new Set(); 
let favorites = JSON.parse(localStorage.getItem('libnav_favs')) || [];
const IDLE_LIMIT = 30000;
let idleTimeout;

async function init() {
    loadTheme();
    await LibraryDB.init(); // Wait for DB to be ready
    
    // --- DEEP LINK CHECK ---
    // If user scanned a QR code (e.g., libnav.vercel.app/?book=5)
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('book');
    if (bookId) {
        // Find and open that book immediately
        const allBooks = LibraryDB.getBooks();
        const deepLinkedBook = allBooks.find(b => b.id == bookId);
        if (deepLinkedBook) {
            openModal(deepLinkedBook);
            // Clean URL so refresh doesn't keep opening it
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    // -----------------------

    loadFeaturedBook(); 
    performSearch('');
    resetIdleTimer();
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            filterMenu.style.display = 'none';
        }
    });
}

function loadFeaturedBook() {
    const books = LibraryDB.getBooks();
    if(books.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const storedData = JSON.parse(localStorage.getItem('libnav_daily_pick'));
    let featuredBook;
    if (storedData && storedData.date === today) {
        featuredBook = books.find(b => b.id === storedData.bookId);
    } 
    if (!featuredBook) {
        featuredBook = books[Math.floor(Math.random() * books.length)];
        localStorage.setItem('libnav_daily_pick', JSON.stringify({ date: today, bookId: featuredBook.id }));
    }
    featuredContainer.innerHTML = `
        <div class="featured-section">
            <span class="featured-label">Recommended for you</span>
            <div class="featured-card">
                <h2 style="font-size:1.4rem; margin-bottom:5px;">${featuredBook.title}</h2>
                <p style="color:var(--text-muted); font-size:0.95rem;">by ${featuredBook.author}</p>
                <div style="margin-top:10px;"><span class="chip">${featuredBook.genre}</span></div>
            </div>
        </div>`;
    featuredContainer.querySelector('.featured-card').addEventListener('click', () => { openModal(featuredBook); });
}

homeBtn.addEventListener('click', () => {
    searchInput.value = '';
    selectedGenres.clear();
    checkboxes.forEach(c => c.checked = false);
    quickBtns.forEach(b => b.classList.remove('active'));
    hero.classList.remove('minimized');
    featuredContainer.style.display = 'block';
    homeBtn.classList.add('home-hidden');
    performSearch('');
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
    searchInput.value = '';
    selectedGenres.clear();
    checkboxes.forEach(c => c.checked = false);
    quickBtns.forEach(b => b.classList.remove('active'));
    hero.classList.remove('minimized');
    featuredContainer.style.display = 'block';
    homeBtn.classList.add('home-hidden');
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
        if (selectedGenres.size > 0) { hero.classList.add('minimized'); featuredContainer.style.display = 'none'; homeBtn.classList.remove('home-hidden'); } 
        else if (searchInput.value === '') { hero.classList.remove('minimized'); featuredContainer.style.display = 'block'; homeBtn.classList.add('home-hidden'); }
        performSearch(searchInput.value);
    });
});

searchInput.addEventListener('input', (e) => {
    const term = e.target.value;
    if (term.length > 0) { hero.classList.add('minimized'); featuredContainer.style.display = 'none'; homeBtn.classList.remove('home-hidden'); } 
    else if (selectedGenres.size === 0) { hero.classList.remove('minimized'); featuredContainer.style.display = 'block'; homeBtn.classList.add('home-hidden'); }
    performSearch(term);
});

function performSearch(term) {
    let allBooks = LibraryDB.getBooks();
    allBooks.sort((a, b) => a.title.localeCompare(b.title));
    let matches = allBooks.filter(book => {
        let textMatch = true;
        if (term && term.trim() !== '') {
            const query = term.toLowerCase().trim().split(" ");
            const title = book.title.toLowerCase();
            const author = book.author.toLowerCase();
            textMatch = query.every(w => title.includes(w) || author.includes(w));
        }
        let genreMatch = false;
        if (selectedGenres.has('All') || selectedGenres.size === 0) genreMatch = true;
        else {
            if (selectedGenres.has('Favorites') && favorites.includes(book.id)) genreMatch = true;
            if (selectedGenres.has(book.genre)) genreMatch = true;
        }
        if(selectedGenres.has('Favorites') && !favorites.includes(book.id)) return false;
        return textMatch && genreMatch;
    });
    renderResults(matches);
}

function renderResults(books) {
    resultsArea.innerHTML = '';
    if (books.length === 0 && (searchInput.value !== '' || selectedGenres.size > 0)) {
        resultsArea.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:20px;">No books found.</div>';
        return;
    }
    books.forEach((book, index) => {
        const isFav = favorites.includes(book.id);
        const div = document.createElement('div');
        div.className = 'book-card';
        div.style.animationDelay = `${index * 0.05}s`;
        div.innerHTML = `
            <div class="book-info" style="flex:1;">
                <h3>${book.title}</h3>
                <p style="color:var(--text-muted); font-size:0.9rem;">by ${book.author}</p>
                <div style="margin-top:5px;"><span class="chip">${book.genre}</span><span style="color:var(--text-muted); font-size:0.85rem; margin-left:10px;">Shelf ${book.shelf}</span></div>
            </div>
            <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, ${book.id})"><svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg></button>`;
        div.addEventListener('click', (e) => { if(!e.target.closest('.fav-btn')) openModal(book); });
        resultsArea.appendChild(div);
    });
}

function toggleFavorite(e, bookId) {
    e.stopPropagation(); 
    const index = favorites.indexOf(bookId);
    if (index === -1) favorites.push(bookId); else favorites.splice(index, 1);
    localStorage.setItem('libnav_favs', JSON.stringify(favorites));
    performSearch(searchInput.value);
}

// --- MODAL & QR CODE ---
const bookModal = document.getElementById('book-modal');
const neighborsArea = document.getElementById('neighbors-area');
const neighborsList = document.getElementById('neighbors-list');
const mapContainer = document.getElementById('map-container');
const qrContainer = document.getElementById('qrcode');

async function openModal(book) {
    updateHistory(book.title);
    document.getElementById('modal-title').innerText = book.title;
    document.getElementById('modal-author').innerText = book.author;
    document.getElementById('modal-shelf').innerText = book.shelf;
    document.getElementById('modal-genre').innerText = book.genre;
    
    // 1. Generate QR Code
    qrContainer.innerHTML = ''; // Clear old QR
    // Generate URL: e.g. https://libnav.vercel.app/?book=12
    const deepLink = `${window.location.origin}${window.location.pathname}?book=${book.id}`;
    new QRCode(qrContainer, {
        text: deepLink,
        width: 90,
        height: 90,
        colorDark : "#0b1121",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.L
    });

    // 2. Load Map
    try {
        const response = await fetch('map.svg');
        const svgText = await response.text();
        mapContainer.innerHTML = svgText;
        const shelfId = `shelf-${book.shelf}`;
        const targetShelf = document.getElementById(shelfId);
        if (targetShelf) {
            targetShelf.style.fill = 'var(--primary-pink)';
            targetShelf.style.filter = 'drop-shadow(0 0 10px var(--primary-pink))';
            targetShelf.setAttribute('stroke', '#fff');
            targetShelf.innerHTML = `<animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />`;
        }
    } catch (e) { console.error("Map Error", e); mapContainer.innerHTML = `<p style="color:var(--text-muted)">Map unavailable</p>`; }

    // 3. Neighbors
    const allBooks = LibraryDB.getBooks();
    const neighbors = allBooks.filter(b => b.shelf === book.shelf && b.id !== book.id);
    neighborsList.innerHTML = '';
    if (neighbors.length > 0) {
        neighborsArea.style.display = 'block';
        neighbors.forEach(n => {
            const chip = document.createElement('span');
            chip.className = 'neighbor-chip';
            chip.innerText = n.title;
            chip.onclick = () => openModal(n);
            neighborsList.appendChild(chip);
        });
    } else neighborsArea.style.display = 'none';
    
    bookModal.classList.add('active');
}
document.querySelectorAll('.close-modal').forEach(btn => btn.onclick = (e) => e.target.closest('.modal-overlay').classList.remove('active'));
function updateHistory(title) { let hist = JSON.parse(localStorage.getItem('search_history')) || []; hist.push(title); localStorage.setItem('search_history', JSON.stringify(hist)); }

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
document.getElementById('stats-trigger').onclick = () => { /* Stats logic kept same */ document.getElementById('stats-modal').classList.add('active'); };
const themeBtn = document.getElementById('theme-toggle');
themeBtn.onclick = () => { document.body.classList.toggle('light-mode'); localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark'); loadTheme(); };
function loadTheme() { themeBtn.innerHTML = document.body.classList.contains('light-mode') ? '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>' : '<svg viewBox="0 0 24 24"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.63 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/></svg>'; }
init();
