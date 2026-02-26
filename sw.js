const CACHE_NAME = "salespro-v4";
const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Caching app shell");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("Deleting old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Navigation requests (SPA shell) -> try network, fallback to cached index.html
  if (event.request.mode === 'navigate' ||
      (event.request.method === 'GET' && event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request).then(res => {
        // Put a clone in cache
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('/index.html', resClone)).catch(()=>{});
        return res;
      }).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // For other requests: cache-first, then network fallback and update cache
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Only cache successful GET responses from same-origin (avoid CORS issues)
        if (event.request.method === 'GET' && response && response.status === 200 && response.type !== 'opaque') {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone()).catch(() => {});
          });
        }
        return response;
      }).catch(() => {
        // Nothing else to do — let it fail (for external resources like CDNs we don't force caching)
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});