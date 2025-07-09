const CACHE_NAME = 'battleship-game-cache-v1';
// キャッシュするファイルのリスト
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './hit.mp3',
  './sunk.mp3',
  './bgm.mp3',
  './title.mp3',
  './icon-192.png',
  './icon-512.png'
];

// インストール時にキャッシュを作成する
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// リクエストがあった場合にキャッシュから返す
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // キャッシュにあればそれを返す
        if (response) {
          return response;
        }
        // なければネットワークから取得
        return fetch(event.request);
      })
  );
});
