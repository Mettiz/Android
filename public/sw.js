// Clean Service Worker for ShiftFlow PWA (With OS Notifications & Background Sync)
try {
  importScripts('/sw-notif-handler.js');
} catch (e) {
  // Fallback if importScripts fails
}

const CACHE_NAME = 'shiftflow-pwa-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
});
