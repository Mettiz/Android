// Clean Service Worker for ShiftFlow PWA v4.0.0 (With OS Notifications & Background Sync)
try {
  importScripts('/sw-notif-handler.js');
} catch (e) {
  // Fallback if importScripts fails
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
});
