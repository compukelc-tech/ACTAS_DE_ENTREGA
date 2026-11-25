/**
 * ============================================================================
 * SISTEMA DE ACTAS DE ENTREGA E INVENTARIO (CÓD. GA-R26) - SERVICE WORKER
 * Desarrollado por compukelc | Control automático de caché PWA v1.0.4
 * ============================================================================
 */

const CACHE_VERSION = 'ga-r26-cache-v1.0.4';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/styles.css',
  './js/config.js',
  './js/forms.js',
  './js/scanner.js',
  './js/pdf-builder.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((oldCache) => caches.delete(oldCache))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET' || req.url.includes('script.google.com') || req.url.includes('googleusercontent.com')) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && req.url.startsWith(self.location.origin)) {
          const clone = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(req))
  );
});
