const CACHE_NAME = 'liferpg-nexus-v3';
const ASSETS = [
  '/life-rpg/index.html',
  '/life-rpg/manifest.json'
];

// Установка кэша
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// Активация и чистка старого мусора (ошибок из прошлых версий)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Умный перехват трафика: сначала Сеть (чтобы получать обновы), потом Кэш
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
