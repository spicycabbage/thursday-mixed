const CACHE = 'thursday-mixed-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const upgraded = keys.some((key) => key !== CACHE);
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
      if (!upgraded) return;

      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(
        windows.map((client) => (client.navigate ? client.navigate(client.url) : undefined))
      );
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(event, request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icon-') ||
    pathname.startsWith('/apple-touch-') ||
    pathname === '/manifest.json' ||
    pathname === '/favicon-32.png'
  );
}

function freshGet(url) {
  return fetch(url, { cache: 'no-store', credentials: 'same-origin', redirect: 'follow' });
}

function refreshDocument(cache, request) {
  return fetch(request.url, {
    cache: 'no-store',
    credentials: 'same-origin',
    redirect: 'follow',
  })
    .then(async (response) => {
      if (response.ok && !response.redirected) {
        await cache.put(request.url, response.clone());
      }
      return response;
    })
    .catch(() => null);
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request.url);
  const refresh = refreshDocument(cache, request);

  if (cached) {
    event.waitUntil(refresh.then(() => undefined));
    return cached;
  }

  const response = await refresh;
  if (response) return response;
  return (await cache.match('/')) || Response.error();
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await freshGet(request.url);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
