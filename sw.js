const CACHE_NAME = 'liferpg-nexus-v4';

// Установка: не ждем, активируем сразу
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Активация: Убиваем абсолютно все старые кэши, чтобы не было белых экранов
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => caches.delete(cache))
      );
    })
  );
  self.clients.claim();
});

// Запрос сети: Всегда идем в интернет за свежим кодом
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
