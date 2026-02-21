/* app.js - vFinal (With Libby AI Integration) */

// --- CONFIGURATION ---
// ⚠️ SECURITY WARNING: In a real app, never store API keys in frontend code.
// For this demo/school project, it is acceptable.
const GEMINI_API_KEY = "AIzaSyCocE7oZcgoadKSGbysvVW2Svq_z7P6QcM"; 

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

// CHAT ELEMENTS
const chatOpenBtn = document.getElementById('chat-open-btn');
const chatModal = document.getElementById('chat-modal');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const chatMessages = document.getElementById('chat-messages');

let selectedGenres = new Set(); 
let favorites = JSON.parse(localStorage.getItem('libnav_favs')) || [];
const IDLE_LIMIT = 30000;
let idleTimeout;
const coverCache = {}; 
const authorCache = {}; 
let currentImages = [];
let currentImageIndex = 0;
const carouselImg = document.getElementById('carousel-img');
const prevBtn = document.getElementById('prev-img-btn');
const nextBtn = document.getElementById('next-img-btn');
const stepCounter = document.getElementById('step-counter');

async function init() {
    loadTheme();
    await LibraryDB.init(); 
    
    const urlParams = new URLSearchParams(window.location.search);
    const viewMode = urlParams.get('view'); 
    const bookId = urlParams.get('book');

    const isMobileDevice = window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobileDevice) document.body.classList.add('is-mobile-device');

    if (bookId) {
        const allBooks = LibraryDB.getBooks();
        const deepLinkedBook = allBooks.find(b => b.id == bookId);
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

// --- LIBBY CHAT LOGIC ---

chatOpenBtn.addEventListener('click', () => {
    chatModal.classList.add('active');
    chatInput.focus();
});

closeChatBtn.addEventListener('click', () => {
    chatModal.classList.remove('active');
});

sendChatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // 1. Add User Message
    addMessage(text, 'user-msg');
    chatInput.value = '';
    
    // 2. Show Loading
    const loadingId = addMessage("Thinking...", 'bot-msg loading');

    try {
        // 3. Prepare Context for Gemini
        const allBooks = LibraryDB.getBooks();
        // Create a lightweight list of books for the AI to read
        const libraryContext = allBooks.map(b => `${b.title} by ${b.author} (${b.genre})`).join("\n");

        const prompt = `
        You are Libby, a helpful AI librarian for LibNav.
        Here is the current library catalog:
        ${libraryContext}

        User Request: "${text}"

        Rules:
        1. Only recommend books from the catalog above.
        2. If the user asks for a book not in the list, apologize and suggest a similar one from the list.
        3. Keep answers short and friendly.
        4. If you recommend a book, put its exact Title in **bold**.
        `;

        // 4. Call Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();
        const aiText = data.candidates[0].content.parts[0].text;

        // 5. Remove Loading & Add Response
        document.getElementById(loadingId).remove();
        addMessage(aiText, 'bot-msg');

    } catch (error) {
        document.getElementById(loadingId).remove();
        addMessage("Sorry, my brain is offline right now! Please check the API Key.", 'bot-msg');
        console.error(error);
    }
}

function addMessage(text, className) {
    const div = document.createElement('div');
    div.className = `message ${className}`;
    div.id = 'msg-' + Date.now();
    // Parse Markdown for bolding
    div.innerHTML = marked.parse(text); 
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div.id;
}

