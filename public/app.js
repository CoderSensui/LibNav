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
    const IDLE_LIMIT = 120000;
    let idleTimeout;
    const coverCache = {};
    let currentImages = [];
    let currentImageIndex = 0;
    let currentGenre = "";
    let currentSort = 'default';
    let recentSearches = JSON.parse(localStorage.getItem('libnav_recent')) || [];


    const GENRE_COLORS = {
        'Fiction': { bg: 'rgba(167,139,250,0.18)', color: '#a78bfa', border: 'rgba(167,139,250,0.3)' },
        'Filipiniana': { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: 'rgba(251,191,36,0.3)' },
        'Filipiniana Reference': { bg: 'rgba(251,146,60,0.15)', color: '#fb923c', border: 'rgba(251,146,60,0.3)' },
        'Science/Math': { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
        'Religion': { bg: 'rgba(74,222,128,0.15)', color: '#4ade80', border: 'rgba(74,222,128,0.3)' },
    };
    function getGenreStyle(genre) {
        return GENRE_COLORS[genre] || { bg: 'var(--primary-light)', color: 'var(--primary)', border: 'rgba(255,158,181,0.3)' };
    }

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

    function showLoaderStep(step, pct) {
        document.querySelectorAll('.loader-step').forEach((el, i) => {
            el.classList.toggle('active', i < step);
            el.classList.toggle('done', i < step - 1);
        });
        const bar = document.getElementById('loader-bar');
        if(bar) bar.style.width = pct + '%';
    }

    function hideLoader() {
        const loader = document.getElementById('app-loader');
        if(!loader) return;
        loader.classList.add('loader-out');
        setTimeout(() => { loader.style.display = 'none'; }, 600);
    }

    async function init() {
        const saved = localStorage.getItem('theme') || 'dark';
        applyTheme(saved);

        showLoaderStep(1, 15);
        await new Promise(r => setTimeout(r, 300));

        try {
            showLoaderStep(1, 30);
            await Promise.race([
                LibraryDB.init(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000))
            ]);
            showLoaderStep(2, 55);
        } catch(e) {
            showLoaderStep(2, 55);
        }

        await new Promise(r => setTimeout(r, 250));
        showLoaderStep(3, 75);
        await new Promise(r => setTimeout(r, 200));
        showLoaderStep(4, 92);

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

        showLoaderStep(4, 100);
        await new Promise(r => setTimeout(r, 180));
        hideLoader();
        renderIcons();

        setTimeout(() => {
            const gif = new Image();
            gif.src = 'https://media.tenor.com/N_8Yk_wO8qIAAAAi/minion-running.gif';
        }, 5000);
    }


    function animateCount(el, from, to, duration) {
        const start = performance.now();
        const update = (now) => {
            const p = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            el.innerText = Math.round(from + (to - from) * ease);
            if(p < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    function switchSection(sectionId, fromCategory = false) {
        document.querySelectorAll('.nav-tab').forEach(i => i.classList.remove('active'));
        const mobileTab = document.querySelector(`.nav-tab[data-section="${sectionId}"]`);
        if(mobileTab) mobileTab.classList.add('active');

        document.querySelectorAll('.desk-nav-item').forEach(d => d.classList.remove('active'));
        const deskTab = document.querySelector(`.desk-nav-item[data-section="${sectionId}"]`);
        if(deskTab) deskTab.classList.add('active');

        const current = document.querySelector('.content-section.active');
        const next = document.getElementById(`${sectionId}-section`);
        if(current && current !== next) {
            current.classList.add('section-exit');
            setTimeout(() => { current.classList.remove('active', 'section-exit'); }, 180);
            setTimeout(() => { next.classList.add('active'); }, 160);
        } else {
            document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
            next.classList.add('active');
        }

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

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if(e.target === overlay) overlay.style.display = 'none';
        });
    });

    bookModal.addEventListener('click', (e) => {
        if(e.target === bookModal) bookModal.style.display = 'none';
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

  document.getElementById('admin-password').addEventListener('keydown', (e) => {
        if(e.key === 'Enter') document.getElementById('admin-auth-btn').click();
    });

  document.getElementById('admin-auth-btn').onclick = async () => {
        const btn = document.getElementById('admin-auth-btn');
        const passInput = document.getElementById('admin-password').value;

        btn.innerHTML = 'Verifying...';
        btn.disabled = true;

        const isValid = await LibraryDB.verifyAdminPassword(passInput);

        if (isValid) {
            const sessionToken = await LibraryDB.createAdminSession();
            if (!sessionToken) {
                showPopup("Error", "Could not create session. Check your connection.", null, false);
                btn.innerHTML = 'Login';
                btn.disabled = false;
                return;
            }
            localStorage.setItem('libnav_admin_token', sessionToken);

            const maintOverlay = document.getElementById('maintenance-overlay');
            if (maintOverlay) maintOverlay.style.display = 'none';

            document.getElementById('admin-login-screen').style.display = 'none';
            document.getElementById('admin-dashboard').style.display = 'block';
            document.getElementById('admin-password').value = '';
            updateImageInputs();
            renderAdminList();
        } else {
            showPopup("Access Denied", "Incorrect Security Key.", null, false);
        }

        btn.innerHTML = 'Login';
        btn.disabled = false;
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

    let undoDeleteTimer = null;
    window.handleDelete = function(id) {
        const books = LibraryDB.getBooks();
        const bookToDelete = books.find(b => String(b.id) === String(id));
        if (!bookToDelete) return;

        LibraryDB.books = books.filter(b => String(b.id) !== String(id));
        renderAdminList();
        performSearch(searchInput.value);

        if (undoDeleteTimer) clearTimeout(undoDeleteTimer);
        const undoBar = document.getElementById('undo-delete-bar');
        const undoTitleEl = document.getElementById('undo-book-title');
        if (undoBar) {
            if (undoTitleEl) undoTitleEl.textContent = `"${bookToDelete.title}"`;
            const fill = undoBar.querySelector('.undo-bar-fill');
            if (fill) {
                fill.style.transition = 'none';
                fill.style.width = '100%';
                setTimeout(() => { fill.style.transition = 'width 5s linear'; fill.style.width = '0%'; }, 30);
            }
            undoBar.classList.add('visible');
            const undoBtn = document.getElementById('undo-delete-btn');
            if (undoBtn) {
                undoBtn.onclick = () => {
                    clearTimeout(undoDeleteTimer);
                    undoBar.classList.remove('visible');
                    LibraryDB.books.push(bookToDelete);
                    LibraryDB.books.sort((a, b) => a.id - b.id);
                    renderAdminList();
                    performSearch(searchInput.value);
                };
            }
            undoDeleteTimer = setTimeout(async () => {
                undoBar.classList.remove('visible');
                await LibraryDB.saveToCloud();
            }, 5000);
        }
    };
    document.getElementById('factory-reset-btn').onclick = async () => { showPopup("Defense Mode", "Reset Stats?", async () => { await LibraryDB.factoryReset(); window.location.reload(); }, true); };

    document.getElementById('admin-logout-btn').onclick = async () => {
        showPopup("Logout", "End your admin session?", async () => {
            const token = localStorage.getItem('libnav_admin_token');
            await LibraryDB.destroyAdminSession(token);
            adminModal.style.display = 'none';
            document.getElementById('admin-login-screen').style.display = 'block';
            document.getElementById('admin-dashboard').style.display = 'none';
        }, true);
    };

    function loadFeaturedBook() {
        const books = LibraryDB.getBooks(); if (books.length === 0) return;
        const idx = Math.abs(new Date().toDateString().split('').reduce((a,b)=>a+(b.charCodeAt(0)),0)) % books.length; const b = books[idx];
        const isFav = favorites.some(id => String(id) === String(b.id));
        const allBooks = LibraryDB.getBooks();
        const maxViews = allBooks.reduce((mx, x) => Math.max(mx, x.views || 0), 0);
        const trendingId = maxViews > 0 ? allBooks.find(x => x.views === maxViews)?.id : null;
        const gs = getGenreStyle(b.genre);
        const isHot = b.id === trendingId;
        featuredContainer.innerHTML = `
            <div class="featured-wrap">
                <span class="feat-tag"><i data-lucide="star"></i> Daily Global Pick</span>
                <div class="featured-card book-card" style="--feat-glow: ${gs.bg};" onclick="openModalById('${b.id}')">
                    <div class="feat-img-wrap skeleton">
                        ${isHot ? '<div class="hot-badge"><i data-lucide="flame" style="width:12px;height:12px;fill:white;"></i> HOT</div>' : ''}
                        <img id="fc-img" src="" style="opacity: 0; transition: opacity 0.4s ease;">
                        <button class="fav-btn ${isFav?'active':''}" onclick="toggleFavorite(event,'${b.id}')"><i data-lucide="bookmark"></i></button>
                    </div>
                    <div class="feat-info">
                        <h2>${b.title}</h2><p>${b.author}</p>
                        <span class="book-badge" style="background:${gs.bg};color:${gs.color};border:1px solid ${gs.border};">${b.genre}</span>
                    </div>
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
        const wrap = el.closest('.bm-author-avatar');
        const fallback = generateInitialsImage(author);
        el.src = fallback;
        if(wrap) wrap.classList.remove('skeleton');
        el.onerror = function() { this.src = fallback; };
        fetch(`https://openlibrary.org/search/authors.json?q=${encodeURIComponent(author)}`).then(r=>r.json()).then(d=>{
            if(d.docs?.[0]?.key) {
                const url = `https://covers.openlibrary.org/a/olid/${d.docs[0].key}-M.jpg?default=false`;
                el.src = url;
            }
        }).catch(() => {});
    }

    function applyCover(url, elId, isImgTag) {
        const el = document.getElementById(elId); if(!el) return;
        if(isImgTag) { el.src = url; el.onload = () => { el.style.opacity = '1'; const wrap = el.closest('.umh-cover-wrap') || el.closest('.skeleton'); if(wrap) wrap.classList.remove('skeleton'); }; }
        else { el.style.backgroundImage = `url(${url})`; }
    }

window.openModalById = function(id) { const b = LibraryDB.getBooks().find(x => String(x.id) === String(id)); if(b) openModal(b); };

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
    let swipeDist = 0;

    if(carouselWrapper) {
        carouselWrapper.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
            swipeDist = 0;
        }, {passive: true});
        carouselWrapper.addEventListener('touchend', e => {
            touchEndX = e.changedTouches[0].screenX;
            swipeDist = Math.abs(touchEndX - touchStartX);
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

    const openZoomModal = (e) => {
        if (e) e.stopPropagation();
        if(currentImages && currentImages.length > 0) {
            zoomedImage.src = currentImages[currentImageIndex];
            zoomModal.style.display = 'flex';

            const pHint = document.getElementById('pinch-hint');
            if (pHint && window.innerWidth < 850) {
                pHint.style.display = 'flex';
                pHint.style.animation = 'none';
                pHint.offsetHeight;
                pHint.style.animation = 'swipeFade 3.5s ease-in-out forwards';
            }
        }
    };

    if(zoomTrigger) zoomTrigger.onclick = openZoomModal;

    if(carouselImg) {
        carouselImg.onclick = (e) => { if (swipeDist < 10) openZoomModal(e); };
    }

    document.getElementById('close-zoom-btn').onclick = () => { zoomModal.style.display = 'none'; resetFullScreenZoom(); };
    zoomModal.onclick = (e) => { if(e.target === zoomModal || e.target === zoomedImage) { zoomModal.style.display = 'none'; resetFullScreenZoom(); } };


    async function openModal(book) {
        bookModal.style.display = 'flex'; LibraryDB.incrementView(book.id);
        document.getElementById('modal-book-id').innerText = book.id;

 const modalBox = bookModal.querySelector('.modal-box');
        const gs = getGenreStyle(book.genre);
        
        modalBox.style.setProperty('--dynamic-color', gs.color);
        modalBox.classList.add('dynamic-theme');

        const coverBg = modalBox.querySelector('.bm-cover-bg');
        if (coverBg) {
            coverBg.style.background = `linear-gradient(160deg, ${gs.bg} 0%, transparent 80%)`;
        }
        
        document.getElementById('umh-title').innerText = book.title;
        const authorNameEl = document.getElementById('umh-author-name');
        authorNameEl.innerText = book.author;
        authorNameEl.style.cursor = 'pointer';
        authorNameEl.title = `Search books by ${book.author}`;
        authorNameEl.classList.add('clickable-author');
        authorNameEl.onclick = (e) => {
            e.stopPropagation();
            bookModal.style.display = 'none';
            searchInput.value = book.author;
            if(searchClearBtn) searchClearBtn.style.display = 'flex';
            hero.style.display = 'none';
            featuredContainer.style.display = 'none';
            selectedGenres.clear();
            saveRecentSearch(book.author);
            performSearch(book.author);
            switchSection('home', true);
            if(navigator.vibrate) navigator.vibrate(20);
        };
        const genreEl = document.getElementById('umh-genre');
        genreEl.innerText = book.genre;
        const badge = genreEl.closest('.bm-genre-badge');
        if(badge) {
            badge.style.background = gs.bg;
            badge.style.color = gs.color;
            badge.style.borderColor = gs.border;
            badge.style.cursor = 'pointer';
            badge.title = `Browse ${book.genre}`;
            badge.onclick = (e) => {
                e.stopPropagation();
                bookModal.style.display = 'none';
                selectedGenres.clear();
                selectedGenres.add(book.genre);
                searchInput.value = '';
                if(searchClearBtn) searchClearBtn.style.display = 'none';
                hero.style.display = 'none';
                featuredContainer.style.display = 'none';
                document.querySelectorAll('.menu-item').forEach(b => {
                    b.classList.toggle('active', b.dataset.genre === book.genre);
                });
                performSearch('');
                switchSection('home', true);
                if(navigator.vibrate) navigator.vibrate(20);
            };
        }
        const viewsEl = document.getElementById('bm-views-count');
        if(viewsEl) {
            const viewVal = (book.views || 0) + 1;
            viewsEl.innerText = viewVal;
            animateCount(viewsEl, 0, viewVal, 800);
        }

        const cover = document.getElementById('umh-book-cover');
        if(cover) {
            cover.src = ''; cover.style.opacity = '0';
            const wrap = cover.closest('.umh-cover-wrap');
            if(wrap) wrap.classList.add('skeleton');
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
        const showQrBtnDesk = document.getElementById('show-qr-btn-desk');
        if(showQrBtnDesk) showQrBtnDesk.onclick = () => { qrModal.style.display = 'flex'; };
        const topShare = document.getElementById('top-share-btn');
        if (topShare) topShare.onclick = () => {
             const url = `${window.location.origin}${window.location.pathname}?book=${book.id}`;
             navigator.clipboard.writeText(`Check out "${book.title}" on LibNav: ${url}`);
             const toast = document.getElementById('toast-notification');
             toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000);
        };

        const related = LibraryDB.getBooks().filter(b => b.genre === book.genre && b.id !== book.id).slice(0, 25);
        const relatedContainer = document.getElementById('related-shelf');
        const relatedShelf = relatedContainer?.closest('.bm-shelf');
        const relatedHeading = relatedShelf?.querySelector('h3');
        if(relatedHeading) {
            relatedHeading.innerHTML = related.length > 0
                ? `Also in this section <span class="related-count">${related.length} more in ${book.genre}</span>`
                : 'Also in this section';
        }
        if (relatedContainer) {
            relatedContainer.innerHTML = '';
            if(related.length === 0) {
                relatedContainer.innerHTML = `<p class="related-empty">No other books in this section yet.</p>`;
                if(relatedShelf) relatedShelf.style.display = 'block';
            } else {
                if(relatedShelf) relatedShelf.style.display = 'block';
                related.forEach(rBook => {
                    const div = document.createElement('div');
                    div.className = 'related-card skeleton';
                    div.innerHTML = `<img id="rel-${rBook.id}" src="" style="opacity:0" onload="this.style.opacity=1;this.parentElement.classList.remove('skeleton')">`;
                    div.onclick = () => openModal(rBook);
                    relatedContainer.appendChild(div);
                    fetchCoverWithFallback(rBook.title, rBook.author, `rel-${rBook.id}`, true);
                });
            }
        }

        currentImages = book.images || [];
        currentImageIndex = 0;
        currentGenre = book.genre;
        updateCarousel();

        const relGrid = document.getElementById('related-shelf');
        const relWrap = document.getElementById('related-scroll-wrap');
        const relPrev = document.getElementById('rel-prev-btn');
        const relNext = document.getElementById('rel-next-btn');
        if(relGrid && relPrev && relNext) {
            const scrollAmt = 240;
            relPrev.onclick = () => relGrid.scrollBy({ left: -scrollAmt, behavior: 'smooth' });
            relNext.onclick = () => relGrid.scrollBy({ left: scrollAmt, behavior: 'smooth' });
            const updateRelArrows = () => {
                if(relPrev) relPrev.disabled = relGrid.scrollLeft <= 0;
                if(relNext) relNext.disabled = relGrid.scrollLeft + relGrid.clientWidth >= relGrid.scrollWidth - 4;
                if(relWrap) {
                    relWrap.classList.toggle('can-scroll-left', relGrid.scrollLeft > 10);
                    relWrap.classList.toggle('no-more-right', relGrid.scrollLeft + relGrid.clientWidth >= relGrid.scrollWidth - 10);
                }
            };
            relGrid.addEventListener('scroll', updateRelArrows, { passive: true });
            setTimeout(updateRelArrows, 300);
        }

        const hint = document.getElementById('swipe-hint');
        const tHint = document.getElementById('tap-hint');

        if(window.innerWidth < 850) {
            if(hint) {
                hint.style.display = 'flex';
                hint.style.opacity = '1';
                hint.style.animation = 'none';
                hint.offsetHeight;
                hint.style.animation = 'swipeFade 2.2s ease-in-out forwards';
            }
            if(tHint) {
                tHint.style.display = 'none';
                tHint.style.opacity = '0';
                setTimeout(() => {
                    if(tHint) {
                        tHint.style.display = 'flex';
                        tHint.style.animation = 'none';
                        tHint.offsetHeight;
                        tHint.style.animation = 'swipeFade 2.2s ease-in-out forwards';
                    }
                }, 2400);
            }
        } else {
            if(hint) hint.style.display = 'none';
            if(tHint) tHint.style.display = 'none';
        }
        renderIcons();
    }

    function updateCarousel() {
        const aa = document.getElementById('mobile-action-area');
        const dotsContainer = document.getElementById('carousel-dots');
        const cWrapper = document.getElementById('carousel-wrapper');
        // Desktop row: CSS keeps it visible on ≥850px, hidden on mobile — JS only controls "I Found It!" inside it
        const foundBtnDesk = document.getElementById('bm-found-btn-desk');

        if (currentImages && currentImages.length > 0) {
            if (cWrapper) cWrapper.classList.add('skeleton');
            carouselImg.style.opacity = '0';
            carouselImg.style.transition = 'opacity 0.3s ease, transform 0.1s ease-out';
            carouselImg.onload = () => {
                carouselImg.style.opacity = '1';
                if (cWrapper) cWrapper.classList.remove('skeleton');
            };

            carouselImg.src = currentImages[currentImageIndex];
            carouselImg.style.display = 'block';

            if (stepCounter) stepCounter.innerText = `Step ${currentImageIndex + 1} of ${currentImages.length}`;
            if (prevBtn) { prevBtn.style.opacity = currentImageIndex === 0 ? "0.3" : "1"; prevBtn.style.pointerEvents = currentImageIndex === 0 ? "none" : "auto"; }
            if (nextBtn) { nextBtn.style.opacity = currentImageIndex === currentImages.length - 1 ? "0.3" : "1"; nextBtn.style.pointerEvents = currentImageIndex === currentImages.length - 1 ? "none" : "auto"; }

            if (dotsContainer) {
                dotsContainer.innerHTML = currentImages.map((_, i) =>
                    `<span class="dot ${i === currentImageIndex ? 'active' : ''}"></span>`
                ).join('');
            }

            const isLastStep = currentImageIndex === currentImages.length - 1;

            // MOBILE: show the "I Found It!" row only on last step (CSS hides this row on desktop)
            if (aa) aa.style.display = isLastStep ? 'flex' : 'none';

            // DESKTOP: "Send Map to Mobile" is always visible (CSS handles it).
            // Only toggle the "I Found It!" button inside that row.
            if (foundBtnDesk) foundBtnDesk.style.display = isLastStep ? 'flex' : 'none';

        } else {
            // No images — hide all action areas
            carouselImg.style.display = 'none';
            if (stepCounter) stepCounter.innerText = "No map available";
            if (dotsContainer) dotsContainer.innerHTML = '';
            if (aa) aa.style.display = 'none';
            if (foundBtnDesk) foundBtnDesk.style.display = 'none';
            if (cWrapper) cWrapper.classList.remove('skeleton');
        }
    }

    const recentDropdown = document.getElementById('recent-searches-dropdown');
    const searchClearBtn = document.getElementById('search-clear-btn');

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
        autocompleteDropdown.style.display = 'none';
        if(searchClearBtn) searchClearBtn.style.display = 'flex';
        hero.style.display = 'none';
        featuredContainer.style.display = 'none';
        performSearch(query);
        saveRecentSearch(query);
    };

    searchInput.addEventListener('focus', () => {
        if (!searchInput.value.trim() && recentSearches.length > 0 && recentDropdown) {
            renderRecentSearches();
            recentDropdown.style.display = 'block';
        }
    });

    document.addEventListener('click', (e) => {
        const inSearch = searchInput.contains(e.target);
        const inAuto = autocompleteDropdown.contains(e.target);
        const inRecent = recentDropdown && recentDropdown.contains(e.target);
        const inFilter = filterMenu.contains(e.target) || filterToggle.contains(e.target);
        if (!inSearch && !inAuto) autocompleteDropdown.style.display = 'none';
        if (!inSearch && !inRecent) { if(recentDropdown) recentDropdown.style.display = 'none'; }
        if (!inFilter) filterMenu.style.display = 'none';
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            autocompleteDropdown.style.display = 'none';
            if(recentDropdown) recentDropdown.style.display = 'none';
        }, 180);
    });

    searchInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') {
            autocompleteDropdown.style.display = 'none';
            if(recentDropdown) recentDropdown.style.display = 'none';
            searchInput.blur();
            const t = searchInput.value.trim();
            if(t) { saveRecentSearch(t); performSearch(t); }
        }
        if(e.key === 'Escape') {
            autocompleteDropdown.style.display = 'none';
            if(recentDropdown) recentDropdown.style.display = 'none';
            searchInput.blur();
        }
    });

    searchInput.addEventListener('mouseleave', () => {
        if(document.activeElement !== searchInput) {
            autocompleteDropdown.style.display = 'none';
            if(recentDropdown) recentDropdown.style.display = 'none';
        }
    });

    searchInput.addEventListener('change', () => saveRecentSearch(searchInput.value));

    if(searchClearBtn) {
        searchClearBtn.onclick = () => {
            searchInput.value = '';
            searchClearBtn.style.display = 'none';
            autocompleteDropdown.style.display = 'none';
            if(recentDropdown) recentDropdown.style.display = 'none';
            filterMenu.style.display = 'none';
            if(selectedGenres.size === 0 || selectedGenres.has('All')) {
                hero.style.display = 'block'; featuredContainer.style.display = 'block';
            }
            resultsArea.innerHTML = '';
            searchInput.focus();
            if(navigator.vibrate) navigator.vibrate(30);
        };
    }

    searchInput.addEventListener('input', (e) => {
        const t = e.target.value.toLowerCase().trim();
        if(searchClearBtn) searchClearBtn.style.display = t.length > 0 ? 'flex' : 'none';
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
    bttBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

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
        if(currentSort === 'A-Z') matches.sort((a, b) => a.title.localeCompare(b.title));
        else if(currentSort === 'Z-A') matches.sort((a, b) => b.title.localeCompare(a.title));
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

            const gs = getGenreStyle(book.genre);
            card.innerHTML = `
                <div class="cover-box skeleton">
                    ${badgesHtml}
                    <img id="${coverId}" data-title="${book.title}" data-author="${book.author}" src="">
                    <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(event, '${book.id}')"><i data-lucide="bookmark"></i></button>
                </div>
                <div class="book-info"><strong>${titleHtml}</strong><small style="color:${gs.color}">${book.genre}</small></div>
            `;
            card.style.animationDelay = `${i * 0.045}s`;
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
            if(navigator.vibrate) navigator.vibrate(60);
            btn.classList.add('fav-pop');
            setTimeout(() => btn.classList.remove('fav-pop'), 400);
        } else {
            favorites.splice(index, 1);
            if(navigator.vibrate) navigator.vibrate(30);
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

    let ssClockInterval = null;

    function startScreensaverClock() {
        const el = document.getElementById('screensaver-clock');
        if(!el) return;
        const tick = () => {
            const now = new Date();
            el.innerText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        };
        tick();
        ssClockInterval = setInterval(tick, 1000);
    }

    function stopScreensaverClock() {
        clearInterval(ssClockInterval);
        ssClockInterval = null;
    }

    async function fetchScreensaverFact() {
        const factEl = document.getElementById('screensaver-fact');
        if(!factEl) return;
        factEl.innerText = 'Loading a fun fact...';
        try {
            const res = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random');
            const data = await res.json();
            factEl.innerText = data.text;
        } catch(e) {
            const fallbacks = [
                'Reading for just 6 minutes can reduce stress by up to 68%.',
                'The word "library" comes from the Latin "liber," meaning book.',
                'The Library of Congress holds over 170 million items.',
                'Reading before bed improves sleep quality and memory retention.',
                'A bookworm is actually a real insect that eats through books!'
            ];
            factEl.innerText = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }
    }

    function resetIdleTimer() {
        clearTimeout(idleTimeout);
        if(screensaver.style.display !== 'none') {
            screensaver.style.display = 'none';
            stopScreensaverClock();
        }
        idleTimeout = setTimeout(() => {
            if(!document.body.classList.contains('companion-mode-active')) {
                switchSection('home');
                document.querySelectorAll('.modal-overlay').forEach(m=>m.style.display='none');
                screensaver.style.display = 'flex';
                fetchScreensaverFact();
                startScreensaverClock();
                renderIcons();
            }
        }, IDLE_LIMIT);
    }

    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(evt =>
        document.addEventListener(evt, resetIdleTimer, true)
    );
    window.onload = resetIdleTimer;

    let uptimeInterval = null;

    const openStats = async () => {
        const statsModal = document.getElementById('stats-modal');
        const statsBox = statsModal?.querySelector('.modal-box');
        if (!statsModal || !statsBox) return;

        // Show modal immediately with spinner while fetching live Firebase data
        statsModal.style.display = 'flex';
        const savedCloseBtn = statsBox.querySelector('.close-btn')?.outerHTML || '';
        statsBox.innerHTML = `
            ${savedCloseBtn}
            <div class="modal-loading-state">
                <div class="modal-loader-ring"></div>
                <p>Fetching live data...</p>
            </div>`;
        // Re-wire close button
        statsBox.querySelector('.close-btn')?.addEventListener('click', () => { statsModal.style.display = 'none'; });

        const books = LibraryDB.getBooks();
        const ratings = LibraryDB.getRatings() || [];

        // Await the LIVE count from Firebase — this is the only source of truth
        const globalHelpedCount = await getHelpedCount();

        const mostViewed = books.reduce((a, b) => (a.views || 0) > (b.views || 0) ? a : b, { title: "None", views: 0, author: "N/A", genre: "" });
        const newest = books.reduce((a, b) => (a.id > b.id) ? a : b, { title: "None", author: "N/A" });
        const genres = {};
        books.forEach(b => genres[b.genre] = (genres[b.genre] || 0) + 1);
        const sortedGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]);
        const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + parseInt(b), 0) / ratings.length).toFixed(1) : "0.0";
        const avgNum = parseFloat(avg);
        const avgPct = (avgNum / 5) * 100;

        statsBox.classList.add('stats-layout');
        statsBox.innerHTML = `
            <button class="close-btn"><i data-lucide="x"></i></button>
            <div id="stats-content">
            <div class="sn-header">
                <div class="sn-title-block">
                    <span class="sn-eyebrow">LibNav Analytics</span>
                    <h2 class="sn-title">Dashboard</h2>
                </div>
                <div class="sn-uptime">
                    <span class="sn-live-dot"></span>
                    <span id="uptime-display">...</span>
                </div>
            </div>

            <div class="sn-hero">
                <div class="sn-hero-label"><i data-lucide="flame"></i> Trending Right Now</div>
                <div class="sn-hero-views">${mostViewed.views || 0}</div>
                <div class="sn-hero-views-sub">total views</div>
                <div class="sn-hero-divider"></div>
                <h3 class="sn-hero-title">${mostViewed.title || "No Data"}</h3>
                <p class="sn-hero-author">${mostViewed.author || ""}</p>
                ${mostViewed.genre ? `<span class="sn-hero-genre">${mostViewed.genre}</span>` : ""}
                <div class="sn-hero-glow"></div>
            </div>

            <div class="sn-pills-row">
                <div class="sn-pill">
                    <i data-lucide="library"></i>
                    <span class="sn-pill-val">${books.length}</span>
                    <span class="sn-pill-lbl">Books</span>
                </div>
                <div class="sn-pill sn-pill-accent" id="helped-pill">
                    <i data-lucide="heart-handshake"></i>
                    <span class="sn-pill-val" id="sn-helped-val">${globalHelpedCount}</span>
                    <span class="sn-pill-lbl" style="color: #10b981;">Helped</span>
                </div>
                <div class="sn-pill">
                    <i data-lucide="bookmark"></i>
                    <span class="sn-pill-val">${favorites.length}</span>
                    <span class="sn-pill-lbl">Saved</span>
                </div>
            </div>

            <div class="sn-two-col">
                <div class="sn-section sn-rating-section">
                    <div class="sn-section-label"><i data-lucide="star"></i> Rating</div>
                    <div class="sn-rating-num">${avg}<span>/5</span></div>
                    <div class="sn-rating-bar-track">
                        <div class="sn-rating-bar-fill" style="width:${avgPct}%"></div>
                    </div>
                    <p class="sn-rating-reviews">${ratings.length} review${ratings.length !== 1 ? "s" : ""}</p>
                </div>
                <div class="sn-section sn-new-section">
                    <div class="sn-section-label"><i data-lucide="sparkles"></i> New Arrival</div>
                    <div class="sn-new-badge-inline">NEW</div>
                    <h4 class="sn-new-title">${newest.title || "No Data"}</h4>
                    <p class="sn-new-author">${newest.author || ""}</p>
                </div>
            </div>

            <div class="sn-section sn-catalog-section">
                <div class="sn-section-label"><i data-lucide="layers"></i> Catalog Breakdown</div>
                <div class="sn-genre-list">
                    ${sortedGenres.map(([k, v]) => `
                        <div class="sn-genre-item">
                            <div class="sn-genre-top">
                                <span class="sn-genre-name">${k}</span>
                                <span class="sn-genre-count">${v} <span style="opacity:0.5">vol</span></span>
                            </div>
                            <div class="sn-genre-track">
                                <div class="sn-genre-fill" style="width:${Math.round((v/books.length)*100)}%; background:${getGenreStyle(k).color}; --bar-w:${Math.round((v/books.length)*100)}%;"></div>
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
            </div>`;

        // Re-wire close button after innerHTML rebuild
        statsBox.querySelector('.close-btn')?.addEventListener('click', () => { statsModal.style.display = 'none'; });
        renderIcons();

        // Animate the helped count since we now have the real live value
        const helpedEl = document.getElementById('sn-helped-val');
        if (helpedEl) animateCount(helpedEl, 0, globalHelpedCount, 800);

        setTimeout(() => {
            const heroViewsEl = document.querySelector('.sn-hero-views');
            if (heroViewsEl) animateCount(heroViewsEl, 0, mostViewed.views || 0, 1000);
            document.querySelectorAll('.sn-genre-fill').forEach((el, i) => {
                const styleAttr = el.getAttribute('style') || '';
                const match = styleAttr.match(/--bar-w:\s*([\d.]+%)/);
                const targetW = match ? match[1] : '100%';
                el.style.animation = 'none';
                el.offsetHeight;
                el.style.setProperty('--bar-w', targetW);
                el.style.animationDelay = (0.08 + i * 0.08) + 's';
                el.style.animationName = 'barGrow';
                el.style.animationDuration = '0.75s';
                el.style.animationTimingFunction = 'cubic-bezier(0.4,0,0.2,1)';
                el.style.animationFillMode = 'both';
            });
        }, 80);

        const updateUptime = () => {
            const diff = Date.now() - new Date("2026-01-01T00:00:00").getTime();
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            const el = document.getElementById("uptime-display");
            if (el) el.innerText = `${d}d ${h}h ${m}m ${s}s`;
        };
        if (uptimeInterval) clearInterval(uptimeInterval);
        updateUptime();
        uptimeInterval = setInterval(updateUptime, 1000);
    };

    document.getElementById('section-stats-btn')?.addEventListener('click', openStats);

    const openFeedback = () => {
        const feedbackModal = document.getElementById('feedback-modal');
        const feedbackBox = feedbackModal?.querySelector('.modal-box');
        if (!feedbackModal || !feedbackBox) return;
        const snapshot = feedbackBox.innerHTML;
        feedbackModal.style.display = 'flex';
        feedbackBox.innerHTML = `<div class="modal-loading-state"><div class="modal-loader-ring"></div><p>Loading...</p></div>`;
        setTimeout(() => {
            feedbackBox.innerHTML = snapshot;
            renderIcons();
            feedbackBox.querySelector('.close-btn')?.addEventListener('click', () => { feedbackModal.style.display = 'none'; });
        }, 500);
    };
    document.getElementById('section-feedback-btn')?.addEventListener('click', openFeedback);

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

    function launchConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.display = 'block';
        const pieces = Array.from({length: 80}, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * -canvas.height,
            r: Math.random() * 6 + 4,
            d: Math.random() * 3 + 1,
            color: ['#ff9eb5','#a78bfa','#4ade80','#fbbf24','#60a5fa','#fb923c'][Math.floor(Math.random()*6)],
            tilt: Math.random() * 10 - 5,
            tiltSpeed: Math.random() * 0.1 + 0.05
        }));
        let frame = 0;
        const draw = () => {
            if(frame > 120) { ctx.clearRect(0,0,canvas.width,canvas.height); canvas.style.display='none'; return; }
            ctx.clearRect(0,0,canvas.width,canvas.height);
            pieces.forEach(p => {
                p.y += p.d + 1;
                p.tilt += p.tiltSpeed;
                ctx.beginPath();
                ctx.fillStyle = p.color;
                ctx.ellipse(p.x + Math.sin(p.tilt)*10, p.y, p.r, p.r*0.5, p.tilt, 0, Math.PI*2);
                ctx.fill();
            });
            frame++;
            requestAnimationFrame(draw);
        };
        draw();
    }

    async function incrementHelpedCount() {
        try {
            // incrementHelped fetches current count fresh → adds 1 → PUTs back → returns new count
            const newCount = await LibraryDB.incrementHelped();
            const MILESTONES = [10, 25, 50, 100, 200, 500, 1000];
            if (MILESTONES.includes(newCount)) {
                setTimeout(() => showMilestoneToast(newCount), 2200);
            }
        } catch(e) {}
    }

    async function getHelpedCount() {
        try {
            return await LibraryDB.fetchHelpedCount();
        } catch(e) {}
        return 0;
    }

    function showMilestoneToast(count) {
        const toast = document.getElementById('toast-notification');
        if(!toast) return;
        toast.innerHTML = `<i data-lucide="party-popper"></i> <span>LibNav has helped ${count} students find their book! 🎉</span>`;
        toast.classList.add('show', 'toast-milestone');
        renderIcons();
        setTimeout(() => { toast.classList.remove('show', 'toast-milestone'); }, 5000);
    }



window.showSuccessScreen = function() {
    document.getElementById('book-modal').style.display = 'none';
    document.getElementById('success-modal').style.display = 'flex';
    if(navigator.vibrate) navigator.vibrate([50, 30, 100, 30, 200]);
    launchConfetti();
    incrementHelpedCount();
}
    
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

    window.addEventListener('online', () => document.getElementById('offline-banner').style.display = 'none');
    window.addEventListener('offline', () => document.getElementById('offline-banner').style.display = 'flex');
    if (!navigator.onLine) document.getElementById('offline-banner').style.display = 'flex';

    renderIcons();
    setTimeout(renderIcons, 200);
    setTimeout(renderIcons, 500);
    setTimeout(renderIcons, 1000);

    const openMaintBtn = document.getElementById('open-maint-view-btn');
    const closeMaintBtn = document.getElementById('close-maint-modal-btn');
    const maintModal = document.getElementById('admin-maint-modal');
    const maintSwitch = document.getElementById('maint-toggle-switch');
    const saveMaintBtn = document.getElementById('save-maint-btn');

    if (openMaintBtn && maintModal) {
        openMaintBtn.onclick = async () => {
            maintModal.style.display = 'flex';
            if (typeof LibraryDB.getMaintenance === 'function') {
                const currentMaint = await LibraryDB.getMaintenance();
                if(maintSwitch) maintSwitch.checked = currentMaint;
            }
        };
    }
    if (closeMaintBtn && maintModal) closeMaintBtn.onclick = () => maintModal.style.display = 'none';

    if (saveMaintBtn) {
        saveMaintBtn.onclick = async () => {
            if (typeof LibraryDB.setMaintenance !== 'function') return showPopup("Error", "Database update missing.", null, false);
            const newState = maintSwitch ? maintSwitch.checked : false;
            await LibraryDB.setMaintenance(newState);
            showPopup("System Control", `Maintenance Mode is now ${newState ? 'ON' : 'OFF'}.`, null, false);
            if (maintModal) maintModal.style.display = 'none';
        };
    }

    const openBcBtn = document.getElementById('open-broadcast-view-btn');
    const closeBcBtn = document.getElementById('close-broadcast-admin-btn');
    const sendBcBtn = document.getElementById('send-broadcast-btn');
    const clearBcBtn = document.getElementById('clear-broadcast-btn');
    const adminBcView = document.getElementById('admin-broadcast-view');

    if (openBcBtn && adminBcView) openBcBtn.onclick = () => adminBcView.style.display = 'flex';
    if (closeBcBtn && adminBcView) closeBcBtn.onclick = () => adminBcView.style.display = 'none';

    if (sendBcBtn) {
        sendBcBtn.onclick = async () => {
            const t = document.getElementById('bc-title')?.value.trim();
            const m = document.getElementById('bc-msg')?.value.trim();
            const theme = document.getElementById('bc-theme')?.value;
            if(!t || !m) return showPopup("Error", "Fill out both fields.", null, false);
            if (typeof LibraryDB.setBroadcast !== 'function') return showPopup("Error", "Database update missing.", null, false);

            const bcObj = { id: 'bc_' + Date.now(), title: t, message: m, theme: theme };
            await LibraryDB.setBroadcast(bcObj);
            showPopup("Success", "Broadcast sent to all users!", null, false);
            if (adminBcView) adminBcView.style.display = 'none';
        };
    }

    if (clearBcBtn) {
        clearBcBtn.onclick = async () => {
            if (typeof LibraryDB.setBroadcast !== 'function') return;
            await LibraryDB.setBroadcast(null);
            showPopup("Cleared", "Active broadcast removed.", null, false);
            if (adminBcView) adminBcView.style.display = 'none';
        };
    }

    function startMaintClock() {
        const el = document.getElementById('maint-live-clock');
        if (!el) return;
        const tick = () => {
            const now = new Date();
            el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        };
        tick();
        setInterval(tick, 1000);
    }

    setTimeout(async () => {
        if (typeof LibraryDB.getMaintenance === 'function') {
            const isMaint = await LibraryDB.getMaintenance();
            const savedToken = localStorage.getItem('libnav_admin_token');
            const isVIP = await LibraryDB.verifyAdminSession(savedToken);
            if (isMaint && !isVIP) {
                const maintOverlay = document.getElementById('maintenance-overlay');
                if (maintOverlay) {
                    maintOverlay.style.display = 'flex';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    startMaintClock();
                }
                return;
            }
        }

        if (typeof LibraryDB.getBroadcast === 'function') {
            const activeBc = await LibraryDB.getBroadcast();
            if (activeBc && activeBc.id) {
                const seenBc = localStorage.getItem('libnav_seen_broadcast');
                if (seenBc !== activeBc.id) {
                    const ubModal = document.getElementById('user-broadcast-modal');
                    if (ubModal) {
                        const box = ubModal.querySelector('.modal-box');
                        const iconWrap = ubModal.querySelector('.welcome-icon-wrap');
                        box.className = `modal-box broadcast-layout theme-${activeBc.theme || 'info'}`;
                        let iconStr = 'bell-ring';
                        if(activeBc.theme === 'success') iconStr = 'check-circle';
                        if(activeBc.theme === 'warning') iconStr = 'alert-triangle';
                        if(activeBc.theme === 'alert') iconStr = 'shield-alert';
                        iconWrap.innerHTML = `<i data-lucide="${iconStr}"></i>`;
                        if(typeof lucide !== 'undefined') lucide.createIcons();
                        const titleEl = document.getElementById('ub-title');
                        const msgEl = document.getElementById('ub-msg');
                        if (titleEl) titleEl.innerText = activeBc.title;
                        if (msgEl) msgEl.innerText = activeBc.message;
                        ubModal.style.display = 'flex';
                        const gotItBtn = document.getElementById('ub-got-it-btn');
                        if (gotItBtn) {
                            gotItBtn.onclick = () => {
                                localStorage.setItem('libnav_seen_broadcast', activeBc.id);
                                ubModal.style.display = 'none';
                            };
                        }
                    }
                }
            }
        }
    }, 1500);

    const zoomImageElement = document.getElementById('zoomed-image');
    const zoomModalContainer = document.getElementById('zoom-modal');

    let zScale = 1, zP1x = 0, zP1y = 0, zP2x = 0, zP2y = 0;
    let zStartX = 0, zStartY = 0, zX = 0, zY = 0;
    let zIsDragging = false;
    let zLastTapTime = 0;

    if (zoomImageElement && zoomModalContainer) {
        zoomModalContainer.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        zoomImageElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                zIsDragging = true;
                zStartX = e.touches[0].clientX - zX;
                zStartY = e.touches[0].clientY - zY;
            } else if (e.touches.length === 2) {
                zIsDragging = false;
                zP1x = e.touches[0].clientX; zP1y = e.touches[0].clientY;
                zP2x = e.touches[1].clientX; zP2y = e.touches[1].clientY;
            }
        }, { passive: false });

        zoomImageElement.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && zIsDragging) {
                zX = e.touches[0].clientX - zStartX;
                zY = e.touches[0].clientY - zStartY;
                zoomImageElement.style.transform = `translate(${zX}px, ${zY}px) scale(${zScale})`;
            } else if (e.touches.length === 2) {
                const zCurrentP1x = e.touches[0].clientX, zCurrentP1y = e.touches[0].clientY;
                const zCurrentP2x = e.touches[1].clientX, zCurrentP2y = e.touches[1].clientY;

                const startDist = Math.hypot(zP1x - zP2x, zP1y - zP2y);
                const currentDist = Math.hypot(zCurrentP1x - zCurrentP2x, zCurrentP1y - zCurrentP2y);

                const distanceChange = currentDist - startDist;
                zScale = Math.min(Math.max(1, zScale + (distanceChange * 0.01)), 4);

                zoomImageElement.style.transform = `translate(${zX}px, ${zY}px) scale(${zScale})`;

                zP1x = zCurrentP1x; zP1y = zCurrentP1y;
                zP2x = zCurrentP2x; zP2y = zCurrentP2y;
            }
        }, { passive: false });

        zoomImageElement.addEventListener('touchend', (e) => {
            zIsDragging = false;

            const currentTime = new Date().getTime();
            const tapLength = currentTime - zLastTapTime;

            if (tapLength < 300 && tapLength > 0 && e.changedTouches.length === 1) {
                if (zScale > 1) {
                    resetFullScreenZoom();
                } else {
                    zScale = 2.5;
                    zoomImageElement.style.transform = `translate(0px, 0px) scale(${zScale})`;
                }
                e.preventDefault();
            }
            zLastTapTime = currentTime;
        });
    }

    const resetFullScreenZoom = () => {
        zScale = 1; zX = 0; zY = 0;
        if(zoomImageElement) zoomImageElement.style.transform = `translate(0px, 0px) scale(1)`;
    };

    const welcomeModal = document.getElementById('welcome-modal');
    const startLibnavBtn = document.getElementById('start-libnav-btn');
    if (welcomeModal && !localStorage.getItem('libnav_onboarded')) {
        setTimeout(() => { welcomeModal.style.display = 'flex'; }, 1000);
    }
    if (startLibnavBtn) {
        startLibnavBtn.onclick = () => {
            const neverShowCheck = document.getElementById('never-show-welcome');
            if (neverShowCheck && neverShowCheck.checked) {
                localStorage.setItem('libnav_onboarded', 'true');
            }
            if(welcomeModal) welcomeModal.style.display = 'none';
        };
    }

    init();
});
