const CACHE_NAME = 'battleship-game-cache-v2'; // キャッシュのバージョンを更新
// ★修正：キャッシュするファイルのリストを現状に合わせる
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './hit.mp3',
  './sunk.mp3',
  './bgm.mp3'// 正しいファイル名に変更
  // './icon-192.png', // 存在しないため削除
  // './icon-512.png'  // 存在しないため削除
];

// インストール時にキャッシュを作成する
self.addEventListener('install', event => {
  // 古いキャッシュが残っている場合に、新しいService Workerをすぐに有効にする
  self.skipWaiting(); 
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 新しいService Workerが有効になったときに、古いキャッシュを削除する
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
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
        // キャッシュにあればそれを返す
        if (response) {
          return response;
        }
        // なければネットワークから取得
        return fetch(event.request);
      })
  );
});