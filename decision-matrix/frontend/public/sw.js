/** SPA shell for GitHub Pages — network-first HTML so deploys never 404 hashed assets. */
const CACHE = 'sppr-shell-v6';

const PRECACHE = ['./manifest.webmanifest', './pwa-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

function isNavigationRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

/** GitHub Pages returns HTTP 404 for SPA routes; fetch the shell document, not the path. */
async function networkFirstShell() {
  const shellUrls = ['./index.html', './404.html'];
  for (const shellPath of shellUrls) {
    try {
      const response = await fetch(shellPath, { cache: 'no-cache' });
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put('./index.html', response.clone());
        return response;
      }
    } catch {
      /* try next shell URL */
    }
  }
  const cached = await caches.match('./index.html');
  if (cached) return cached;
  return caches.match('./404.html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.includes('/api/')) return;

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirstShell());
    return;
  }

  const isHashedBundle =
    url.pathname.includes('/assets/') || url.pathname.includes('/map3d-models/');
  if (isHashedBundle) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