// --- END LIBBY LOGIC ---

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
            <div class="featured-card" onclick="openModal(LibraryDB.getBooks().find(b => b.id == ${featuredBook.id}))">
                <div class="featured-cover" id="feat-cover-${featuredBook.id}"></div>
                <div class="featured-info">
                    <h2 style="font-size:1.3rem; margin-bottom:2px; line-height: 1.2;">${featuredBook.title}</h2>
                    <p style="color:var(--text-muted); font-size:0.9rem;">by ${featuredBook.author}</p>
                    <div style="margin-top:8px;"><span class="chip" style="margin:0;">${featuredBook.genre}</span></div>
                </div>
            </div>
        </div>`;

    const featCoverId = `feat-cover-${featuredBook.id}`;
    if (coverCache[featuredBook.title]) {
        const url = coverCache[featuredBook.title];
        document.getElementById(featCoverId).style.backgroundImage = `url(${url})`;
    } else {
        fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(featuredBook.title)}&author=${encodeURIComponent(featuredBook.author)}&limit=1`)
        .then(res => res.json())
        .then(data => {
            if (data.docs && data.docs[0] && data.docs[0].cover_i) {
                const url = `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-M.jpg`;
                coverCache[featuredBook.title] = url;
                const el = document.getElementById(featCoverId);
                if (el) el.style.backgroundImage = `url(${url})`;
            }
        }).catch(err => console.log(err));
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
    homeBtn.click();
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    closeSidebar();
    filterMenu.style.display = 'none';
    chatModal.classList.remove('active'); // Close chat on idle
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
        } else { genreMatch = true; }
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
        resultsArea.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--text-muted); padding:40px 20px;">No books found. Try adjusting your search!</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();

    books.forEach((book, index) => {
        const card = document.createElement('div');
        card.className = 'shelf-book-card';
        if (index < 12) { card.style.animationDelay = `${index * 0.04}s`; } 
        else { card.style.animation = 'fadeInUp 0.4s ease-out forwards'; card.style.animationDelay = '0s'; }
        
        const isFav = favorites.includes(book.id);
        const coverId = `img-${book.id}`;
        
        card.innerHTML = `
            <div class="shelf-cover-wrapper">
                <img id="${coverId}" class="shelf-cover-img" src="" loading="lazy" alt="${book.title}">
                <button class="fav-btn-grid ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, ${book.id})">
                    <svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
                </button>
            </div>
            <div class="shelf-info">
                <p class="shelf-title">${book.title}</p>
                <p class="shelf-author">${book.author}</p>
            </div>
        `;
        
        card.onclick = (e) => { if(!e.target.closest('.fav-btn-grid')) openModal(book); };
        fragment.appendChild(card);

        if (coverCache[book.title]) {
             const img = card.querySelector('.shelf-cover-img');
             const url = coverCache[book.title];
             img.src = url;
             img.onload = () => { img.style.opacity = '1'; };
        } else {
            fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}&limit=1`)
            .then(res => res.json())
            .then(data => {
                if (data.docs && data.docs[0] && data.docs[0].cover_i) {
                    const url = `https://covers.openlibrary.org/b/id/${data.docs[0].cover_i}-M.jpg`;
                    coverCache[book.title] = url;
                    const img = document.getElementById(coverId);
                    if (img) {
                        img.src = url;
                        img.onload = () => { img.style.opacity = '1'; };
                    }
                }
            }).catch(() => {}); 
        }
    });
    
    resultsArea.appendChild(fragment);
}

function toggleFavorite(e, bookId) {
    e.stopPropagation(); 
    const index = favorites.indexOf(bookId);
    if (index === -1) favorites.push(bookId); else favorites.splice(index, 1);
    localStorage.setItem('libnav_favs', JSON.stringify(favorites));
    performSearch(searchInput.value); 
}

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US';
    micBtn.addEventListener('click', () => {
        if (micBtn.classList.contains('listening')) recognition.stop();
        else recognition.start();
    });
    recognition.onstart = () => { micBtn.classList.add('listening'); searchInput.placeholder = "Listening..."; };
    recognition.onend = () => { micBtn.classList.remove('listening'); searchInput.placeholder = "Search title or author..."; };
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        searchInput.value = transcript;
        hero.classList.add('minimized');
        featuredContainer.style.display = 'none';
        homeBtn.classList.remove('home-hidden');
        performSearch(transcript);
    };
} else { micBtn.style.display = 'none'; }

