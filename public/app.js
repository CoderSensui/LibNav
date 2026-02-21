/* app.js - vFinal (Fixed Chat & Bug-Free) */

// ⚠️ PASTE YOUR API KEY HERE:
const GEMINI_API_KEY = "AIzaSyA64z6Ym8mRh3CxG2eNPeDFgG8kmp0xsvY"; 

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
    setTimeout(() => chatInput.focus(), 100);
});

closeChatBtn.addEventListener('click', () => {
    chatModal.classList.remove('active');
});

sendChatBtn.addEventListener('click', () => {
    sendMessage();
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return; // Do nothing if input is empty

    // 1. Show user message
    addMessage(text, 'user-msg');
    chatInput.value = '';
    
    // 2. Show "Thinking..." loading message
    const loadingId = addMessage("Thinking...", 'bot-msg loading');

    try {
        // 3. Prepare Context for AI
        const allBooks = LibraryDB.getBooks();
        const libraryContext = allBooks.map(b => `- ${b.title} by ${b.author} (${b.genre})`).join("\n");

        const promptText = `You are Libby, a helpful AI librarian for LibNav.
Here is the current library catalog:
${libraryContext}

User Request: "${text}"

Rules:
1. Only recommend books from the catalog above.
2. If the user asks for a book not in the list, apologize and suggest a similar one from the list.
3. Keep answers short and friendly.
4. If you recommend a book, put its exact Title in **bold**.`;

        const safeApiKey = GEMINI_API_KEY.trim();

        if (!safeApiKey || safeApiKey === "PASTE_YOUR_API_KEY_HERE") {
            throw new Error("API Key is missing! Please add it to app.js");
        }

        // 4. API Call
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${safeApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ 
                    role: "user", 
                    parts: [{ text: promptText }] 
                }] 
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("API Details:", data);
            alert("Google API Error: " + (data.error?.message || "Unknown Error"));
            throw new Error(data.error?.message || "API Connection Failed");
        }

        const aiText = data.candidates[0].content.parts[0].text;

        // 5. Remove Loading & Show Result
        document.getElementById(loadingId).remove();
        addMessage(aiText, 'bot-msg');

    } catch (error) {
        document.getElementById(loadingId).remove();
        addMessage("Sorry, my brain is offline right now! Error: " + error.message, 'bot-msg');
        console.error("Libby Error:", error);
    }
}

function addMessage(text, className) {
    const div = document.createElement('div');
    div.className = `message ${className}`;
    div.id = 'msg-' + Date.now();
    
    // Safely try to parse markdown (bold text), fallback to plain text if library isn't loaded
    try {
        if (typeof marked !== 'undefined') {
            div.innerHTML = marked.parse(text); 
        } else {
            div.innerText = text;
        }
    } catch(e) {
        div.innerText = text;
    }
    
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
    chatModal.classList.remove('active');
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
        resultsArea.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:var(--text-muted); padding:40px 20px;">No books found. Try adjusting your search!</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();

    books.forEach((book, index) => {
        const card = document.createElement('div');
        card.className = 'shelf-book-card';
        
        if (index < 12) {
            card.style.animationDelay = `${index * 0.04}s`;
        } else {
            card.style.animation = 'fadeInUp 0.4s ease-out forwards';
            card.style.animationDelay = '0s'; 
        }
        
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
        
        card.onclick = (e) => { 
            if(!e.target.closest('.fav-btn-grid')) openModal(book); 
        };
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
            <d
