// ★キャッシュ名を変更して、強制的に新しいものを使わせる
const CACHE_NAME = 'battleship-game-cache-v3'; 
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './hit.mp3',
  './sunk.mp3',
  './bgm.mp3'
];

// インストール時にキャッシュを作成する
self.addEventListener('install', event => {
  console.log('[Service Worker] Install event in progress.');
  self.skipWaiting(); 
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching files:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Caching failed:', error);
      })
  );
});

// 新しいService Workerが有効になったときに、古いキャッシュを削除する
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate event in progress.');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// リクエストがあった場合にキャッシュから返す
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // console.log('[Service Worker] Found in cache:', event.request.url);
          return response;
        }
        // console.log('[Service Worker] Network request for:', event.request.url);
        return fetch(event.request);
      })
  );
});