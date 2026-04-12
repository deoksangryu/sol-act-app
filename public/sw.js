const CACHE_NAME = 'sol-act-v4';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never cache API requests or WebSocket upgrades
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return;

  // Static assets (JS/CSS/images): stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);  // network error: fall back to cache

      // Return cached immediately if available, update in background
      return cached || fetchPromise;
    })
  );
});

// --- Web Push Notifications ---
self.addEventListener('push', (event) => {
  let data = { title: 'SOL-ACT', body: '새 알림이 있습니다.' };
  try {
    if (event.data) data = event.data.json();
  } catch (_) {
    // use defaults
  }
  const tag = data.tag || 'general';
  event.waitUntil(
    self.registration.showNotification(data.title || 'SOL-ACT', {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
      tag: tag,
      renotify: true,
      data: { url: '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
