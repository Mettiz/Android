// Clean Service Worker for ShiftFlow PWA (No WebSocket / HMR dependencies)
const CACHE_NAME = 'shiftflow-pwa-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through network-first strategy for dev/preview stability
  if (event.request.method !== 'GET') return;
});
