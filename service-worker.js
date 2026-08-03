/* タイ語単語帳 PWA Service Worker
   単一HTMLアプリなので、初回アクセス時に本体をキャッシュし、
   以降はオフラインでも起動できるようにする(約4MBを1回だけダウンロード)。

   更新時の考え方: CACHE_VERSION を上げると古いキャッシュを破棄して取り直す。
   語彙データやUIを更新して index_v6.4.html を差し替えたら、必ずここも上げること。 */
const CACHE_VERSION = 'thai-vocab-v6.4.0';
const CORE_ASSETS = [
  './',
  './index_v6.4.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS).catch(() => {
        // 一部アセット(アイコン等)が無くてもインストールは継続させる
        return cache.addAll(['./index_v6.4.html']);
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 同一オリジンのみ扱う(Googleフォント等はブラウザ標準キャッシュに任せる)
  if (url.origin !== self.location.origin) return;

  // HTMLはネットワーク優先(更新をすぐ反映) → 失敗時キャッシュ
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index_v6.4.html')))
    );
    return;
  }

  // その他(アイコン・JSON等)はキャッシュ優先
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => cached))
  );
});
