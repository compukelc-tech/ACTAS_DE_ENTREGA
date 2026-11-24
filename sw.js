/**
 * ============================================================================
 * SISTEMA DE ACTAS DE ENTREGA E INVENTARIO (CÓD. GA-R26) - SERVICE WORKER
 * Desarrollado por compukelc | Control automático de caché PWA
 * ============================================================================
 */

const CACHE_VERSION = 'ga-r26-cache-v1.0.0';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/config.js',
  './js/forms.js',
  './js/scanner.js',
  './js/pdf-builder.js',
  './js/app.js'
];

/* === SECCIÓN 1: INSTALACIÓN Y ACTIVACIÓN INMEDIATA === */
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

/* === SECCIÓN 2: ESTRATEGIA NETWORK-FIRST (SIEMPRE ÚLTIMA VERSIÓN EN GITHUB) === */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // No interceptar peticiones POST ni llamadas a Google Apps Script / APIs externas
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
