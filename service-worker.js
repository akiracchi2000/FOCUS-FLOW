const CACHE_NAME = 'focus-flow-v1.5.7';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css?v=1.5.7',
    './app.js?v=1.5.7',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
    'https://unpkg.com/@phosphor-icons/web'
];

// Install Event - Cache Assets
self.addEventListener('install', (event) => {
    // Force new service worker to activate immediately similar to "skip waiting"
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching all assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Fetch Event - Serve from Cache if available, else Network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true })
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// Activate Event - Cleanup old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});