document.getElementById('stats-trigger').onclick = () => {
    const books = LibraryDB.getBooks();
    const history = JSON.parse(localStorage.getItem('search_history')) || [];
    const genres = {};
    books.forEach(b => genres[b.genre] = (genres[b.genre] || 0) + 1);
    let topBook = 'No data yet';
    let maxCount = 0;
    if(history.length > 0) {
        const counts = {};
        history.forEach(h => {
            counts[h] = (counts[h] || 0) + 1;
            if(counts[h] > maxCount) { maxCount = counts[h]; topBook = h; }
        });
    }
    const favCount = favorites.length;
    let genreHTML = Object.entries(genres).map(([k,v]) => 
        `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid var(--border-color);"><span>${k}</span> <span class="text-pink">${v}</span></div>`
    ).join('');
    document.getElementById('stats-content').innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
            <div style="background:var(--bg-chip); padding:15px; border-radius:15px; text-align:center;"><p style="color:var(--text-muted); font-size:0.8rem;">Total Books</p><h2 style="font-size:1.8rem;">${books.length}</h2></div>
            <div style="background:var(--bg-chip); padding:15px; border-radius:15px; text-align:center;"><p style="color:var(--text-muted); font-size:0.8rem;">Bookmarks</p><h2 style="font-size:1.8rem; color:#ef4444;">${favCount}</h2></div>
        </div>
        <div style="margin-bottom:20px;"><p style="color:var(--text-muted); font-size:0.9rem;">👑 Most Viewed Book</p><h3 class="text-pink" style="font-size:1.3rem; margin-top:5px;">${topBook}</h3></div>
        <div style="margin-bottom:10px;"><p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:5px;">Genre Breakdown</p>${genreHTML}</div>
    `;
    document.getElementById('stats-modal').classList.add('active');
};
function updateHistory(title) { let hist = JSON.parse(localStorage.getItem('search_history')) || []; hist.push(title); localStorage.setItem('search_history', JSON.stringify(hist)); }

const bookModal = document.getElementById('book-modal');
const neighborsArea = document.getElementById('neighbors-area');
const neighborsList = document.getElementById('neighbors-list');
const qrContainer = document.getElementById('qrcode');

async function openModal(book) {
    if (!document.body.classList.contains('companion-mode-active')) {
        updateHistory(book.title);
    }

    document.getElementById('modal-title').innerText = book.title;
    document.getElementById('modal-author').innerText = book.author;
    document.getElementById('modal-book-id').innerText = book.id;
    document.getElementById('modal-genre').innerText = book.genre;

    const authorImg = document.getElementById('modal-author-pic');
    authorImg.style.display = 'none'; 
    authorImg.src = '';
    
    if (authorCache[book.author]) {
         authorImg.src = authorCache[book.author];
         authorImg.style.display = 'block';
    } else {
        fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(book.author)}`)
        .then(res => res.json())
        .then(data => {
            if(data.docs && data.docs[0] && data.docs[0].key) {
                const authorKey = data.docs[0].key; 
                const url = `https://covers.openlibrary.org/a/olid/${authorKey}-M.jpg`;
                authorCache[book.author] = url;
                authorImg.src = url;
                authorImg.style.display = 'block';
            }
        }).catch(e => console.log(e));
    }

    qrContainer.innerHTML = '';
    const deepLink = `${window.location.origin}${window.location.pathname}?book=${book.id}&view=mobile`;
    new QRCode(qrContainer, {
        text: deepLink,
        width: 120, height: 120,
        colorDark : "#0b1121", colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
    });

    currentImages = book.images || []; 
    currentImageIndex = 0; 
    updateCarousel(); 

    const allBooks = LibraryDB.getBooks();
    const neighbors = allBooks.filter(b => b.genre === book.genre && b.id !== book.id); 
    
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
    
    bookModal.classList.add('active');
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

function showSuccessScreen() { document.getElementById('book-modal').classList.remove('active'); document.getElementById('success-modal').classList.add('active'); }
function closeSuccessScreen() { document.getElementById('success-modal').classList.remove('active'); window.location.href = window.location.pathname; }

init();
