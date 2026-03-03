const CACHE_NAME = 'libnav-v3';
const ASSETS = ['/', '/index.html', '/app.js', '/database.js', '/style.css', '/manifest.json'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
    }).catch(() => cached)));
});

self.addEventListener('push', e => {
    if (!e.data) return;
    let data = {};
    try { data = e.data.json(); } catch(_) { data = { title: 'LibNav', body: e.data.text() }; }
    e.waitUntil(self.registration.showNotification(data.title || 'LibNav', {
        body: data.body || '',
        icon: 'https://i.imgur.com/gmJh9bn.jpe',
        badge: 'https://i.imgur.com/gmJh9bn.jpe',
        tag: 'libnav-broadcast',
        renotify: true,
        data: { url: data.url || '/' }
    }));
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
        const match = cs.find(c => c.url.includes(self.location.origin) && 'focus' in c);
        if (match) return match.focus();
        if (clients.openWindow) return clients.openWindow(e.notification.data?.url || '/');
    }));
});
