const CACHE = 'sppr-shell-v4';

function indexResponse() {
  return caches.match('./index.html').then((cached) => {
    if (cached) return cached;
    return caches.match('./404.html');
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache
        .addAll(['./', './index.html', './404.html', './manifest.webmanifest', './pwa-icon.svg'])
        .catch(() => cache.addAll(['./', './index.html', './manifest.webmanifest', './pwa-icon.svg']))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isNavigationRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.includes('/api/')) return;

  const navigate = isNavigationRequest(request);

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (navigate && !response.ok) {
          return indexResponse().then((shell) => shell || response);
        }
        const isHashedBundle =
          url.pathname.includes('/assets/') || url.pathname.includes('/map3d-models/');
        if (response.ok && url.origin === self.location.origin && !isHashedBundle && !navigate) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => {
        if (navigate) {
          return indexResponse();
        }
        return caches.match(request).then((cached) => cached || indexResponse());
      })
  );
});
